import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateBatch, type Batch } from '@/hooks/useBatches';
import { Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface BatchAdjustDialogProps {
  batch: Batch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryUnit?: string;
  secondaryUnit?: string | null;
  conversionFactor?: number | null;
}

export function BatchAdjustDialog({ batch, open, onOpenChange, primaryUnit = 'pcs', secondaryUnit, conversionFactor }: BatchAdjustDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'set' | 'add' | 'subtract'>('set');
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [reason, setReason] = useState('');
  
  const updateBatch = useUpdateBatch();

  if (!batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const value = parseFloat(adjustmentValue);
    if (isNaN(value) || value < 0) {
      toast.error('Please enter a valid positive number');
      return;
    }
    
    let newQuantity = batch.remaining_quantity;
    
    if (adjustmentType === 'set') {
      newQuantity = value;
    } else if (adjustmentType === 'add') {
      newQuantity = batch.remaining_quantity + value;
    } else if (adjustmentType === 'subtract') {
      newQuantity = Math.max(0, batch.remaining_quantity - value);
    }
    
    await updateBatch.mutateAsync({
      id: batch.id,
      remaining_quantity: newQuantity,
    });
    
    toast.success(`Stock adjusted to ${newQuantity} ${primaryUnit}`);
    onOpenChange(false);
    setAdjustmentValue('');
    setReason('');
  };

  const secondaryRemaining = conversionFactor && secondaryUnit 
    ? batch.remaining_quantity * conversionFactor 
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wrench className="w-4 h-4" />
            Adjust Stock - Batch {batch.batch_name.split('/')[0]}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-accent/30 rounded text-sm space-y-1">
            <div className="font-medium">Current Stock</div>
            <div className="font-mono text-lg">
              {batch.remaining_quantity} {primaryUnit}
              {secondaryRemaining !== null && secondaryUnit && (
                <span className="text-muted-foreground ml-2">
                  ({secondaryRemaining.toFixed(1)} {secondaryUnit})
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Original: {batch.quantity} {primaryUnit} | Date: {batch.batch_date}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as 'set' | 'add' | 'subtract')}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set to</SelectItem>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="subtract">Subtract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity ({primaryUnit})</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                className="h-8 text-sm"
                placeholder="0"
                required
              />
            </div>
          </div>
          
          {adjustmentValue && (
            <div className="p-2 bg-muted rounded text-sm">
              <span className="text-muted-foreground">New stock will be:</span>
              <span className="ml-2 font-mono font-medium">
                {adjustmentType === 'set' 
                  ? parseFloat(adjustmentValue) || 0
                  : adjustmentType === 'add'
                    ? batch.remaining_quantity + (parseFloat(adjustmentValue) || 0)
                    : Math.max(0, batch.remaining_quantity - (parseFloat(adjustmentValue) || 0))
                } {primaryUnit}
              </span>
            </div>
          )}
          
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm min-h-[60px]"
              placeholder="e.g., Damaged goods, Physical count adjustment..."
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateBatch.isPending || !adjustmentValue}>
              {updateBatch.isPending ? 'Saving...' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
