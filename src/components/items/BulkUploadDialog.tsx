import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBulkCreateItems, type ItemInsert } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { Upload, FileDown, AlertCircle, CheckCircle2, ClipboardPaste, FileSpreadsheet } from 'lucide-react';
import { read, utils } from 'xlsx';
import type { Database } from '@/integrations/supabase/types';

type UnitType = Database['public']['Enums']['unit_type'];

interface ParsedItem {
  item_code: string;
  name: string;
  shortword: string;
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

  const parseText = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    
    const items: ParsedItem[] = lines.map((line, index) => {
      const isTabSeparated = line.includes('\t');
      const separator = isTabSeparated ? '\t' : ',';
      const parts = line.split(separator).map(s => s.trim().replace(/^"|"$/g, ''));
      
      if (parts.length < 2) {
        return {
          item_code: parts[0] || `ITEM${index + 1}`,
          name: '',
          shortword: '',
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

      // Format: Code, Name, Shortword, Category, Unit Type, Primary, Secondary, ConvFactor, Price
      const [item_code, name, shortword = '', category_name = '', unit_type_str = 'piece', primary_unit = 'pcs', secondary_unit = '', conversion_factor_str = '1', price_str = '0'] = parts;
      
      const unit_type = parseUnitType(unit_type_str);
      const conversion_factor = parseFloat(conversion_factor_str) || 1;
      const current_selling_price = parseFloat(price_str) || 0;

      const isValid = item_code && name;
      
      return {
        item_code,
        name,
        shortword,
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

    return items;
  };

  const handleParse = () => {
    const items = parseText(bulkText);
    setParsedItems(items);
    setStep('preview');
  };

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBulkText(text);
      if (text.includes('\t') || text.includes(',')) {
        const items = parseText(text);
        if (items.length > 0 && items.some(i => i.isValid)) {
          setParsedItems(items);
          setStep('preview');
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }, []);

  const handleUpload = async () => {
    const validItems = parsedItems.filter(item => item.isValid);
    
    const itemsToCreate: ItemInsert[] = validItems.map(item => {
      const category = categories?.find(c => 
        c.name.toLowerCase() === item.category_name.toLowerCase()
      );
      
      return {
        item_code: item.item_code,
        name: item.name,
        shortword: item.shortword || null,
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

  const updateParsedItem = (index: number, field: keyof ParsedItem, value: any) => {
    const updated = [...parsedItems];
    (updated[index] as any)[field] = value;
    updated[index].isValid = !!(updated[index].item_code && updated[index].name);
    updated[index].error = updated[index].isValid ? undefined : 'Missing required fields';
    setParsedItems(updated);
  };

  const downloadTemplate = () => {
    const template = `Item Code,Name,Shortword,Category,Unit Type,Primary Unit,Secondary Unit,Conversion Factor,Selling Price
ITM001,Rice Basmati,Rice,Groceries,kg_number,kg,pcs,1,120
ITM002,Tiles 2x2,Tile,Building,sqft_number,sqft,pcs,4,45
ITM003,Cement Bag,Cement,Building,piece,pcs,,1,380`;
    
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
                Paste data from Excel/Google Sheets or enter CSV format
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 gap-1" onClick={handlePaste}>
                  <ClipboardPaste className="w-3 h-3" /> Paste from Clipboard
                </Button>
                <Button variant="outline" size="sm" className="h-7 gap-1" onClick={downloadTemplate}>
                  <FileDown className="w-3 h-3" /> Download Template
                </Button>
              </div>
            </div>
            
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Paste from Excel/Sheets (tab-separated) or CSV format:

Item Code,Name,Shortword,Category,Unit Type,Primary Unit,Secondary Unit,Conversion Factor,Selling Price
ITM001,Rice Basmati,Rice,Groceries,kg_number,kg,pcs,1,120
ITM002,Tiles 2x2,Tile,Building,sqft_number,sqft,pcs,4,45`}
              className="min-h-[200px] text-sm font-mono"
            />
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Supports:</strong> Copy-paste from Excel, Google Sheets, or CSV files</p>
              <p><strong>Format:</strong> Code, Name, Shortword, Category, Unit Type, Primary Unit, Secondary Unit, Conversion Factor, Price</p>
              <p><strong>Shortword:</strong> Short name used in paper bills for OCR matching</p>
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
                    <TableHead>Shortword</TableHead>
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
                      <TableCell>
                        <Input
                          value={item.item_code}
                          onChange={(e) => updateParsedItem(index, 'item_code', e.target.value)}
                          className="h-6 text-xs font-mono w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) => updateParsedItem(index, 'name', e.target.value)}
                          className="h-6 text-xs w-40"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.shortword}
                          onChange={(e) => updateParsedItem(index, 'shortword', e.target.value)}
                          className="h-6 text-xs w-24"
                          placeholder="OCR"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.category_name}
                          onChange={(e) => updateParsedItem(index, 'category_name', e.target.value)}
                          className="h-6 text-xs w-28"
                        />
                      </TableCell>
                      <TableCell className="text-xs">{item.unit_type}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.current_selling_price}
                          onChange={(e) => updateParsedItem(index, 'current_selling_price', parseFloat(e.target.value) || 0)}
                          className="h-6 text-xs w-20"
                        />
                      </TableCell>
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