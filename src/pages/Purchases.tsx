import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePurchases, useDeletePurchase, type PurchaseWithDetails } from '@/hooks/usePurchases';
import { format } from 'date-fns';
import { Search, Plus, Trash2, Eye, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function PurchaseDetailsDialog({ purchase, open, onOpenChange }: { purchase: PurchaseWithDetails | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!purchase) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Purchase {purchase.purchase_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Date:</span>
              <span className="ml-2 font-medium">{format(new Date(purchase.purchase_date), 'dd MMM yyyy')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Supplier:</span>
              <span className="ml-2 font-medium">{purchase.suppliers?.name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total:</span>
              <span className="ml-2 font-bold">₹{purchase.total_amount}</span>
            </div>
          </div>
          
          {purchase.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Notes:</span>
              <span className="ml-2">{purchase.notes}</span>
            </div>
          )}
          
          <div className="border rounded-md">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Purchase ₹</TableHead>
                  <TableHead className="text-right">Selling ₹</TableHead>
                  <TableHead className="text-right">Total ₹</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.purchase_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{item.items?.item_code}</span>
                      <span className="ml-2">{item.items?.name}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">₹{item.purchase_price}</TableCell>
                    <TableCell className="text-right font-mono">₹{item.selling_price}</TableCell>
                    <TableCell className="text-right font-mono font-medium">₹{item.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Purchases() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewPurchase, setViewPurchase] = useState<PurchaseWithDetails | null>(null);
  const [deletePurchase, setDeletePurchase] = useState<PurchaseWithDetails | null>(null);

  const { data: purchases, isLoading } = usePurchases();
  const deletePurchaseMutation = useDeletePurchase();

  const filteredPurchases = purchases?.filter(p => 
    search === '' || 
    p.purchase_number.toLowerCase().includes(search.toLowerCase()) ||
    p.suppliers?.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleDelete = async () => {
    if (deletePurchase) {
      await deletePurchaseMutation.mutateAsync(deletePurchase.id);
      setDeletePurchase(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <Button size="sm" className="h-8 gap-1" onClick={() => navigate('/purchases/new')}>
          <Plus className="w-3.5 h-3.5" />
          New Purchase
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search purchases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Purchases Table */}
      <div className="border rounded-md">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Purchase #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total ₹</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading purchases...</TableCell>
              </TableRow>
            ) : filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {purchases?.length === 0 ? 'No purchases yet. Create your first purchase.' : 'No purchases match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-mono text-sm">{purchase.purchase_number}</TableCell>
                  <TableCell>{format(new Date(purchase.purchase_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{purchase.suppliers?.name || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{purchase.purchase_items.length} items</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">₹{purchase.total_amount}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewPurchase(purchase)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeletePurchase(purchase)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredPurchases.length} of {purchases?.length || 0} purchases
      </div>

      {/* Dialogs */}
      <PurchaseDetailsDialog 
        purchase={viewPurchase} 
        open={!!viewPurchase} 
        onOpenChange={(open) => !open && setViewPurchase(null)} 
      />

      <AlertDialog open={!!deletePurchase} onOpenChange={() => setDeletePurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete purchase "{deletePurchase?.purchase_number}"? This will also delete the associated batches and stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
