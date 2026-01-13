import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSuppliers, useDeleteSupplier, type Supplier } from '@/hooks/useSuppliers';
import { SupplierFormDialog } from '@/components/suppliers/SupplierFormDialog';
import { Search, Plus, Pencil, Trash2, Phone, Mail } from 'lucide-react';

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading } = useSuppliers();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suppliers</h1>
        <Button size="sm" className="h-8 gap-1" onClick={() => { setEditSupplier(null); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Add Supplier
        </Button>
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
              <TableHead>GST Number</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading suppliers...</TableCell>
              </TableRow>
            ) : filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {suppliers?.length === 0 ? 'No suppliers yet. Add your first supplier.' : 'No suppliers match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
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
                  <TableCell className="font-mono text-xs">{supplier.gst_number || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(supplier)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteSupplier(supplier)}>
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
        Showing {filteredSuppliers.length} of {suppliers?.length || 0} suppliers
      </div>

      {/* Dialogs */}
      <SupplierFormDialog 
        open={showForm} 
        onOpenChange={setShowForm} 
        editSupplier={editSupplier}
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
