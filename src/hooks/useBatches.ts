import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

export type Batch = Tables<'batches'>;
export type BatchInsert = TablesInsert<'batches'>;
export type BatchUpdate = TablesUpdate<'batches'>;

export type BatchWithItem = Batch & {
  items: { name: string; item_code: string; primary_unit: string } | null;
};

export function useBatchesByItem(itemId: string | null) {
  return useQuery({
    queryKey: ['batches', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('item_id', itemId)
        .order('serial_number', { ascending: false });
      
      if (error) throw error;
      return data as Batch[];
    },
    enabled: !!itemId,
  });
}

export function useAllBatches() {
  return useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          items(name, item_code, primary_unit)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BatchWithItem[];
    },
  });
}

export function useBatchesWithStock() {
  return useQuery({
    queryKey: ['batches', 'with-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          items(name, item_code, primary_unit, secondary_unit, unit_type, conversion_factor, current_selling_price, low_stock_threshold, categories(name))
        `)
        .gt('remaining_quantity', 0)
        .order('serial_number', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (batch: Omit<BatchInsert, 'serial_number' | 'batch_name'> & { is_opening_stock?: boolean }) => {
      // Get next serial number
      const { data: serialData, error: serialError } = await supabase
        .rpc('get_next_batch_serial', { p_item_id: batch.item_id });
      
      if (serialError) throw serialError;
      
      const serialNumber = serialData as number;
      const dateStr = batch.is_opening_stock ? 'Opening' : format(new Date(batch.batch_date || new Date()), 'dd-MMM-yy');
      const batchName = `${String(serialNumber).padStart(3, '0')}/${dateStr}/${batch.quantity}*${batch.purchase_price}`;
      
      const { data, error } = await supabase
        .from('batches')
        .insert({
          ...batch,
          serial_number: serialNumber,
          batch_name: batchName,
          remaining_quantity: batch.remaining_quantity ?? batch.quantity,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Batch created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create batch: ${error.message}`);
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: BatchUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('batches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Batch updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update batch: ${error.message}`);
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Batch deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete batch: ${error.message}`);
    },
  });
}
