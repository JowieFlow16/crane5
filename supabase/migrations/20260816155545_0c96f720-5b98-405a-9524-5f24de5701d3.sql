-- 1. Daily reward claims ledger
CREATE TABLE IF NOT EXISTS public.daily_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  claim_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Kampala')::date,
  amount integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, claim_date)
);
GRANT SELECT ON public.daily_reward_claims TO authenticated;
GRANT ALL ON public.daily_reward_claims TO service_role;
ALTER TABLE public.daily_reward_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own reward claims" ON public.daily_reward_claims;
CREATE POLICY "Own reward claims" ON public.daily_reward_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'quick_quiz',
  subject text,
  class_level text,
  difficulty text NOT NULL DEFAULT 'medium',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  seconds_per_question integer NOT NULL DEFAULT 30,
  prize_credits integer NOT NULL DEFAULT 10,
  prize_xp integer NOT NULL DEFAULT 100,
  winners_count integer NOT NULL DEFAULT 5,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  published boolean NOT NULL DEFAULT true,
  finalized_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Published tournaments readable" ON public.tournaments;
CREATE POLICY "Published tournaments readable" ON public.tournaments
  FOR SELECT TO authenticated USING (published OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage tournaments" ON public.tournaments;
CREATE POLICY "Admins manage tournaments" ON public.tournaments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS tournaments_window_idx ON public.tournaments(starts_at, ends_at);

-- 3. Entries / standings
CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  class_level text,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  time_ms integer NOT NULL DEFAULT 0,
  finished_at timestamptz,
  rank integer,
  awarded_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Standings readable" ON public.tournament_entries;
CREATE POLICY "Standings readable" ON public.tournament_entries
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS tournament_entries_rank_idx
  ON public.tournament_entries(tournament_id, score DESC, time_ms ASC);

-- 4. Internal: grant bonus AI credits for today
CREATE OR REPLACE FUNCTION public.add_bonus_requests(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
BEGIN
  INSERT INTO public.ai_usage (user_id, last_reset_date)
  VALUES (p_user_id, today)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ai_usage
     SET bonus_requests = CASE WHEN last_reset_date = today
                               THEN bonus_requests + p_amount ELSE p_amount END,
         requests_today = CASE WHEN last_reset_date = today THEN requests_today ELSE 0 END,
         images_today   = CASE WHEN last_reset_date = today THEN images_today ELSE 0 END,
         last_reset_date = today,
         updated_at = now()
   WHERE user_id = p_user_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.add_bonus_requests(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_bonus_requests(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.add_bonus_requests(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_bonus_requests(uuid, integer) TO service_role;

-- 5. Internal: award XP to any user, syncing the leaderboard
CREATE OR REPLACE FUNCTION public.add_xp_for(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE st public.user_stats;
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_stats
     SET xp = xp + p_amount,
         level = GREATEST(1, floor((xp + p_amount) / 500.0)::int + 1),
         updated_at = now()
   WHERE user_id = p_user_id
  RETURNING * INTO st;

  INSERT INTO public.leaderboard (user_id, full_name, avatar_url, class_level, xp, level, current_streak, updated_at)
  SELECT p.id, p.full_name, p.avatar_url, p.class_level::text, st.xp, st.level, st.current_streak, now()
    FROM public.profiles p WHERE p.id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET xp = EXCLUDED.xp, level = EXCLUDED.level,
        current_streak = EXCLUDED.current_streak,
        full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url,
        class_level = EXCLUDED.class_level, updated_at = now();
END;
$fn$;
REVOKE ALL ON FUNCTION public.add_xp_for(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_xp_for(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.add_xp_for(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp_for(uuid, integer) TO service_role;

-- 6. Daily +10 credits for the leaderboard top 5
CREATE OR REPLACE FUNCTION public.claim_top_rank_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  my_rank integer;
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.rn INTO my_rank FROM (
    SELECT user_id, row_number() OVER (ORDER BY xp DESC, current_streak DESC, updated_at ASC) AS rn
      FROM public.leaderboard WHERE xp > 0
  ) r WHERE r.user_id = uid;

  IF my_rank IS NULL OR my_rank > 5 THEN
    RETURN jsonb_build_object('granted', false, 'rank', my_rank, 'reason', 'not_top_5');
  END IF;

  SELECT true INTO already FROM public.daily_reward_claims
   WHERE user_id = uid AND kind = 'top_rank' AND claim_date = today;
  IF already THEN
    RETURN jsonb_build_object('granted', false, 'rank', my_rank, 'reason', 'already_claimed');
  END IF;

  INSERT INTO public.daily_reward_claims (user_id, kind, claim_date, amount, meta)
  VALUES (uid, 'top_rank', today, 10, jsonb_build_object('rank', my_rank));

  PERFORM public.add_bonus_requests(uid, 10);
  RETURN jsonb_build_object('granted', true, 'rank', my_rank, 'amount', 10);
END;
$fn$;
REVOKE ALL ON FUNCTION public.claim_top_rank_bonus() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_top_rank_bonus() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_top_rank_bonus() TO authenticated;

-- 7. Submit a tournament result while it is live
CREATE OR REPLACE FUNCTION public.submit_tournament_entry(
  p_tournament_id uuid, p_score integer, p_total integer, p_time_ms integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  t public.tournaments;
  prof record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id AND published;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF now() < t.starts_at THEN RAISE EXCEPTION 'This tournament has not started yet'; END IF;
  IF now() > t.ends_at THEN RAISE EXCEPTION 'This tournament has already ended'; END IF;

  SELECT full_name, avatar_url, class_level::text AS class_level INTO prof
    FROM public.profiles WHERE id = uid;

  INSERT INTO public.tournament_entries
    (tournament_id, user_id, display_name, avatar_url, class_level, score, total, time_ms, finished_at)
  VALUES (p_tournament_id, uid, prof.full_name, prof.avatar_url, prof.class_level,
          GREATEST(p_score, 0), GREATEST(p_total, 0), GREATEST(p_time_ms, 0), now())
  ON CONFLICT (tournament_id, user_id) DO UPDATE
    SET score = GREATEST(tournament_entries.score, EXCLUDED.score),
        total = EXCLUDED.total,
        time_ms = CASE WHEN EXCLUDED.score > tournament_entries.score
                       THEN EXCLUDED.time_ms
                       ELSE LEAST(tournament_entries.time_ms, EXCLUDED.time_ms) END,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        class_level = EXCLUDED.class_level,
        finished_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.submit_tournament_entry(uuid, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_tournament_entry(uuid, integer, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_tournament_entry(uuid, integer, integer, integer) TO authenticated;

-- 8. Finalize an ended tournament and reward winners
CREATE OR REPLACE FUNCTION public.finalize_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  t public.tournaments;
  w record;
  rewarded integer := 0;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF now() < t.ends_at THEN RETURN jsonb_build_object('ok', false, 'reason', 'still_running'); END IF;
  IF t.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_finalized');
  END IF;

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY score DESC, time_ms ASC, finished_at ASC) AS rn
      FROM public.tournament_entries WHERE tournament_id = p_tournament_id
  )
  UPDATE public.tournament_entries e
     SET rank = ranked.rn
    FROM ranked WHERE e.id = ranked.id;

  FOR w IN
    SELECT user_id, rank FROM public.tournament_entries
     WHERE tournament_id = p_tournament_id AND rank IS NOT NULL AND rank <= t.winners_count
     ORDER BY rank
  LOOP
    PERFORM public.add_bonus_requests(w.user_id, t.prize_credits);
    PERFORM public.add_xp_for(w.user_id, t.prize_xp);
    UPDATE public.tournament_entries
       SET awarded_credits = t.prize_credits
     WHERE tournament_id = p_tournament_id AND user_id = w.user_id;
    rewarded := rewarded + 1;
  END LOOP;

  UPDATE public.tournaments SET finalized_at = now(), updated_at = now() WHERE id = p_tournament_id;
  RETURN jsonb_build_object('ok', true, 'rewarded', rewarded);
END;
$fn$;
REVOKE ALL ON FUNCTION public.finalize_tournament(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_tournament(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_tournament(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_tournament(uuid) TO service_role;