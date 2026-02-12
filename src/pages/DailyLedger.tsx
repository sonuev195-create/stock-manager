import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSales } from '@/hooks/useSales';
import { usePurchases } from '@/hooks/usePurchases';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getMonth, getYear } from 'date-fns';
import { ChevronDown, ChevronRight, Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DailyLedger() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const { data: sales } = useSales();
  const { data: purchases } = usePurchases();

  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const dailyData = useMemo(() => {
    return daysInMonth.map(day => {
      const daySales = sales?.filter(s => isSameDay(new Date(s.sale_date), day)) || [];
      const dayPurchases = purchases?.filter(p => isSameDay(new Date(p.purchase_date), day)) || [];

      const totalSales = daySales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const totalProfit = daySales.reduce((sum, s) => sum + Number(s.total_profit), 0);
      const totalPurchases = dayPurchases.reduce((sum, p) => sum + Number(p.total_amount), 0);

      // Calculate payment breakdown from sales
      const cashSales = totalSales; // All treated as cash for now
      
      return {
        date: day,
        dateKey: format(day, 'yyyy-MM-dd'),
        dayNum: day.getDate(),
        dayName: format(day, 'EEE'),
        sales: daySales,
        purchases: dayPurchases,
        totalSales,
        totalProfit,
        totalPurchases,
        cashSales,
        billCount: daySales.length,
        balance: totalSales - totalPurchases,
      };
    });
  }, [daysInMonth, sales, purchases]);

  const monthTotals = useMemo(() => ({
    sales: dailyData.reduce((s, d) => s + d.totalSales, 0),
    profit: dailyData.reduce((s, d) => s + d.totalProfit, 0),
    purchases: dailyData.reduce((s, d) => s + d.totalPurchases, 0),
    bills: dailyData.reduce((s, d) => s + d.billCount, 0),
  }), [dailyData]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Daily Ledger
        </h1>
        <div className="flex gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[90px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3" /> Sales</div>
            <div className="text-xl font-bold font-mono">₹{monthTotals.sales.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">{monthTotals.bills} bills</div>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign className="w-3 h-3" /> Profit</div>
            <div className="text-xl font-bold font-mono text-emerald-500">₹{monthTotals.profit.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="w-3 h-3" /> Purchases</div>
            <div className="text-xl font-bold font-mono text-orange-500">₹{monthTotals.purchases.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card className="py-2">
          <CardContent className="pt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign className="w-3 h-3" /> Net</div>
            <div className={`text-xl font-bold font-mono ${monthTotals.sales - monthTotals.purchases >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              ₹{(monthTotals.sales - monthTotals.purchases).toFixed(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Rows */}
      <div className="space-y-1">
        {dailyData.map(day => {
          const isExpanded = expandedDays.has(day.dateKey);
          const hasData = day.billCount > 0 || day.purchases.length > 0;
          const isFuture = day.date > now;

          return (
            <Collapsible key={day.dateKey} open={isExpanded} onOpenChange={() => hasData && toggleDay(day.dateKey)}>
              <CollapsibleTrigger asChild>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors ${
                  isFuture ? 'opacity-40' : ''
                } ${hasData ? '' : 'opacity-60'}`}>
                  {/* Day Number */}
                  <div className="w-8 text-center">
                    <div className="font-bold text-sm">{day.dayNum}</div>
                    <div className="text-[10px] text-muted-foreground">{day.dayName}</div>
                  </div>

                  {/* Sales Amount */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {day.billCount > 0 && (
                        <Badge variant="secondary" className="text-xs">{day.billCount} bills</Badge>
                      )}
                      {day.totalSales > 0 && (
                        <span className="font-mono text-sm font-medium">₹{day.totalSales.toFixed(0)}</span>
                      )}
                    </div>
                  </div>

                  {/* Purchase */}
                  {day.totalPurchases > 0 && (
                    <div className="text-xs text-orange-500 font-mono">
                      -₹{day.totalPurchases.toFixed(0)}
                    </div>
                  )}

                  {/* Profit */}
                  {day.totalProfit !== 0 && (
                    <div className={`text-xs font-mono ${day.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      P: ₹{day.totalProfit.toFixed(0)}
                    </div>
                  )}

                  {/* Balance */}
                  {hasData && (
                    <div className={`text-xs font-mono font-medium ${day.balance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {day.balance >= 0 ? '+' : ''}₹{day.balance.toFixed(0)}
                    </div>
                  )}

                  {hasData && (
                    isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="ml-10 mr-2 my-1 space-y-2">
                  {/* Sales Detail */}
                  {day.sales.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted/50 px-3 py-1 text-xs font-medium flex justify-between">
                        <span>SALES</span>
                        <span className="font-mono">₹{day.totalSales.toFixed(0)}</span>
                      </div>
                      <Table className="data-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs py-1">#</TableHead>
                            <TableHead className="text-xs py-1">Bill No</TableHead>
                            <TableHead className="text-xs py-1">Customer</TableHead>
                            <TableHead className="text-xs py-1">Category</TableHead>
                            <TableHead className="text-xs py-1 text-right">Amount</TableHead>
                            <TableHead className="text-xs py-1 text-right">Cash</TableHead>
                            <TableHead className="text-xs py-1 text-right">Profit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.sales.map((sale, idx) => (
                            <TableRow key={sale.id}>
                              <TableCell className="py-1 text-xs">{idx + 1}</TableCell>
                              <TableCell className="py-1 text-xs font-mono">{sale.sale_number}</TableCell>
                              <TableCell className="py-1 text-xs">{sale.customer_name || '-'}</TableCell>
                              <TableCell className="py-1 text-xs">
                                {sale.sale_type === 'quick' ? 'SALE' : sale.sale_type.toUpperCase()}
                              </TableCell>
                              <TableCell className="py-1 text-xs text-right font-mono">₹{Number(sale.total_amount).toFixed(0)}</TableCell>
                              <TableCell className="py-1 text-xs text-right font-mono">₹{Number(sale.total_amount).toFixed(0)}</TableCell>
                              <TableCell className="py-1 text-xs text-right font-mono text-emerald-500">₹{Number(sale.total_profit).toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Purchases Detail */}
                  {day.purchases.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted/50 px-3 py-1 text-xs font-medium flex justify-between">
                        <span>PURCHASES</span>
                        <span className="font-mono text-orange-500">₹{day.totalPurchases.toFixed(0)}</span>
                      </div>
                      <Table className="data-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs py-1">#</TableHead>
                            <TableHead className="text-xs py-1">Purchase No</TableHead>
                            <TableHead className="text-xs py-1">Supplier</TableHead>
                            <TableHead className="text-xs py-1">Status</TableHead>
                            <TableHead className="text-xs py-1 text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.purchases.map((purchase, idx) => (
                            <TableRow key={purchase.id}>
                              <TableCell className="py-1 text-xs">{idx + 1}</TableCell>
                              <TableCell className="py-1 text-xs font-mono">{purchase.purchase_number}</TableCell>
                              <TableCell className="py-1 text-xs">{purchase.suppliers?.name || '-'}</TableCell>
                              <TableCell className="py-1 text-xs">
                                <Badge variant={purchase.payment_status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">
                                  {purchase.payment_status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-1 text-xs text-right font-mono">₹{Number(purchase.total_amount).toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Day Summary */}
                  {hasData && (
                    <div className="flex gap-4 px-3 py-1.5 bg-muted/30 rounded text-xs font-mono">
                      <span>Sales: ₹{day.totalSales.toFixed(0)}</span>
                      <span className="text-orange-500">Purchase: ₹{day.totalPurchases.toFixed(0)}</span>
                      <span className="text-emerald-500">Profit: ₹{day.totalProfit.toFixed(0)}</span>
                      <span className={day.balance >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                        Net: ₹{day.balance.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
