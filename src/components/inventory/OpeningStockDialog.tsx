import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useCreateBatch } from '@/hooks/useBatches';
import { Package, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface OpeningStockDialogProps {
  selectedItem?: ItemWithCategory | null;
  onSuccess?: () => void;
}

export function OpeningStockDialog({ selectedItem, onSuccess }: OpeningStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(selectedItem?.id || '');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  
  const { data: items } = useItems();
  const createBatch = useCreateBatch();

  const selectedItemData = selectedItem || items?.find(i => i.id === itemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemId || !quantity || !purchasePrice || !sellingPrice) return;
    
    await createBatch.mutateAsync({
      item_id: itemId,
      batch_date: format(new Date(), 'yyyy-MM-dd'),
      quantity: parseFloat(quantity),
      remaining_quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      selling_price: parseFloat(sellingPrice),
      is_opening_stock: true,
    });
    
    setOpen(false);
    setItemId(selectedItem?.id || '');
    setQuantity('');
    setPurchasePrice('');
    setSellingPrice('');
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1">
          <Plus className="w-3.5 h-3.5" />
          Add Opening Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Add Opening Stock
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!selectedItem && (
            <div className="space-y-1.5">
              <Label className="text-xs">Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item_code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {selectedItem && (
            <div className="p-2 bg-accent/30 rounded text-sm">
              <span className="font-medium">{selectedItem.item_code}</span> - {selectedItem.name}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Quantity {selectedItemData ? `(${selectedItemData.primary_unit})` : ''}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-8 text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Purchase Price ₹</Label>
              <Input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="h-8 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Selling Price ₹</Label>
            <Input
              type="number"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="h-8 text-sm"
              placeholder="0.00"
            />
          </div>
          
          {quantity && purchasePrice && (
            <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
              Batch name will be: <span className="font-mono">001/Opening/{quantity}*{purchasePrice}</span>
            </div>
          )}
          
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createBatch.isPending}>
              {createBatch.isPending ? 'Saving...' : 'Add Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
