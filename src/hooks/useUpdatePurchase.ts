import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UpdatePurchaseData {
  id: string;
  supplier_id?: string;
  notes?: string;
  items: {
    item_id: string;
    quantity: number;
    quantity_secondary?: number;
    purchase_price: number;
    selling_price: number;
  }[];
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (purchaseData: UpdatePurchaseData) => {
      // Get existing purchase items with batch info
      const { data: existingItems } = await supabase
        .from('purchase_items')
        .select('id, batch_id, quantity')
        .eq('purchase_id', purchaseData.id);

      // Delete existing batches
      if (existingItems) {
        for (const item of existingItems) {
          if (item.batch_id) {
            await supabase.from('batches').delete().eq('id', item.batch_id);
          }
        }
      }

      // Delete existing purchase items
      await supabase.from('purchase_items').delete().eq('purchase_id', purchaseData.id);

      // Calculate new total
      const totalAmount = purchaseData.items.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0);

      // Update purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .update({
          supplier_id: purchaseData.supplier_id || null,
          notes: purchaseData.notes || null,
          total_amount: totalAmount,
        })
        .eq('id', purchaseData.id)
        .select()
        .single();
      
      if (purchaseError) throw purchaseError;

      // Get item details for batch naming
      const itemIds = purchaseData.items.map(i => i.item_id);
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, conversion_factor')
        .in('id', itemIds);

      const itemMap = new Map(itemsData?.map(i => [i.id, i]) || []);

      // Create new batches and purchase items
      for (const item of purchaseData.items) {
        const itemInfo = itemMap.get(item.item_id);
        
        // Calculate batch conversion factor if secondary qty provided
        let batchConversionFactor = null;
        if (item.quantity_secondary && item.quantity > 0) {
          batchConversionFactor = item.quantity_secondary / item.quantity;
        }

        // Get next serial number
        const { data: serialData } = await supabase
          .rpc('get_next_batch_serial', { p_item_id: item.item_id });
        
        const serialNumber = serialData as number;
        const batchName = `${String(serialNumber).padStart(3, '0')}/${item.quantity}*${item.purchase_price}`;

        // Create batch
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .insert({
            item_id: item.item_id,
            serial_number: serialNumber,
            batch_name: batchName,
            quantity: item.quantity,
            remaining_quantity: item.quantity,
            purchase_price: item.purchase_price,
            selling_price: item.selling_price,
            batch_conversion_factor: batchConversionFactor,
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
            total: item.quantity * item.purchase_price,
          });
        
        if (itemError) throw itemError;
      }
      
      return purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Purchase updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update purchase: ${error.message}`);
    },
  });
}
