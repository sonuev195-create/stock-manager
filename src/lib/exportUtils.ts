import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

export function exportToPDF(
  data: any[],
  columns: ExportColumn[],
  title: string,
  filename: string
) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  
  // Table
  const headers = columns.map(c => c.label);
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value, row) : String(value ?? '-');
    })
  );
  
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  doc.save(`${filename}.pdf`);
}

export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  filename: string
) {
  const worksheetData = data.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach(col => {
      const value = row[col.key];
      obj[col.label] = col.format ? col.format(value, row) : value ?? '';
    });
    return obj;
  });
  
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  // Auto-size columns
  const colWidths = columns.map(col => ({
    wch: Math.max(col.label.length, ...data.map(row => {
      const val = row[col.key];
      return String(val ?? '').length;
    }).slice(0, 100))
  }));
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Column definitions for different report types
export const ITEM_COLUMNS: Record<string, ExportColumn> = {
  item_code: { key: 'item_code', label: 'Item Code' },
  name: { key: 'name', label: 'Name' },
  category: { key: 'category', label: 'Category', format: (_, row) => row.categories?.name || '-' },
  unit_type: { key: 'unit_type', label: 'Unit Type' },
  primary_unit: { key: 'primary_unit', label: 'Primary Unit' },
  secondary_unit: { key: 'secondary_unit', label: 'Secondary Unit', format: v => v || '-' },
  conversion_factor: { key: 'conversion_factor', label: 'Conversion', format: v => v || '-' },
  stock: { key: 'total_stock', label: 'Stock', format: v => String(v || 0) },
  price: { key: 'current_selling_price', label: 'Selling Price', format: v => `₹${v}` },
  low_stock_threshold: { key: 'low_stock_threshold', label: 'Low Stock Threshold' },
};

export const INVENTORY_COLUMNS: Record<string, ExportColumn> = {
  item_code: { key: 'item_code', label: 'Item Code' },
  name: { key: 'name', label: 'Name' },
  category: { key: 'category', label: 'Category', format: (_, row) => row.categories?.name || '-' },
  unit_type: { key: 'unit_type', label: 'Unit Type' },
  total_stock: { key: 'total_stock', label: 'Total Stock (Primary)', format: (v, row) => `${v || 0} ${row.primary_unit}` },
  secondary_stock: { key: 'secondary_stock', label: 'Total Stock (Secondary)', format: (_, row) => {
    if (!row.conversion_factor || !row.secondary_unit) return '-';
    return `${((row.total_stock || 0) * row.conversion_factor).toFixed(1)} ${row.secondary_unit}`;
  }},
  batch_count: { key: 'batch_count', label: 'Batch Count' },
  status: { key: 'status', label: 'Status', format: (_, row) => {
    const stock = row.total_stock || 0;
    const threshold = row.low_stock_threshold || 10;
    if (stock <= 0) return 'Out of Stock';
    if (stock <= threshold) return 'Low Stock';
    return 'In Stock';
  }},
};

export const PURCHASE_COLUMNS: Record<string, ExportColumn> = {
  purchase_number: { key: 'purchase_number', label: 'Purchase #' },
  date: { key: 'purchase_date', label: 'Date', format: v => new Date(v).toLocaleDateString() },
  supplier: { key: 'supplier', label: 'Supplier', format: (_, row) => row.suppliers?.name || 'Walk-in' },
  items_count: { key: 'items_count', label: 'Items', format: (_, row) => String(row.purchase_items?.length || 0) },
  total: { key: 'total_amount', label: 'Total', format: v => `₹${v}` },
  notes: { key: 'notes', label: 'Notes', format: v => v || '-' },
};

export const SALE_COLUMNS: Record<string, ExportColumn> = {
  sale_number: { key: 'sale_number', label: 'Invoice #' },
  date: { key: 'sale_date', label: 'Date', format: v => new Date(v).toLocaleDateString() },
  customer: { key: 'customer_name', label: 'Customer', format: v => v || '-' },
  items_count: { key: 'items_count', label: 'Items', format: (_, row) => String(row.sale_items?.length || 0) },
  subtotal: { key: 'subtotal', label: 'Subtotal', format: v => `₹${v}` },
  discount: { key: 'discount', label: 'Discount', format: v => `₹${v}` },
  total: { key: 'total_amount', label: 'Total', format: v => `₹${v}` },
  profit: { key: 'total_profit', label: 'Profit', format: v => `₹${v}` },
};

export const SUPPLIER_COLUMNS: Record<string, ExportColumn> = {
  name: { key: 'name', label: 'Name' },
  contact_person: { key: 'contact_person', label: 'Contact Person', format: v => v || '-' },
  phone: { key: 'phone', label: 'Phone', format: v => v || '-' },
  email: { key: 'email', label: 'Email', format: v => v || '-' },
  address: { key: 'address', label: 'Address', format: v => v || '-' },
  gst_number: { key: 'gst_number', label: 'GST Number', format: v => v || '-' },
  due_amount: { key: 'due_amount', label: 'Due Amount', format: v => `₹${v || 0}` },
  total_purchases: { key: 'total_purchases', label: 'Total Purchases', format: v => `₹${v || 0}` },
};
