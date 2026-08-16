-- =========================================================
-- Crane 5 durable AI control plane (Phase A)
-- =========================================================

-- 1. Provider configuration -------------------------------------------------
CREATE TABLE public.ai_providers_config (
  id text PRIMARY KEY,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  max_concurrency integer,
  cost_profile text NOT NULL DEFAULT 'standard',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers_config TO authenticated;
GRANT ALL ON public.ai_providers_config TO service_role;
ALTER TABLE public.ai_providers_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage provider config" ON public.ai_providers_config
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 2. Shared provider health ------------------------------------------------
CREATE TABLE public.provider_health (
  provider_id text PRIMARY KEY,
  success bigint NOT NULL DEFAULT 0,
  failure bigint NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  disabled_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_health TO authenticated;
GRANT ALL ON public.provider_health TO service_role;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read provider health" ON public.provider_health
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 3. Per-key rotation state ------------------------------------------------
CREATE TABLE public.ai_key_state (
  provider_id text NOT NULL,
  key_index integer NOT NULL,
  parked_until timestamptz,
  reason text,
  uses bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, key_index)
);
GRANT SELECT ON public.ai_key_state TO authenticated;
GRANT ALL ON public.ai_key_state TO service_role;
ALTER TABLE public.ai_key_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read key state" ON public.ai_key_state
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 4. Durable response cache (never keyed to a single student) ---------------
CREATE TABLE public.ai_cache_entries (
  id text PRIMARY KEY,
  capability text NOT NULL DEFAULT 'text',
  subject text,
  class_level text,
  prompt_preview text,
  value jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX ai_cache_entries_expires_idx ON public.ai_cache_entries (expires_at);
CREATE INDEX ai_cache_entries_subject_idx ON public.ai_cache_entries (subject, created_at DESC);
GRANT SELECT ON public.ai_cache_entries TO authenticated;
GRANT ALL ON public.ai_cache_entries TO service_role;
ALTER TABLE public.ai_cache_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cache" ON public.ai_cache_entries
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 5. Budgets ----------------------------------------------------------------
CREATE TABLE public.ai_budgets (
  id text PRIMARY KEY,
  scope text NOT NULL DEFAULT 'platform',
  daily_limit numeric(12,4) NOT NULL DEFAULT 5,
  monthly_limit numeric(12,4) NOT NULL DEFAULT 100,
  alert_thresholds integer[] NOT NULL DEFAULT '{50,70,80,90,100}',
  enforce boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_budgets TO authenticated;
GRANT ALL ON public.ai_budgets TO service_role;
ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage budgets" ON public.ai_budgets
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 6. Operating policies / modes -------------------------------------------
CREATE TABLE public.ai_policies (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT false,
  prefer_cheap boolean NOT NULL DEFAULT false,
  allow_premium boolean NOT NULL DEFAULT true,
  max_concurrency integer,
  quota_multiplier numeric(5,2) NOT NULL DEFAULT 1,
  blocks_new_requests boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_policies TO authenticated;
GRANT ALL ON public.ai_policies TO service_role;
ALTER TABLE public.ai_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage policies" ON public.ai_policies
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 7. Feature flags ---------------------------------------------------------
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percent integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage feature flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 8. Alerts ---------------------------------------------------------------
CREATE TABLE public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'warning',
  component text NOT NULL,
  title text NOT NULL,
  description text,
  recommended_action text,
  dedupe_key text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX system_alerts_open_idx ON public.system_alerts (resolved, created_at DESC);
CREATE UNIQUE INDEX system_alerts_dedupe_idx ON public.system_alerts (dedupe_key)
  WHERE resolved = false AND dedupe_key IS NOT NULL;
GRANT SELECT, UPDATE ON public.system_alerts TO authenticated;
GRANT ALL ON public.system_alerts TO service_role;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read alerts" ON public.system_alerts
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins resolve alerts" ON public.system_alerts
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 9. System metric samples ------------------------------------------------
CREATE TABLE public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value numeric NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX system_metrics_name_idx ON public.system_metrics (name, created_at DESC);
GRANT SELECT ON public.system_metrics TO authenticated;
GRANT ALL ON public.system_metrics TO service_role;
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read metrics" ON public.system_metrics
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 10. Audit log ----------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 11. Durable AI queue ---------------------------------------------------
CREATE TABLE public.ai_queue_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  priority integer NOT NULL DEFAULT 1,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error_message text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_queue_jobs_dispatch_idx ON public.ai_queue_jobs (status, priority, run_after);
CREATE INDEX ai_queue_jobs_user_idx ON public.ai_queue_jobs (user_id, created_at DESC);
CREATE UNIQUE INDEX ai_queue_jobs_dedupe_idx ON public.ai_queue_jobs (dedupe_key)
  WHERE status IN ('queued', 'processing') AND dedupe_key IS NOT NULL;
GRANT SELECT ON public.ai_queue_jobs TO authenticated;
GRANT ALL ON public.ai_queue_jobs TO service_role;
ALTER TABLE public.ai_queue_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own jobs" ON public.ai_queue_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- 12. Request tracing on the existing ledger ----------------------------
ALTER TABLE public.ai_request_log
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS queue_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS ai_request_log_provider_idx
  ON public.ai_request_log (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_request_log_user_idx
  ON public.ai_request_log (user_id, created_at DESC);

-- 13. updated_at triggers ---------------------------------------------
CREATE TRIGGER ai_providers_config_touch BEFORE UPDATE ON public.ai_providers_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_budgets_touch BEFORE UPDATE ON public.ai_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_policies_touch BEFORE UPDATE ON public.ai_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER feature_flags_touch BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_queue_jobs_touch BEFORE UPDATE ON public.ai_queue_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 14. Seed rows mirroring the current in-code configuration -----------
INSERT INTO public.ai_providers_config (id, label, enabled, priority, cost_profile, notes) VALUES
  ('openrouter', 'OpenRouter', true, 10, 'premium', 'Primary paid production gateway'),
  ('lovable',    'Lovable AI', true, 20, 'included', 'Always-on failover, no user key required'),
  ('requesty',   'Requesty',   true, 30, 'standard', null),
  ('aimlapi',    'AIMLAPI',    true, 40, 'standard', 'Image, video, audio specialist'),
  ('ofox',       'OFOX',       true, 50, 'standard', null),
  ('haimaker',   'HaiMaker',   true, 60, 'standard', null),
  ('allmodels',  'AllModels',  true, 70, 'standard', null),
  ('autorouter', 'Auto Router',true, 80, 'standard', null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_budgets (id, scope, daily_limit, monthly_limit) VALUES
  ('platform', 'platform', 5, 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_policies (id, name, description, active, prefer_cheap, allow_premium, quota_multiplier, blocks_new_requests, sort_order) VALUES
  ('normal',      'Normal',      'Full AI operation with standard routing.', true,  false, true,  1.00, false, 1),
  ('high_demand', 'High Demand', 'Prefer cheaper, faster models during traffic spikes.', false, true,  true,  1.00, false, 2),
  ('restricted',  'Restricted',  'Limit expensive operations and reduce quotas.', false, true,  false, 0.50, false, 3),
  ('emergency',   'Emergency',   'Only essential tutoring requests are processed.', false, true,  false, 0.25, false, 4),
  ('maintenance', 'Maintenance', 'New AI requests are paused while work is carried out.', false, true,  false, 0.00, true,  5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('voice_tutor',        'Voice tutor',        'Speech input and spoken answers.', false),
  ('image_understanding','Image understanding','Let students upload diagrams and photos.', true),
  ('ai_quizzes',         'AI quizzes',         'AI-generated practice quizzes.', true),
  ('teacher_dashboard',  'Teacher dashboard',  'Teacher portal and verification.', true),
  ('parent_dashboard',   'Parent dashboard',   'Guardian progress view.', false),
  ('advanced_reasoning', 'Advanced reasoning', 'High-effort reasoning for hard questions.', true),
  ('premium_models',     'Premium models',     'Allow escalation to premium models.', true),
  ('durable_cache',      'Durable answer cache','Reuse answers to common curriculum questions.', true)
ON CONFLICT (key) DO NOTHING;