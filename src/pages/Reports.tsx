import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from '@/components/common/ExportButton';
import { useItems } from '@/hooks/useItems';
import { useSales } from '@/hooks/useSales';
import { usePurchases } from '@/hooks/usePurchases';
import { useSuppliersWithTotals } from '@/hooks/useSupplierPayments';
import { useCategories } from '@/hooks/useCategories';
import { useBatchesWithStock } from '@/hooks/useBatches';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ITEM_COLUMNS, SALE_COLUMNS, PURCHASE_COLUMNS, SUPPLIER_COLUMNS, INVENTORY_COLUMNS } from '@/lib/exportUtils';
import { getReportColumns } from '@/hooks/useSettings';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { BarChart3, TrendingUp, TrendingDown, Package, ShoppingCart, Truck, DollarSign, FileText, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PERIOD_OPTIONS = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3', label: 'Last 3 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

function getDateRange(period: string) {
  const now = new Date();
  switch (period) {
    case 'this-month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last-month': return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case 'last-3': return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case 'this-year': return { start: startOfYear(now), end: endOfYear(now) };
    default: return null;
  }
}

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)', 'hsl(199, 89%, 68%)', 'hsl(142, 71%, 65%)'];

function SalesReport() {
  const [period, setPeriod] = useState('this-month');
  const { data: sales } = useSales();
  const reportColumns = getReportColumns();

  const range = getDateRange(period);
  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!range) return sales;
    return sales.filter(s => isWithinInterval(new Date(s.sale_date), { start: range.start, end: range.end }));
  }, [sales, period]);

  const stats = useMemo(() => {
    const totalSales = filteredSales.reduce((s, sale) => s + Number(sale.total_amount), 0);
    const totalProfit = filteredSales.reduce((s, sale) => s + Number(sale.total_profit), 0);
    const totalDiscount = filteredSales.reduce((s, sale) => s + Number(sale.discount), 0);
    const avgBillValue = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
    return { totalSales, totalProfit, totalDiscount, avgBillValue, count: filteredSales.length };
  }, [filteredSales]);

  // Daily sales chart
  const dailyChart = useMemo(() => {
    const map: Record<string, { date: string; sales: number; profit: number }> = {};
    filteredSales.forEach(s => {
      const key = format(new Date(s.sale_date), 'dd MMM');
      if (!map[key]) map[key] = { date: key, sales: 0, profit: 0 };
      map[key].sales += Number(s.total_amount);
      map[key].profit += Number(s.total_profit);
    });
    return Object.values(map).slice(-30);
  }, [filteredSales]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <ExportButton data={filteredSales} allColumns={SALE_COLUMNS} defaultColumns={reportColumns.sales} title="Sales Report" filename={`sales_report_${format(new Date(), 'yyyy-MM-dd')}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total Sales</div>
          <div className="text-xl font-bold font-mono">₹{stats.totalSales.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground">{stats.count} bills</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Profit</div>
          <div className={`text-xl font-bold font-mono ${stats.totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>₹{stats.totalProfit.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground">Margin: {stats.totalSales > 0 ? ((stats.totalProfit / stats.totalSales) * 100).toFixed(1) : 0}%</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Avg Bill Value</div>
          <div className="text-xl font-bold font-mono">₹{stats.avgBillValue.toFixed(0)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Discounts Given</div>
          <div className="text-xl font-bold font-mono text-loss">₹{stats.totalDiscount.toFixed(0)}</div>
        </CardContent></Card>
      </div>

      {dailyChart.length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Sales Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.375rem', fontSize: '12px' }} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" name="Sales" radius={[2, 2, 0, 0]} />
                <Bar dataKey="profit" fill="hsl(var(--success))" name="Profit" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Recent Sales</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader><TableRow>
              <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Profit</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredSales.slice(0, 20).map(sale => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs">{sale.sale_number}</TableCell>
                  <TableCell className="text-xs">{format(new Date(sale.sale_date), 'dd MMM')}</TableCell>
                  <TableCell className="text-xs">{sale.customer_name || '-'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">₹{sale.total_amount}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${Number(sale.total_profit) >= 0 ? 'text-profit' : 'text-loss'}`}>₹{sale.total_profit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PurchaseReport() {
  const [period, setPeriod] = useState('this-month');
  const { data: purchases } = usePurchases();
  const reportColumns = getReportColumns();

  const range = getDateRange(period);
  const filtered = useMemo(() => {
    if (!purchases) return [];
    if (!range) return purchases;
    return purchases.filter(p => isWithinInterval(new Date(p.purchase_date), { start: range.start, end: range.end }));
  }, [purchases, period]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, p) => s + Number(p.total_amount), 0);
    const paid = filtered.reduce((s, p) => s + Number(p.paid_amount), 0);
    const unpaid = total - paid;
    return { total, paid, unpaid, count: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <ExportButton data={filtered} allColumns={PURCHASE_COLUMNS} defaultColumns={reportColumns.purchases} title="Purchase Report" filename={`purchase_report_${format(new Date(), 'yyyy-MM-dd')}`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total Purchases</div>
          <div className="text-xl font-bold font-mono">₹{stats.total.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground">{stats.count} bills</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="text-xl font-bold font-mono text-profit">₹{stats.paid.toFixed(0)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Unpaid</div>
          <div className="text-xl font-bold font-mono text-loss">₹{stats.unpaid.toFixed(0)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Purchase History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader><TableRow>
              <TableHead>Purchase #</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.slice(0, 20).map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.purchase_number}</TableCell>
                  <TableCell className="text-xs">{format(new Date(p.purchase_date), 'dd MMM')}</TableCell>
                  <TableCell className="text-xs">{p.suppliers?.name || '-'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">₹{p.total_amount}</TableCell>
                  <TableCell><Badge variant={p.payment_status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">{p.payment_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryReport() {
  const { data: items } = useItems();
  const { data: categories } = useCategories();
  const reportColumns = getReportColumns();

  const stats = useMemo(() => {
    if (!items) return { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
    const inStock = items.filter(i => (i.total_stock || 0) > (i.low_stock_threshold || 10)).length;
    const lowStock = items.filter(i => { const s = i.total_stock || 0; return s > 0 && s <= (i.low_stock_threshold || 10); }).length;
    const outOfStock = items.filter(i => (i.total_stock || 0) <= 0).length;
    const totalValue = items.reduce((sum, i) => sum + (i.total_stock || 0) * i.current_selling_price, 0);
    return { total: items.length, inStock, lowStock, outOfStock, totalValue };
  }, [items]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    if (!items || !categories) return [];
    return categories.map(cat => {
      const catItems = items.filter(i => i.category_id === cat.id);
      const value = catItems.reduce((s, i) => s + (i.total_stock || 0) * i.current_selling_price, 0);
      return { name: cat.name, count: catItems.length, value };
    }).filter(c => c.count > 0);
  }, [items, categories]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButton data={items || []} allColumns={INVENTORY_COLUMNS} defaultColumns={reportColumns.inventory} title="Inventory Report" filename={`inventory_report_${format(new Date(), 'yyyy-MM-dd')}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total Items</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">In Stock</div>
          <div className="text-xl font-bold text-profit">{stats.inStock}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Low Stock</div>
          <div className="text-xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{stats.lowStock}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Out of Stock</div>
          <div className="text-xl font-bold text-loss">{stats.outOfStock}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Stock Value: ₹{stats.totalValue.toFixed(0)}</CardTitle></CardHeader>
        <CardContent>
          {categoryBreakdown.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.375rem', fontSize: '12px' }} formatter={(v: number) => `₹${v.toFixed(0)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader><TableRow>
              <TableHead>Category</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Stock Value</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {categoryBreakdown.map(cat => (
                <TableRow key={cat.name}>
                  <TableCell className="text-sm">{cat.name}</TableCell>
                  <TableCell className="text-right">{cat.count}</TableCell>
                  <TableCell className="text-right font-mono">₹{cat.value.toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SupplierReport() {
  const { data: suppliers } = useSuppliersWithTotals();
  const reportColumns = getReportColumns();

  const stats = useMemo(() => {
    if (!suppliers) return { count: 0, totalPurchases: 0, totalDue: 0 };
    const totalPurchases = suppliers.reduce((s, sup) => s + (sup.total_purchases || 0), 0);
    const totalDue = suppliers.reduce((s, sup) => s + (sup.due_amount || 0), 0);
    return { count: suppliers.length, totalPurchases, totalDue };
  }, [suppliers]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButton data={suppliers || []} allColumns={SUPPLIER_COLUMNS} defaultColumns={reportColumns.suppliers} title="Supplier Report" filename={`supplier_report_${format(new Date(), 'yyyy-MM-dd')}`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total Suppliers</div>
          <div className="text-xl font-bold">{stats.count}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total Purchases</div>
          <div className="text-xl font-bold font-mono">₹{stats.totalPurchases.toFixed(0)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total Due</div>
          <div className="text-xl font-bold font-mono text-loss">₹{stats.totalDue.toFixed(0)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Supplier Summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader><TableRow>
              <TableHead>Supplier</TableHead><TableHead>Phone</TableHead>
              <TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Due</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {suppliers?.map(sup => (
                <TableRow key={sup.id}>
                  <TableCell className="text-sm font-medium">{sup.name}</TableCell>
                  <TableCell className="text-xs">{sup.phone || '-'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">₹{(sup.total_purchases || 0).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-profit">₹{(sup.total_paid || 0).toFixed(0)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${(sup.due_amount || 0) > 0 ? 'text-loss' : 'text-profit'}`}>₹{(sup.due_amount || 0).toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemLedgerReport() {
  const { data: items } = useItems();
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // Fetch all sale_items and purchase_items for the selected item
  const { data: saleItems = [] } = useQuery({
    queryKey: ['item-ledger-sales', selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      const { data, error } = await supabase
        .from('sale_items')
        .select('*, sales(sale_number, sale_date, customer_name), batches(batch_name)')
        .eq('item_id', selectedItemId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedItemId,
  });

  const { data: purchaseItems = [] } = useQuery({
    queryKey: ['item-ledger-purchases', selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      const { data, error } = await supabase
        .from('purchase_items')
        .select('*, purchases(purchase_number, purchase_date, suppliers(name))')
        .eq('item_id', selectedItemId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedItemId,
  });

  const selectedItem = items?.find(i => i.id === selectedItemId);

  // Combine into a ledger
  const ledger = useMemo(() => {
    const entries: { date: string; type: string; ref: string; party: string; batch: string; qtyIn: number; qtyOut: number; rate: number; amount: number }[] = [];

    purchaseItems.forEach((pi: any) => {
      entries.push({
        date: pi.purchases?.purchase_date || pi.created_at,
        type: 'Purchase',
        ref: pi.purchases?.purchase_number || '',
        party: pi.purchases?.suppliers?.name || '-',
        batch: '-',
        qtyIn: Number(pi.quantity),
        qtyOut: 0,
        rate: Number(pi.purchase_price),
        amount: Number(pi.total),
      });
    });

    saleItems.forEach((si: any) => {
      entries.push({
        date: si.sales?.sale_date || si.created_at,
        type: 'Sale',
        ref: si.sales?.sale_number || '',
        party: si.sales?.customer_name || '-',
        batch: si.batches?.batch_name || '-',
        qtyIn: 0,
        qtyOut: Number(si.quantity_primary),
        rate: Number(si.rate),
        amount: Number(si.total),
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let balance = 0;
    return entries.map(e => {
      balance += e.qtyIn - e.qtyOut;
      return { ...e, balance };
    });
  }, [saleItems, purchaseItems]);

  const totals = useMemo(() => {
    const totalIn = ledger.reduce((s, e) => s + e.qtyIn, 0);
    const totalOut = ledger.reduce((s, e) => s + e.qtyOut, 0);
    const totalPurchaseAmt = ledger.filter(e => e.type === 'Purchase').reduce((s, e) => s + e.amount, 0);
    const totalSaleAmt = ledger.filter(e => e.type === 'Sale').reduce((s, e) => s + e.amount, 0);
    return { totalIn, totalOut, totalPurchaseAmt, totalSaleAmt };
  }, [ledger]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
          <SelectTrigger className="w-[250px] h-8 text-sm"><SelectValue placeholder="Select an item" /></SelectTrigger>
          <SelectContent>
            {items?.map(item => (
              <SelectItem key={item.id} value={item.id} className="text-xs">
                {item.name} ({item.item_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedItem && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Total Purchased</div>
              <div className="text-xl font-bold font-mono">{totals.totalIn} {selectedItem.primary_unit}</div>
              <div className="text-xs text-muted-foreground">₹{totals.totalPurchaseAmt.toFixed(0)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Total Sold</div>
              <div className="text-xl font-bold font-mono">{totals.totalOut} {selectedItem.primary_unit}</div>
              <div className="text-xs text-muted-foreground">₹{totals.totalSaleAmt.toFixed(0)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Current Stock</div>
              <div className="text-xl font-bold font-mono">{selectedItem.total_stock || 0} {selectedItem.primary_unit}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Selling Price</div>
              <div className="text-xl font-bold font-mono">₹{selectedItem.current_selling_price}</div>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Item Ledger - {selectedItem.name}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Ref#</TableHead>
                      <TableHead className="text-xs">Party</TableHead>
                      <TableHead className="text-xs">Batch</TableHead>
                      <TableHead className="text-xs text-right">In</TableHead>
                      <TableHead className="text-xs text-right">Out</TableHead>
                      <TableHead className="text-xs text-right">Rate</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{format(new Date(entry.date), 'dd MMM yy')}</TableCell>
                        <TableCell>
                          <Badge variant={entry.type === 'Purchase' ? 'secondary' : 'default'} className="text-[10px]">
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{entry.ref}</TableCell>
                        <TableCell className="text-xs">{entry.party}</TableCell>
                        <TableCell className="text-xs">{entry.batch}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-profit">{entry.qtyIn > 0 ? entry.qtyIn : ''}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-loss">{entry.qtyOut > 0 ? entry.qtyOut : ''}</TableCell>
                        <TableCell className="text-xs text-right font-mono">₹{entry.rate.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">₹{entry.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold">{entry.balance}</TableCell>
                      </TableRow>
                    ))}
                    {ledger.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground text-sm py-4">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="sales" className="gap-1 text-xs"><ShoppingCart className="w-3 h-3" />Sales</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1 text-xs"><FileText className="w-3 h-3" />Purchases</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1 text-xs"><Package className="w-3 h-3" />Inventory</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1 text-xs"><Truck className="w-3 h-3" />Suppliers</TabsTrigger>
          <TabsTrigger value="item-ledger" className="gap-1 text-xs"><BookOpen className="w-3 h-3" />Item Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="mt-4"><SalesReport /></TabsContent>
        <TabsContent value="purchases" className="mt-4"><PurchaseReport /></TabsContent>
        <TabsContent value="inventory" className="mt-4"><InventoryReport /></TabsContent>
        <TabsContent value="suppliers" className="mt-4"><SupplierReport /></TabsContent>
        <TabsContent value="item-ledger" className="mt-4"><ItemLedgerReport /></TabsContent>
      </Tabs>
    </div>
  );
}
