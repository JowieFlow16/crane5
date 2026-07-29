-- AI plans (tiers)
CREATE TABLE public.ai_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  daily_requests integer NOT NULL DEFAULT 50,
  daily_images integer NOT NULL DEFAULT 5,
  unlimited boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_plans TO authenticated;
GRANT ALL ON public.ai_plans TO service_role;
ALTER TABLE public.ai_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI plans readable by authenticated" ON public.ai_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage AI plans" ON public.ai_plans FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ai_plans (id, name, daily_requests, daily_images, unlimited, sort_order) VALUES
  ('free', 'Free', 50, 5, false, 1),
  ('standard', 'Standard', 300, 30, false, 2),
  ('premium', 'Premium', 0, 0, true, 3);

-- Per-user plan assignment
CREATE TABLE public.user_ai_plans (
  user_id uuid PRIMARY KEY,
  plan_id text NOT NULL REFERENCES public.ai_plans(id) ON UPDATE CASCADE,
  unlimited boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_ai_plans_user ON public.user_ai_plans (user_id);
GRANT SELECT ON public.user_ai_plans TO authenticated;
GRANT ALL ON public.user_ai_plans TO service_role;
ALTER TABLE public.user_ai_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own AI plan" ON public.user_ai_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage user AI plans" ON public.user_ai_plans FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Per-user daily usage
CREATE TABLE public.ai_usage (
  user_id uuid PRIMARY KEY,
  requests_today integer NOT NULL DEFAULT 0,
  successful_requests integer NOT NULL DEFAULT 0,
  failed_requests integer NOT NULL DEFAULT 0,
  images_today integer NOT NULL DEFAULT 0,
  last_reset_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Kampala')::date,
  last_request_at timestamptz,
  total_requests integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_user ON public.ai_usage (user_id);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own AI usage" ON public.ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));
-- No insert/update/delete policies: counters are server-managed only.

-- Resolve a user's effective limits
CREATE OR REPLACE FUNCTION public.ai_effective_limits(p_user_id uuid)
RETURNS TABLE (plan_id text, plan_name text, daily_requests integer, daily_images integer, unlimited boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.daily_requests, p.daily_images,
         (p.unlimited OR COALESCE(u.unlimited, false)
          OR private.has_role(p_user_id, 'admin'::app_role))
  FROM public.ai_plans p
  LEFT JOIN public.user_ai_plans u ON u.user_id = p_user_id
  WHERE p.id = COALESCE((SELECT plan_id FROM public.user_ai_plans WHERE user_id = p_user_id), 'free')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.ai_effective_limits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_effective_limits(uuid) TO service_role;

-- Atomically check + consume one unit of a user's daily quota
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid, p_kind text DEFAULT 'request')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
          images_today = 0, last_reset_date = today, updated_at = now()
      WHERE user_id = p_user_id
      RETURNING * INTO rec;
  END IF;

  IF p_kind = 'image' THEN
    used := rec.images_today; cap := lim.daily_images;
  ELSE
    used := rec.requests_today; cap := lim.daily_requests;
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
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text) TO service_role;

-- Record the outcome of a consumed request
CREATE OR REPLACE FUNCTION public.record_ai_result(p_user_id uuid, p_success boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_usage
    SET successful_requests = successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_requests = failed_requests + CASE WHEN p_success THEN 0 ELSE 1 END,
        updated_at = now()
    WHERE user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.record_ai_result(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_result(uuid, boolean) TO service_role;

-- Read a user's current usage snapshot (server-side)
CREATE OR REPLACE FUNCTION public.ai_usage_snapshot(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  lim record;
  rec public.ai_usage;
BEGIN
  SELECT * INTO lim FROM public.ai_effective_limits(p_user_id);
  SELECT * INTO rec FROM public.ai_usage WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'plan', lim.plan_name,
    'plan_id', lim.plan_id,
    'unlimited', lim.unlimited,
    'request_limit', lim.daily_requests,
    'image_limit', lim.daily_images,
    'requests_today', CASE WHEN rec.user_id IS NULL OR rec.last_reset_date <> today THEN 0 ELSE rec.requests_today END,
    'images_today', CASE WHEN rec.user_id IS NULL OR rec.last_reset_date <> today THEN 0 ELSE rec.images_today END,
    'successful_requests', CASE WHEN rec.user_id IS NULL OR rec.last_reset_date <> today THEN 0 ELSE rec.successful_requests END,
    'failed_requests', CASE WHEN rec.user_id IS NULL OR rec.last_reset_date <> today THEN 0 ELSE rec.failed_requests END,
    'last_request_at', rec.last_request_at,
    'last_reset_date', COALESCE(rec.last_reset_date, today),
    'resets_at', ((today + 1)::timestamp AT TIME ZONE 'Africa/Kampala')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.ai_usage_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_snapshot(uuid) TO service_role;