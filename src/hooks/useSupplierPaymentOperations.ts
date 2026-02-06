import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  purchase_id: string | null;
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string | null;
  created_at: string;
  purchases?: {
    purchase_number: string;
  } | null;
}

export interface SupplierPaymentInsert {
  supplier_id: string;
  purchase_id?: string | null;
  amount: number;
  payment_mode?: string;
  notes?: string | null;
}

export function useSupplierPayments(supplierId: string | null) {
  return useQuery({
    queryKey: ['supplier-payments', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
          *,
          purchases (purchase_number)
        `)
        .eq('supplier_id', supplierId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data as SupplierPayment[];
    },
    enabled: !!supplierId,
  });
}

export function useCreateSupplierPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payment: SupplierPaymentInsert) => {
      // Insert the payment
      const { data, error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: payment.supplier_id,
          purchase_id: payment.purchase_id,
          amount: payment.amount,
          payment_mode: payment.payment_mode || 'cash',
          notes: payment.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update the purchase paid_amount if payment is against a specific purchase
      if (payment.purchase_id) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('paid_amount, total_amount')
          .eq('id', payment.purchase_id)
          .single();
        
        if (purchase) {
          const newPaidAmount = (purchase.paid_amount || 0) + payment.amount;
          const paymentStatus = newPaidAmount >= purchase.total_amount ? 'paid' : 'partial';
          
          await supabase
            .from('purchases')
            .update({ 
              paid_amount: newPaidAmount,
              payment_status: paymentStatus
            })
            .eq('id', payment.purchase_id);
        }
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments', variables.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-details', variables.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-with-totals'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

export function useDeleteSupplierPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, supplierId }: { id: string; supplierId: string }) => {
      const { error } = await supabase
        .from('supplier_payments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return supplierId;
    },
    onSuccess: (supplierId) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['supplier-details', supplierId] });
      toast.success('Payment deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete payment: ${error.message}`);
    },
  });
}
