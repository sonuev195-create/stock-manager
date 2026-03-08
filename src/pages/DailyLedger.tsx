import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSales } from '@/hooks/useSales';
import { usePurchases } from '@/hooks/usePurchases';
import { useSuppliers } from '@/hooks/useSuppliers';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar,
  Wallet, CreditCard, Users, ShoppingCart, UserCheck, Receipt,
  ArrowLeftRight, Home as HomeIcon, Plus
} from 'lucide-react';

type SectionKey = 'drawer' | 'customer' | 'purchase' | 'employee' | 'expense' | 'exchange' | 'home';

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'drawer', label: 'Drawer', icon: Wallet, color: 'bg-emerald-100 text-emerald-700' },
  { key: 'customer', label: 'Customer', icon: CreditCard, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'purchase', label: 'Purchase', icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
  { key: 'employee', label: 'Employee', icon: Users, color: 'bg-sky-50 text-sky-600' },
  { key: 'expense', label: 'Expense', icon: Receipt, color: 'bg-rose-50 text-rose-500' },
  { key: 'exchange', label: 'Exchange', icon: ArrowLeftRight, color: 'bg-gray-100 text-gray-600' },
  { key: 'home', label: 'Home', icon: HomeIcon, color: 'bg-gray-100 text-gray-600' },
];

const CUSTOMER_TYPES = ['Sale', 'Sales Return', 'Balance Payment', 'Customer Advance'];
const PURCHASE_TYPES = ['Payment', 'Bill A (G)', 'Bill B (N)', 'Bill C (N/G)', 'Delivered', 'Return A (G)', 'Return B (N)', 'Expenses'];
const EXPENSE_CATEGORIES = ['Other Expenses', 'Vehicle Expenses', 'Workshop Expenses'];
const EXCHANGE_TYPES = ['UPI to Cash', 'Cash to UPI'];
const HOME_TYPES = ['Advance', 'Bank', 'Chitty', 'Closing', 'Other'];
const HOME_DIRECTIONS = ['To Owner', 'From Owner'];

