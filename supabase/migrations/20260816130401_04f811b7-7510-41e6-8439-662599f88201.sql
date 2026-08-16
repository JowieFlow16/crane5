CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id text,
  provider text NOT NULL,
  model text NOT NULL,
  task_type text NOT NULL,
  subject text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  reasoning_tokens integer NOT NULL DEFAULT 0,
  cached_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric(12,8) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_request_log TO authenticated;
GRANT ALL ON public.ai_request_log TO service_role;

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own ai request log" ON public.ai_request_log;
CREATE POLICY "own ai request log" ON public.ai_request_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS ai_request_log_created_idx ON public.ai_request_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_request_log_user_idx ON public.ai_request_log (user_id, created_at DESC);

-- Generous default allowance: abuse protection only, not a free-tier throttle.
INSERT INTO public.ai_plans (id, name, daily_requests, daily_images, unlimited, sort_order)
VALUES ('free', 'Standard', 600, 40, false, 1)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      daily_requests = EXCLUDED.daily_requests,
      daily_images = EXCLUDED.daily_images,
      updated_at = now();

-- Admin-only aggregated AI cost / usage overview. service_role only: it is
-- called from the server after the caller's admin role has been verified.
CREATE OR REPLACE FUNCTION public.ai_cost_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (SELECT * FROM public.ai_request_log WHERE created_at > now() - interval '30 days')
  SELECT jsonb_build_object(
    'requests_today', (SELECT count(*) FROM base WHERE created_at::date = (now() AT TIME ZONE 'Africa/Kampala')::date),
    'requests_week', (SELECT count(*) FROM base WHERE created_at > now() - interval '7 days'),
    'requests_total', (SELECT count(*) FROM public.ai_request_log),
    'input_tokens', (SELECT COALESCE(sum(input_tokens),0) FROM base),
    'output_tokens', (SELECT COALESCE(sum(output_tokens),0) FROM base),
    'reasoning_tokens', (SELECT COALESCE(sum(reasoning_tokens),0) FROM base),
    'cost', (SELECT COALESCE(sum(estimated_cost),0) FROM base),
    'cost_today', (SELECT COALESCE(sum(estimated_cost),0) FROM base WHERE created_at::date = (now() AT TIME ZONE 'Africa/Kampala')::date),
    'avg_latency_ms', (SELECT COALESCE(round(avg(latency_ms)),0) FROM base WHERE status = 'success'),
    'error_rate', (SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE status = 'error') / count(*)) END FROM base),
    'by_model', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT model, count(*) AS requests, COALESCE(sum(estimated_cost),0) AS cost FROM base GROUP BY model ORDER BY count(*) DESC LIMIT 10) x),
    'by_task', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT task_type, count(*) AS requests FROM base GROUP BY task_type ORDER BY count(*) DESC LIMIT 12) x),
    'by_subject', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT subject, count(*) AS requests FROM base WHERE subject IS NOT NULL GROUP BY subject ORDER BY count(*) DESC LIMIT 10) x),
    'top_users', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT b.user_id, COALESCE(p.full_name, 'Learner') AS name, count(*) AS requests, COALESCE(sum(b.estimated_cost),0) AS cost FROM base b LEFT JOIN public.profiles p ON p.id = b.user_id GROUP BY b.user_id, p.full_name ORDER BY count(*) DESC LIMIT 8) x),
    'recent_failures', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (SELECT model, task_type, error_message, created_at FROM base WHERE status = 'error' ORDER BY created_at DESC LIMIT 8) x)
  );
$$;

REVOKE ALL ON FUNCTION public.ai_cost_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_cost_overview() TO service_role;