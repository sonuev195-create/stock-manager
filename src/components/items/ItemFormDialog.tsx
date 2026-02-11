import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/hooks/useCategories';
import { useCreateItem, useUpdateItem, type ItemWithCategory } from '@/hooks/useItems';
import type { Database } from '@/integrations/supabase/types';
import { ArrowRightLeft } from 'lucide-react';

type UnitType = Database['public']['Enums']['unit_type'];

const UNIT_TYPES: { value: UnitType; label: string; primaryUnit: string; secondaryUnit: string }[] = [
  { value: 'kg_number', label: 'Kg - Numbers', primaryUnit: 'kg', secondaryUnit: 'pcs' },
  { value: 'sqft_number', label: 'Sq.Ft - Numbers', primaryUnit: 'sqft', secondaryUnit: 'pcs' },
  { value: 'piece', label: 'Piece Only', primaryUnit: 'pcs', secondaryUnit: '' },
];

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: ItemWithCategory | null;
}

export function ItemFormDialog({ open, onOpenChange, editItem }: ItemFormDialogProps) {
  const { data: categories } = useCategories();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const [formData, setFormData] = useState({
    item_code: '',
    name: '',
    category_id: '',
    unit_type: 'piece' as UnitType,
    primary_unit: 'pcs',
    secondary_unit: '',
    conversion_factor: 1,
    conversion_mode: 'permanent' as 'permanent' | 'batch_wise',
    current_selling_price: 0,
    low_stock_threshold: 10,
  });

  useEffect(() => {
    if (editItem) {
      setFormData({
        item_code: editItem.item_code,
        name: editItem.name,
        category_id: editItem.category_id || '',
        unit_type: editItem.unit_type,
        primary_unit: editItem.primary_unit,
        secondary_unit: editItem.secondary_unit || '',
        conversion_factor: editItem.conversion_factor || 1,
        conversion_mode: (editItem as any).conversion_mode || 'permanent',
        current_selling_price: editItem.current_selling_price,
        low_stock_threshold: editItem.low_stock_threshold || 10,
      });
    } else {
      setFormData({
        item_code: '',
        name: '',
        category_id: '',
        unit_type: 'piece',
        primary_unit: 'pcs',
        secondary_unit: '',
        conversion_factor: 1,
        conversion_mode: 'permanent',
        current_selling_price: 0,
        low_stock_threshold: 10,
      });
    }
  }, [editItem, open]);

  const handleUnitTypeChange = (value: UnitType) => {
    const unitType = UNIT_TYPES.find(u => u.value === value);
    setFormData(prev => ({
      ...prev,
      unit_type: value,
      primary_unit: unitType?.primaryUnit || 'pcs',
      secondary_unit: unitType?.secondaryUnit || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      item_code: formData.item_code,
      name: formData.name,
      category_id: formData.category_id || null,
      unit_type: formData.unit_type,
      primary_unit: formData.primary_unit,
      secondary_unit: formData.secondary_unit || null,
      conversion_factor: formData.unit_type !== 'piece' ? formData.conversion_factor : null,
      conversion_mode: formData.unit_type !== 'piece' ? formData.conversion_mode : 'permanent',
      current_selling_price: formData.current_selling_price,
      low_stock_threshold: formData.low_stock_threshold,
    };

    if (editItem) {
      await updateItem.mutateAsync({ id: editItem.id, ...itemData });
    } else {
      await createItem.mutateAsync(itemData);
    }
    
    onOpenChange(false);
  };

  const isPending = createItem.isPending || updateItem.isPending;
  const inverseConversion = formData.conversion_factor ? (1 / formData.conversion_factor) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{editItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Item Code *</Label>
              <Input
                value={formData.item_code}
                onChange={(e) => setFormData(prev => ({ ...prev, item_code: e.target.value }))}
                className="h-8 text-sm"
                placeholder="e.g., ITM001"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-sm"
                placeholder="Item name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unit Type *</Label>
              <Select
                value={formData.unit_type}
                onValueChange={(value) => handleUnitTypeChange(value as UnitType)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.unit_type !== 'piece' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Primary Unit</Label>
                  <Input
                    value={formData.primary_unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_unit: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Secondary Unit</Label>
                  <Input
                    value={formData.secondary_unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_unit: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Conversion Factor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.conversion_factor}
                    onChange={(e) => setFormData(prev => ({ ...prev, conversion_factor: parseFloat(e.target.value) || 1 }))}
                    className="h-8 text-sm"
                    placeholder="1 primary = ? secondary"
                  />
                </div>
              </div>

              {/* To and Fro conversion display */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 p-2 rounded-md">
                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                <span>
                  1 {formData.primary_unit} = {formData.conversion_factor} {formData.secondary_unit}
                  <span className="mx-2">|</span>
                  1 {formData.secondary_unit} = {inverseConversion.toFixed(4)} {formData.primary_unit}
                </span>
              </div>

              {/* Conversion mode toggle */}
              <div className="flex items-center justify-between bg-accent/30 p-2 rounded-md">
                <div>
                  <Label className="text-xs font-medium">Conversion Ratio Mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formData.conversion_mode === 'permanent' 
                      ? 'Uses fixed ratio for all batches' 
                      : 'Each batch can have its own ratio'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Permanent</span>
                  <Switch
                    checked={formData.conversion_mode === 'batch_wise'}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, conversion_mode: checked ? 'batch_wise' : 'permanent' }))}
                  />
                  <span className="text-xs text-muted-foreground">Batch-wise</span>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Current Selling Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.current_selling_price}
                onChange={(e) => setFormData(prev => ({ ...prev, current_selling_price: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-xs">Low Stock Threshold</Label>
              <Input
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData(prev => ({ ...prev, low_stock_threshold: parseInt(e.target.value) || 10 }))}
                className="h-8 text-sm"
                placeholder="10"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {editItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
