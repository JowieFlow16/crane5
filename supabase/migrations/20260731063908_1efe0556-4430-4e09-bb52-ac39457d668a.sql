
-- 1. Lock down SECURITY DEFINER functions: no direct calls from anon/authenticated
REVOKE ALL ON FUNCTION public.ai_effective_limits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_usage_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_result(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_effective_limits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_usage_snapshot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_result(uuid, boolean) TO service_role;

-- Trigger helper functions must never be directly callable
REVOKE ALL ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_post_comments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_post_likes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_official_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_teacher_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 2. Leaderboard: expose only ranking display columns
REVOKE SELECT ON public.leaderboard FROM authenticated, anon;
GRANT SELECT (user_id, full_name, avatar_url, class_level, xp, level, current_streak)
  ON public.leaderboard TO authenticated;
GRANT ALL ON public.leaderboard TO service_role;

-- 3. Social feed: expose only display columns, no internal metadata
REVOKE SELECT ON public.posts FROM authenticated, anon;
GRANT SELECT (id, user_id, author_name, author_avatar, author_class, content, image_url, kind, subject, likes_count, comments_count, created_at)
  ON public.posts TO authenticated;

REVOKE SELECT ON public.post_comments FROM authenticated, anon;
GRANT SELECT (id, post_id, user_id, author_name, author_avatar, content, created_at)
  ON public.post_comments TO authenticated;

REVOKE SELECT ON public.post_likes FROM authenticated, anon;
GRANT SELECT (id, post_id, user_id, created_at) ON public.post_likes TO authenticated;
