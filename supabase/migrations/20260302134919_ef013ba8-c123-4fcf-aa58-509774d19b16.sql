
-- Add batch_priority field to items (FIFO or LIFO per item)
ALTER TABLE public.items ADD COLUMN batch_priority text NOT NULL DEFAULT 'fifo';
