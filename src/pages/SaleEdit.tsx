import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useBatchesByItem, type Batch } from '@/hooks/useBatches';
import { useSales, type SaleLineItem } from '@/hooks/useSales';
import { useUpdateSale } from '@/hooks/useUpdateSale';
import { Search, Trash2, Save, ArrowLeft } from 'lucide-react';

interface EditLineItem extends SaleLineItem {
  primary_unit: string;
  secondary_unit: string | null;
  conversion_factor: number | null;
}

export default function SaleEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sales } = useSales();
  const { data: items } = useItems();
  const updateSale = useUpdateSale();
  const searchRef = useRef<HTMLInputElement>(null);

  const [lineItems, setLineItems] = useState<EditLineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [search, setSearch] = useState('');
  const [showItemList, setShowItemList] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [loaded, setLoaded] = useState(false);

  const sale = useMemo(() => sales?.find(s => s.id === id), [sales, id]);
  const { data: batches } = useBatchesByItem(selectedItemId);
  const selectedItem = useMemo(() => items?.find(i => i.id === selectedItemId), [items, selectedItemId]);

  // Load sale data
  useEffect(() => {
    if (sale && items && !loaded) {
      setCustomerName(sale.customer_name || '');
      setDiscount(sale.discount || 0);
      setLineItems(sale.sale_items.map(si => {
        const item = items.find(i => i.id === si.item_id);
        return {
          item_id: si.item_id,
          item_name: si.items?.name || '',
          batch_id: si.batch_id,
          batch_name: si.batches?.batch_name || '',
          quantity_primary: si.quantity_primary,
          quantity_secondary: si.quantity_secondary,
          rate: si.rate,
          purchase_price: si.purchase_price,
          total: si.total,
          profit: si.profit,
          primary_unit: item?.primary_unit || 'pcs',
          secondary_unit: item?.secondary_unit || null,
          conversion_factor: item?.conversion_factor || null,
        };
      }));
      setLoaded(true);
    }
  }, [sale, items, loaded]);

  const filteredItems = useMemo(() => {
    if (!items || !search) return [];
    const s = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(s) || i.item_code.toLowerCase().includes(s)).slice(0, 10);
  }, [items, search]);

  const sortedBatches = useMemo(() => {
    if (!batches || !selectedItem) return [];
    const priority = (selectedItem as any).batch_priority || 'fifo';
    const filtered = batches.filter(b => b.remaining_quantity > 0);
    return priority === 'lifo'
      ? filtered.sort((a, b) => b.serial_number - a.serial_number)
      : filtered.sort((a, b) => a.serial_number - b.serial_number);
  }, [batches, selectedItem]);

  const selectBatch = (batch: Batch) => {
    const item = items?.find(i => i.id === selectedItemId);
    if (!item) return;
    const cf = (batch as any).batch_conversion_factor ?? item.conversion_factor ?? null;
    setLineItems(prev => [...prev, {
      item_id: item.id, item_name: item.name, batch_id: batch.id, batch_name: batch.batch_name,
      quantity_primary: 1, quantity_secondary: cf ? cf : null,
      rate: batch.selling_price, purchase_price: batch.purchase_price,
      total: batch.selling_price, profit: batch.selling_price - batch.purchase_price,
      primary_unit: item.primary_unit, secondary_unit: item.secondary_unit || null, conversion_factor: cf,
    }]);
    setSelectedItemId(''); setSearch('');
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const updateQty = (i: number, qty: number) => {
    const updated = [...lineItems]; const li = updated[i];
    li.quantity_primary = qty;
    if (li.conversion_factor) li.quantity_secondary = qty * li.conversion_factor;
    li.total = qty * li.rate; li.profit = (li.rate - li.purchase_price) * qty;
    setLineItems(updated);
  };

  const updateRate = (i: number, rate: number) => {
    const updated = [...lineItems]; const li = updated[i];
    li.rate = rate; li.total = li.quantity_primary * rate; li.profit = (rate - li.purchase_price) * li.quantity_primary;
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const totalAmount = subtotal - discount;
  const getItemDiscount = (t: number) => discount > 0 && subtotal > 0 ? (t / subtotal) * discount : 0;

  const handleSave = async () => {
    if (!id) return;
    await updateSale.mutateAsync({
      id,
      customer_name: customerName || undefined,
      discount,
      items: lineItems.map(li => {
        const d = getItemDiscount(li.total);
        return { ...li, total: li.total - d, profit: li.profit - d };
      }),
    });
    navigate('/sales');
  };

  if (!sale) return <div className="p-8 text-center text-muted-foreground">Loading sale...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sales')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-semibold">Edit Sale: {sale.sale_number}</h1>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Add item..." value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedItemId(''); setShowItemList(true); }}
              onFocus={() => setShowItemList(true)} className="pl-8 h-9" />
          </div>

          {showItemList && !selectedItemId && filteredItems.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-auto">
              {filteredItems.map(item => (
                <div key={item.id} className="p-2 hover:bg-accent cursor-pointer" onClick={() => { setSelectedItemId(item.id); setShowItemList(false); }}>
                  <span className="font-mono text-xs">{item.item_code}</span> - {item.name}
                </div>
              ))}
            </div>
          )}

          {selectedItemId && sortedBatches.length > 0 && (
            <div className="border rounded-md p-2 space-y-2">
              <div className="text-sm font-medium">Select Batch</div>
              <div className="flex flex-wrap gap-2">
                {sortedBatches.map(b => (
                  <Button key={b.id} variant="outline" size="sm" className="text-xs" onClick={() => selectBatch(b)}>
                    {b.batch_name} - {b.remaining_quantity} @ ₹{b.selling_price}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-20">Rate ₹</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((li, i) => (
                <TableRow key={i}>
                  <TableCell>{li.item_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{li.batch_name}</Badge></TableCell>
                  <TableCell><Input type="number" value={li.quantity_primary} onChange={(e) => updateQty(i, parseFloat(e.target.value) || 0)} className="h-7 w-16" /></TableCell>
                  <TableCell><Input type="number" value={li.rate} onChange={(e) => updateRate(i, parseFloat(e.target.value) || 0)} className="h-7 w-20" /></TableCell>
                  <TableCell className="text-right font-mono">₹{li.total.toFixed(2)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setLineItems(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="w-3 h-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Customer Name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-7" />
          </div>
          <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono">₹{subtotal.toFixed(2)}</span></div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Discount ₹</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="h-7 w-24" />
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>₹{totalAmount.toFixed(2)}</span></div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => navigate('/sales')}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateSale.isPending} className="gap-1">
              <Save className="w-4 h-4" />
              {updateSale.isPending ? 'Saving...' : 'Update Sale'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}