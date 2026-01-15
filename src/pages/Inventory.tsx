import { useState, useMemo } from 'react';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useBatchesByItem, type Batch } from '@/hooks/useBatches';
import { OpeningStockDialog } from '@/components/inventory/OpeningStockDialog';
import { BatchAdjustDialog } from '@/components/inventory/BatchAdjustDialog';
import { ExportButton } from '@/components/common/ExportButton';
import { INVENTORY_COLUMNS } from '@/lib/exportUtils';
import { getReportColumns } from '@/hooks/useSettings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { Search, Plus, AlertTriangle, Wrench } from 'lucide-react';
import { format } from 'date-fns';

function BatchBreakdown({ item, onAdjust }: { item: ItemWithCategory; onAdjust: (batch: Batch) => void }) {
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
            className="text-[10px] px-1.5 py-0 font-mono cursor-pointer hover:bg-accent"
            title={`Click to adjust | Purchase: ₹${batch.purchase_price} | Selling: ₹${batch.selling_price}`}
            onClick={() => onAdjust(batch)}
          >
            {batch.batch_name.split('/')[0]}
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

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ItemWithCategory | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<{ batch: Batch; item: ItemWithCategory } | null>(null);

  const { data: items, isLoading } = useItems();
  const { data: categories } = useCategories();
  const reportColumns = getReportColumns();

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
        <div className="flex gap-2">
          <ExportButton data={filteredItems} allColumns={INVENTORY_COLUMNS} defaultColumns={reportColumns.inventory} title="Inventory" filename={`inventory_${format(new Date(), 'yyyy-MM-dd')}`} />
          <OpeningStockDialog />
        </div>
      </div>

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

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[130px] h-8 text-sm"><SelectValue placeholder="Stock Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Total Stock</TableHead>
              <TableHead>Batch Breakdown (click to adjust)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">No items found.</TableCell></TableRow>
            ) : (
              filteredItems.map((item) => {
                const status = getStockStatus(item);
                const totalStock = item.total_stock || 0;
                const secondaryStock = item.conversion_factor && item.secondary_unit ? totalStock * item.conversion_factor : null;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.categories?.name ? <Badge variant="secondary" className="text-xs">{item.categories.name}</Badge> : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div><span className="font-bold">{totalStock.toFixed(2)}</span> <span className="text-muted-foreground">{item.primary_unit}</span></div>
                      {secondaryStock !== null && item.secondary_unit && (<div className="text-xs text-muted-foreground">({secondaryStock.toFixed(1)} {item.secondary_unit})</div>)}
                    </TableCell>
                    <TableCell><BatchBreakdown item={item} onAdjust={(batch) => setAdjustBatch({ batch, item })} /></TableCell>
                    <TableCell><Badge className={status.class}>{status.label}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="sm" className="h-6 gap-1" onClick={() => setSelectedItem(item)}><Plus className="w-3 h-3" />Stock</Button></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">Showing {filteredItems.length} of {items?.length || 0} items</div>

      <Dialog open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" />Add Stock - {selectedItem?.name}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">Use the Purchases module to add new stock batches, or add Opening Stock for initial inventory.</div>
          {selectedItem && <OpeningStockDialog selectedItem={selectedItem} onSuccess={() => setSelectedItem(null)} />}
        </DialogContent>
      </Dialog>

      <BatchAdjustDialog 
        batch={adjustBatch?.batch || null} 
        open={!!adjustBatch} 
        onOpenChange={(o) => !o && setAdjustBatch(null)}
        primaryUnit={adjustBatch?.item.primary_unit}
        secondaryUnit={adjustBatch?.item.secondary_unit}
        conversionFactor={adjustBatch?.item.conversion_factor}
      />
    </div>
  );
}