export default function DailyLedger() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set());

  const { data: sales } = useSales();
  const { data: purchases } = usePurchases();
  const { data: suppliers } = useSuppliers();

  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = isToday ? 'Today' : format(selectedDate, 'EEEE');
  const dateSubLabel = format(selectedDate, 'EEEE, MMM d');

  const daySales = useMemo(() =>
    sales?.filter(s => isSameDay(new Date(s.sale_date), selectedDate)) || [],
    [sales, selectedDate]);

  const dayPurchases = useMemo(() =>
    purchases?.filter(p => isSameDay(new Date(p.purchase_date), selectedDate)) || [],
    [purchases, selectedDate]);

  const totalCash = daySales.reduce((s, sale) => s + Number(sale.total_amount), 0);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold">{dateLabel}</h1>
        <p className="text-sm text-muted-foreground">{dateSubLabel}</p>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="w-4 h-4" />
          {format(selectedDate, 'MMM d')}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-3 px-1">
        {SECTIONS.map(section => {
          const isOpen = expandedSections.has(section.key);
          return (
            <Collapsible key={section.key} open={isOpen} onOpenChange={() => toggleSection(section.key)}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${section.color}`}>
                      <section.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-sm">{section.label}</span>
                      {section.key === 'drawer' && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-emerald-600">🏪 ₹{totalCash.toFixed(0)}</span>
                          <span className="text-muted-foreground">🏧 ₹0</span>
                        </div>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t px-4 py-3">
                    {section.key === 'drawer' && <DrawerSection totalCash={totalCash} />}
                    {section.key === 'customer' && <CustomerSection />}
                    {section.key === 'purchase' && <PurchaseSection suppliers={suppliers || []} />}
                    {section.key === 'employee' && <EmployeeSection />}
                    {section.key === 'expense' && <ExpenseSection />}
                    {section.key === 'exchange' && <ExchangeSection />}
                    {section.key === 'home' && <HomeSection />}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// ─── Drawer Section ───
function DrawerSection({ totalCash }: { totalCash: number }) {
  const [closingCoin, setClosingCoin] = useState('0');
  const [closingNote, setClosingNote] = useState('0');
  const closingTotal = (parseFloat(closingCoin) || 0) + (parseFloat(closingNote) || 0);
  const error = Math.abs(totalCash - closingTotal);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {[
          { label: 'Cash', icon: Wallet, amount: totalCash },
          { label: 'UPI', icon: CreditCard, amount: 0 },
          { label: 'Customer Advance', icon: Users, amount: 0 },
          { label: 'Customer Due', icon: Users, amount: 0 },
          { label: 'Supplier Due', icon: ShoppingCart, amount: 0 },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-3 py-1.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <item.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm">{item.label}</span>
            <span className="font-mono text-sm font-semibold text-emerald-600">₹{item.amount.toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Opening (Cash)</span>
          <Button variant="ghost" size="sm" className="text-emerald-600 text-xs gap-1">✏️ Edit</Button>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-1 text-xs text-muted-foreground">
          <div><span>Coin</span><div className="font-mono text-foreground">₹0</div></div>
          <div><span>Note</span><div className="font-mono text-foreground">₹0</div></div>
          <div><span>Total</span><div className="font-mono text-foreground">₹0</div></div>
        </div>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2 flex justify-between items-center">
        <span className="text-sm text-emerald-700 dark:text-emerald-400">System Cash</span>
        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">₹{totalCash.toFixed(0)}</span>
      </div>

      <div className="space-y-2">
        <span className="font-semibold text-sm">Closing (Cash)</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Coin</Label>
            <Input value={closingCoin} onChange={e => setClosingCoin(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Input value={closingNote} onChange={e => setClosingNote(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex justify-between items-center bg-muted/50 rounded px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">Closing Total</span>
          <span className="font-mono font-semibold">₹{closingTotal}</span>
        </div>
        <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 rounded px-3 py-1.5 text-sm">
          <span className="flex items-center gap-1 text-emerald-600">✓ Error</span>
          <span className="font-mono font-semibold text-emerald-600">{error} Error</span>
        </div>
        <Button className="w-full gap-2">Update Closing</Button>
      </div>
    </div>
  );
}

// ─── Customer Section ───
function CustomerSection() {
  const [type, setType] = useState('Sale');
  const [billNo, setBillNo] = useState('S0001');
  const [customer, setCustomer] = useState('');
  const [welder, setWelder] = useState('None');
  const [amount, setAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('0');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Customer Transactions</span>
        <Button variant="outline" size="sm" className="text-xs gap-1"><Plus className="w-3 h-3" /> Add Customer</Button>
      </div>

      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="pt-4 space-y-3">
          <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Entry</span>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bill #</Label>
              <Input value={billNo} onChange={e => setBillNo(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer</Label>
              <Input placeholder="Name or phone" value={customer} onChange={e => setCustomer(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {type === 'Sale' && (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Welder</Label>
                <Select value={welder} onValueChange={setWelder}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input value={amount} onChange={e => setAmount(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">&nbsp;</Label>
                  <Input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <Button variant="link" size="sm" className="text-emerald-600 p-0 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">📷 Capture Bill</Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">⬆ Upload Bill</Button>
          </div>
          <Button className="w-full gap-2">✓ Save & Next</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Purchase Section ───
function PurchaseSection({ suppliers }: { suppliers: any[] }) {
  const [supplierName, setSupplierName] = useState('');
  const [type, setType] = useState('Bill A (G)');
  const [billNo, setBillNo] = useState('PB0001');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Purchase Transactions</span>
        <Button variant="outline" size="sm" className="text-xs gap-1"><Plus className="w-3 h-3" /> Add Supplier</Button>
      </div>

      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="pt-4 space-y-3">
          <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Entry</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Supplier</Label>
              <Input placeholder="Supplier name..." value={supplierName} onChange={e => setSupplierName(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURCHASE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Bill #</Label>
            <Input value={billNo} onChange={e => setBillNo(e.target.value)} className="h-8 text-xs w-40" />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">📷 Capture</Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">⬆ Upload</Button>
          </div>
          <Button className="w-full gap-2">✓ Save & Next</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Employee Section ───
function EmployeeSection() {
  const [employeeName, setEmployeeName] = useState('');
  const [category, setCategory] = useState('');
  const [salary, setSalary] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('0');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-sky-600 uppercase tracking-wide">Employee Transactions</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="text-xs gap-1"><Plus className="w-3 h-3" /> Category</Button>
          <Button variant="outline" size="sm" className="text-xs gap-1"><Plus className="w-3 h-3" /> Employee</Button>
        </div>
      </div>

      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="pt-4 space-y-3">
          <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Entry</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <Input placeholder="Employee name..." value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Salary</Label>
              <Input value={salary} onChange={e => setSalary(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">&nbsp;</Label>
              <Input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <Button variant="link" size="sm" className="text-emerald-600 p-0 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
          <Button className="w-full gap-2">✓ Save & Next</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Expense Section ───
function ExpenseSection() {
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('0');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-rose-500 uppercase tracking-wide">Expenses</span>
        <Button variant="outline" size="sm" className="text-xs gap-1"><Plus className="w-3 h-3" /> Add Category</Button>
      </div>

      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="pt-4 space-y-3">
          <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Entry</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Details</Label>
              <Input placeholder="Details..." value={details} onChange={e => setDetails(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">&nbsp;</Label>
              <Input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <Button className="w-full gap-2">✓ Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Exchange Section ───
function ExchangeSection() {
  const [type, setType] = useState('UPI to Cash');
  const [amount, setAmount] = useState('0');

  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exchange</span>

      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="pt-4 space-y-3">
          <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Entry</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXCHANGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <Button className="w-full gap-2">✓ Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Home Section ───
function HomeSection() {
  const [direction, setDirection] = useState('To Owner');
  const [type, setType] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('0');

  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Home</span>

      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="pt-4 space-y-3">
          <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Entry</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOME_DIRECTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">&nbsp;</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {HOME_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Details</Label>
              <Input placeholder="Details..." value={details} onChange={e => setDetails(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (Cash)</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <Button className="w-full gap-2">✓ Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
