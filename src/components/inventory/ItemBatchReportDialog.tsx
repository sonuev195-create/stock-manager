import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBatchesByItem, type Batch } from '@/hooks/useBatches';
import type { ItemWithCategory } from '@/hooks/useItems';
import { Package, Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { exportToPDF, exportToExcel, type ExportColumn } from '@/lib/exportUtils';

interface ItemBatchReportDialogProps {
  item: ItemWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BATCH_COLUMNS: Record<string, ExportColumn> = {
  batch_name: { key: 'batch_name', label: 'Batch', format: (v: string) => v.split('/')[0] },
  batch_date: { key: 'batch_date', label: 'Date', format: (v: string) => format(new Date(v), 'dd-MMM-yyyy') },
  quantity: { key: 'quantity', label: 'Original Qty' },
  remaining_quantity: { key: 'remaining_quantity', label: 'Remaining' },
  purchase_price: { key: 'purchase_price', label: 'Purchase ₹', format: (v: number) => `₹${v}` },
  selling_price: { key: 'selling_price', label: 'Selling ₹', format: (v: number) => `₹${v}` },
  is_opening_stock: { key: 'is_opening_stock', label: 'Type', format: (v: boolean) => v ? 'Opening' : 'Purchase' },
};

export function ItemBatchReportDialog({ item, open, onOpenChange }: ItemBatchReportDialogProps) {
  const { data: batches, isLoading } = useBatchesByItem(item?.id || null);
  const [tab, setTab] = useState<'current' | 'all'>('current');

  if (!item) return null;

  const currentBatches = batches?.filter(b => b.remaining_quantity > 0) || [];
  const allBatches = batches || [];
  const displayBatches = tab === 'current' ? currentBatches : allBatches;

  const handleExportPDF = () => {
    const columns = Object.values(BATCH_COLUMNS);
    exportToPDF(displayBatches, columns, `${item.name} - ${tab === 'current' ? 'Current' : 'All'} Batches`, `${item.item_code}_batches`);
  };

  const handleExportExcel = () => {
    const columns = Object.values(BATCH_COLUMNS);
    exportToExcel(displayBatches, columns, `${item.item_code}_batches`);
  };

  // Calculate totals
  const totalRemaining = displayBatches.reduce((sum, b) => sum + b.remaining_quantity, 0);
  const avgPurchasePrice = displayBatches.length > 0 
    ? displayBatches.reduce((sum, b) => sum + b.purchase_price * b.remaining_quantity, 0) / totalRemaining || 0
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            {item.name} - Batch Report
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-3 p-3 bg-accent/30 rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-muted-foreground">Total Stock:</span>
              <span className="ml-2 text-xl font-bold">{item.total_stock || 0} {item.primary_unit}</span>
              {item.secondary_unit && item.conversion_factor && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({((item.total_stock || 0) * item.conversion_factor).toFixed(1)} {item.secondary_unit})
                </span>
              )}
            </div>
            <Badge variant="outline">{item.item_code}</Badge>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'current' | 'all')} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="current">Current Stock ({currentBatches.length})</TabsTrigger>
            <TabsTrigger value="all">All Batches ({allBatches.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value={tab} className="flex-1 overflow-auto border rounded-md m-0">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Purchase ₹</TableHead>
                  <TableHead className="text-right">Selling ₹</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : displayBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {tab === 'current' ? 'No batches with remaining stock' : 'No batches yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayBatches.map((batch) => (
                    <TableRow key={batch.id} className={batch.remaining_quantity <= 0 ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">{batch.batch_name}</span>
                          {batch.is_opening_stock && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Opening</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(batch.batch_date), 'dd-MMM-yy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{batch.quantity} {item.primary_unit}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono ${batch.remaining_quantity <= 0 ? 'text-destructive' : batch.remaining_quantity < batch.quantity * 0.2 ? 'text-warning' : ''}`}>
                          {batch.remaining_quantity} {item.primary_unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">₹{batch.purchase_price}</TableCell>
                      <TableCell className="text-right font-mono">₹{batch.selling_price}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        <div className="mt-3 flex justify-between items-center text-sm">
          <div className="text-muted-foreground">
            {displayBatches.length} batches | Total: {totalRemaining.toFixed(2)} {item.primary_unit}
            {avgPurchasePrice > 0 && ` | Avg Cost: ₹${avgPurchasePrice.toFixed(2)}`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </Button>
            <Button size="sm" className="gap-1" onClick={handleExportPDF}>
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
