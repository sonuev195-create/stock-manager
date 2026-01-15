import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useCreatePurchase } from '@/hooks/usePurchases';
import { format } from 'date-fns';
import { ArrowLeft, Trash2, Save, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseLineItemWithUnits {
  item_id: string;
  item: ItemWithCategory;
  quantity_primary: number;
  quantity_secondary: number | null;
  batch_conversion_factor: number | null; // Per-batch conversion factor
  purchase_price: number;
  selling_price: number;
  total: number;
}

export function PurchaseForm() {
  const navigate = useNavigate();
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseLineItemWithUnits[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const lastSearchRef = useRef('');

  const { data: items } = useItems();
  const { data: suppliers } = useSuppliers();
  const createPurchase = useCreatePurchase();

  const filteredItems = items?.filter(i => 
    !lineItems.some(li => li.item_id === i.id) &&
    (i.name.toLowerCase().includes(searchValue.toLowerCase()) || 
     i.item_code.toLowerCase().includes(searchValue.toLowerCase()))
  ) || [];

  const selectItem = (item: ItemWithCategory) => {
    lastSearchRef.current = searchValue;
    
    const initialConversion = item.conversion_factor || null;
    
    setLineItems([...lineItems, {
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
    // Auto-open search for next item with same search text
    setTimeout(() => {
      setSearchValue(lastSearchRef.current);
      setSearchOpen(true);
    }, 100);
  };

  const updatePrimaryQuantity = (index: number, value: number) => {
    const updated = [...lineItems];
    const lineItem = updated[index];
    lineItem.quantity_primary = value;
    
    // Auto-calculate secondary using batch-specific conversion factor
    if (lineItem.item.unit_type !== 'piece' && lineItem.batch_conversion_factor) {
      lineItem.quantity_secondary = value * lineItem.batch_conversion_factor;
    }
    
    lineItem.total = value * lineItem.purchase_price;
    setLineItems(updated);
  };

  const updateSecondaryQuantity = (index: number, value: number) => {
    const updated = [...lineItems];
    const lineItem = updated[index];
    const oldSecondary = lineItem.quantity_secondary;
    lineItem.quantity_secondary = value;
    
    // When secondary is manually entered, calculate new conversion factor
    if (lineItem.quantity_primary > 0 && value > 0) {
      lineItem.batch_conversion_factor = value / lineItem.quantity_primary;
    } else if (lineItem.batch_conversion_factor && lineItem.batch_conversion_factor !== 0) {
      // Calculate primary from secondary using existing conversion
      lineItem.quantity_primary = value / lineItem.batch_conversion_factor;
      lineItem.total = lineItem.quantity_primary * lineItem.purchase_price;
    }
    
    setLineItems(updated);
  };

  // When both primary and secondary are entered, auto-calculate conversion
  const recalculateConversion = (index: number) => {
    const updated = [...lineItems];
    const lineItem = updated[index];
    
    if (lineItem.quantity_primary > 0 && lineItem.quantity_secondary && lineItem.quantity_secondary > 0) {
      lineItem.batch_conversion_factor = lineItem.quantity_secondary / lineItem.quantity_primary;
    }
    
    setLineItems(updated);
  };

  const updatePrice = (index: number, field: 'purchase_price' | 'selling_price', value: number) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    if (field === 'purchase_price') {
      updated[index].total = updated[index].quantity_primary * value;
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (lineItems.length === 0) return;
    
    await createPurchase.mutateAsync({
      supplier_id: supplierId || null,
      purchase_date: purchaseDate,
      notes,
      items: lineItems
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
        })),
    });
    
    navigate('/purchases');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/purchases')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold">New Purchase</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Purchase Details */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="h-8 text-sm"
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm min-h-[60px]"
                placeholder="Optional notes..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add Item - Direct Selection */}
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full h-9 justify-start gap-2">
                  <Search className="w-4 h-4" />
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
                              onBlur={() => recalculateConversion(index)}
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
                                value={lineItem.quantity_secondary?.toFixed(2) || ''}
                                onChange={(e) => updateSecondaryQuantity(index, parseFloat(e.target.value) || 0)}
                                onBlur={() => recalculateConversion(index)}
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
                            className="h-7 text-sm w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={lineItem.selling_price || ''}
                            onChange={(e) => updatePrice(index, 'selling_price', parseFloat(e.target.value) || 0)}
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
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/purchases')}>Cancel</Button>
        <Button 
          className="gap-1" 
          onClick={handleSubmit} 
          disabled={lineItems.length === 0 || createPurchase.isPending}
        >
          <Save className="w-4 h-4" />
          {createPurchase.isPending ? 'Saving...' : 'Save Purchase'}
        </Button>
      </div>
    </div>
  );
}
