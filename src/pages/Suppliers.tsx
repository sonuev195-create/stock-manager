import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useSuppliersWithTotals } from '@/hooks/useSupplierPayments';
import { useDeleteSupplier, type Supplier } from '@/hooks/useSuppliers';
import { SupplierFormDialog } from '@/components/suppliers/SupplierFormDialog';
import { SupplierDetailsDialog } from '@/components/suppliers/SupplierDetailsDialog';
import { ExportButton } from '@/components/common/ExportButton';
import { SUPPLIER_COLUMNS } from '@/lib/exportUtils';
import { Search, Plus, Pencil, Trash2, Phone, Mail, Eye } from 'lucide-react';

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading } = useSuppliersWithTotals();
  const deleteSupplierMutation = useDeleteSupplier();

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    
    return suppliers.filter(supplier => {
      return search === '' || 
        supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        supplier.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
        supplier.phone?.includes(search);
    });
  }, [suppliers, search]);

  const handleEdit = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deleteSupplier) {
      await deleteSupplierMutation.mutateAsync(deleteSupplier.id);
      setDeleteSupplier(null);
    }
  };

  // Prepare export data
  const exportData = filteredSuppliers.map(s => ({
    name: s.name,
    contact_person: s.contact_person || '',
    phone: s.phone || '',
    email: s.email || '',
    gst_number: s.gst_number || '',
    address: s.address || '',
    total_purchases: `₹${(s as any).total_purchases?.toFixed(2) || '0.00'}`,
    total_paid: `₹${(s as any).total_paid?.toFixed(2) || '0.00'}`,
    due_amount: `₹${(s as any).due_amount?.toFixed(2) || '0.00'}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suppliers</h1>
        <div className="flex gap-2">
          <ExportButton 
            data={filteredSuppliers} 
            filename="suppliers" 
            allColumns={SUPPLIER_COLUMNS}
            defaultColumns={['name', 'contact_person', 'phone', 'email', 'total_purchases', 'due_amount']}
            title="Suppliers Report"
          />
          <Button size="sm" className="h-8 gap-1" onClick={() => { setEditSupplier(null); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Suppliers Table */}
      <div className="border rounded-md">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Total Purchases</TableHead>
              <TableHead className="text-right">Due Amount</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading suppliers...</TableCell>
              </TableRow>
            ) : filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {suppliers?.length === 0 ? 'No suppliers yet. Add your first supplier.' : 'No suppliers match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => {
                const typedSupplier = supplier as Supplier & { total_purchases: number; total_paid: number; due_amount: number };
                return (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.contact_person || '-'}</TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {supplier.email ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Mail className="w-3 h-3" />
                          {supplier.email}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">₹{typedSupplier.total_purchases.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {typedSupplier.due_amount > 0 ? (
                        <Badge variant="destructive" className="font-mono">₹{typedSupplier.due_amount.toFixed(2)}</Badge>
                      ) : (
                        <Badge variant="default" className="font-mono">₹0.00</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewSupplier(supplier as Supplier)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(supplier as Supplier)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteSupplier(supplier as Supplier)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredSuppliers.length} of {suppliers?.length || 0} suppliers
      </div>

      {/* Dialogs */}
      <SupplierFormDialog 
        open={showForm} 
        onOpenChange={setShowForm} 
        editSupplier={editSupplier}
      />

      <SupplierDetailsDialog
        supplier={viewSupplier}
        open={!!viewSupplier}
        onOpenChange={(open) => !open && setViewSupplier(null)}
      />

      <AlertDialog open={!!deleteSupplier} onOpenChange={() => setDeleteSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSupplier?.name}"? This action cannot be undone.
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
