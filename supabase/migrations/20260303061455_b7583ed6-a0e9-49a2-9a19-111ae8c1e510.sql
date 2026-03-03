-- Add shortword column for OCR matching
ALTER TABLE public.items ADD COLUMN shortword text DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.items.shortword IS 'Short word used in paper bills for OCR matching';