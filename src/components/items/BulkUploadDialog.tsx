import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBulkCreateItems, type ItemInsert } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { Upload, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type UnitType = Database['public']['Enums']['unit_type'];

interface ParsedItem {
  item_code: string;
  name: string;
  category_name: string;
  unit_type: UnitType;
  primary_unit: string;
  secondary_unit: string;
  conversion_factor: number;
  current_selling_price: number;
  isValid: boolean;
  error?: string;
}

export function BulkUploadDialog() {
  const [open, setOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  
  const { data: categories } = useCategories();
  const bulkCreate = useBulkCreateItems();

  const parseUnitType = (value: string): UnitType => {
    const lower = value.toLowerCase().trim();
    if (lower.includes('kg') || lower === 'kg_number') return 'kg_number';
    if (lower.includes('sqft') || lower.includes('sq') || lower === 'sqft_number') return 'sqft_number';
    return 'piece';
  };

  const handleParse = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const items: ParsedItem[] = lines.map((line, index) => {
      const parts = line.split(',').map(s => s.trim());
      
      if (parts.length < 2) {
        return {
          item_code: parts[0] || `ITEM${index + 1}`,
          name: '',
          category_name: '',
          unit_type: 'piece' as UnitType,
          primary_unit: 'pcs',
          secondary_unit: '',
          conversion_factor: 1,
          current_selling_price: 0,
          isValid: false,
          error: 'At least item code and name are required',
        };
      }

      const [item_code, name, category_name = '', unit_type_str = 'piece', primary_unit = 'pcs', secondary_unit = '', conversion_factor_str = '1', price_str = '0'] = parts;
      
      const unit_type = parseUnitType(unit_type_str);
      const conversion_factor = parseFloat(conversion_factor_str) || 1;
      const current_selling_price = parseFloat(price_str) || 0;

      const isValid = item_code && name;
      
      return {
        item_code,
        name,
        category_name,
        unit_type,
        primary_unit: primary_unit || 'pcs',
        secondary_unit: unit_type === 'piece' ? '' : (secondary_unit || 'pcs'),
        conversion_factor,
        current_selling_price,
        isValid: !!isValid,
        error: isValid ? undefined : 'Missing required fields',
      };
    });

    setParsedItems(items);
    setStep('preview');
  };

  const handleUpload = async () => {
    const validItems = parsedItems.filter(item => item.isValid);
    
    const itemsToCreate: ItemInsert[] = validItems.map(item => {
      const category = categories?.find(c => 
        c.name.toLowerCase() === item.category_name.toLowerCase()
      );
      
      return {
        item_code: item.item_code,
        name: item.name,
        category_id: category?.id || null,
        unit_type: item.unit_type,
        primary_unit: item.primary_unit,
        secondary_unit: item.unit_type === 'piece' ? null : item.secondary_unit,
        conversion_factor: item.unit_type === 'piece' ? null : item.conversion_factor,
        current_selling_price: item.current_selling_price,
      };
    });

    await bulkCreate.mutateAsync(itemsToCreate);
    setOpen(false);
    setBulkText('');
    setParsedItems([]);
    setStep('input');
  };

  const downloadTemplate = () => {
    const template = `Item Code,Name,Category,Unit Type,Primary Unit,Secondary Unit,Conversion Factor,Selling Price
ITM001,Rice Basmati,Groceries,kg_number,kg,pcs,1,120
ITM002,Tiles 2x2,Building,sqft_number,sqft,pcs,4,45
ITM003,Cement Bag,Building,piece,pcs,,1,380`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedItems.filter(i => i.isValid).length;
  const invalidCount = parsedItems.filter(i => !i.isValid).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Upload className="w-3.5 h-3.5" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Bulk Upload Items</DialogTitle>
        </DialogHeader>
        
        {step === 'input' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Paste your items data below (CSV format)
              </p>
              <Button variant="outline" size="sm" className="h-7 gap-1" onClick={downloadTemplate}>
                <FileDown className="w-3 h-3" /> Download Template
              </Button>
            </div>
            
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Item Code,Name,Category,Unit Type,Primary Unit,Secondary Unit,Conversion Factor,Selling Price
ITM001,Rice Basmati,Groceries,kg_number,kg,pcs,1,120
ITM002,Tiles 2x2,Building,sqft_number,sqft,pcs,4,45`}
              className="min-h-[200px] text-sm font-mono"
            />
            
            <div className="text-xs text-muted-foreground">
              <p><strong>Format:</strong> Item Code, Name, Category, Unit Type, Primary Unit, Secondary Unit, Conversion Factor, Selling Price</p>
              <p><strong>Unit Types:</strong> piece, kg_number, sqft_number</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleParse} disabled={!bulkText.trim()}>
                Preview Items
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-4 h-4" /> {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="w-4 h-4" /> {invalidCount} with errors
                </span>
              )}
            </div>
            
            <div className="flex-1 overflow-auto border rounded-md">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Type</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => (
                    <TableRow key={index} className={!item.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {item.isValid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                      <TableCell>{item.name || <span className="text-destructive">Missing</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category_name || '-'}</TableCell>
                      <TableCell className="text-xs">{item.unit_type}</TableCell>
                      <TableCell>₹{item.current_selling_price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('input')}>Back</Button>
              <Button size="sm" onClick={handleUpload} disabled={validCount === 0 || bulkCreate.isPending}>
                Upload {validCount} Items
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
