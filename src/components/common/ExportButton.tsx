import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToPDF, exportToExcel, type ExportColumn } from '@/lib/exportUtils';

interface ExportButtonProps {
  data: any[];
  allColumns: Record<string, ExportColumn>;
  defaultColumns: string[];
  title: string;
  filename: string;
}

export function ExportButton({ data, allColumns, defaultColumns, title, filename }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(defaultColumns);

  const handleToggleColumn = (key: string) => {
    setSelectedColumns(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleExportPDF = () => {
    const columns = selectedColumns.map(key => allColumns[key]).filter(Boolean);
    exportToPDF(data, columns, title, filename);
    setOpen(false);
  };

  const handleExportExcel = () => {
    const columns = selectedColumns.map(key => allColumns[key]).filter(Boolean);
    exportToExcel(data, columns, filename);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}>
        <FileDown className="w-3.5 h-3.5" />
        Export
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Export {title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select columns to include in the export:
            </div>
            
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {Object.entries(allColumns).map(([key, col]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={selectedColumns.includes(key)}
                    onCheckedChange={() => handleToggleColumn(key)}
                  />
                  <Label htmlFor={key} className="text-sm cursor-pointer">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
            
            <div className="text-xs text-muted-foreground">
              {data.length} records will be exported
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1"
              onClick={handleExportExcel}
              disabled={selectedColumns.length === 0}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </Button>
            <Button 
              size="sm" 
              className="gap-1"
              onClick={handleExportPDF}
              disabled={selectedColumns.length === 0}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
