import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ItemWithCategory } from '@/hooks/useItems';
import { DollarSign } from 'lucide-react';

interface BulkPriceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: ItemWithCategory[];
  allItems: ItemWithCategory[];
}

export function BulkPriceEditDialog({ open, onOpenChange, selectedItems, allItems }: BulkPriceEditDialogProps) {
  const [mode, setMode] = useState<'fixed' | 'percentage' | 'individual'>('fixed');
  const [fixedPrice, setFixedPrice] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  const [individualPrices, setIndividualPrices] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const items = selectedItems.length > 0 ? selectedItems : allItems;

  const handleOpen = () => {
    const prices: Record<string, number> = {};
    items.forEach(item => { prices[item.id] = item.current_selling_price; });
    setIndividualPrices(prices);
  };

  const getNewPrice = (item: ItemWithCategory): number => {
    if (mode === 'fixed') return fixedPrice;
    if (mode === 'percentage') return Math.round(item.current_selling_price * (1 + percentage / 100) * 100) / 100;
    return individualPrices[item.id] ?? item.current_selling_price;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const item of items) {
        const newPrice = getNewPrice(item);
        if (newPrice !== item.current_selling_price) {
          await supabase
            .from('items')
            .update({ current_selling_price: newPrice })
            .eq('id', item.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(`Updated prices for ${items.length} items`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Failed to update prices: ${e.message}`);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Bulk Price Edit ({items.length} items)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === 'fixed' ? 'default' : 'outline'} size="sm" onClick={() => setMode('fixed')}>
              Fixed Price
            </Button>
            <Button variant={mode === 'percentage' ? 'default' : 'outline'} size="sm" onClick={() => setMode('percentage')}>
              % Change
            </Button>
            <Button variant={mode === 'individual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('individual')}>
              Individual
            </Button>
          </div>

          {mode === 'fixed' && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">New Price ₹</Label>
              <Input 
                type="number" 
                value={fixedPrice} 
                onChange={(e) => setFixedPrice(parseFloat(e.target.value) || 0)} 
                className="h-8 w-32"
                onDoubleClick={(e) => e.currentTarget.select()}
              />
            </div>
          )}

          {mode === 'percentage' && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Change %</Label>
              <Input 
                type="number" 
                value={percentage} 
                onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)} 
                className="h-8 w-24"
                onDoubleClick={(e) => e.currentTarget.select()}
              />
              <span className="text-xs text-muted-foreground">(+ve = increase, -ve = decrease)</span>
            </div>
          )}

          <div className="border rounded-md max-h-60 overflow-auto">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Current ₹</TableHead>
                  <TableHead className="text-right">New ₹</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{item.categories?.name || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">₹{item.current_selling_price}</TableCell>
                    <TableCell className="text-right">
                      {mode === 'individual' ? (
                        <Input
                          type="number"
                          value={individualPrices[item.id] ?? item.current_selling_price}
                          onChange={(e) => setIndividualPrices(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                          className="h-7 w-24 ml-auto text-right"
                          onDoubleClick={(e) => e.currentTarget.select()}
                        />
                      ) : (
                        <span className="font-mono text-sm">₹{getNewPrice(item)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Updating...' : `Update ${items.length} Prices`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
