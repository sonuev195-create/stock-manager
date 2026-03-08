import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings, useUpdateSettings, getReportColumns, setReportColumns, type ReportColumns } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { 
  ITEM_COLUMNS, 
  INVENTORY_COLUMNS, 
  PURCHASE_COLUMNS, 
  SALE_COLUMNS, 
  SUPPLIER_COLUMNS 
} from '@/lib/exportUtils';
import { Save, Settings2, FileText, Lock, Sun, Moon, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [purchasePrefix, setPurchasePrefix] = useState('PUR');
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(true);
  const [deletePassword, setDeletePassword] = useState('');
  
  const [reportColumns, setLocalReportColumns] = useState<ReportColumns>(getReportColumns());

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.business_name || '');
      setBusinessAddress(settings.business_address || '');
      setBusinessPhone(settings.business_phone || '');
      setBusinessEmail(settings.business_email || '');
      setInvoicePrefix(settings.invoice_prefix || 'INV');
      setPurchasePrefix(settings.purchase_prefix || 'PUR');
      setLowStockAlertEnabled(settings.low_stock_alert_enabled ?? true);
      setDeletePassword((settings as any).delete_password || '');
    }
  }, [settings]);

  const handleSaveGeneral = async () => {
    await updateSettings.mutateAsync({
      business_name: businessName,
      business_address: businessAddress,
      business_phone: businessPhone,
      business_email: businessEmail,
      invoice_prefix: invoicePrefix,
      purchase_prefix: purchasePrefix,
      low_stock_alert_enabled: lowStockAlertEnabled,
      delete_password: deletePassword || null,
    } as any);
  };

  const toggleReportColumn = (reportType: keyof ReportColumns, columnKey: string) => {
    const newColumns = { ...reportColumns };
    const columns = newColumns[reportType];
    
    if (columns.includes(columnKey)) {
      newColumns[reportType] = columns.filter(k => k !== columnKey);
    } else {
      newColumns[reportType] = [...columns, columnKey];
    }
    
    setLocalReportColumns(newColumns);
    setReportColumns(newColumns);
  };

  const handleSaveReportColumns = () => {
    setReportColumns(reportColumns);
    toast.success('Report column preferences saved');
  };

  const renderColumnCheckboxes = (
    reportType: keyof ReportColumns, 
    allColumns: Record<string, { label: string }>
  ) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {Object.entries(allColumns).map(([key, col]) => (
        <div key={key} className="flex items-center space-x-2">
          <Checkbox
            id={`${reportType}-${key}`}
            checked={reportColumns[reportType].includes(key)}
            onCheckedChange={() => toggleReportColumn(reportType, key)}
          />
          <Label htmlFor={`${reportType}-${key}`} className="text-sm cursor-pointer">
            {col.label}
          </Label>
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-1">
            <Settings2 className="w-3.5 h-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1">
            <FileText className="w-3.5 h-3.5" />
            Report Columns
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <div className="space-y-4">
            {/* Theme Toggle */}
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Appearance</CardTitle>
                <CardDescription className="text-xs">Choose light or dark theme</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    <Label className="text-sm">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-muted-foreground" />
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    />
                    <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Business Information</CardTitle>
                <CardDescription className="text-xs">
                  Configure your business details for invoices and reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business Name</Label>
                    <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-8 text-sm" placeholder="My Business" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="h-8 text-sm" placeholder="+91 9876543210" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className="h-8 text-sm" placeholder="business@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address</Label>
                    <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="h-8 text-sm" placeholder="123 Main Street, City" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice Number Prefix</Label>
                    <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} className="h-8 text-sm w-32" placeholder="INV" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Purchase Number Prefix</Label>
                    <Input value={purchasePrefix} onChange={(e) => setPurchasePrefix(e.target.value)} className="h-8 text-sm w-32" placeholder="PUR" />
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label className="text-sm">Low Stock Alerts</Label>
                    <p className="text-xs text-muted-foreground">Show alerts when items are low on stock</p>
                  </div>
                  <Switch checked={lowStockAlertEnabled} onCheckedChange={setLowStockAlertEnabled} />
                </div>
                
                <div className="space-y-1.5 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm">Delete Password</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Required for permanent deletion of items, bills, and purchases</p>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="h-8 text-sm w-48"
                    placeholder="Set delete password"
                  />
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button size="sm" className="gap-1" onClick={handleSaveGeneral} disabled={updateSettings.isPending}>
                    <Save className="w-3.5 h-3.5" />
                    {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive">
              <CardHeader className="py-4">
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-xs">Irreversible actions. Proceed with extreme caution.</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      Erase All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">Erase All Data</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL sales, purchases, items, batches, categories, suppliers, and payments. This action cannot be undone.
                        <br /><br />
                        Type <strong>ERASE ALL</strong> to confirm:
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="Type ERASE ALL"
                      className="h-8 text-sm"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setResetConfirmText('')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={resetConfirmText !== 'ERASE ALL' || isResetting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async () => {
                          setIsResetting(true);
                          try {
                            // Delete in order of dependencies
                            await supabase.from('sale_items').delete().neq('id', '');
                            await supabase.from('sales').delete().neq('id', '');
                            await supabase.from('purchase_items').delete().neq('id', '');
                            await supabase.from('supplier_payments').delete().neq('id', '');
                            await supabase.from('purchases').delete().neq('id', '');
                            await supabase.from('batches').delete().neq('id', '');
                            await supabase.from('items').delete().neq('id', '');
                            await supabase.from('categories').delete().neq('id', '');
                            await supabase.from('suppliers').delete().neq('id', '');
                            queryClient.invalidateQueries();
                            toast.success('All data has been erased');
                          } catch (err: any) {
                            toast.error(`Failed to erase data: ${err.message}`);
                          } finally {
                            setIsResetting(false);
                            setResetConfirmText('');
                          }
                        }}
                      >
                        {isResetting ? 'Erasing...' : 'Erase Everything'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Items Report Columns</CardTitle>
              <CardDescription className="text-xs">Select which columns to include when exporting items</CardDescription>
            </CardHeader>
            <CardContent>{renderColumnCheckboxes('items', ITEM_COLUMNS)}</CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Inventory Report Columns</CardTitle>
              <CardDescription className="text-xs">Select which columns to include when exporting inventory</CardDescription>
            </CardHeader>
            <CardContent>{renderColumnCheckboxes('inventory', INVENTORY_COLUMNS)}</CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Sales Report Columns</CardTitle>
              <CardDescription className="text-xs">Select which columns to include when exporting sales/bills</CardDescription>
            </CardHeader>
            <CardContent>{renderColumnCheckboxes('sales', SALE_COLUMNS)}</CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Purchase Report Columns</CardTitle>
              <CardDescription className="text-xs">Select which columns to include when exporting purchases</CardDescription>
            </CardHeader>
            <CardContent>{renderColumnCheckboxes('purchases', PURCHASE_COLUMNS)}</CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Suppliers Report Columns</CardTitle>
              <CardDescription className="text-xs">Select which columns to include when exporting suppliers</CardDescription>
            </CardHeader>
            <CardContent>{renderColumnCheckboxes('suppliers', SUPPLIER_COLUMNS)}</CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button size="sm" className="gap-1" onClick={handleSaveReportColumns}>
              <Save className="w-3.5 h-3.5" />
              Save Column Preferences
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
