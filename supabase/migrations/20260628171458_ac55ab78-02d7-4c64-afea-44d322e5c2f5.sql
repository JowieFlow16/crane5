
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);
DROP FUNCTION IF EXISTS public.award_xp(integer);

CREATE TABLE IF NOT EXISTS public.leaderboard (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  class_level text,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaderboard TO authenticated;
GRANT ALL ON public.leaderboard TO service_role;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard readable by authenticated" ON public.leaderboard FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own leaderboard row" ON public.leaderboard FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own leaderboard row" ON public.leaderboard FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer)
RETURNS public.user_stats
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.user_stats;
  add_xp integer := GREATEST(COALESCE(p_amount, 0), 0);
  new_streak integer;
  new_xp integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO rec FROM public.user_stats WHERE user_id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.user_stats(user_id, xp, level, current_streak, longest_streak, last_active)
    VALUES (uid, add_xp, GREATEST(1, floor(add_xp / 200.0)::int + 1), 1, 1, current_date)
    RETURNING * INTO rec;
  ELSE
    IF rec.last_active = current_date THEN
      new_streak := rec.current_streak;
    ELSIF rec.last_active = current_date - 1 THEN
      new_streak := rec.current_streak + 1;
    ELSE
      new_streak := 1;
    END IF;

    new_xp := rec.xp + add_xp;

    UPDATE public.user_stats
      SET xp = new_xp,
          level = GREATEST(1, floor(new_xp / 200.0)::int + 1),
          current_streak = new_streak,
          longest_streak = GREATEST(rec.longest_streak, new_streak),
          last_active = current_date
      WHERE user_id = uid
      RETURNING * INTO rec;
  END IF;

  INSERT INTO public.leaderboard(user_id, full_name, avatar_url, class_level, xp, level, current_streak)
  SELECT uid, p.full_name, p.avatar_url, p.class_level::text, rec.xp, rec.level, rec.current_streak
  FROM public.profiles p WHERE p.id = uid
  ON CONFLICT (user_id) DO UPDATE
    SET xp = EXCLUDED.xp,
        level = EXCLUDED.level,
        current_streak = EXCLUDED.current_streak,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        class_level = EXCLUDED.class_level,
        updated_at = now();

  RETURN rec;
END;
$$;
GRANT EXECUTE ON FUNCTION public.award_xp(integer) TO authenticated;
