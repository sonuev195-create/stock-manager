import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItems } from '@/hooks/useItems';
import { useAllBatches } from '@/hooks/useBatches';
import { useCreateSale } from '@/hooks/useSales';
import { Upload, Trash2, Plus, FileSpreadsheet, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';

interface BulkSaleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedSaleBill {
  customer_name: string;
  customer_phone: string;
  sale_date: string;
  items: ParsedSaleItem[];
  discount: number;
}

interface ParsedSaleItem {
  item_code: string;
  item_name: string;
  item_id: string;
  batch_id: string;
  batch_name: string;
  quantity_primary: number;
  quantity_secondary: number | null;
  rate: number;
  total: number;
  purchase_price: number;
  profit: number;
  isValid: boolean;
  error?: string;
}

export function BulkSaleUploadDialog({ open, onOpenChange }: BulkSaleUploadDialogProps) {
  const [pasteData, setPasteData] = useState('');
  const [parsedBills, setParsedBills] = useState<ParsedSaleBill[]>([]);
  const [selectedBillIndex, setSelectedBillIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: items } = useItems();
  const { data: batches } = useAllBatches();
  const createSale = useCreateSale();

  // Parse pasted data from Excel/Sheets
  const handleParse = () => {
    if (!pasteData.trim()) {
      toast.error('Please paste data first');
      return;
    }

    try {
      const lines = pasteData.trim().split('\n');
      const bills: ParsedSaleBill[] = [];
      let currentBill: ParsedSaleBill | null = null;

      for (const line of lines) {
        const cells = line.split('\t').map(c => c.trim());
        
        // Check if this is a header row (new bill)
        if (cells[0]?.toLowerCase() === 'customer' || cells[0]?.toLowerCase() === 'bill') {
          if (currentBill && currentBill.items.length > 0) {
            bills.push(currentBill);
          }
          currentBill = {
            customer_name: cells[1] || '',
            customer_phone: cells[2] || '',
            sale_date: cells[3] || new Date().toISOString().split('T')[0],
            discount: parseFloat(cells[4]) || 0,
            items: [],
          };
          continue;
        }

        // Skip empty rows
        if (!cells[0]) continue;

        // Parse item row: ItemCode, Qty Primary, Qty Secondary (optional), Rate
        if (currentBill === null) {
          currentBill = {
            customer_name: '',
            customer_phone: '',
            sale_date: new Date().toISOString().split('T')[0],
            discount: 0,
            items: [],
          };
        }

        const itemCode = cells[0];
        const qtyPrimary = parseFloat(cells[1]) || 1;
        const qtySecondary = cells[2] ? parseFloat(cells[2]) : null;
        const rate = parseFloat(cells[3]) || 0;

        // Find matching item
        const item = items?.find(i => 
          i.item_code.toLowerCase() === itemCode.toLowerCase() || 
          i.name.toLowerCase() === itemCode.toLowerCase()
        );

        // Find available batch (LIFO - most recent first)
        const availableBatch = item ? batches?.filter(b => 
          b.item_id === item.id && b.remaining_quantity >= qtyPrimary
        ).sort((a, b) => new Date(b.batch_date).getTime() - new Date(a.batch_date).getTime())[0] : null;

        const purchasePrice = availableBatch?.purchase_price || 0;
        const total = qtyPrimary * rate;

        currentBill.items.push({
          item_code: itemCode,
          item_name: item?.name || itemCode,
          item_id: item?.id || '',
          batch_id: availableBatch?.id || '',
          batch_name: availableBatch?.batch_name || '',
          quantity_primary: qtyPrimary,
          quantity_secondary: qtySecondary,
          rate: rate || availableBatch?.selling_price || 0,
          total,
          purchase_price: purchasePrice,
          profit: total - (purchasePrice * qtyPrimary),
          isValid: !!item && !!availableBatch,
          error: !item ? 'Item not found' : !availableBatch ? 'No stock available' : undefined,
        });
      }

      if (currentBill && currentBill.items.length > 0) {
        bills.push(currentBill);
      }

      if (bills.length === 0) {
        toast.error('No valid bills found in pasted data');
        return;
      }

      setParsedBills(bills);
      setSelectedBillIndex(0);
      toast.success(`Parsed ${bills.length} bill(s) with ${bills.reduce((sum, b) => sum + b.items.length, 0)} items`);
    } catch (error) {
      toast.error('Failed to parse data. Check format.');
    }
  };

  const updateBillItem = (billIndex: number, itemIndex: number, field: string, value: any) => {
    const updated = [...parsedBills];
    const item = updated[billIndex].items[itemIndex];
    (item as any)[field] = value;
    
    // Recalculate
    if (field === 'quantity_primary' || field === 'rate') {
      item.total = item.quantity_primary * item.rate;
      item.profit = item.total - (item.purchase_price * item.quantity_primary);
    }
    
    // Re-validate if batch changed
    if (field === 'batch_id') {
      const batch = batches?.find(b => b.id === value);
      if (batch) {
        item.batch_name = batch.batch_name;
        item.purchase_price = batch.purchase_price;
        item.rate = item.rate || batch.selling_price;
        item.total = item.quantity_primary * item.rate;
        item.profit = item.total - (batch.purchase_price * item.quantity_primary);
        item.isValid = batch.remaining_quantity >= item.quantity_primary;
        item.error = item.isValid ? undefined : 'Insufficient stock';
      }
    }
    
    setParsedBills(updated);
  };

  const removeBillItem = (billIndex: number, itemIndex: number) => {
    const updated = [...parsedBills];
    updated[billIndex].items.splice(itemIndex, 1);
    if (updated[billIndex].items.length === 0) {
      updated.splice(billIndex, 1);
      setSelectedBillIndex(Math.max(0, selectedBillIndex - 1));
    }
    setParsedBills(updated);
  };

  const handleSaveAll = async () => {
    const validBills = parsedBills.filter(bill => 
      bill.items.length > 0 && bill.items.every(item => item.isValid)
    );

    if (validBills.length === 0) {
      toast.error('No valid bills to save. Fix errors first.');
      return;
    }

    setIsProcessing(true);
    let savedCount = 0;

    try {
      for (const bill of validBills) {
        const subtotal = bill.items.reduce((sum, i) => sum + i.total, 0);
        
        await createSale.mutateAsync({
          sale_type: 'invoice',
          customer_name: bill.customer_name || null,
          customer_phone: bill.customer_phone || null,
          subtotal,
          discount: bill.discount,
          tax: 0,
          total_amount: subtotal - bill.discount,
          items: bill.items.map(item => ({
            item_id: item.item_id,
            item_name: item.item_name,
            batch_id: item.batch_id,
            batch_name: item.batch_name,
            quantity_primary: item.quantity_primary,
            quantity_secondary: item.quantity_secondary,
            rate: item.rate,
            purchase_price: item.purchase_price,
            total: item.total,
            profit: item.profit,
          })),
        });
        savedCount++;
      }

      toast.success(`Successfully saved ${savedCount} sale bill(s)`);
      setParsedBills([]);
      setPasteData('');
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed after saving ${savedCount} bills`);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentBill = parsedBills[selectedBillIndex];
  const hasErrors = parsedBills.some(bill => bill.items.some(item => !item.isValid));
  const billTotal = currentBill?.items.reduce((sum, i) => sum + i.total, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Upload Sale Bills
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList>
            <TabsTrigger value="paste" className="gap-1">
              <ClipboardPaste className="w-3 h-3" /> Paste from Excel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">
                Paste from Excel/Sheets (Format: ItemCode, Qty Primary, Qty Secondary, Rate)
              </Label>
              <div className="text-xs text-muted-foreground mb-1">
                Start each bill with: Customer, Name, Phone, Date, Discount<br/>
                Then list items: ItemCode, QtyPrimary, QtySecondary, Rate
              </div>
              <Textarea 
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="Customer	John Doe	9876543210	2025-01-15	50
ITEM001	5	10	150
ITEM002	3		200

Customer	Jane Smith	9123456789	2025-01-16	0
ITEM001	2	4	160"
                className="min-h-[120px] font-mono text-xs"
              />
              <Button onClick={handleParse} className="gap-1">
                <Upload className="w-4 h-4" />
                Parse Data
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {parsedBills.length > 0 && (
          <div className="space-y-3 mt-4">
            {/* Bill selector */}
            <div className="flex items-center gap-2">
              <Label className="text-xs">Bill:</Label>
              <Select 
                value={selectedBillIndex.toString()} 
                onValueChange={(v) => setSelectedBillIndex(parseInt(v))}
              >
                <SelectTrigger className="w-64 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parsedBills.map((bill, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      Bill {i + 1}: {bill.customer_name || 'Walk-in'} ({bill.items.length} items)
                      {bill.items.some(item => !item.isValid) && ' ⚠️'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">{parsedBills.length} bill(s)</Badge>
            </div>

            {currentBill && (
              <>
                {/* Bill header */}
                <div className="grid grid-cols-4 gap-3 p-3 bg-muted/30 rounded-md">
                  <div>
                    <Label className="text-xs">Customer Name</Label>
                    <Input 
                      value={currentBill.customer_name}
                      onChange={(e) => {
                        const updated = [...parsedBills];
                        updated[selectedBillIndex].customer_name = e.target.value;
                        setParsedBills(updated);
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input 
                      value={currentBill.customer_phone}
                      onChange={(e) => {
                        const updated = [...parsedBills];
                        updated[selectedBillIndex].customer_phone = e.target.value;
                        setParsedBills(updated);
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input 
                      type="date"
                      value={currentBill.sale_date}
                      onChange={(e) => {
                        const updated = [...parsedBills];
                        updated[selectedBillIndex].sale_date = e.target.value;
                        setParsedBills(updated);
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Discount ₹</Label>
                    <Input 
                      type="number"
                      value={currentBill.discount}
                      onChange={(e) => {
                        const updated = [...parsedBills];
                        updated[selectedBillIndex].discount = parseFloat(e.target.value) || 0;
                        setParsedBills(updated);
                      }}
                      className="h-8"
                    />
                  </div>
                </div>

                {/* Items table */}
                <div className="border rounded-md">
                  <Table className="data-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="w-20">Qty Pri</TableHead>
                        <TableHead className="w-20">Qty Sec</TableHead>
                        <TableHead className="w-24">Rate ₹</TableHead>
                        <TableHead className="text-right">Total ₹</TableHead>
                        <TableHead className="w-16">Status</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentBill.items.map((item, i) => {
                        const itemBatches = batches?.filter(b => b.item_id === item.item_id && b.remaining_quantity > 0) || [];
                        return (
                          <TableRow key={i} className={!item.isValid ? 'bg-destructive/10' : ''}>
                            <TableCell>
                              <div>
                                <span className="font-mono text-xs">{item.item_code}</span>
                                <div className="text-xs text-muted-foreground">{item.item_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={item.batch_id} 
                                onValueChange={(v) => updateBillItem(selectedBillIndex, i, 'batch_id', v)}
                              >
                                <SelectTrigger className="h-7 text-xs w-32">
                                  <SelectValue placeholder="Select batch" />
                                </SelectTrigger>
                                <SelectContent>
                                  {itemBatches.map(b => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.batch_name.split('/')[0]} ({b.remaining_quantity})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input 
                                type="number"
                                value={item.quantity_primary}
                                onChange={(e) => updateBillItem(selectedBillIndex, i, 'quantity_primary', parseFloat(e.target.value) || 0)}
                                className="h-7 w-16"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                type="number"
                                value={item.quantity_secondary || ''}
                                onChange={(e) => updateBillItem(selectedBillIndex, i, 'quantity_secondary', parseFloat(e.target.value) || null)}
                                className="h-7 w-16"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                type="number"
                                value={item.rate}
                                onChange={(e) => updateBillItem(selectedBillIndex, i, 'rate', parseFloat(e.target.value) || 0)}
                                className="h-7 w-20"
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono">₹{item.total.toFixed(2)}</TableCell>
                            <TableCell>
                              {item.isValid ? (
                                <Badge variant="default" className="text-xs">OK</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">{item.error}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive"
                                onClick={() => removeBillItem(selectedBillIndex, i)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Bill summary */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
                  <div className="text-sm">
                    Subtotal: <span className="font-mono">₹{billTotal.toFixed(2)}</span>
                    {currentBill.discount > 0 && (
                      <span className="ml-3">- Discount: <span className="font-mono">₹{currentBill.discount.toFixed(2)}</span></span>
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    Total: <span className="font-mono">₹{(billTotal - currentBill.discount).toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveAll} 
            disabled={parsedBills.length === 0 || isProcessing}
            className="gap-1"
          >
            {isProcessing ? 'Saving...' : `Save ${parsedBills.length} Bill(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
