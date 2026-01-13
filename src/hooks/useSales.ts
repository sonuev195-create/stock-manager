import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type Sale = Tables<'sales'>;
export type SaleItem = Tables<'sale_items'>;

export type SaleWithDetails = Sale & {
  sale_items: (SaleItem & {
    items: { name: string; item_code: string; primary_unit: string; secondary_unit: string | null } | null;
    batches: { batch_name: string } | null;
  })[];
};

export interface SaleLineItem {
  item_id: string;
  item_name: string;
  batch_id: string;
  batch_name: string;
  quantity_primary: number;
  quantity_secondary: number | null;
  rate: number;
  purchase_price: number;
  total: number;
  profit: number;
}

export interface CreateSaleData {
  sale_type: 'quick' | 'invoice';
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  notes?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  items: SaleLineItem[];
}

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(
            *,
            items(name, item_code, primary_unit, secondary_unit),
            batches(batch_name)
          )
        `)
        .order('sale_date', { ascending: false });
      
      if (error) throw error;
      return data as SaleWithDetails[];
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (saleData: CreateSaleData) => {
      // Generate sale number
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true });
      
      const saleNumber = `INV-${String((count || 0) + 1).padStart(5, '0')}`;
      const totalProfit = saleData.items.reduce((sum, item) => sum + item.profit, 0);
      
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          sale_type: saleData.sale_type,
          customer_name: saleData.customer_name || null,
          customer_phone: saleData.customer_phone || null,
          customer_address: saleData.customer_address || null,
          notes: saleData.notes || null,
          subtotal: saleData.subtotal,
          discount: saleData.discount,
          tax: saleData.tax,
          total_amount: saleData.total_amount,
          total_profit: totalProfit,
        })
        .select()
        .single();
      
      if (saleError) throw saleError;
      
      // Create sale items and update batch quantities
      for (const item of saleData.items) {
        // Create sale item
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            item_id: item.item_id,
            batch_id: item.batch_id,
            quantity_primary: item.quantity_primary,
            quantity_secondary: item.quantity_secondary,
            rate: item.rate,
            purchase_price: item.purchase_price,
            total: item.total,
            profit: item.profit,
          });
        
        if (itemError) throw itemError;
        
        // Update batch remaining quantity
        const { data: batch } = await supabase
          .from('batches')
          .select('remaining_quantity')
          .eq('id', item.batch_id)
          .single();
        
        if (batch) {
          const newRemaining = batch.remaining_quantity - item.quantity_primary;
          await supabase
            .from('batches')
            .update({ remaining_quantity: Math.max(0, newRemaining) })
            .eq('id', item.batch_id);
        }
      }
      
      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Sale completed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sale: ${error.message}`);
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First restore batch quantities
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('batch_id, quantity_primary')
        .eq('sale_id', id);
      
      if (saleItems) {
        for (const item of saleItems) {
          const { data: batch } = await supabase
            .from('batches')
            .select('remaining_quantity')
            .eq('id', item.batch_id)
            .single();
          
          if (batch) {
            await supabase
              .from('batches')
              .update({ remaining_quantity: batch.remaining_quantity + item.quantity_primary })
              .eq('id', item.batch_id);
          }
        }
      }
      
      // Delete sale items
      await supabase.from('sale_items').delete().eq('sale_id', id);
      
      // Delete sale
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Sale deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete sale: ${error.message}`);
    },
  });
}
