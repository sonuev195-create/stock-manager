import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierWithDetails {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  payment_type: string;
  created_at: string;
  updated_at: string;
  total_purchases: number;
  total_paid: number;
  due_amount: number;
  purchases: {
    id: string;
    purchase_number: string;
    purchase_date: string;
    total_amount: number;
    paid_amount: number;
    due_amount: number;
  }[];
}

export function useSupplierWithDetails(supplierId: string | null) {
  return useQuery({
    queryKey: ['supplier-details', supplierId],
    queryFn: async () => {
      if (!supplierId) return null;
      
      // Get supplier
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();
      
      if (supplierError) throw supplierError;
      
      // Get purchases for this supplier
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('purchase_date', { ascending: false });
      
      if (purchasesError) throw purchasesError;
      
      // Get payments for this supplier
      const { data: payments, error: paymentsError } = await supabase
        .from('supplier_payments')
        .select('amount')
        .eq('supplier_id', supplierId);
      
      if (paymentsError) throw paymentsError;
      
      // Calculate totals
      const totalPurchases = purchases.reduce((sum, p) => sum + p.total_amount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = totalPurchases - totalPaid;
      
      return {
        ...supplier,
        payment_type: supplier.payment_type || 'bill-wise',
        total_purchases: totalPurchases,
        total_paid: totalPaid,
        due_amount: dueAmount,
        purchases: purchases.map(p => ({
          id: p.id,
          purchase_number: p.purchase_number,
          purchase_date: p.purchase_date,
          total_amount: p.total_amount,
          paid_amount: p.paid_amount || 0,
          due_amount: p.total_amount - (p.paid_amount || 0),
        })),
      } as SupplierWithDetails;
    },
    enabled: !!supplierId,
  });
}

export function useSuppliersWithTotals() {
  return useQuery({
    queryKey: ['suppliers-with-totals'],
    queryFn: async () => {
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (suppliersError) throw suppliersError;
      
      // Get purchases for all suppliers
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('supplier_id, total_amount');
      
      if (purchasesError) throw purchasesError;
      
      // Get payments for all suppliers
      const { data: payments, error: paymentsError } = await supabase
        .from('supplier_payments')
        .select('supplier_id, amount');
      
      if (paymentsError) throw paymentsError;
      
      // Calculate totals per supplier
      const purchaseTotals: Record<string, number> = {};
      purchases.forEach(p => {
        if (p.supplier_id) {
          purchaseTotals[p.supplier_id] = (purchaseTotals[p.supplier_id] || 0) + p.total_amount;
        }
      });
      
      const paymentTotals: Record<string, number> = {};
      payments.forEach(p => {
        if (p.supplier_id) {
          paymentTotals[p.supplier_id] = (paymentTotals[p.supplier_id] || 0) + p.amount;
        }
      });
      
      return suppliers.map(s => ({
        ...s,
        total_purchases: purchaseTotals[s.id] || 0,
        total_paid: paymentTotals[s.id] || 0,
        due_amount: (purchaseTotals[s.id] || 0) - (paymentTotals[s.id] || 0),
      }));
    },
  });
}
