import { useState, useMemo } from 'react';
import { read, utils } from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useItems } from '@/hooks/useItems';
import { useBatchesWithStock } from '@/hooks/useBatches';
import { useCreateSale } from '@/hooks/useSales';
import { useCreatePurchase } from '@/hooks/usePurchases';
import { findBestMatch } from '@/lib/fuzzyMatch';
import { toast } from 'sonner';

type BillType = 'sale' | 'sale_return' | 'purchase' | 'purchase_return';

interface ParsedBillItem {
  billNumber: string;
  billType: BillType;
  itemName: string;
  quantity: number;
  amount: number;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchedBatchId: string | null;
  confidence: number;
  confirmed: boolean;
}

function classifyBill(billNumber: string): BillType {
  const upper = billNumber.trim().toUpperCase();
  if (upper.startsWith('RE/') || upper.startsWith('RE ')) return 'sale_return';
  if (upper.startsWith('PR/') || upper.startsWith('PR ')) return 'purchase_return';
  if (upper.startsWith('NE/') || upper.startsWith('NE ') || upper.startsWith('E/') || upper.startsWith('E ')) return 'sale';
  if (upper.startsWith('P/') || upper.startsWith('P ')) return 'purchase';
  return 'purchase'; // default
}

function billTypeLabel(t: BillType) {
  switch (t) {
    case 'sale': return 'Sale';
    case 'sale_return': return 'Sale Return';
    case 'purchase': return 'Purchase';
    case 'purchase_return': return 'Purchase Return';
  }
}

function billTypeBadgeVariant(t: BillType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (t) {
    case 'sale': return 'default';
    case 'sale_return': return 'destructive';
    case 'purchase': return 'secondary';
    case 'purchase_return': return 'outline';
  }
}

