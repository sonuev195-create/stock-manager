import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItems, type ItemWithCategory } from '@/hooks/useItems';
import { useBatchesWithStock } from '@/hooks/useBatches';
import { useCreateSale } from '@/hooks/useSales';
import { findBestMatch } from '@/lib/fuzzyMatch';
import { Camera, Upload, Loader2, Check, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PaperBillScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScannedItem {
  name: string;
  quantity: number;
  amount: number;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchedBatchId: string | null;
  confidence: number;
  confirmed: boolean;
  rate: number;
  purchase_price: number;
}

export function PaperBillScanDialog({ open, onOpenChange }: PaperBillScanDialogProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: items } = useItems();
  const { data: batchesWithStock } = useBatchesWithStock();
  const createSale = useCreateSale();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imageBase64) {
      toast.error('Please select or capture a bill image first');
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-bill', {
        body: { image_base64: imageBase64 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const scanned: ScannedItem[] = (data.items || []).map((item: any) => {
        const match = findBestMatch(item.name, items || [], (i) => [i.item_code, i.name]);
        const matchedItem = match?.item;
        
        // Find best batch based on item's batch_priority setting
        let bestBatch = null;
        if (matchedItem) {
          const itemBatches = batchesWithStock?.filter(b => b.item_id === matchedItem.id && b.remaining_quantity >= item.quantity) || [];
          const batchPriority = (matchedItem as any).batch_priority || 'fifo';
          if (itemBatches.length > 0) {
            bestBatch = itemBatches.sort((a, b) => {
              const dateA = new Date(a.batch_date).getTime();
              const dateB = new Date(b.batch_date).getTime();
              return batchPriority === 'fifo' ? dateA - dateB : dateB - dateA;
            })[0];
          }
        }

        const rate = item.quantity > 0 ? item.amount / item.quantity : 0;

        return {
          name: item.name,
          quantity: item.quantity,
          amount: item.amount,
          matchedItemId: matchedItem?.id || null,
          matchedItemName: matchedItem?.name || null,
          matchedBatchId: bestBatch?.id || null,
          confidence: match?.score || 0,
          confirmed: (match?.score || 0) >= 0.8,
          rate,
          purchase_price: bestBatch?.purchase_price || 0,
        };
      });

      setScannedItems(scanned);
      setTotalAmount(data.total_amount || null);
      setCustomerName(data.customer_name || '');
      toast.success(`Scanned ${scanned.length} items from bill`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to scan bill');
    } finally {
      setIsScanning(false);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    setScannedItems(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      
      if (field === 'matchedItemId') {
        const item = items?.find(i => i.id === value);
        updated[index].matchedItemName = item?.name || null;
        // Find batch
        const itemBatches = batchesWithStock?.filter(b => b.item_id === value && b.remaining_quantity >= updated[index].quantity) || [];
        const batchPriority = (item as any)?.batch_priority || 'fifo';
        const bestBatch = itemBatches.sort((a, b) => {
          const dateA = new Date(a.batch_date).getTime();
          const dateB = new Date(b.batch_date).getTime();
          return batchPriority === 'fifo' ? dateA - dateB : dateB - dateA;
        })[0];
        updated[index].matchedBatchId = bestBatch?.id || null;
        updated[index].purchase_price = bestBatch?.purchase_price || 0;
        updated[index].confirmed = true;
      }
      
      if (field === 'quantity' || field === 'amount') {
        const qty = field === 'quantity' ? value : updated[index].quantity;
        const amt = field === 'amount' ? value : updated[index].amount;
        updated[index].rate = qty > 0 ? amt / qty : 0;
      }
      
      return updated;
    });
  };

  const handleSave = async () => {
    const validItems = scannedItems.filter(i => i.confirmed && i.matchedItemId && i.matchedBatchId);
    if (validItems.length === 0) {
      toast.error('No confirmed items to save');
      return;
    }

    setIsSaving(true);
    try {
      const subtotal = validItems.reduce((sum, i) => sum + i.amount, 0);
      const discount = totalAmount ? Math.max(0, subtotal - totalAmount) : 0;

      await createSale.mutateAsync({
        sale_type: 'invoice',
        customer_name: customerName || null,
        subtotal,
        discount,
        tax: 0,
        total_amount: subtotal - discount,
        items: validItems.map(item => ({
          item_id: item.matchedItemId!,
          item_name: item.matchedItemName!,
          batch_id: item.matchedBatchId!,
          batch_name: '',
          quantity_primary: item.quantity,
          quantity_secondary: null,
          rate: item.rate,
          purchase_price: item.purchase_price,
          total: item.amount,
          profit: item.amount - (item.purchase_price * item.quantity),
        })),
      });

      toast.success('Bill saved as sale');
      setScannedItems([]);
      setImagePreview(null);
      setImageBase64(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmedCount = scannedItems.filter(i => i.confirmed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Paper Bill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image capture */}
          <div className="flex gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
            
            <Button variant="outline" onClick={() => cameraInputRef.current?.click()} className="gap-2">
              <Camera className="w-4 h-4" /> Capture
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" /> Upload Image
            </Button>
            {imageBase64 && (
              <Button onClick={handleScan} disabled={isScanning} className="gap-2">
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                {isScanning ? 'Scanning...' : 'Scan Bill'}
              </Button>
            )}
          </div>

          {imagePreview && (
            <div className="border rounded-md p-2 max-h-48 overflow-hidden">
              <img src={imagePreview} alt="Bill" className="max-h-44 object-contain mx-auto" />
            </div>
          )}

          {/* Scanned results */}
          {scannedItems.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Customer name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 max-w-xs"
                />
                <Badge variant="outline">{confirmedCount}/{scannedItems.length} confirmed</Badge>
              </div>

              <div className="border rounded-md">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">✓</TableHead>
                      <TableHead>Scanned Name</TableHead>
                      <TableHead className="min-w-[200px]">Matched Item</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-24">Amount ₹</TableHead>
                      <TableHead className="w-20">Rate ₹</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedItems.map((item, i) => (
                      <TableRow key={i} className={!item.confirmed ? 'bg-warning/10' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={item.confirmed}
                            onCheckedChange={(checked) => updateItem(i, 'confirmed', !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{item.name}</span>
                          {item.confidence > 0 && (
                            <Badge variant={item.confidence >= 0.8 ? 'default' : 'destructive'} className="ml-2 text-[10px]">
                              {Math.round(item.confidence * 100)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.matchedItemId || ''}
                            onValueChange={(v) => updateItem(i, 'matchedItemId', v)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Select item..." />
                            </SelectTrigger>
                            <SelectContent>
                              {items?.map(it => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.item_code} - {it.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-7 w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => updateItem(i, 'amount', parseFloat(e.target.value) || 0)}
                            className="h-7 w-20"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">₹{item.rate.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                <span className="text-sm">
                  Items Total: ₹{scannedItems.filter(i => i.confirmed).reduce((s, i) => s + i.amount, 0).toFixed(2)}
                </span>
                {totalAmount && (
                  <span className="font-bold">Bill Total: ₹{totalAmount.toFixed(2)}</span>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {scannedItems.length > 0 && (
            <Button onClick={handleSave} disabled={isSaving || confirmedCount === 0}>
              {isSaving ? 'Saving...' : `Save ${confirmedCount} Items as Sale`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
