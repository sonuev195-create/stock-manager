import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type Settings = Tables<'settings'>;
export type SettingsUpdate = TablesUpdate<'settings'>;

export interface ReportColumns {
  items: string[];
  inventory: string[];
  purchases: string[];
  sales: string[];
  suppliers: string[];
}

const DEFAULT_REPORT_COLUMNS: ReportColumns = {
  items: ['item_code', 'name', 'category', 'unit_type', 'stock', 'price'],
  inventory: ['item_code', 'name', 'category', 'total_stock', 'batch_breakdown'],
  purchases: ['purchase_number', 'date', 'supplier', 'items', 'total'],
  sales: ['sale_number', 'date', 'customer', 'items', 'total', 'profit'],
  suppliers: ['name', 'contact_person', 'phone', 'email', 'gst_number', 'due_amount'],
};

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as Settings | null;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: SettingsUpdate & { id?: string }) => {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .limit(1)
        .single();
      
      if (existing) {
        const { data, error } = await supabase
          .from('settings')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('settings')
          .insert(updates)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });
}

// Local storage for report column preferences
export function getReportColumns(): ReportColumns {
  const stored = localStorage.getItem('report_columns');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_REPORT_COLUMNS;
    }
  }
  return DEFAULT_REPORT_COLUMNS;
}

export function setReportColumns(columns: ReportColumns) {
  localStorage.setItem('report_columns', JSON.stringify(columns));
}

export function useReportColumns() {
  const columns = getReportColumns();
  
  const updateColumns = (newColumns: ReportColumns) => {
    setReportColumns(newColumns);
  };
  
  return { columns, updateColumns };
}
