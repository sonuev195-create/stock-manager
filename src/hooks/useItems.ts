import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type Item = Tables<'items'>;
export type ItemInsert = TablesInsert<'items'>;
export type ItemUpdate = TablesUpdate<'items'>;

export type ItemWithCategory = Item & {
  categories: { name: string } | null;
  total_stock?: number;
};

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          categories(name)
        `)
        .order('name');
      
      if (error) throw error;
      
      // Get stock for each item
      const itemsWithStock = await Promise.all(
        (data || []).map(async (item) => {
          const { data: stockData } = await supabase
            .rpc('get_item_total_stock', { p_item_id: item.id });
          return {
            ...item,
            total_stock: stockData || 0
          };
        })
      );
      
      return itemsWithStock as ItemWithCategory[];
    },
  });
}

export function useItem(id: string | null) {
  return useQuery({
    queryKey: ['items', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          categories(name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as ItemWithCategory;
    },
    enabled: !!id,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: ItemInsert) => {
      const { data, error } = await supabase
        .from('items')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: ItemUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });
}

export function useBulkCreateItems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (items: ItemInsert[]) => {
      const { data, error } = await supabase
        .from('items')
        .insert(items)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(`${data.length} items created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk create items: ${error.message}`);
    },
  });
}
