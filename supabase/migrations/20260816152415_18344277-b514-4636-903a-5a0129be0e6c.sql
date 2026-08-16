-- 1. Onboarding fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- 2. Revision timetable
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject text NOT NULL,
  topic text,
  activity text NOT NULL DEFAULT 'Revision',
  reminder_minutes integer NOT NULL DEFAULT 10,
  reminders_on boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own timetable" ON public.timetable_slots;
CREATE POLICY "Own timetable" ON public.timetable_slots FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS timetable_slots_user_idx ON public.timetable_slots(user_id, day_of_week, start_time);

-- 3. Share-to-earn credits
CREATE TABLE IF NOT EXISTS public.referral_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'link',
  share_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Kampala')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_shares TO authenticated;
GRANT ALL ON public.referral_shares TO service_role;
ALTER TABLE public.referral_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own shares" ON public.referral_shares;
CREATE POLICY "Own shares" ON public.referral_shares FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Log own shares" ON public.referral_shares;
CREATE POLICY "Log own shares" ON public.referral_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS referral_shares_user_day_idx ON public.referral_shares(user_id, share_date);

ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS bonus_requests integer NOT NULL DEFAULT 0;

-- 4. Quota consumption now includes earned bonus allowance
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid, p_kind text DEFAULT 'request'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  lim record;
  rec public.ai_usage;
  used integer;
  cap integer;
BEGIN
  SELECT * INTO lim FROM public.ai_effective_limits(p_user_id);

  INSERT INTO public.ai_usage (user_id, last_reset_date)
  VALUES (p_user_id, today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO rec FROM public.ai_usage WHERE user_id = p_user_id FOR UPDATE;

  IF rec.last_reset_date <> today THEN
    UPDATE public.ai_usage
      SET requests_today = 0, successful_requests = 0, failed_requests = 0,
          images_today = 0, bonus_requests = 0, last_reset_date = today, updated_at = now()
      WHERE user_id = p_user_id
      RETURNING * INTO rec;
  END IF;

  IF p_kind = 'image' THEN
    used := rec.images_today; cap := lim.daily_images;
  ELSE
    used := rec.requests_today; cap := lim.daily_requests + COALESCE(rec.bonus_requests, 0);
  END IF;

  IF NOT lim.unlimited AND used >= cap THEN
    RETURN jsonb_build_object(
      'allowed', false, 'kind', p_kind, 'used', used, 'limit', cap,
      'unlimited', false, 'plan', lim.plan_name,
      'resets_at', ((today + 1)::timestamp AT TIME ZONE 'Africa/Kampala')
    );
  END IF;

  UPDATE public.ai_usage
    SET requests_today = requests_today + CASE WHEN p_kind = 'image' THEN 0 ELSE 1 END,
        images_today = images_today + CASE WHEN p_kind = 'image' THEN 1 ELSE 0 END,
        total_requests = total_requests + 1,
        last_request_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO rec;

  RETURN jsonb_build_object(
    'allowed', true, 'kind', p_kind,
    'used', CASE WHEN p_kind = 'image' THEN rec.images_today ELSE rec.requests_today END,
    'limit', cap, 'unlimited', lim.unlimited, 'plan', lim.plan_name,
    'resets_at', ((today + 1)::timestamp AT TIME ZONE 'Africa/Kampala')
  );
END;
$function$;

-- 5. Snapshot exposes bonus + shares
CREATE OR REPLACE FUNCTION public.ai_usage_snapshot(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  lim record;
  rec public.ai_usage;
  fresh boolean;
  shares integer;
  bonus integer;
BEGIN
  SELECT * INTO lim FROM public.ai_effective_limits(p_user_id);
  SELECT * INTO rec FROM public.ai_usage WHERE user_id = p_user_id;
  fresh := rec.user_id IS NULL OR rec.last_reset_date <> today;
  bonus := CASE WHEN fresh THEN 0 ELSE COALESCE(rec.bonus_requests, 0) END;

  SELECT count(*) INTO shares FROM public.referral_shares
    WHERE user_id = p_user_id AND share_date = today;

  RETURN jsonb_build_object(
    'plan', lim.plan_name,
    'plan_id', lim.plan_id,
    'unlimited', lim.unlimited,
    'base_request_limit', lim.daily_requests,
    'bonus_requests', bonus,
    'shares_today', shares,
    'shares_to_next_bonus', 3 - (shares % 3),
    'request_limit', lim.daily_requests + bonus,
    'image_limit', lim.daily_images,
    'requests_today', CASE WHEN fresh THEN 0 ELSE rec.requests_today END,
    'images_today', CASE WHEN fresh THEN 0 ELSE rec.images_today END,
    'successful_requests', CASE WHEN fresh THEN 0 ELSE rec.successful_requests END,
    'failed_requests', CASE WHEN fresh THEN 0 ELSE rec.failed_requests END,
    'last_request_at', rec.last_request_at,
    'last_reset_date', COALESCE(rec.last_reset_date, today),
    'resets_at', ((today + 1)::timestamp AT TIME ZONE 'Africa/Kampala')
  );
END;
$function$;

-- 6. Log a share and grant +5 requests for every 3 shares in a day
CREATE OR REPLACE FUNCTION public.record_app_share(p_channel text DEFAULT 'link')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  shares integer;
  earned integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.referral_shares (user_id, channel, share_date)
  VALUES (uid, COALESCE(NULLIF(trim(p_channel), ''), 'link'), today);

  SELECT count(*) INTO shares FROM public.referral_shares
    WHERE user_id = uid AND share_date = today;
  earned := (shares / 3) * 5;

  INSERT INTO public.ai_usage (user_id, last_reset_date) VALUES (uid, today)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ai_usage
    SET bonus_requests = GREATEST(COALESCE(bonus_requests, 0), earned),
        last_reset_date = CASE WHEN last_reset_date <> today THEN today ELSE last_reset_date END,
        requests_today = CASE WHEN last_reset_date <> today THEN 0 ELSE requests_today END,
        images_today = CASE WHEN last_reset_date <> today THEN 0 ELSE images_today END,
        updated_at = now()
    WHERE user_id = uid;

  RETURN public.ai_usage_snapshot(uid);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_app_share(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_app_share(text) TO authenticated;