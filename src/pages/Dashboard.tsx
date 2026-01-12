import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="w-3 h-3" /> Total Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" /> Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">₹0</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Today's Profit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold text-profit">₹0</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold text-warning">0</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader className="p-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-sm text-muted-foreground">No recent activity. Start by adding items and categories.</p>
        </CardContent>
      </Card>
    </div>
  );
}
