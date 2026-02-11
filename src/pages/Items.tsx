import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useItems, useDeleteItem, useUpdateItem, type ItemWithCategory } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { CategoryDialog } from '@/components/items/CategoryDialog';
import { ItemFormDialog } from '@/components/items/ItemFormDialog';
import { BulkUploadDialog } from '@/components/items/BulkUploadDialog';
import { ItemBatchesDialog } from '@/components/items/ItemBatchesDialog';
import { Search, Plus, Pencil, Trash2, Package, ChevronDown, AlertTriangle, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';

export default function Items() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<ItemWithCategory | null>(null);
  const [deleteItem, setDeleteItem] = useState<ItemWithCategory | null>(null);
  const [permanentDeleteItem, setPermanentDeleteItem] = useState<ItemWithCategory | null>(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState('');
  const [viewBatchesItem, setViewBatchesItem] = useState<ItemWithCategory | null>(null);

  const { data: items, isLoading } = useItems();
  const { data: categories } = useCategories();
  const deleteItemMutation = useDeleteItem();
  const updateItemMutation = useUpdateItem();

  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    let filtered = items.filter(item => {
      const matchesSearch = search === '' || 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.item_code.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });

    // Sort by sort_order
    return filtered.sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0));
  }, [items, search, categoryFilter]);

  const handleEdit = (item: ItemWithCategory) => {
    setEditItem(item);
    setShowItemForm(true);
  };

  const handleDelete = async () => {
    if (deleteItem) {
      await deleteItemMutation.mutateAsync(deleteItem.id);
      setDeleteItem(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (permanentDeleteItem && permanentDeleteConfirm === permanentDeleteItem.name) {
      await deleteItemMutation.mutateAsync(permanentDeleteItem.id);
      setPermanentDeleteItem(null);
      setPermanentDeleteConfirm('');
    }
  };

  const moveItem = async (item: ItemWithCategory, direction: 'up' | 'down') => {
    const index = filteredItems.findIndex(i => i.id === item.id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === filteredItems.length - 1)) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const swapItem = filteredItems[swapIndex];
    
    const currentOrder = (item as any).sort_order || 0;
    const swapOrder = (swapItem as any).sort_order || 0;

    await Promise.all([
      updateItemMutation.mutateAsync({ id: item.id, sort_order: swapOrder } as any),
      updateItemMutation.mutateAsync({ id: swapItem.id, sort_order: currentOrder } as any),
    ]);
  };

  const getStockStatusClass = (item: ItemWithCategory) => {
    const stock = item.total_stock || 0;
    const threshold = item.low_stock_threshold || 10;
    
    if (stock <= 0) return 'out-of-stock';
    if (stock <= threshold) return 'low-stock';
    return 'text-green-400';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Items</h1>
        <div className="flex gap-2">
          <CategoryDialog />
          <BulkUploadDialog />
          <Button size="sm" className="h-8 gap-1" onClick={() => { setEditItem(null); setShowItemForm(true); }}>
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </Button>
        </div>
      </div>

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
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items Table */}
      <div className="border rounded-md">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price ₹</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading items...</TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {items?.length === 0 ? 'No items yet. Add your first item.' : 'No items match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveItem(item, 'up')} disabled={idx === 0}>
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveItem(item, 'down')} disabled={idx === filteredItems.length - 1}>
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.categories?.name ? (
                      <Badge variant="secondary" className="text-xs">{item.categories.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.unit_type === 'piece' ? item.primary_unit : `${item.primary_unit}/${item.secondary_unit}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`h-6 px-2 gap-1 font-mono ${getStockStatusClass(item)}`}
                      onClick={() => setViewBatchesItem(item)}
                    >
                      {item.total_stock || 0}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right font-mono">₹{item.current_selling_price}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewBatchesItem(item)}>
                        <Package className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(item)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteItem(item)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setPermanentDeleteItem(item)} title="Permanent Delete">
                        <AlertTriangle className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredItems.length} of {items?.length || 0} items
      </div>

      {/* Dialogs */}
      <ItemFormDialog 
        open={showItemForm} 
        onOpenChange={setShowItemForm} 
        editItem={editItem}
      />
      
      <ItemBatchesDialog
        item={viewBatchesItem}
        open={!!viewBatchesItem}
        onOpenChange={(open) => !open && setViewBatchesItem(null)}
      />

      {/* Regular Delete */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This will also delete all batches and stock history for this item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete (double confirm) */}
      <AlertDialog open={!!permanentDeleteItem} onOpenChange={() => { setPermanentDeleteItem(null); setPermanentDeleteConfirm(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Permanent Delete
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{permanentDeleteItem?.name}" and all associated batches, stock, and transaction history. Type the item name to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={permanentDeleteConfirm}
            onChange={(e) => setPermanentDeleteConfirm(e.target.value)}
            placeholder={permanentDeleteItem?.name}
            className="h-8 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermanentDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={permanentDeleteConfirm !== permanentDeleteItem?.name}
            >
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
