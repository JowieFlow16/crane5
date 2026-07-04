-- Fix 1: Restrict curriculum-docs storage reads to admins only
DROP POLICY IF EXISTS "Authenticated can read curriculum docs" ON storage.objects;

CREATE POLICY "Admins can read curriculum docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'curriculum-docs'
  AND private.has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Allow profile owners to delete their own profile
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);