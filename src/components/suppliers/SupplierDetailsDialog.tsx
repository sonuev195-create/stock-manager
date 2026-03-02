import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupplierWithDetails } from '@/hooks/useSupplierPayments';
import { useSupplierPayments, useCreateSupplierPayment, useDeleteSupplierPayment } from '@/hooks/useSupplierPaymentOperations';
import { format } from 'date-fns';
import { Plus, CreditCard, FileText, Phone, Mail, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Supplier } from '@/hooks/useSuppliers';
import { toast } from 'sonner';

interface SupplierDetailsDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierDetailsDialog({ supplier, open, onOpenChange }: SupplierDetailsDialogProps) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  const { data: supplierDetails, isLoading } = useSupplierWithDetails(supplier?.id || null);
  const { data: payments } = useSupplierPayments(supplier?.id || null);
  const createPayment = useCreateSupplierPayment();
  const deletePayment = useDeleteSupplierPayment();

  const handleAddPayment = async () => {
    if (!supplier || !paymentAmount) return;
    
    await createPayment.mutateAsync({
      supplier_id: supplier.id,
      purchase_id: supplier.payment_type === 'bill-wise' ? selectedPurchaseId : null,
      amount: parseFloat(paymentAmount),
      payment_mode: paymentMode,
      notes: paymentNotes || null,
    });
    
    setPaymentAmount('');
    setPaymentNotes('');
    setSelectedPurchaseId(null);
    setShowPaymentForm(false);
    setEditingPaymentId(null);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!supplier) return;
    await deletePayment.mutateAsync({ id: paymentId, supplierId: supplier.id });
  };

  const handleEditPayment = (payment: any) => {
    setEditingPaymentId(payment.id);
    setPaymentAmount(payment.amount.toString());
    setPaymentMode(payment.payment_mode);
    setPaymentNotes(payment.notes || '');
    setSelectedPurchaseId(payment.purchase_id);
    setShowPaymentForm(true);
  };

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{supplier.name}</span>
            <Badge variant={supplier.payment_type === 'bill-wise' ? 'default' : 'secondary'}>
              {supplier.payment_type === 'bill-wise' ? 'Bill-wise Payment' : 'Total Payment'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Supplier Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs text-muted-foreground">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="text-xl font-bold">₹{supplierDetails?.total_purchases?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="text-xl font-bold text-primary">₹{supplierDetails?.total_paid?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs text-muted-foreground">Due Amount</CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="text-xl font-bold text-destructive">₹{supplierDetails?.due_amount?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4 p-3 bg-muted/30 rounded-md">
          {supplier.contact_person && <span className="font-medium">{supplier.contact_person}</span>}
          {supplier.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {supplier.phone}</span>}
          {supplier.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {supplier.email}</span>}
          {supplier.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {supplier.address}</span>}
          {supplier.gst_number && <span className="font-mono">GST: {supplier.gst_number}</span>}
        </div>

        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="purchases" className="gap-1"><FileText className="w-3 h-3" /> Purchases</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1"><CreditCard className="w-3 h-3" /> Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading purchases...</div>
            ) : supplierDetails?.purchases?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No purchases from this supplier yet.</div>
            ) : (
              <div className="border rounded-md">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchase #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total ₹</TableHead>
                      <TableHead className="text-right">Paid ₹</TableHead>
                      <TableHead className="text-right">Due ₹</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierDetails?.purchases?.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-mono text-sm">{purchase.purchase_number}</TableCell>
                        <TableCell>{format(new Date(purchase.purchase_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right font-mono">₹{purchase.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-primary">₹{purchase.paid_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">₹{purchase.due_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={purchase.due_amount <= 0 ? 'default' : 'destructive'}>
                            {purchase.due_amount <= 0 ? 'Paid' : 'Due'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setShowPaymentForm(!showPaymentForm); setEditingPaymentId(null); setPaymentAmount(''); setPaymentNotes(''); }} className="gap-1">
                <Plus className="w-3 h-3" />
                Add Payment
              </Button>
            </div>

            {showPaymentForm && (
              <Card className="border-primary">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {supplier.payment_type === 'bill-wise' && supplierDetails?.purchases && (
                      <div className="space-y-1">
                        <Label className="text-xs">Against Purchase</Label>
                        <Select value={selectedPurchaseId || ''} onValueChange={setSelectedPurchaseId}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select purchase..." />
                          </SelectTrigger>
                          <SelectContent>
                            {supplierDetails.purchases.filter(p => p.due_amount > 0).map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.purchase_number} - Due: ₹{p.due_amount.toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Amount ₹</Label>
                      <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Payment Mode</Label>
                      <Select value={paymentMode} onValueChange={setPaymentMode}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Optional notes..." className="h-8" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setShowPaymentForm(false); setEditingPaymentId(null); }}>Cancel</Button>
                    <Button size="sm" onClick={handleAddPayment} disabled={!paymentAmount || createPayment.isPending}>
                      {createPayment.isPending ? 'Saving...' : editingPaymentId ? 'Update Payment' : 'Save Payment'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {payments?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No payments recorded yet.</div>
            ) : (
              <div className="border rounded-md">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Against</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Amount ₹</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {payment.purchases ? (
                            <Badge variant="outline">{payment.purchases.purchase_number}</Badge>
                          ) : (
                            <span className="text-muted-foreground">General</span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{payment.payment_mode}</TableCell>
                        <TableCell className="text-right font-mono text-primary">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{payment.notes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditPayment(payment)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeletePayment(payment.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
