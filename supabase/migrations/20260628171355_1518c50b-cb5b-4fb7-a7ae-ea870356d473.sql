
CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer)
RETURNS public.user_stats
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
    RETURN rec;
  END IF;

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

  RETURN rec;
END;
$$;
GRANT EXECUTE ON FUNCTION public.award_xp(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_n integer DEFAULT 20)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, class_level text, xp integer, level integer, current_streak integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.user_id, p.full_name, p.avatar_url, p.class_level::text, s.xp, s.level, s.current_streak
  FROM public.user_stats s
  JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.xp DESC, s.current_streak DESC
  LIMIT GREATEST(1, LEAST(COALESCE(limit_n, 20), 100));
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;
