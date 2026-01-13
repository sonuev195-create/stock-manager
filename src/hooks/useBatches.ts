import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Batch = Tables<'batches'>;

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
          items(name, item_code)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}
