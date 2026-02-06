-- Create supplier_payments table for tracking payments to suppliers
CREATE TABLE public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add paid_amount and payment_status to purchases
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';

-- Add payment_type preference to suppliers (bill-wise or total-wise)
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'bill-wise';

-- Enable RLS on supplier_payments
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for supplier_payments (allow all for authenticated users)
CREATE POLICY "Users can view supplier payments"
ON public.supplier_payments FOR SELECT
USING (true);

CREATE POLICY "Users can create supplier payments"
ON public.supplier_payments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update supplier payments"
ON public.supplier_payments FOR UPDATE
USING (true);

CREATE POLICY "Users can delete supplier payments"
ON public.supplier_payments FOR DELETE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_supplier_payments_updated_at
BEFORE UPDATE ON public.supplier_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();