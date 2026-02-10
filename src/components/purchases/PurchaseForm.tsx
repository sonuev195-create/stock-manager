import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreatePurchase, usePurchases } from '@/hooks/usePurchases';
import { useUpdatePurchase } from '@/hooks/useUpdatePurchase';
import { format } from 'date-fns';
import { ArrowLeft, Trash2, Save, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseLineItemWithUnits {
  item_id: string;
  item: ItemWithCategory;
  quantity_primary: number;
  quantity_secondary: number | null;
  batch_conversion_factor: number | null;
  purchase_price: number;
  selling_price: number;
  total: number;
}

const selectAllOnDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
  e.currentTarget.select();
};

export function PurchaseForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;

  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseLineItemWithUnits[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [initialized, setInitialized] = useState(false);

  const { data: items } = useItems();
  const { data: suppliers } = useSuppliers();
  const { data: purchases } = usePurchases();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();

  // Load purchase data when editing
  useEffect(() => {
    if (isEdit && purchases && items && !initialized) {
      const purchase = purchases.find(p => p.id === editId);
      if (purchase) {
        setSupplierId(purchase.supplier_id || '');
        setPurchaseDate(purchase.purchase_date);
        setNotes(purchase.notes || '');
        setLineItems(purchase.purchase_items.map(pi => {
          const item = items.find(i => i.id === pi.item_id);
          return {
            item_id: pi.item_id,
            item: item!,
            quantity_primary: pi.quantity,
            quantity_secondary: item?.unit_type !== 'piece' && item?.conversion_factor ? pi.quantity * item.conversion_factor : null,
            batch_conversion_factor: item?.conversion_factor || null,
            purchase_price: pi.purchase_price,
            selling_price: pi.selling_price,
            total: pi.total,
          };
        }).filter(li => li.item));
        setInitialized(true);
      }
    }
  }, [isEdit, editId, purchases, items, initialized]);

  const filteredItems = items?.filter(i => 
    !lineItems.some(li => li.item_id === i.id) &&
    (i.name.toLowerCase().includes(searchValue.toLowerCase()) || 
     i.item_code.toLowerCase().includes(searchValue.toLowerCase()))
  ) || [];

  const selectItem = (item: ItemWithCategory) => {
    const initialConversion = item.conversion_factor || null;
    
    setLineItems(prev => [...prev, {
      item_id: item.id,
      item: item,
      quantity_primary: 0,
      quantity_secondary: item.unit_type !== 'piece' && initialConversion ? 0 : null,
      batch_conversion_factor: initialConversion,
      purchase_price: 0,
      selling_price: item.current_selling_price,
      total: 0,
    }]);
    
    setSearchOpen(false);
    setSearchValue('');
  };

  const updatePrimaryQuantity = (index: number, value: number) => {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== index) return li;
      const secondary = li.item.unit_type !== 'piece' && li.batch_conversion_factor
        ? value * li.batch_conversion_factor : li.quantity_secondary;
      return { ...li, quantity_primary: value, quantity_secondary: secondary, total: value * li.purchase_price };
    }));
  };

  const updateSecondaryQuantity = (index: number, value: number) => {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== index) return li;
      // Only update secondary and recalculate conversion factor, do NOT change primary
      const newConversion = li.quantity_primary > 0 ? value / li.quantity_primary : li.batch_conversion_factor;
      return { ...li, quantity_secondary: value, batch_conversion_factor: newConversion };
    }));
  };

  const updatePrice = (index: number, field: 'purchase_price' | 'selling_price', value: number) => {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== index) return li;
      const updated = { ...li, [field]: value };
      if (field === 'purchase_price') updated.total = updated.quantity_primary * value;
      return updated;
    }));
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (lineItems.length === 0) return;

    const mappedItems = lineItems
      .filter(li => li.quantity_primary > 0)
      .map(li => ({
        item_id: li.item_id,
        item_name: li.item.name,
        item_code: li.item.item_code,
        quantity: li.quantity_primary,
        quantity_secondary: li.quantity_secondary,
        batch_conversion_factor: li.batch_conversion_factor,
        purchase_price: li.purchase_price,
        selling_price: li.selling_price,
        total: li.total,
      }));

    if (isEdit) {
      await updatePurchase.mutateAsync({
        id: editId!,
        supplier_id: supplierId || undefined,
        notes,
        items: mappedItems.map(i => ({
          item_id: i.item_id,
          quantity: i.quantity,
          quantity_secondary: i.quantity_secondary ?? undefined,
          purchase_price: i.purchase_price,
          selling_price: i.selling_price,
        })),
      });
    } else {
      await createPurchase.mutateAsync({
        supplier_id: supplierId || null,
        purchase_date: purchaseDate,
        notes,
        items: mappedItems,
      });
    }
    
    navigate('/purchases');
  };

  const isPending = createPurchase.isPending || updatePurchase.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/purchases')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold">{isEdit ? 'Edit Purchase' : 'New Purchase'}</h1>
      </div>

      {/* Purchase Details + Supplier combined */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="h-8 text-sm"
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-8 text-sm"
                placeholder="Optional notes..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add Item */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-9 justify-start gap-2">
                <Plus className="w-4 h-4" />
                {lineItems.length === 0 ? 'Search and select item...' : 'Add another item...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search by name or code..." 
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>No items found.</CommandEmpty>
                  <CommandGroup>
                    {filteredItems.slice(0, 10).map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.item_code} ${item.name}`}
                        onSelect={() => selectItem(item)}
                        className="cursor-pointer"
                      >
                        <div className="flex-1">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{item.item_code}</span>
                          <span>{item.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({item.primary_unit}{item.secondary_unit ? `/${item.secondary_unit}` : ''})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">₹{item.current_selling_price}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Items Table */}
          {lineItems.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qty (Primary)</TableHead>
                    <TableHead className="w-24">Qty (Secondary)</TableHead>
                    <TableHead className="w-20">Conv.</TableHead>
                    <TableHead className="w-24">Purchase ₹</TableHead>
                    <TableHead className="w-24">Selling ₹</TableHead>
                    <TableHead className="w-24 text-right">Total ₹</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((lineItem, index) => (
                    <TableRow key={lineItem.item_id}>
                      <TableCell>
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">{lineItem.item.item_code}</span>
                          <span className="ml-2">{lineItem.item.name}</span>
                          <div className="text-xs text-muted-foreground">
                            {lineItem.item.primary_unit}
                            {lineItem.item.secondary_unit && ` / ${lineItem.item.secondary_unit}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={lineItem.quantity_primary || ''}
                            onChange={(e) => updatePrimaryQuantity(index, parseFloat(e.target.value) || 0)}
                            onDoubleClick={selectAllOnDoubleClick}
                            className="h-7 text-sm w-20"
                          />
                          <span className="text-xs text-muted-foreground">{lineItem.item.primary_unit}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lineItem.item.unit_type !== 'piece' && lineItem.item.secondary_unit ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={lineItem.quantity_secondary != null ? lineItem.quantity_secondary : ''}
                              onChange={(e) => updateSecondaryQuantity(index, parseFloat(e.target.value) || 0)}
                              onDoubleClick={selectAllOnDoubleClick}
                              className="h-7 text-sm w-20"
                            />
                            <span className="text-xs text-muted-foreground">{lineItem.item.secondary_unit}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lineItem.batch_conversion_factor !== null ? (
                          <span className="text-xs font-mono text-muted-foreground">
                            1:{lineItem.batch_conversion_factor.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={lineItem.purchase_price || ''}
                          onChange={(e) => updatePrice(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                          onDoubleClick={selectAllOnDoubleClick}
                          className="h-7 text-sm w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={lineItem.selling_price || ''}
                          onChange={(e) => updatePrice(index, 'selling_price', parseFloat(e.target.value) || 0)}
                          onDoubleClick={selectAllOnDoubleClick}
                          className="h-7 text-sm w-20"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{lineItem.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeLineItem(index)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {lineItems.length === 0 && (
            <div className="text-center text-muted-foreground py-8 border rounded-md">
              Click above to search and add items
            </div>
          )}

          {/* Total */}
          {lineItems.length > 0 && (
            <div className="flex justify-between items-center p-3 bg-muted rounded-md">
              <span className="font-medium">Total Amount</span>
              <span className="text-xl font-bold">₹{totalAmount.toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/purchases')}>Cancel</Button>
        <Button 
          className="gap-1" 
          onClick={handleSubmit} 
          disabled={lineItems.length === 0 || isPending}
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Saving...' : isEdit ? 'Update Purchase' : 'Save Purchase'}
        </Button>
      </div>
    </div>
  );
}
