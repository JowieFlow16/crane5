INSERT INTO public.ai_plans (id, name, daily_requests, daily_images, unlimited, sort_order)
VALUES
  ('free', 'Free', 40, 5, false, 1),
  ('standard', 'Standard', 150, 20, false, 2),
  ('pro', 'Pro', 500, 60, false, 3),
  ('unlimited', 'Unlimited', 0, 0, true, 4)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ai_effective_limits(p_user_id uuid)
RETURNS TABLE(plan_id text, plan_name text, daily_requests integer, daily_images integer, unlimited boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.id, 'free'),
    COALESCE(p.name, 'Free'),
    COALESCE(p.daily_requests, 40),
    COALESCE(p.daily_images, 5),
    COALESCE(p.unlimited, false)
      OR COALESCE(u.unlimited, false)
      OR private.has_role(p_user_id, 'admin'::app_role)
  FROM (SELECT 1) x
  LEFT JOIN public.user_ai_plans u ON u.user_id = p_user_id
  LEFT JOIN public.ai_plans p
    ON p.id = COALESCE(u.plan_id, 'free')
  LIMIT 1;
$$;