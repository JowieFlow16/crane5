-- Storage RLS for curriculum-docs (private). Authenticated users can read; admins manage.
create policy "Authenticated can read curriculum docs"
on storage.objects for select to authenticated
using (bucket_id = 'curriculum-docs');

create policy "Admins can upload curriculum docs"
on storage.objects for insert to authenticated
with check (bucket_id = 'curriculum-docs' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can update curriculum docs"
on storage.objects for update to authenticated
using (bucket_id = 'curriculum-docs' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete curriculum docs"
on storage.objects for delete to authenticated
using (bucket_id = 'curriculum-docs' and public.has_role(auth.uid(), 'admin'));