-- Add batch-specific conversion factor to store the conversion rate at purchase time
ALTER TABLE public.batches ADD COLUMN batch_conversion_factor numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.batches.batch_conversion_factor IS 'Conversion factor calculated at purchase time (primary to secondary ratio)';