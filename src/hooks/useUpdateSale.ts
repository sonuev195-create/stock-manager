import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SaleLineItem } from './useSales';

export interface UpdateSaleData {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  notes?: string;
  discount: number;
  items: (SaleLineItem & { original_quantity?: number })[];
}

export function useUpdateSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (saleData: UpdateSaleData) => {
      // Get existing sale items to restore quantities
      const { data: existingItems } = await supabase
        .from('sale_items')
        .select('id, batch_id, quantity_primary')
        .eq('sale_id', saleData.id);

      // Restore old batch quantities
      if (existingItems) {
        for (const item of existingItems) {
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

      // Delete existing sale items
      await supabase.from('sale_items').delete().eq('sale_id', saleData.id);

      // Calculate new totals
      const subtotal = saleData.items.reduce((sum, item) => sum + item.total, 0);
      const totalProfit = saleData.items.reduce((sum, item) => sum + item.profit, 0);
      const totalAmount = subtotal - saleData.discount;

      // Update sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .update({
          customer_name: saleData.customer_name || null,
          customer_phone: saleData.customer_phone || null,
          customer_address: saleData.customer_address || null,
          notes: saleData.notes || null,
          subtotal,
          discount: saleData.discount,
          total_amount: totalAmount,
          total_profit: totalProfit - saleData.discount,
        })
        .eq('id', saleData.id)
        .select()
        .single();
      
      if (saleError) throw saleError;

      // Insert new sale items and update batch quantities
      for (const item of saleData.items) {
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
      toast.success('Sale updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update sale: ${error.message}`);
    },
  });
}
