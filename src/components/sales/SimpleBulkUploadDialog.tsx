import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useItems } from '@/hooks/useItems';
import { useBatchesWithStock } from '@/hooks/useBatches';
import { useCreateSale } from '@/hooks/useSales';
import { findBestMatch } from '@/lib/fuzzyMatch';
import { Upload, AlertTriangle, Check, Trash2, Edit2 } from 'lucide-react';

interface ParsedLine {
  originalName: string;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchedBatchId: string | null;
  quantity: number;
  rate: number;
  total: number;
  confidence: number;
  error?: string;
}

interface SimpleBulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimpleBulkUploadDialog({ open, onOpenChange }: SimpleBulkUploadDialogProps) {
  const [rawInput, setRawInput] = useState('');
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const { data: items } = useItems();
  const { data: batches } = useBatchesWithStock();
  const createSale = useCreateSale();

  const parseInput = () => {
    if (!items || !batches) return;

    const lines = rawInput.trim().split('\n').filter(line => line.trim());
    const itemNames = items.map(i => ({ id: i.id, name: i.name, code: i.item_code }));
    
    const parsed: ParsedLine[] = [];

    for (const line of lines) {
      let parts: string[] = [];
      
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      } else if (line.includes('|')) {
        parts = line.split('|').map(p => p.trim()).filter(Boolean);
      } else if (line.includes(',')) {
        parts = line.split(',').map(p => p.trim()).filter(Boolean);
      } else {
        parts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
      }

      if (parts.length < 2) {
        parsed.push({
          originalName: line,
          matchedItemId: null,
          matchedItemName: null,
          matchedBatchId: null,
          quantity: 0,
          rate: 0,
          total: 0,
          confidence: 0,
          error: 'Could not parse. Expected: Item Name, Quantity, Amount'
        });
        continue;
      }

      const itemNamePart = parts[0];
      const qtyPart = parseFloat(parts[1]) || 0;
      // Third value is now TOTAL AMOUNT (not rate)
      const amountPart = parts.length > 2 ? parseFloat(parts[2]) || 0 : 0;

      const match = findBestMatch(itemNamePart, itemNames, (item) => [item.name, item.code]);
      
      if (!match || match.score < 0.4) {
        parsed.push({
          originalName: itemNamePart,
          matchedItemId: null,
          matchedItemName: null,
          matchedBatchId: null,
          quantity: qtyPart,
          rate: qtyPart > 0 && amountPart > 0 ? amountPart / qtyPart : 0,
          total: amountPart,
          confidence: match?.score || 0,
          error: 'No matching item found'
        });
        continue;
      }

      const matchedItem = match.item;
      const itemBatches = batches.filter(b => b.item_id === matchedItem.id && b.remaining_quantity > 0);
      const bestBatch = itemBatches[0];

      if (!bestBatch) {
        parsed.push({
          originalName: itemNamePart,
          matchedItemId: matchedItem.id,
          matchedItemName: matchedItem.name,
          matchedBatchId: null,
          quantity: qtyPart,
          rate: qtyPart > 0 && amountPart > 0 ? amountPart / qtyPart : 0,
          total: amountPart,
          confidence: match.score,
          error: 'No stock available for this item'
        });
        continue;
      }

      // Calculate rate from amount, or use batch selling price
      let finalRate: number;
      let finalTotal: number;
      if (amountPart > 0) {
        finalTotal = amountPart;
        finalRate = qtyPart > 0 ? amountPart / qtyPart : 0;
      } else {
        finalRate = bestBatch.selling_price;
        finalTotal = qtyPart * finalRate;
      }

      parsed.push({
        originalName: itemNamePart,
        matchedItemId: matchedItem.id,
        matchedItemName: matchedItem.name,
        matchedBatchId: bestBatch.id,
        quantity: qtyPart,
        rate: finalRate,
        total: finalTotal,
        confidence: match.score
      });
    }

