-- 1) Lock down SECURITY DEFINER / internal functions
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_effective_limits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_usage_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_result(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_post_comments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_post_likes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_official_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_teacher_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_effective_limits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_usage_snapshot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_result(uuid, boolean) TO service_role;

-- award_xp is SECURITY INVOKER and is called by signed-in users from the app
REVOKE ALL ON FUNCTION public.award_xp(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(integer) TO authenticated, service_role;

-- 2) Avatars: only the owner can read the raw object (others use signed URLs)
DROP POLICY IF EXISTS "Avatars readable by authenticated" ON storage.objects;
CREATE POLICY "Users read own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Leaderboard + social feed: signed-in only, no anonymous access
REVOKE ALL ON TABLE public.leaderboard FROM anon;
REVOKE ALL ON TABLE public.posts FROM anon;
REVOKE ALL ON TABLE public.post_comments FROM anon;
REVOKE ALL ON TABLE public.post_likes FROM anon;