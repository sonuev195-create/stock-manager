import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSupplier, useUpdateSupplier, type Supplier } from '@/hooks/useSuppliers';
import { Truck } from 'lucide-react';

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSupplier?: Supplier | null;
}

export function SupplierFormDialog({ open, onOpenChange, editSupplier }: SupplierFormDialogProps) {
  const [name, setName] = useState(editSupplier?.name || '');
  const [contactPerson, setContactPerson] = useState(editSupplier?.contact_person || '');
  const [phone, setPhone] = useState(editSupplier?.phone || '');
  const [email, setEmail] = useState(editSupplier?.email || '');
  const [address, setAddress] = useState(editSupplier?.address || '');
  const [gstNumber, setGstNumber] = useState(editSupplier?.gst_number || '');
  
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstNumber('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && editSupplier) {
      setName(editSupplier.name);
      setContactPerson(editSupplier.contact_person || '');
      setPhone(editSupplier.phone || '');
      setEmail(editSupplier.email || '');
      setAddress(editSupplier.address || '');
      setGstNumber(editSupplier.gst_number || '');
    } else if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;
    
    const supplierData = {
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      gst_number: gstNumber.trim() || null,
    };
    
    if (editSupplier) {
      await updateSupplier.mutateAsync({ id: editSupplier.id, ...supplierData });
    } else {
      await createSupplier.mutateAsync(supplierData);
    }
    
    handleOpenChange(false);
  };

  const isPending = createSupplier.isPending || updateSupplier.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {editSupplier ? 'Edit Supplier' : 'Add Supplier'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
              placeholder="Supplier name"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Person</Label>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="h-8 text-sm"
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-8 text-sm"
                placeholder="Phone number"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GST Number</Label>
              <Input
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="h-8 text-sm"
                placeholder="GST number"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="text-sm min-h-[60px]"
              placeholder="Full address"
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Saving...' : editSupplier ? 'Update' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
