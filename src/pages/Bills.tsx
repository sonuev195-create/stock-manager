import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSales, type SaleWithDetails } from '@/hooks/useSales';
import { ExportButton } from '@/components/common/ExportButton';
import { SALE_COLUMNS } from '@/lib/exportUtils';
import { getReportColumns } from '@/hooks/useSettings';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { Search, Eye, TrendingUp, Calendar, FileText } from 'lucide-react';

function SaleDetailDialog({ sale, open, onOpenChange }: { sale: SaleWithDetails | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!sale) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Bill: {sale.sale_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Date:</span>
              <div className="font-medium">{format(new Date(sale.sale_date), 'dd MMM yyyy HH:mm')}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Customer:</span>
              <div className="font-medium">{sale.customer_name || 'Walk-in'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline">{sale.sale_type}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Total:</span>
              <div className="font-bold text-lg">₹{sale.total_amount}</div>
            </div>
          </div>
          
          {sale.customer_phone && (
            <div className="text-sm">
              <span className="text-muted-foreground">Phone:</span> {sale.customer_phone}
            </div>
          )}
          
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty (Primary)</TableHead>
                <TableHead className="text-right">Qty (Secondary)</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.sale_items.map((si) => (
                <TableRow key={si.id}>
                  <TableCell>
                    <div>
                      {si.items?.name}
                      <div className="text-xs text-muted-foreground">
                        {si.items?.primary_unit}{si.items?.secondary_unit && ` / ${si.items.secondary_unit}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{si.batches?.batch_name.split('/')[0]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{si.quantity_primary} {si.items?.primary_unit}</TableCell>
                  <TableCell className="text-right">
                    {si.quantity_secondary ? `${si.quantity_secondary} ${si.items?.secondary_unit || ''}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">₹{si.rate}</TableCell>
                  <TableCell className="text-right font-medium">₹{si.total}</TableCell>
                  <TableCell className="text-right text-green-400">₹{si.profit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="flex justify-end gap-8 pt-4 border-t">
            <div className="text-sm">
              <span className="text-muted-foreground">Subtotal:</span> ₹{sale.subtotal}
            </div>
            {sale.discount > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Discount:</span> -₹{sale.discount}
              </div>
            )}
            <div className="font-bold">
              Total: ₹{sale.total_amount}
            </div>
            <div className="text-green-400">
              Profit: ₹{sale.total_profit}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupSalesByDate(sales: SaleWithDetails[]) {
  const groups: Record<string, SaleWithDetails[]> = {};
  
  sales.forEach(sale => {
    const dateKey = format(new Date(sale.sale_date), 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(sale);
  });
  
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      dateLabel: format(new Date(date), 'EEEE, dd MMMM yyyy'),
      sales: items,
      totalAmount: items.reduce((sum, s) => sum + s.total_amount, 0),
      totalProfit: items.reduce((sum, s) => sum + s.total_profit, 0),
    }));
}

export default function Bills() {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'daywise' | 'all'>('daywise');
  const [showProfit, setShowProfit] = useState(false);
  const [viewSale, setViewSale] = useState<SaleWithDetails | null>(null);
  
  const { data: sales, isLoading } = useSales();
  const reportColumns = getReportColumns();

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    
    return sales.filter(sale => {
      const matchesSearch = search === '' || 
        sale.sale_number.toLowerCase().includes(search.toLowerCase()) ||
        sale.customer_name?.toLowerCase().includes(search.toLowerCase());
      
      let matchesDate = true;
      const saleDate = new Date(sale.sale_date);
      
      if (dateFilter === 'today') {
        matchesDate = isWithinInterval(saleDate, {
          start: startOfDay(new Date()),
          end: endOfDay(new Date()),
        });
      } else if (dateFilter === 'week') {
        matchesDate = isWithinInterval(saleDate, {
          start: startOfDay(subDays(new Date(), 7)),
          end: endOfDay(new Date()),
        });
      } else if (dateFilter === 'month') {
        matchesDate = isWithinInterval(saleDate, {
          start: startOfDay(subDays(new Date(), 30)),
          end: endOfDay(new Date()),
        });
      }
      
      return matchesSearch && matchesDate;
    });
  }, [sales, search, dateFilter]);

  const groupedSales = useMemo(() => groupSalesByDate(filteredSales), [filteredSales]);
  
  const totals = useMemo(() => ({
    count: filteredSales.length,
    amount: filteredSales.reduce((sum, s) => sum + s.total_amount, 0),
    profit: filteredSales.reduce((sum, s) => sum + s.total_profit, 0),
  }), [filteredSales]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bills</h1>
        <ExportButton
          data={filteredSales}
          allColumns={SALE_COLUMNS}
          defaultColumns={reportColumns.sales}
          title="Bills"
          filename={`bills_${format(new Date(), 'yyyy-MM-dd')}`}
        />
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="text-2xl font-bold">{totals.count}</div>
            <div className="text-xs text-muted-foreground">Total Bills</div>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="text-2xl font-bold">₹{totals.amount.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Total Sales</div>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="text-2xl font-bold text-green-400">₹{totals.profit.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Total Profit</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by bill # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <Calendar className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'daywise' | 'all')}>
          <TabsList className="h-8">
            <TabsTrigger value="daywise" className="text-xs h-6">Day-wise</TabsTrigger>
            <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowProfit(!showProfit)}>
          <TrendingUp className="w-3 h-3 mr-1" />
          {showProfit ? 'Hide' : 'Show'} Profit
        </Button>
      </div>

      {/* Day-wise View */}
      {viewMode === 'daywise' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading bills...</div>
          ) : groupedSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No bills found.</div>
          ) : (
            groupedSales.map((group) => (
              <Card key={group.date}>
                <CardHeader className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{group.dateLabel}</CardTitle>
                    <div className="flex gap-4 text-sm">
                      <span>{group.sales.length} bills</span>
                      <span className="font-mono">₹{group.totalAmount.toFixed(0)}</span>
                      {showProfit && (
                        <span className="text-green-400 font-mono">+₹{group.totalProfit.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-2">
                  <Table className="data-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill #</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {showProfit && <TableHead className="text-right">Profit</TableHead>}
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono text-xs">{sale.sale_number}</TableCell>
                          <TableCell className="text-xs">{format(new Date(sale.sale_date), 'HH:mm')}</TableCell>
                          <TableCell>{sale.customer_name || '-'}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{sale.sale_items.length}</Badge></TableCell>
                          <TableCell className="text-right font-mono">₹{sale.total_amount}</TableCell>
                          {showProfit && <TableCell className="text-right font-mono text-green-400">₹{sale.total_profit}</TableCell>}
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewSale(sale)}>
                              <Eye className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* All View */}
      {viewMode === 'all' && (
        <div className="border rounded-md">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {showProfit && <TableHead className="text-right">Profit</TableHead>}
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={showProfit ? 7 : 6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow><TableCell colSpan={showProfit ? 7 : 6} className="text-center py-8">No bills found.</TableCell></TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs">{sale.sale_number}</TableCell>
                    <TableCell>{format(new Date(sale.sale_date), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>{sale.customer_name || '-'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{sale.sale_items.length}</Badge></TableCell>
                    <TableCell className="text-right font-mono">₹{sale.total_amount}</TableCell>
                    {showProfit && <TableCell className="text-right font-mono text-green-400">₹{sale.total_profit}</TableCell>}
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewSale(sale)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      
      <SaleDetailDialog sale={viewSale} open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)} />
    </div>
  );
}
