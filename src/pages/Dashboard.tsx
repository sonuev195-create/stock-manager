import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, TrendingUp, AlertTriangle, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useDashboardStats, useSalesChart, useTopSellingItems, useRecentActivity, useLowStockItems } from '@/hooks/useDashboard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function formatSecondaryStock(primaryStock: number, conversionFactor: number | null, secondaryUnit: string | null): string {
  if (!conversionFactor || !secondaryUnit || conversionFactor === 0) return '';
  const secondaryStock = primaryStock * conversionFactor;
  return `(${secondaryStock.toFixed(1)} ${secondaryUnit})`;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: salesChart } = useSalesChart(7);
  const { data: topItems } = useTopSellingItems(5);
  const { data: recentActivity } = useRecentActivity(8);
  const { data: lowStockItems } = useLowStockItems();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="w-3 h-3" /> Total Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.totalItems}</p>
            <p className="text-xs text-muted-foreground">
              Stock Value: {formatCurrency(stats?.totalStockValue || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" /> Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">{formatCurrency(stats?.todaySales || 0)}</p>
            <div className="flex items-center gap-1 text-xs text-success">
              <ArrowUpRight className="w-3 h-3" />
              <span>Live</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Today's Profit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold text-profit">{formatCurrency(stats?.todayProfit || 0)}</p>
            <p className="text-xs text-muted-foreground">
              Margin: {stats?.todaySales ? ((stats.todayProfit / stats.todaySales) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-warning">{stats?.lowStockCount || 0}</p>
              <span className="text-sm text-muted-foreground">low</span>
              <p className="text-2xl font-bold text-destructive">{stats?.outOfStockCount || 0}</p>
              <span className="text-sm text-muted-foreground">out</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Chart */}
        <Card className="bg-card">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Sales & Profit (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {salesChart && salesChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={salesChart}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.375rem',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`₹${value.toFixed(0)}`, '']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--chart-1))" fill="url(#salesGradient)" name="Sales" />
                  <Area type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" fill="url(#profitGradient)" name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Items */}
        <Card className="bg-card">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {topItems && topItems.length > 0 ? (
              <div className="space-y-2">
                {topItems.map((item, index) => (
                  <div key={item.item_id} className="flex items-center justify-between p-2 bg-accent/30 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">{item.total_quantity} {item.primary_unit} sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">₹{item.total_revenue.toFixed(0)}</p>
                      <p className="text-xs text-profit">+₹{item.total_profit.toFixed(0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No sales yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Alerts */}
        <Card className="bg-card">
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Low Stock Alerts
              </CardTitle>
              <Link to="/inventory">
                <Button variant="ghost" size="sm" className="h-6 text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {lowStockItems && lowStockItems.length > 0 ? (
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {lowStockItems.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-accent/30">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.is_out ? "destructive" : "secondary"} className="text-[10px] px-1.5">
                        {item.is_out ? 'OUT' : 'LOW'}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.categories?.name || 'Uncategorized'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-mono ${item.is_out ? 'text-destructive' : 'text-warning'}`}>
                        {item.current_stock} {item.primary_unit}
                      </p>
                      {item.secondary_unit && item.conversion_factor && (
                        <p className="text-xs text-muted-foreground">
                          {(item.current_stock * item.conversion_factor).toFixed(1)} {item.secondary_unit}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground">
                All items well stocked
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {recentActivity.map((activity) => (
                  <div key={`${activity.type}-${activity.id}`} className="flex items-center justify-between p-2 rounded hover:bg-accent/30">
                    <div className="flex items-center gap-2">
                      {activity.type === 'sale' ? (
                        <ArrowUpRight className="w-4 h-4 text-success" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-warning" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.timestamp), 'dd MMM, HH:mm')}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-mono ${activity.type === 'sale' ? 'text-success' : ''}`}>
                      {activity.type === 'sale' ? '+' : '-'}₹{activity.amount.toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground">
                No recent activity. Start by adding items and categories.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
