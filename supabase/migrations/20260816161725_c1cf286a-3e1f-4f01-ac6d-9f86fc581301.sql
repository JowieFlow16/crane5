-- 1. Realtime for chat
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- 2. Blocking
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blocks: owner read" ON public.user_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Blocks: owner insert" ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);
CREATE POLICY "Blocks: owner delete" ON public.user_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- 3. Reports / moderation queue
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('message','conversation','post','comment','user')),
  target_id uuid,
  reason text not null,
  details text,
  excerpt text,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports(status, created_at DESC);
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reports: reporter or admin read" ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Reports: reporter insert" ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reports: admin update" ON public.content_reports FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 4. Block enforcement on new messages
CREATE OR REPLACE FUNCTION public.enforce_dm_not_blocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE (blocker_id = NEW.recipient_id AND blocked_id = NEW.sender_id)
        OR (blocker_id = NEW.sender_id AND blocked_id = NEW.recipient_id)
  ) THEN
    RAISE EXCEPTION 'This conversation is blocked';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS dm_block_guard ON public.direct_messages;
CREATE TRIGGER dm_block_guard BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_not_blocked();

-- 5. Once-per-day top-5 claim (race-safe)
CREATE OR REPLACE FUNCTION public.claim_top_rank_bonus()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  my_rank integer;
  inserted_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- one claim attempt at a time per user
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || ':top_rank', 0));

  SELECT r.rn INTO my_rank FROM (
    SELECT user_id, row_number() OVER (ORDER BY xp DESC, current_streak DESC, updated_at ASC) AS rn
      FROM public.leaderboard WHERE xp > 0
  ) r WHERE r.user_id = uid;

  IF my_rank IS NULL OR my_rank > 5 THEN
    RETURN jsonb_build_object('granted', false, 'rank', my_rank, 'reason', 'not_top_5');
  END IF;

  INSERT INTO public.daily_reward_claims (user_id, kind, claim_date, amount, meta)
  VALUES (uid, 'top_rank', today, 10, jsonb_build_object('rank', my_rank))
  ON CONFLICT (user_id, kind, claim_date) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'rank', my_rank, 'reason', 'already_claimed');
  END IF;

  PERFORM public.add_bonus_requests(uid, 10);
  RETURN jsonb_build_object('granted', true, 'rank', my_rank, 'amount', 10);
END;
$$;

-- 6. Tournament prizes awarded exactly once per user per tournament
CREATE OR REPLACE FUNCTION public.finalize_tournament(p_tournament_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.tournaments;
  w record;
  rewarded integer := 0;
  claim_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('finalize_tournament:' || p_tournament_id::text, 0));

  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
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
    -- idempotent ledger row: one prize per user per tournament
    INSERT INTO public.daily_reward_claims (user_id, kind, claim_date, amount, meta)
    VALUES (w.user_id, 'tournament:' || p_tournament_id::text,
            (now() AT TIME ZONE 'Africa/Kampala')::date, t.prize_credits,
            jsonb_build_object('tournament_id', p_tournament_id, 'rank', w.rank))
    ON CONFLICT (user_id, kind, claim_date) DO NOTHING
    RETURNING id INTO claim_id;

    IF claim_id IS NOT NULL THEN
      PERFORM public.add_bonus_requests(w.user_id, t.prize_credits);
      PERFORM public.add_xp_for(w.user_id, t.prize_xp);
      UPDATE public.tournament_entries
         SET awarded_credits = t.prize_credits
       WHERE tournament_id = p_tournament_id AND user_id = w.user_id;
      rewarded := rewarded + 1;
    END IF;
    claim_id := NULL;
  END LOOP;

  UPDATE public.tournaments SET finalized_at = now(), updated_at = now() WHERE id = p_tournament_id;
  RETURN jsonb_build_object('ok', true, 'rewarded', rewarded);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_top_rank_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_top_rank_bonus() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_tournament(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_dm_not_blocked() FROM PUBLIC, anon, authenticated;