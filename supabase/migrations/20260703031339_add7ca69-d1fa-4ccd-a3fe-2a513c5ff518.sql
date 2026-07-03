-- Restrict direct reads of curriculum documents to admins only.
-- AI grounding (RAG) continues to work through a controlled security-definer function.

DROP POLICY IF EXISTS "Authenticated can read documents" ON public.documents;

CREATE POLICY "Admins can read documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Controlled read path for AI grounding: returns only curriculum text fields,
-- never storage paths or uploader identity. Any signed-in user may call it,
-- but they cannot read the underlying table directly.
CREATE OR REPLACE FUNCTION public.search_curriculum(p_subject text DEFAULT NULL, p_limit int DEFAULT 4)
RETURNS TABLE (name text, subject text, content_text text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.name, d.subject, d.content_text
  FROM public.documents d
  WHERE d.content_text IS NOT NULL
    AND (p_subject IS NULL OR d.subject ILIKE '%' || p_subject || '%')
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 4), 15), 1)
$$;

REVOKE ALL ON FUNCTION public.search_curriculum(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_curriculum(text, int) TO authenticated;