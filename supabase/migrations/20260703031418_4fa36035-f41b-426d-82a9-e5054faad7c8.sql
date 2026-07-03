-- The AI grounding read is moved fully server-side (privileged), so no
-- signed-in-user-callable function is needed. Remove it to satisfy the
-- project's no-authenticated-SECURITY-DEFINER policy.
DROP FUNCTION IF EXISTS public.search_curriculum(text, int);