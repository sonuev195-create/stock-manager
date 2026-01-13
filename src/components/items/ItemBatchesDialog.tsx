import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBatchesByItem } from '@/hooks/useBatches';
import type { ItemWithCategory } from '@/hooks/useItems';
import { Package, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ItemBatchesDialogProps {
  item: ItemWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemBatchesDialog({ item, open, onOpenChange }: ItemBatchesDialogProps) {
  const { data: batches, isLoading } = useBatchesByItem(item?.id || null);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            {item.name} - Stock Batches
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-3 p-3 bg-accent/30 rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-muted-foreground">Total Stock:</span>
              <span className="ml-2 text-xl font-bold">{item.total_stock || 0} {item.primary_unit}</span>
            </div>
            <Badge variant="outline">{item.item_code}</Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Qty</TableHead>
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
              ) : batches?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No batches yet. Add stock via Purchases or Opening Stock.
                  </TableCell>
                </TableRow>
              ) : (
                batches?.map((batch) => (
                  <TableRow key={batch.id}>
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
                    <TableCell className="text-right font-mono">{batch.quantity}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono ${batch.remaining_quantity <= 0 ? 'text-destructive' : batch.remaining_quantity < batch.quantity * 0.2 ? 'text-warning' : ''}`}>
                        {batch.remaining_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">₹{batch.purchase_price}</TableCell>
                    <TableCell className="text-right font-mono">₹{batch.selling_price}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
