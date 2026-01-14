import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface DashboardStats {
  totalItems: number;
  todaySales: number;
  todayProfit: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStock: number;
  totalStockValue: number;
}

export interface SalesDataPoint {
  date: string;
  sales: number;
  profit: number;
}

export interface TopSellingItem {
  item_id: string;
  item_name: string;
  item_code: string;
  total_quantity: number;
  total_revenue: number;
  total_profit: number;
  primary_unit: string;
}

export interface RecentActivity {
  id: string;
  type: 'sale' | 'purchase' | 'stock';
  description: string;
  amount: number;
  timestamp: string;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      // Get total items
      const { count: totalItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true });

      // Get today's sales
      const { data: todaySalesData } = await supabase
        .from('sales')
        .select('total_amount, total_profit')
        .gte('sale_date', startOfToday)
        .lte('sale_date', endOfToday);

      const todaySales = todaySalesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const todayProfit = todaySalesData?.reduce((sum, s) => sum + Number(s.total_profit), 0) || 0;

      // Get items with their stock for low stock calculation
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, low_stock_threshold');

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStock = 0;
      let totalStockValue = 0;

      if (itemsData) {
        for (const item of itemsData) {
          const { data: stockData } = await supabase.rpc('get_item_total_stock', { p_item_id: item.id });
          const stock = stockData || 0;
          totalStock += stock;

          if (stock <= 0) {
            outOfStockCount++;
          } else if (stock <= (item.low_stock_threshold || 10)) {
            lowStockCount++;
          }
        }
      }

      // Get total stock value from batches
      const { data: batchesData } = await supabase
        .from('batches')
        .select('remaining_quantity, purchase_price')
        .gt('remaining_quantity', 0);

      totalStockValue = batchesData?.reduce((sum, b) => sum + (Number(b.remaining_quantity) * Number(b.purchase_price)), 0) || 0;

      return {
        totalItems: totalItems || 0,
        todaySales,
        todayProfit,
        lowStockCount,
        outOfStockCount,
        totalStock,
        totalStockValue,
      } as DashboardStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useSalesChart(days: number = 7) {
  return useQuery({
    queryKey: ['dashboard', 'sales-chart', days],
    queryFn: async () => {
      const dataPoints: SalesDataPoint[] = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        const { data } = await supabase
          .from('sales')
          .select('total_amount, total_profit')
          .gte('sale_date', start)
          .lte('sale_date', end);

        dataPoints.push({
          date: format(date, 'dd MMM'),
          sales: data?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
          profit: data?.reduce((sum, s) => sum + Number(s.total_profit), 0) || 0,
        });
      }

      return dataPoints;
    },
    refetchInterval: 60000,
  });
}

export function useTopSellingItems(limit: number = 5) {
  return useQuery({
    queryKey: ['dashboard', 'top-selling', limit],
    queryFn: async () => {
      // Get sale items with item details
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select(`
          item_id,
          quantity_primary,
          total,
          profit,
          items(name, item_code, primary_unit)
        `);

      if (!saleItems) return [];

      // Aggregate by item
      const itemMap = new Map<string, TopSellingItem>();

      for (const si of saleItems) {
        const existing = itemMap.get(si.item_id);
        if (existing) {
          existing.total_quantity += Number(si.quantity_primary);
          existing.total_revenue += Number(si.total);
          existing.total_profit += Number(si.profit);
        } else {
          itemMap.set(si.item_id, {
            item_id: si.item_id,
            item_name: si.items?.name || 'Unknown',
            item_code: si.items?.item_code || '',
            total_quantity: Number(si.quantity_primary),
            total_revenue: Number(si.total),
            total_profit: Number(si.profit),
            primary_unit: si.items?.primary_unit || 'pcs',
          });
        }
      }

      return Array.from(itemMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);
    },
  });
}

export function useRecentActivity(limit: number = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', limit],
    queryFn: async () => {
      const activities: RecentActivity[] = [];

      // Get recent sales
      const { data: sales } = await supabase
        .from('sales')
        .select('id, sale_number, total_amount, sale_date')
        .order('sale_date', { ascending: false })
        .limit(limit);

      sales?.forEach(s => {
        activities.push({
          id: s.id,
          type: 'sale',
          description: `Sale ${s.sale_number}`,
          amount: Number(s.total_amount),
          timestamp: s.sale_date,
        });
      });

      // Get recent purchases
      const { data: purchases } = await supabase
        .from('purchases')
        .select('id, purchase_number, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      purchases?.forEach(p => {
        activities.push({
          id: p.id,
          type: 'purchase',
          description: `Purchase ${p.purchase_number}`,
          amount: Number(p.total_amount),
          timestamp: p.created_at,
        });
      });

      // Sort by timestamp and limit
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    },
  });
}

export function useLowStockItems() {
  return useQuery({
    queryKey: ['dashboard', 'low-stock-items'],
    queryFn: async () => {
      const { data: items } = await supabase
        .from('items')
        .select('id, name, item_code, primary_unit, secondary_unit, conversion_factor, low_stock_threshold, categories(name)');

      if (!items) return [];

      const lowStockItems = [];

      for (const item of items) {
        const { data: stockData } = await supabase.rpc('get_item_total_stock', { p_item_id: item.id });
        const stock = stockData || 0;
        const threshold = item.low_stock_threshold || 10;

        if (stock <= threshold) {
          lowStockItems.push({
            ...item,
            current_stock: stock,
            is_out: stock <= 0,
          });
        }
      }

      return lowStockItems.sort((a, b) => a.current_stock - b.current_stock);
    },
  });
}
