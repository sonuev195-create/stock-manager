import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

export type Purchase = Tables<'purchases'>;
export type PurchaseItem = Tables<'purchase_items'>;

export type PurchaseWithDetails = Purchase & {
  suppliers: { name: string } | null;
  purchase_items: (PurchaseItem & {
    items: { name: string; item_code: string } | null;
  })[];
};

export interface PurchaseLineItem {
  item_id: string;
  item_name: string;
  item_code: string;
  quantity: number;
  quantity_secondary?: number | null;
  batch_conversion_factor?: number | null;
  purchase_price: number;
  selling_price: number;
  total: number;
}

export interface CreatePurchaseData {
  supplier_id: string | null;
  purchase_date: string;
  notes: string;
  items: PurchaseLineItem[];
}

export function usePurchases() {
  return useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          suppliers(name),
          purchase_items(
            *,
            items(name, item_code)
          )
        `)
        .order('purchase_date', { ascending: false });
      
      if (error) throw error;
      return data as PurchaseWithDetails[];
    },
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (purchaseData: CreatePurchaseData) => {
      // Generate purchase number using MAX to avoid conflicts after deletion
      const { data: maxPurchase } = await supabase
        .from('purchases')
        .select('purchase_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let nextNumber = 1;
      if (maxPurchase?.purchase_number) {
        const match = maxPurchase.purchase_number.match(/PUR-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const purchaseNumber = `PUR-${String(nextNumber).padStart(5, '0')}`;
      const totalAmount = purchaseData.items.reduce((sum, item) => sum + item.total, 0);
      
      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          purchase_number: purchaseNumber,
          supplier_id: purchaseData.supplier_id,
          purchase_date: purchaseData.purchase_date,
          notes: purchaseData.notes,
          total_amount: totalAmount,
        })
        .select()
        .single();
      
      if (purchaseError) throw purchaseError;
      
      // Create purchase items and batches
      for (const item of purchaseData.items) {
        // Get next serial number for batch
        const { data: serialData, error: serialError } = await supabase
          .rpc('get_next_batch_serial', { p_item_id: item.item_id });
        
        if (serialError) throw serialError;
        
        const serialNumber = serialData as number;
        const dateStr = format(new Date(purchaseData.purchase_date), 'dd-MMM-yy');
        const batchName = `${String(serialNumber).padStart(3, '0')}/${dateStr}/${item.quantity}*${item.purchase_price}`;
        
        // Create batch with batch-specific conversion factor
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .insert({
            item_id: item.item_id,
            serial_number: serialNumber,
            batch_name: batchName,
            batch_date: purchaseData.purchase_date,
            quantity: item.quantity,
            remaining_quantity: item.quantity,
            purchase_price: item.purchase_price,
            selling_price: item.selling_price,
            is_opening_stock: false,
            batch_conversion_factor: item.batch_conversion_factor || null,
          })
          .select()
          .single();
        
        if (batchError) throw batchError;
        
        // Create purchase item
        const { error: itemError } = await supabase
          .from('purchase_items')
          .insert({
            purchase_id: purchase.id,
            item_id: item.item_id,
            batch_id: batch.id,
            quantity: item.quantity,
            purchase_price: item.purchase_price,
            selling_price: item.selling_price,
            total: item.total,
          });
        
        if (itemError) throw itemError;
        
        // Update item's current selling price
        await supabase
          .from('items')
          .update({ current_selling_price: item.selling_price })
          .eq('id', item.item_id);
      }
      
      return purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Purchase created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create purchase: ${error.message}`);
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First delete related purchase_items and batches
      const { data: purchaseItems } = await supabase
        .from('purchase_items')
        .select('batch_id')
        .eq('purchase_id', id);
      
      if (purchaseItems) {
        for (const item of purchaseItems) {
          if (item.batch_id) {
            await supabase.from('batches').delete().eq('id', item.batch_id);
          }
        }
      }
      
      await supabase.from('purchase_items').delete().eq('purchase_id', id);
      
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Purchase deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete purchase: ${error.message}`);
    },
  });
}
