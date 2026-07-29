ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz;

UPDATE public.documents
  SET source_type = CASE WHEN storage_path LIKE 'manual/%' THEN 'text' ELSE 'file' END
  WHERE source_type = 'file';

CREATE INDEX IF NOT EXISTS documents_source_url_idx ON public.documents (source_url);