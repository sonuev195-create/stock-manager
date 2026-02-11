
-- Add conversion mode to items (batch_wise = each batch has its own ratio, permanent = uses item-level ratio)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS conversion_mode text NOT NULL DEFAULT 'permanent';

-- Add sort_order to items and categories for drag-drop ordering
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Create index for sort_order
CREATE INDEX IF NOT EXISTS idx_items_sort_order ON public.items(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);
