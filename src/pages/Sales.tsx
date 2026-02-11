import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useBatchesByItem, type Batch } from '@/hooks/useBatches';
import { useSales, useCreateSale, useDeleteSale, type SaleLineItem, type SaleWithDetails } from '@/hooks/useSales';
import { format } from 'date-fns';
import { Search, Plus, Trash2, ShoppingCart, Eye, TrendingUp, Upload, Edit2, AlertTriangle } from 'lucide-react';
import { BulkSaleUploadDialog } from '@/components/sales/BulkSaleUploadDialog';
import { SimpleBulkUploadDialog } from '@/components/sales/SimpleBulkUploadDialog';

interface SaleLineItemWithUnits extends SaleLineItem {
  primary_unit: string;
  secondary_unit: string | null;
  conversion_factor: number | null;
}

function QuickSale() {
  const [search, setSearch] = useState('');
  const [showItemList, setShowItemList] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [lineItems, setLineItems] = useState<SaleLineItemWithUnits[]>([]);
  const [discount, setDiscount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: items } = useItems();
  const { data: batches } = useBatchesByItem(selectedItemId);
  const createSale = useCreateSale();

  const selectedItem = useMemo(() => items?.find(i => i.id === selectedItemId), [items, selectedItemId]);

  const filteredItems = useMemo(() => {
    if (!items) return items || [];
    if (!search) return items.slice(0, 15);
    return items.filter(i => 
      i.name.toLowerCase().includes(search.toLowerCase()) || 
      i.item_code.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 15);
  }, [items, search]);

  const addItem = (itemId: string) => {
    const item = items?.find(i => i.id === itemId);
    if (!item) return;
    setSelectedItemId(itemId);
    setShowItemList(false);
  };

  const selectBatch = (batch: Batch) => {
    const item = items?.find(i => i.id === selectedItemId);
    if (!item || batch.remaining_quantity <= 0) return;

    const effectiveConversionFactor = (batch as any).batch_conversion_factor ?? item.conversion_factor ?? null;
    const secondaryQty = effectiveConversionFactor ? 1 * effectiveConversionFactor : null;

    setLineItems([...lineItems, {
      item_id: item.id,
      item_name: item.name,
      batch_id: batch.id,
      batch_name: batch.batch_name,
      quantity_primary: 1,
      quantity_secondary: secondaryQty,
      rate: batch.selling_price,
      purchase_price: batch.purchase_price,
      total: batch.selling_price,
      profit: batch.selling_price - batch.purchase_price,
      primary_unit: item.primary_unit,
      secondary_unit: item.secondary_unit || null,
      conversion_factor: effectiveConversionFactor,
    }]);
    setSelectedItemId('');
    setSearch('');
    // Auto-focus search for next entry
    setTimeout(() => {
      searchRef.current?.focus();
      setShowItemList(true);
    }, 100);
  };

  const updatePrimaryQuantity = (index: number, qty: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    item.quantity_primary = qty;
    if (item.conversion_factor) {
      item.quantity_secondary = qty * item.conversion_factor;
    }
    item.total = qty * item.rate;
    item.profit = (item.rate - item.purchase_price) * qty;
    setLineItems(updated);
  };

  const updateSecondaryQuantity = (index: number, qty: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    item.quantity_secondary = qty;
    if (item.conversion_factor && item.conversion_factor !== 0) {
      item.quantity_primary = qty / item.conversion_factor;
      item.total = item.quantity_primary * item.rate;
      item.profit = (item.rate - item.purchase_price) * item.quantity_primary;
    }
    setLineItems(updated);
  };

  const updateRate = (index: number, rate: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    item.rate = rate;
    item.total = item.quantity_primary * rate;
    item.profit = (rate - item.purchase_price) * item.quantity_primary;
    setLineItems(updated);
  };

  const removeItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const totalAmount = subtotal - discount;
  const totalProfit = lineItems.reduce((sum, i) => sum + i.profit, 0) - discount;

  const handleSave = async () => {
    if (lineItems.length === 0) return;
    await createSale.mutateAsync({
      sale_type: 'quick',
      subtotal,
      discount,
      tax: 0,
      total_amount: totalAmount,
      items: lineItems.map(li => ({
        item_id: li.item_id,
        item_name: li.item_name,
        batch_id: li.batch_id,
        batch_name: li.batch_name,
        quantity_primary: li.quantity_primary,
        quantity_secondary: li.quantity_secondary,
        rate: li.rate,
        purchase_price: li.purchase_price,
        total: li.total,
        profit: li.profit,
      })),
    });
    setLineItems([]);
    setDiscount(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search item by name or code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedItemId(''); setShowItemList(true); }}
              onFocus={() => { setShowItemList(true); setSelectedItemId(''); }}
              className="pl-8 h-9"
            />
          </div>

          {showItemList && !selectedItemId && filteredItems.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-auto">
              {filteredItems.map(item => {
                const secondaryStock = item.conversion_factor && item.secondary_unit 
                  ? (item.total_stock || 0) * item.conversion_factor 
                  : null;
                return (
                  <div key={item.id} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center" onClick={() => addItem(item.id)}>
                    <span><span className="font-mono text-xs">{item.item_code}</span> - {item.name}</span>
                    <div className="text-right">
                      <Badge variant="outline">{item.total_stock} {item.primary_unit}</Badge>
                      {secondaryStock !== null && item.secondary_unit && (
                        <span className="text-xs text-muted-foreground ml-1">({secondaryStock.toFixed(1)} {item.secondary_unit})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedItemId && batches && selectedItem && (
            <div className="border rounded-md p-2 space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">Select Batch for: {selectedItem.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedItem.primary_unit}{selectedItem.secondary_unit && ` / ${selectedItem.secondary_unit}`}
                  {selectedItem.conversion_factor && selectedItem.conversion_factor !== 1 && (
                    <span className="ml-1">(1:{selectedItem.conversion_factor})</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {batches.filter(b => b.remaining_quantity > 0).map(batch => {
                  const effectiveConversion = (batch as any).batch_conversion_factor ?? selectedItem.conversion_factor ?? null;
                  const secondaryRemaining = effectiveConversion && selectedItem.secondary_unit
                    ? batch.remaining_quantity * effectiveConversion
                    : null;
                  return (
                    <Button key={batch.id} variant="outline" size="sm" className="text-xs h-auto py-1" onClick={() => selectBatch(batch)}>
                      <div className="text-left">
                        <div>{batch.batch_name.split('/')[0]} @ ₹{batch.selling_price}</div>
                        <div className="text-muted-foreground">
                          {batch.remaining_quantity} {selectedItem.primary_unit}
                          {secondaryRemaining !== null && selectedItem.secondary_unit && (
                            <span> ({secondaryRemaining.toFixed(1)} {selectedItem.secondary_unit})</span>
                          )}
                          {effectiveConversion && effectiveConversion !== selectedItem.conversion_factor && (
                            <span className="ml-1 text-blue-400">[1:{effectiveConversion.toFixed(1)}]</span>
                          )}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {lineItems.length > 0 && (
            <div className="overflow-x-auto">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="w-24">Qty (Primary)</TableHead>
                    <TableHead className="w-24">Qty (Secondary)</TableHead>
                    <TableHead className="w-24">Rate ₹</TableHead>
                    <TableHead className="text-right">Total ₹</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          {item.item_name}
                          <div className="text-xs text-muted-foreground">
                            {item.primary_unit}{item.secondary_unit && ` / ${item.secondary_unit}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{item.batch_name.split('/')[0]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            step="0.01"
                            value={item.quantity_primary} 
                            onChange={(e) => updatePrimaryQuantity(i, parseFloat(e.target.value) || 0)} 
                            onDoubleClick={(e) => e.currentTarget.select()}
                            className="h-7 w-16" 
                          />
                          <span className="text-xs text-muted-foreground">{item.primary_unit}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.secondary_unit && item.conversion_factor ? (
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              step="0.01"
                              value={item.quantity_secondary != null ? item.quantity_secondary : ''} 
                              onChange={(e) => updateSecondaryQuantity(i, parseFloat(e.target.value) || 0)} 
                              onDoubleClick={(e) => e.currentTarget.select()}
                              className="h-7 w-16" 
                            />
                            <span className="text-xs text-muted-foreground">{item.secondary_unit}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.rate} onChange={(e) => updateRate(i, parseFloat(e.target.value) || 0)} className="h-7 w-20" />
                      </TableCell>
                      <TableCell className="text-right font-mono">₹{item.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono">₹{subtotal.toFixed(2)}</span></div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Discount ₹</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="h-7 w-24" />
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="font-mono">₹{totalAmount.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-green-400"><TrendingUp className="w-4 h-4" /><span>Profit: ₹{totalProfit.toFixed(2)}</span></div>
          <Button className="w-full gap-1" onClick={handleSave} disabled={lineItems.length === 0 || createSale.isPending}>
            <ShoppingCart className="w-4 h-4" />
            {createSale.isPending ? 'Saving...' : 'Complete Sale'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesHistory() {
  const [showProfit, setShowProfit] = useState(false);
  const [viewSale, setViewSale] = useState<SaleWithDetails | null>(null);
  const [deleteSaleTarget, setDeleteSaleTarget] = useState<SaleWithDetails | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<SaleWithDetails | null>(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState('');
  const { data: sales, isLoading } = useSales();
  const deleteSaleMutation = useDeleteSale();

  const handleDelete = async () => {
    if (deleteSaleTarget) {
      await deleteSaleMutation.mutateAsync(deleteSaleTarget.id);
      setDeleteSaleTarget(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (permanentDeleteTarget && permanentDeleteConfirm === permanentDeleteTarget.sale_number) {
      await deleteSaleMutation.mutateAsync(permanentDeleteTarget.id);
      setPermanentDeleteTarget(null);
      setPermanentDeleteConfirm('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowProfit(!showProfit)}>
          <TrendingUp className="w-3 h-3 mr-1" />{showProfit ? 'Hide' : 'Show'} Profit
        </Button>
      </div>
      <div className="border rounded-md">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total ₹</TableHead>
              {showProfit && <TableHead className="text-right">Profit ₹</TableHead>}
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={showProfit ? 7 : 6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : sales?.length === 0 ? (
              <TableRow><TableCell colSpan={showProfit ? 7 : 6} className="text-center py-8">No sales yet.</TableCell></TableRow>
            ) : (
              sales?.map(sale => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-sm">{sale.sale_number}</TableCell>
                  <TableCell>{format(new Date(sale.sale_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{sale.customer_name || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{sale.sale_items.length}</Badge></TableCell>
                  <TableCell className="text-right font-mono font-medium">₹{sale.total_amount}</TableCell>
                  {showProfit && <TableCell className="text-right font-mono text-green-400">₹{sale.total_profit}</TableCell>}
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewSale(sale)} title="View">
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteSaleTarget(sale)} title="Delete (restore stock)">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setPermanentDeleteTarget(sale)} title="Permanent Delete">
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

      {/* View Sale Dialog */}
      <Dialog open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Sale {viewSale?.sale_number}</DialogTitle></DialogHeader>
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty (Primary)</TableHead>
                <TableHead className="text-right">Qty (Secondary)</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewSale?.sale_items.map(si => (
                <TableRow key={si.id}>
                  <TableCell>
                    <div>
                      {si.items?.name}
                      <div className="text-xs text-muted-foreground">
                        {si.items?.primary_unit}{si.items?.secondary_unit && ` / ${si.items.secondary_unit}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{si.batches?.batch_name.split('/')[0]}</Badge></TableCell>
                  <TableCell className="text-right">{si.quantity_primary} {si.items?.primary_unit}</TableCell>
                  <TableCell className="text-right">
                    {si.quantity_secondary ? `${si.quantity_secondary} ${si.items?.secondary_unit || ''}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">₹{si.rate}</TableCell>
                  <TableCell className="text-right font-medium">₹{si.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between p-3 bg-muted rounded-md">
            <span>Total Amount</span>
            <span className="font-bold">₹{viewSale?.total_amount}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete (restore stock) dialog */}
      <AlertDialog open={!!deleteSaleTarget} onOpenChange={() => setDeleteSaleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteSaleTarget?.sale_number}"? Stock will be restored to respective batches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete dialog (double confirm) */}
      <AlertDialog open={!!permanentDeleteTarget} onOpenChange={() => { setPermanentDeleteTarget(null); setPermanentDeleteConfirm(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Permanent Delete
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{permanentDeleteTarget?.sale_number}" and restore stock. Type the invoice number to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={permanentDeleteConfirm}
            onChange={(e) => setPermanentDeleteConfirm(e.target.value)}
            placeholder={permanentDeleteTarget?.sale_number}
            className="h-8 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermanentDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={permanentDeleteConfirm !== permanentDeleteTarget?.sale_number}
            >
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Sales() {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showSimpleBulkUpload, setShowSimpleBulkUpload] = useState(false);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sales</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setShowSimpleBulkUpload(true)}>
            <Upload className="w-3.5 h-3.5" />
            Quick Bulk
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setShowBulkUpload(true)}>
            <Upload className="w-3.5 h-3.5" />
            Bulk Upload Bills
          </Button>
        </div>
      </div>
      <Tabs defaultValue="quick">
        <TabsList><TabsTrigger value="quick">Quick Sale</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
        <TabsContent value="quick" className="mt-4"><QuickSale /></TabsContent>
        <TabsContent value="history" className="mt-4"><SalesHistory /></TabsContent>
      </Tabs>
      
      <BulkSaleUploadDialog open={showBulkUpload} onOpenChange={setShowBulkUpload} />
      <SimpleBulkUploadDialog open={showSimpleBulkUpload} onOpenChange={setShowSimpleBulkUpload} />
    </div>
  );
}
