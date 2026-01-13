import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useItems } from '@/hooks/useItems';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreatePurchase, type PurchaseLineItem } from '@/hooks/usePurchases';
import { format } from 'date-fns';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';

export function PurchaseForm() {
  const navigate = useNavigate();
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  const { data: items } = useItems();
  const { data: suppliers } = useSuppliers();
  const createPurchase = useCreatePurchase();

  const addLineItem = () => {
    if (!selectedItemId) return;
    
    const item = items?.find(i => i.id === selectedItemId);
    if (!item) return;
    
    // Check if item already exists
    if (lineItems.some(li => li.item_id === selectedItemId)) {
      return;
    }
    
    setLineItems([...lineItems, {
      item_id: item.id,
      item_name: item.name,
      item_code: item.item_code,
      quantity: 0,
      purchase_price: 0,
      selling_price: item.current_selling_price,
      total: 0,
    }]);
    setSelectedItemId('');
  };

  const updateLineItem = (index: number, field: keyof PurchaseLineItem, value: number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    updated[index].total = updated[index].quantity * updated[index].purchase_price;
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
      items: lineItems.filter(li => li.quantity > 0),
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
            {/* Add Item */}
            <div className="flex gap-2">
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Select item to add" />
                </SelectTrigger>
                <SelectContent>
                  {items?.filter(i => !lineItems.some(li => li.item_id === i.id)).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item_code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1" onClick={addLineItem} disabled={!selectedItemId}>
                <Plus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>

            {/* Items Table */}
            {lineItems.length > 0 && (
              <div className="border rounded-md">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Purchase ₹</TableHead>
                      <TableHead className="w-28">Selling ₹</TableHead>
                      <TableHead className="w-28 text-right">Total ₹</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={item.item_id}>
                        <TableCell>
                          <div>
                            <span className="font-mono text-xs text-muted-foreground">{item.item_code}</span>
                            <span className="ml-2">{item.item_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity || ''}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-7 text-sm w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.purchase_price || ''}
                            onChange={(e) => updateLineItem(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                            className="h-7 text-sm w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.selling_price || ''}
                            onChange={(e) => updateLineItem(index, 'selling_price', parseFloat(e.target.value) || 0)}
                            className="h-7 text-sm w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{item.total.toFixed(2)}
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
                Add items to this purchase
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