export default function BulkBillUpload() {
  const [parsedItems, setParsedItems] = useState<ParsedBillItem[]>([]);
  const [activeTab, setActiveTab] = useState<BillType>('sale');
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: items = [] } = useItems();
  const { data: batchesWithStock = [] } = useBatchesWithStock();
  const createSale = useCreateSale();
  const createPurchase = useCreatePurchase();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = utils.sheet_to_json(sheet, { header: 1 });

    const parsed: ParsedBillItem[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 13) continue;

      const billNumber = String(row[3] || '').trim(); // Column D (0-indexed: 3)
      const itemName = String(row[4] || '').trim();   // Column E (0-indexed: 4)
      const quantity = parseFloat(row[8]) || 0;        // Column I (0-indexed: 8)
      const amount = parseFloat(row[12]) || 0;         // Column M (0-indexed: 12)

      if (!billNumber && !itemName) continue;
      if (!itemName || quantity === 0) continue;

      const billType = classifyBill(billNumber);

      // Match item
      const match = findBestMatch(itemName, items, (item) => [item.name, item.item_code, item.shortword || '']);
      
      let matchedBatchId: string | null = null;
      if (match) {
        const itemBatches = batchesWithStock.filter(b => b.item_id === match.item.id);
        if (itemBatches.length > 0) {
          const item = items.find(it => it.id === match.item.id);
          const priority = item?.batch_priority || 'fifo';
          const sorted = [...itemBatches].sort((a, b) => 
            priority === 'lifo' 
              ? new Date(b.batch_date).getTime() - new Date(a.batch_date).getTime()
              : new Date(a.batch_date).getTime() - new Date(b.batch_date).getTime()
          );
          matchedBatchId = sorted[0]?.id || null;
        }
      }

      parsed.push({
        billNumber,
        billType,
        itemName,
        quantity,
        amount,
        matchedItemId: match?.item.id || null,
        matchedItemName: match?.item.name || null,
        matchedBatchId,
        confidence: match?.score || 0,
        confirmed: (match?.score || 0) >= 0.8,
      });
    }

    setParsedItems(parsed);
    if (parsed.length > 0) {
      const types: BillType[] = ['sale', 'sale_return', 'purchase', 'purchase_return'];
      const first = types.find(t => parsed.some(p => p.billType === t));
      if (first) setActiveTab(first);
    }
    toast.success(`Parsed ${parsed.length} items from file`);
  };

  const grouped = useMemo(() => {
    const groups: Record<BillType, Record<string, ParsedBillItem[]>> = {
      sale: {}, sale_return: {}, purchase: {}, purchase_return: {}
    };
    for (const item of parsedItems) {
      if (!groups[item.billType][item.billNumber]) {
        groups[item.billType][item.billNumber] = [];
      }
      groups[item.billType][item.billNumber].push(item);
    }
    return groups;
  }, [parsedItems]);

  const counts = useMemo(() => ({
    sale: parsedItems.filter(p => p.billType === 'sale').length,
    sale_return: parsedItems.filter(p => p.billType === 'sale_return').length,
    purchase: parsedItems.filter(p => p.billType === 'purchase').length,
    purchase_return: parsedItems.filter(p => p.billType === 'purchase_return').length,
  }), [parsedItems]);

  const updateItem = (index: number, field: keyof ParsedBillItem, value: any) => {
    setParsedItems(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
  };

  const handleChangeMatchedItem = (globalIndex: number, newItemId: string) => {
    const item = items.find(i => i.id === newItemId);
    const itemBatches = batchesWithStock.filter(b => b.item_id === newItemId);
    const priority = item?.batch_priority || 'fifo';
    const sorted = [...itemBatches].sort((a, b) =>
      priority === 'lifo'
        ? new Date(b.batch_date).getTime() - new Date(a.batch_date).getTime()
        : new Date(a.batch_date).getTime() - new Date(b.batch_date).getTime()
    );

    setParsedItems(prev => {
      const updated = [...prev];
      updated[globalIndex] = {
        ...updated[globalIndex],
        matchedItemId: newItemId,
        matchedItemName: item?.name || null,
        matchedBatchId: sorted[0]?.id || null,
        confidence: 1,
        confirmed: true,
      };
      return updated;
    });
  };

  const handleSyncSales = async () => {
    setIsProcessing(true);
    try {
      const saleBills = grouped.sale;
      let count = 0;
      for (const [billNum, billItems] of Object.entries(saleBills)) {
        const validItems = billItems.filter(i => i.confirmed && i.matchedItemId && i.matchedBatchId);
        if (validItems.length === 0) continue;

        const saleItems = validItems.map(vi => {
          const batch = batchesWithStock.find(b => b.id === vi.matchedBatchId);
          const rate = vi.quantity > 0 ? vi.amount / vi.quantity : 0;
          return {
            item_id: vi.matchedItemId!,
            batch_id: vi.matchedBatchId!,
            quantity_primary: vi.quantity,
            quantity_secondary: null as number | null,
            rate,
            purchase_price: batch?.purchase_price || 0,
            total: vi.amount,
            profit: vi.amount - (batch?.purchase_price || 0) * vi.quantity,
          };
        });

        await createSale.mutateAsync({
          sale_type: 'bulk',
          discount: 0,
          items: saleItems,
        });
        count++;
      }
      toast.success(`${count} sale bills synced to inventory`);
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncPurchases = async () => {
    setIsProcessing(true);
    try {
      const purchaseBills = grouped.purchase;
      let count = 0;
      for (const [billNum, billItems] of Object.entries(purchaseBills)) {
        const validItems = billItems.filter(i => i.confirmed && i.matchedItemId);
        if (validItems.length === 0) continue;

        const purchaseItems = validItems.map(vi => {
          const rate = vi.quantity > 0 ? vi.amount / vi.quantity : 0;
          const matchedItem = items.find(it => it.id === vi.matchedItemId);
          return {
            item_id: vi.matchedItemId!,
            quantity: vi.quantity,
            purchase_price: rate,
            selling_price: matchedItem?.current_selling_price || rate,
            total: vi.amount,
          };
        });

        await createPurchase.mutateAsync({
          items: purchaseItems,
          notes: `Bulk upload - ${billNum}`,
        });
        count++;
      }
      toast.success(`${count} purchase bills synced to inventory`);
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderBillGroup = (type: BillType) => {
    const bills = grouped[type];
    const billEntries = Object.entries(bills);
    if (billEntries.length === 0) {
      return <p className="text-muted-foreground text-sm p-4">No {billTypeLabel(type).toLowerCase()} bills found.</p>;
    }

    return (
      <div className="space-y-4">
        {billEntries.map(([billNum, billItems]) => {
          const total = billItems.reduce((s, i) => s + i.amount, 0);
          const allConfirmed = billItems.every(i => i.confirmed);
          return (
            <Card key={billNum}>
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{billNum}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">₹{total.toFixed(2)}</span>
                    {allConfirmed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-0 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item Name</TableHead>
                      <TableHead className="text-xs">Matched</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-center">✓</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map((bi) => {
                      const globalIndex = parsedItems.indexOf(bi);
                      return (
                        <TableRow key={globalIndex}>
                          <TableCell className="text-xs py-1">{bi.itemName}</TableCell>
                          <TableCell className="text-xs py-1 min-w-[150px]">
                            {bi.confidence >= 0.8 ? (
                              <span className="text-green-600">{bi.matchedItemName}</span>
                            ) : (
                              <Select
                                value={bi.matchedItemId || ''}
                                onValueChange={(v) => handleChangeMatchedItem(globalIndex, v)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {items.map(item => (
                                    <SelectItem key={item.id} value={item.id} className="text-xs">
                                      {item.name} ({item.item_code})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-xs py-1 text-right">{bi.quantity}</TableCell>
                          <TableCell className="text-xs py-1 text-right">₹{bi.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-xs py-1 text-center">
                            <button
                              onClick={() => updateItem(globalIndex, 'confirmed', !bi.confirmed)}
                              className="inline-flex"
                            >
                              {bi.confirmed ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bulk Bill Upload</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Upload XLSX File</span>
              <Input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Columns: D=Bill No, E=Item Name, I=Qty, M=Amount. Prefix: NE/ or E/ = Sale, RE/ = Return, P/ = Purchase, PR/ = Purchase Return
            </p>
          </div>
        </CardContent>
      </Card>

      {parsedItems.length > 0 && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BillType)}>
          <TabsList className="w-full">
            <TabsTrigger value="sale" className="flex-1 text-xs">
              Sales ({counts.sale})
            </TabsTrigger>
            <TabsTrigger value="sale_return" className="flex-1 text-xs">
              Sale Returns ({counts.sale_return})
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex-1 text-xs">
              Purchases ({counts.purchase})
            </TabsTrigger>
            <TabsTrigger value="purchase_return" className="flex-1 text-xs">
              Purch. Returns ({counts.purchase_return})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sale" className="mt-4">
            {renderBillGroup('sale')}
            {counts.sale > 0 && (
              <Button onClick={handleSyncSales} disabled={isProcessing} className="mt-4 w-full">
                Sync {Object.keys(grouped.sale).length} Sale Bills to Inventory
              </Button>
            )}
          </TabsContent>

          <TabsContent value="sale_return" className="mt-4">
            {renderBillGroup('sale_return')}
            <p className="text-xs text-muted-foreground mt-2">Sale return sync coming soon</p>
          </TabsContent>

          <TabsContent value="purchase" className="mt-4">
            {renderBillGroup('purchase')}
            {counts.purchase > 0 && (
              <Button onClick={handleSyncPurchases} disabled={isProcessing} className="mt-4 w-full">
                Sync {Object.keys(grouped.purchase).length} Purchase Bills to Inventory
              </Button>
            )}
          </TabsContent>

          <TabsContent value="purchase_return" className="mt-4">
            {renderBillGroup('purchase_return')}
            <p className="text-xs text-muted-foreground mt-2">Purchase return sync coming soon</p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
