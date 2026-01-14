import { useState, useMemo } from 'react';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useBatchesByItem } from '@/hooks/useBatches';
import { OpeningStockDialog } from '@/components/inventory/OpeningStockDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { Search, Package, Plus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

function formatDualStock(primary: number, primaryUnit: string, conversionFactor: number | null, secondaryUnit: string | null): string {
  if (!conversionFactor || !secondaryUnit || conversionFactor === 0) {
    return `${primary.toFixed(2)} ${primaryUnit}`;
  }
  const secondary = primary * conversionFactor;
  return `${primary.toFixed(2)} ${primaryUnit} (${secondary.toFixed(1)} ${secondaryUnit})`;
}

function BatchBreakdown({ item }: { item: ItemWithCategory }) {
  const { data: batches } = useBatchesByItem(item.id);
  
  if (!batches || batches.length === 0) {
    return <span className="text-muted-foreground text-xs">No batches</span>;
  }
  
  const conversionFactor = item.conversion_factor || null;
  const secondaryUnit = item.secondary_unit || null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {batches.filter(b => b.remaining_quantity > 0).map((batch) => {
        const primaryQty = batch.remaining_quantity;
        const secondaryQty = conversionFactor ? primaryQty * conversionFactor : null;
        
        return (
          <Badge 
            key={batch.id} 
            variant="outline" 
            className="text-[10px] px-1.5 py-0 font-mono"
            title={`Purchase: ₹${batch.purchase_price} | Selling: ₹${batch.selling_price}`}
          >
            {batch.batch_name.split('/')[0]}/{batch.is_opening_stock ? 'Op' : format(new Date(batch.batch_date), 'dd-MMM')} 
            : {primaryQty} {item.primary_unit}
            {secondaryQty !== null && secondaryUnit && (
              <span className="text-muted-foreground"> ({secondaryQty.toFixed(1)} {secondaryUnit})</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}

function AddStockDialog({ item, open, onOpenChange }: { item: ItemWithCategory | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!item) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Stock - {item.name}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          Use the Purchases module to add new stock batches, or add Opening Stock for initial inventory.
        </div>
        <OpeningStockDialog selectedItem={item} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ItemWithCategory | null>(null);

  const { data: items, isLoading } = useItems();
  const { data: categories } = useCategories();

  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    return items.filter(item => {
      const matchesSearch = search === '' || 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.item_code.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
      
      const stock = item.total_stock || 0;
      const threshold = item.low_stock_threshold || 10;
      let matchesStock = true;
      if (stockFilter === 'low') matchesStock = stock > 0 && stock <= threshold;
      if (stockFilter === 'out') matchesStock = stock <= 0;
      if (stockFilter === 'in') matchesStock = stock > threshold;
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [items, search, categoryFilter, stockFilter]);

  const getStockStatus = (item: ItemWithCategory) => {
    const stock = item.total_stock || 0;
    const threshold = item.low_stock_threshold || 10;
    
    if (stock <= 0) return { label: 'Out of Stock', class: 'bg-destructive/20 text-destructive' };
    if (stock <= threshold) return { label: 'Low Stock', class: 'bg-warning/20 text-warning' };
    return { label: 'In Stock', class: 'bg-green-500/20 text-green-400' };
  };

  const lowStockCount = items?.filter(i => (i.total_stock || 0) > 0 && (i.total_stock || 0) <= (i.low_stock_threshold || 10)).length || 0;
  const outOfStockCount = items?.filter(i => (i.total_stock || 0) <= 0).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <OpeningStockDialog />
      </div>

      {/* Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex gap-3">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-destructive">{outOfStockCount} items out of stock</span>
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/30 rounded text-sm">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-warning">{lowStockCount} items low on stock</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px] h-8 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Table */}
      <div className="border rounded-md">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit Type</TableHead>
              <TableHead className="text-right">Total Stock</TableHead>
              <TableHead>Batch Breakdown</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading inventory...</TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const status = getStockStatus(item);
                const totalStock = item.total_stock || 0;
                const conversionFactor = item.conversion_factor || null;
                const secondaryUnit = item.secondary_unit || null;
                const secondaryStock = conversionFactor && secondaryUnit ? totalStock * conversionFactor : null;
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      {item.categories?.name ? (
                        <Badge variant="secondary" className="text-xs">{item.categories.name}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {item.unit_type === 'piece' ? 'Piece Only' : 
                         item.unit_type === 'kg_number' ? 'Kg - Pcs' : 'SqFt - Pcs'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <span className="font-bold">{totalStock.toFixed(2)}</span>
                        <span className="text-muted-foreground ml-1">{item.primary_unit}</span>
                      </div>
                      {secondaryStock !== null && secondaryUnit && (
                        <div className="text-xs text-muted-foreground">
                          ({secondaryStock.toFixed(1)} {secondaryUnit})
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <BatchBreakdown item={item} />
                    </TableCell>
                    <TableCell>
                      <Badge className={status.class}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 gap-1"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Plus className="w-3 h-3" />
                        Stock
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredItems.length} of {items?.length || 0} items
      </div>

      <AddStockDialog 
        item={selectedItem} 
        open={!!selectedItem} 
        onOpenChange={(open) => !open && setSelectedItem(null)} 
      />
    </div>
  );
}