    setParsedLines(parsed);
    setStep('review');
  };

  const updateLine = (index: number, field: keyof ParsedLine, value: any) => {
    const updated = [...parsedLines];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'total') {
      // Recalculate rate from total/qty
      if (updated[index].quantity > 0) {
        updated[index].rate = updated[index].total / updated[index].quantity;
      }
    } else if (field === 'rate') {
      updated[index].total = updated[index].quantity * updated[index].rate;
    }
    
    setParsedLines(updated);
    setEditingIndex(null);
  };

  const removeLine = (index: number) => {
    setParsedLines(parsedLines.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validLines = parsedLines.filter(l => l.matchedItemId && l.matchedBatchId && !l.error);
    
    if (validLines.length === 0) return;

    const lineItems = validLines.map(line => {
      const item = items?.find(i => i.id === line.matchedItemId);
      const batch = batches?.find(b => b.id === line.matchedBatchId);
      
      if (!item || !batch) return null;

      const effectiveConversion = (batch as any).batch_conversion_factor ?? item.conversion_factor ?? null;

      return {
        item_id: item.id,
        item_name: item.name,
        batch_id: batch.id,
        batch_name: batch.batch_name,
        quantity_primary: line.quantity,
        quantity_secondary: effectiveConversion ? line.quantity * effectiveConversion : null,
        rate: line.rate,
        purchase_price: batch.purchase_price,
        total: line.total,
        profit: (line.rate - batch.purchase_price) * line.quantity,
      };
    }).filter(Boolean) as any[];

    if (lineItems.length === 0) return;

    const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);

    await createSale.mutateAsync({
      sale_type: 'quick',
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      customer_address: customerAddress || undefined,
      subtotal,
      discount: 0,
      tax: 0,
      total_amount: subtotal,
      items: lineItems,
    });

    setRawInput('');
    setParsedLines([]);
    setStep('input');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    onOpenChange(false);
  };

  const validCount = parsedLines.filter(l => l.matchedItemId && l.matchedBatchId && !l.error).length;
  const errorCount = parsedLines.filter(l => l.error).length;
  const grandTotal = parsedLines.filter(l => !l.error).reduce((sum, l) => sum + l.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Quick Bulk Upload
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 flex-1">
            <Alert>
              <AlertDescription className="text-xs">
                Paste items line by line. Each line: <strong>Item Name, Quantity, Total Amount</strong><br />
                Separate with tabs, commas, pipes, or multiple spaces. Amount is optional (uses batch price × qty if omitted).
              </AlertDescription>
            </Alert>

            <div>
              <Label className="text-sm">Paste Items</Label>
              <Textarea
                placeholder={`Example:\nCement Bag    10    3500\nTMT Steel Bar, 5, 22500\nBricks | 1000 | 8000`}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className="h-48 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: Copy from Excel/Sheets. Third column is <strong>total amount</strong> (not per-unit rate).
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2">
              {validCount > 0 && (
                <Badge variant="default" className="gap-1">
                  <Check className="w-3 h-3" />
                  {validCount} valid
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errorCount} errors
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-auto border rounded-md">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Original Input</TableHead>
                    <TableHead>Matched Item</TableHead>
                    <TableHead className="text-right w-20">Qty</TableHead>
                    <TableHead className="text-right w-24">Rate ₹</TableHead>
                    <TableHead className="text-right w-24">Amount ₹</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedLines.map((line, index) => (
                    <TableRow key={index} className={line.error ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        <div className="text-xs">
                          {line.originalName}
                          {line.confidence > 0 && line.confidence < 1 && (
                            <span className="text-muted-foreground ml-1">({Math.round(line.confidence * 100)}%)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {line.error ? (
                          <span className="text-destructive text-xs">{line.error}</span>
                        ) : (
                          <span className="text-sm">{line.matchedItemName}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingIndex === index ? (
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-6 w-16 text-xs"
                            autoFocus
                            onBlur={() => setEditingIndex(null)}
                          />
                        ) : (
                          <span className="font-mono text-xs">{line.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-xs">₹{line.rate.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {editingIndex === index ? (
                          <Input
                            type="number"
                            value={line.total}
                            onChange={(e) => updateLine(index, 'total', parseFloat(e.target.value) || 0)}
                            className="h-6 w-20 text-xs"
                            onBlur={() => setEditingIndex(null)}
                          />
                        ) : (
                          <span className="font-mono text-xs font-medium">₹{line.total.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingIndex(index)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeLine(index)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {customerName && (
              <div className="text-xs text-muted-foreground">
                Customer: {customerName} {customerPhone && `| ${customerPhone}`} {customerAddress && `| ${customerAddress}`}
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{parsedLines.length} items parsed</span>
              <span className="font-bold">Grand Total: ₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'input' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={parseInput} disabled={!rawInput.trim() || !items || !batches}>
                Parse & Review
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>Back</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={validCount === 0 || createSale.isPending}
              >
                {createSale.isPending ? 'Creating...' : `Create Sale (${validCount} items)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
