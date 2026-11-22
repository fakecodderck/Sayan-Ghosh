import { jsPDF } from 'jspdf';
import {
  CompanySettings,
  InventoryItem,
  TransactionVoucher,
  VoucherType
} from '../types/accounting';
import { formatDateReadable, getDateRangeLabel } from './dayBookPdf';

export type StockMovementType = 'SALE' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

export interface StockTransactionRow {
  id: string;
  date: string;
  createdAt: string;
  voucher: TransactionVoucher;
  voucherNo: string;
  movementType: StockMovementType;
  direction: 'IN' | 'OUT';
  productId: string;
  productName: string;
  sku: string;
  category: string;
  hsn: string;
  partyName: string;
  qty: number;
  inQty: number;
  outQty: number;
  unit: string;
  rate: number;
  total: number;
}

export interface ProductMovementSummary {
  key: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  purchasedQty: number;
  soldQty: number;
  salesReturnQty: number;
  purchaseReturnQty: number;
  totalInQty: number;
  totalOutQty: number;
  netChange: number;
  currentStock: number | null;
  salesValue: number;
  purchaseValue: number;
  txCount: number;
}

export interface StockReportExportOptions {
  rows: StockTransactionRow[];
  productSummaries: ProductMovementSummary[];
  settings: CompanySettings;
  startDate: string;
  endDate: string;
  selectedTypes: StockMovementType[]; // empty = all
  productCategory: string; // 'ALL' or category name
  reportMode?: 'transactions' | 'summary';
}

export const STOCK_MOVEMENT_META: {
  key: StockMovementType;
  label: string;
  shortLabel: string;
  direction: 'IN' | 'OUT';
}[] = [
  { key: 'SALE', label: 'Sold (Sales)', shortLabel: 'Sold', direction: 'OUT' },
  { key: 'PURCHASE', label: 'Purchased', shortLabel: 'Purchased', direction: 'IN' },
  { key: 'CREDIT_NOTE', label: 'Sales Return', shortLabel: 'Sales Ret.', direction: 'IN' },
  { key: 'DEBIT_NOTE', label: 'Purchase Return', shortLabel: 'Purch. Ret.', direction: 'OUT' },
];

export function getMovementLabel(type: StockMovementType): string {
  return STOCK_MOVEMENT_META.find(m => m.key === type)?.shortLabel || type;
}

export function getSelectedTypesLabel(selectedTypes: StockMovementType[]): string {
  if (selectedTypes.length === 0 || selectedTypes.length === STOCK_MOVEMENT_META.length) {
    return 'All Stock Transactions';
  }
  return selectedTypes
    .map(t => STOCK_MOVEMENT_META.find(m => m.key === t)?.label || t)
    .join(', ');
}

const STOCK_VOUCHER_TYPES: Set<VoucherType> = new Set([
  'SALE',
  'PURCHASE',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
]);

export function buildStockTransactions(
  vouchers: TransactionVoucher[],
  inventory: InventoryItem[]
): StockTransactionRow[] {
  const invById = new Map<string, InventoryItem>();
  const invByName = new Map<string, InventoryItem>();

  for (const item of inventory) {
    invById.set(item.id, item);
    invByName.set(item.name.trim().toLowerCase(), item);
  }

  const rows: StockTransactionRow[] = [];

  for (const v of vouchers) {
    if (!STOCK_VOUCHER_TYPES.has(v.type)) continue;
    const items = v.items || [];
    if (items.length === 0) continue;

    const movementType = v.type as StockMovementType;
    const direction: 'IN' | 'OUT' =
      movementType === 'PURCHASE' || movementType === 'CREDIT_NOTE' ? 'IN' : 'OUT';
    const partyName = v.guestDetails?.name || v.partyName || 'Walk-in / Direct';

    items.forEach((item, idx) => {
      const matched =
        invById.get(item.itemId) || invByName.get((item.name || '').trim().toLowerCase());
      const qty = Number(item.qty || 0);
      if (qty <= 0) return;

      rows.push({
        id: `${v.id}_${idx}`,
        date: v.date || '',
        createdAt: v.createdAt || '',
        voucher: v,
        voucherNo: v.voucherNo || '—',
        movementType,
        direction,
        productId: matched?.id || item.itemId,
        productName: item.name || matched?.name || 'Unnamed Product',
        sku: matched?.sku || '',
        category: matched?.category?.trim() || 'Uncategorized',
        hsn: item.hsn || matched?.hsnCode || '',
        partyName,
        qty,
        inQty: direction === 'IN' ? qty : 0,
        outQty: direction === 'OUT' ? qty : 0,
        unit: item.unit || matched?.unit || 'Pcs',
        rate: Number(item.rate || 0),
        total: Number(item.total || 0),
      });
    });
  }

  rows.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return rows;
}

export function filterStockTransactions(
  allRows: StockTransactionRow[],
  startDate: string,
  endDate: string,
  selectedTypes: StockMovementType[],
  productCategory: string,
  searchQuery: string = ''
): StockTransactionRow[] {
  const typeSet = selectedTypes.length > 0 ? new Set(selectedTypes) : null;
  const q = searchQuery.trim().toLowerCase();

  return allRows.filter(r => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    if (typeSet && !typeSet.has(r.movementType)) return false;
    if (productCategory && productCategory !== 'ALL' && r.category !== productCategory) return false;

    if (q) {
      const matchesProduct = r.productName.toLowerCase().includes(q);
      const matchesSku = r.sku.toLowerCase().includes(q);
      const matchesInvoice = r.voucherNo.toLowerCase().includes(q);
      const matchesParty = r.partyName.toLowerCase().includes(q);
      const matchesCategory = r.category.toLowerCase().includes(q);
      if (!matchesProduct && !matchesSku && !matchesInvoice && !matchesParty && !matchesCategory) {
        return false;
      }
    }
    return true;
  });
}

export function summarizeByProduct(
  rows: StockTransactionRow[],
  inventory: InventoryItem[]
): ProductMovementSummary[] {
  const invById = new Map<string, InventoryItem>();
  const invByName = new Map<string, InventoryItem>();
  for (const item of inventory) {
    invById.set(item.id, item);
    invByName.set(item.name.trim().toLowerCase(), item);
  }

  const map = new Map<string, ProductMovementSummary>();

  for (const r of rows) {
    const matched = invById.get(r.productId) || invByName.get(r.productName.trim().toLowerCase());
    const key = matched ? matched.id : `name_${r.productName.trim().toLowerCase()}`;

    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        productName: matched?.name || r.productName,
        sku: matched?.sku || r.sku,
        category: matched?.category?.trim() || r.category,
        unit: matched?.unit || r.unit,
        purchasedQty: 0,
        soldQty: 0,
        salesReturnQty: 0,
        purchaseReturnQty: 0,
        totalInQty: 0,
        totalOutQty: 0,
        netChange: 0,
        currentStock: matched ? Number(matched.currentStock || 0) : null,
        salesValue: 0,
        purchaseValue: 0,
        txCount: 0,
      };
      map.set(key, entry);
    }

    entry.txCount += 1;
    if (r.movementType === 'PURCHASE') {
      entry.purchasedQty += r.qty;
      entry.totalInQty += r.qty;
      entry.purchaseValue += r.total;
    } else if (r.movementType === 'SALE') {
      entry.soldQty += r.qty;
      entry.totalOutQty += r.qty;
      entry.salesValue += r.total;
    } else if (r.movementType === 'CREDIT_NOTE') {
      entry.salesReturnQty += r.qty;
      entry.totalInQty += r.qty;
      entry.salesValue -= r.total;
    } else if (r.movementType === 'DEBIT_NOTE') {
      entry.purchaseReturnQty += r.qty;
      entry.totalOutQty += r.qty;
      entry.purchaseValue -= r.total;
    }
    entry.netChange = entry.totalInQty - entry.totalOutQty;
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalOutQty + b.totalInQty - (a.totalOutQty + a.totalInQty)
  );
}

function formatRs(amount: number): string {
  const num = Number(amount || 0);
  return (
    'Rs. ' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatQty(val: number): string {
  if (!val) return '-';
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export function downloadStockReportPdf(options: StockReportExportOptions): void {
  const {
    rows,
    productSummaries,
    settings,
    startDate,
    endDate,
    selectedTypes,
    productCategory,
    reportMode = 'transactions',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const cw = pageW - margin * 2;
  const maxY = pageH - 12;

  const companyName = settings.name || 'Ghosh Agency';
  const rangeLabel = getDateRangeLabel(startDate, endDate);
  const typeLabel = getSelectedTypesLabel(selectedTypes);
  const catLabel = productCategory === 'ALL' ? 'All Product Categories' : productCategory;

  let y = margin;

  const drawHeader = (isContinuation: boolean) => {
    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 10 : 13);
    doc.setTextColor(15, 23, 42);
    doc.text(companyName.toUpperCase(), margin, y + 4);

    doc.setFontSize(isContinuation ? 8.5 : 10);
    doc.setTextColor(37, 99, 235);
    const titleStr =
      reportMode === 'summary'
        ? isContinuation
          ? 'STOCK SUMMARY REPORT (CONT.)'
          : 'PRODUCT STOCK SUMMARY REPORT'
        : isContinuation
        ? 'STOCK TRANSACTION REPORT (CONT.)'
        : 'STOCK TRANSACTION REPORT';
    doc.text(titleStr, pageW - margin, y + 4, { align: 'right' });

    y += isContinuation ? 6.5 : 6;

    if (!isContinuation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const subInfo = [
        settings.gstin ? `GSTIN: ${settings.gstin}` : '',
        settings.phone ? `Ph: ${settings.phone}` : '',
        settings.address || '',
      ]
        .filter(Boolean)
        .join('  |  ');
      if (subInfo) {
        const lines = doc.splitTextToSize(subInfo, cw * 0.62) as string[];
        doc.text(lines.slice(0, 2), margin, y + 3);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`Period: ${rangeLabel}`, pageW - margin, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        truncateText(`${typeLabel}  |  ${catLabel}`, 48),
        pageW - margin,
        y + 7,
        { align: 'right' }
      );
      y += 10.5;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${rangeLabel}  |  ${typeLabel}  |  ${catLabel}`, margin, y + 2);
      y += 4;
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  drawHeader(false);

  const totalSoldQty = rows
    .filter(r => r.movementType === 'SALE')
    .reduce((acc, r) => acc + r.qty, 0);
  const totalPurchasedQty = rows
    .filter(r => r.movementType === 'PURCHASE')
    .reduce((acc, r) => acc + r.qty, 0);
  const totalInQty = rows.reduce((acc, r) => acc + r.inQty, 0);
  const totalOutQty = rows.reduce((acc, r) => acc + r.outQty, 0);
  const totalValue = rows.reduce((acc, r) => acc + r.total, 0);

  // Summary KPI Boxes
  const kpis: { label: string; value: string; color: [number, number, number] }[] = [
    { label: 'TOTAL QTY SOLD (OUT)', value: `${formatQty(totalSoldQty)} Units`, color: [225, 29, 72] },
    { label: 'TOTAL QTY PURCHASED (IN)', value: `${formatQty(totalPurchasedQty)} Units`, color: [5, 150, 105] },
    {
      label: 'NET STOCK CHANGE',
      value: `${totalInQty - totalOutQty >= 0 ? '+' : ''}${Number.isInteger(totalInQty - totalOutQty) ? totalInQty - totalOutQty : (totalInQty - totalOutQty).toFixed(2)} Units`,
      color: [37, 99, 235],
    },
    { label: 'TOTAL VALUE MOVED', value: formatRs(totalValue), color: [15, 23, 42] },
  ];

  const boxGap = 2.5;
  const boxW = (cw - boxGap * 3) / 4;
  const boxH = 13.5;

  kpis.forEach((k, i) => {
    const bx = margin + i * (boxW + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, bx + 2.5, y + 4.5);

    doc.setFontSize(8.8);
    doc.setTextColor(...k.color);
    doc.text(k.value, bx + 2.5, y + 10.5);
  });

  y += boxH + 4;

  const ensureSpace = (neededMm: number, redrawCols: () => void) => {
    if (y + neededMm > maxY) {
      doc.addPage();
      drawHeader(true);
      redrawCols();
    }
  };

  if (reportMode === 'summary') {
    const cols = [
      { label: 'Product Name', w: 50, align: 'left' as const },
      { label: 'Category', w: 26, align: 'left' as const },
      { label: 'Purchased', w: 20, align: 'right' as const },
      { label: 'Sold', w: 20, align: 'right' as const },
      { label: 'Net Qty', w: 20, align: 'right' as const },
      { label: 'In Stock', w: 20, align: 'right' as const },
      { label: 'Sales Val (Rs.)', w: 34, align: 'right' as const },
    ];

    const drawCols = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, cw, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      let cx = margin;
      for (const col of cols) {
        const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
        doc.text(col.label, tx, y + 4.4, { align: col.align });
        cx += col.w;
      }
      y += 6.5;
    };

    drawCols();

    if (productSummaries.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No product stock movements match the selected filters.', pageW / 2, y + 9, {
        align: 'center',
      });
      y += 16;
    } else {
      productSummaries.forEach((p, idx) => {
        ensureSpace(7, drawCols);
        const rowH = 6.5;
        if (idx % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, y, cw, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(margin, y + rowH, pageW - margin, y + rowH);

        const cells = [
          truncateText(p.sku ? `${p.productName} (${p.sku})` : p.productName, 31),
          truncateText(p.category, 16),
          p.purchasedQty > 0 ? `+${formatQty(p.purchasedQty)} ${p.unit}` : '-',
          p.soldQty > 0 ? `-${formatQty(p.soldQty)} ${p.unit}` : '-',
          `${p.netChange >= 0 ? '+' : ''}${Number.isInteger(p.netChange) ? p.netChange : p.netChange.toFixed(2)}`,
          p.currentStock !== null ? `${formatQty(p.currentStock)} ${p.unit}` : 'Custom',
          p.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ];

        let cx = margin;
        cells.forEach((val, ci) => {
          const col = cols[ci];
          doc.setFont('helvetica', ci === 0 || ci === 5 ? 'bold' : 'normal');
          doc.setFontSize(7.5);
          if (ci === 2 && p.purchasedQty > 0) doc.setTextColor(5, 150, 105);
          else if (ci === 3 && p.soldQty > 0) doc.setTextColor(225, 29, 72);
          else doc.setTextColor(30, 41, 59);
          const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
          doc.text(val, tx, y + 4.4, { align: col.align });
          cx += col.w;
        });
        y += rowH;
      });
    }
  } else {
    // Itemized Stock Transactions Table
    const cols = [
      { label: 'Date', w: 19, align: 'left' as const },
      { label: 'Invoice No', w: 26, align: 'left' as const },
      { label: 'Type', w: 18, align: 'left' as const },
      { label: 'Product & Category', w: 45, align: 'left' as const },
      { label: 'Party', w: 26, align: 'left' as const },
      { label: 'In Qty', w: 14, align: 'right' as const },
      { label: 'Out Qty', w: 14, align: 'right' as const },
      { label: 'Amount (Rs.)', w: 28, align: 'right' as const },
    ];

    const drawCols = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, cw, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      let cx = margin;
      for (const col of cols) {
        const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
        doc.text(col.label, tx, y + 4.4, { align: col.align });
        cx += col.w;
      }
      y += 6.5;
    };

    drawCols();

    if (rows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No stock transactions match the selected date range and filters.', pageW / 2, y + 9, {
        align: 'center',
      });
      y += 16;
    } else {
      rows.forEach((r, idx) => {
        ensureSpace(7, drawCols);
        const rowH = 6.4;
        if (idx % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, y, cw, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(margin, y + rowH, pageW - margin, y + rowH);

        const cells = [
          formatDateReadable(r.date),
          truncateText(r.voucherNo, 16),
          getMovementLabel(r.movementType),
          truncateText(`${r.productName} [${r.category}]`, 29),
          truncateText(r.partyName, 17),
          r.inQty > 0 ? `+${formatQty(r.inQty)}` : '-',
          r.outQty > 0 ? `-${formatQty(r.outQty)}` : '-',
          r.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ];

        let cx = margin;
        cells.forEach((val, ci) => {
          const col = cols[ci];
          doc.setFont('helvetica', ci === 1 || ci === 5 || ci === 6 || ci === 7 ? 'bold' : 'normal');
          doc.setFontSize(7.2);
          if (ci === 5 && r.inQty > 0) doc.setTextColor(5, 150, 105);
          else if (ci === 6 && r.outQty > 0) doc.setTextColor(225, 29, 72);
          else doc.setTextColor(30, 41, 59);
          const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
          doc.text(val, tx, y + 4.3, { align: col.align });
          cx += col.w;
        });
        y += rowH;
      });

      // Totals Row
      ensureSpace(10, drawCols);
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, cw, 7.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 58, 138);
      doc.text(`TOTAL (${rows.length} Stock Movements)`, margin + 2, y + 5);

      const inColX = margin + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w + cols[5].w - 1.5;
      const outColX = inColX + cols[6].w;
      const amtColX = outColX + cols[7].w;

      doc.setTextColor(5, 150, 105);
      doc.text(`+${formatQty(totalInQty)}`, inColX, y + 5, { align: 'right' });
      doc.setTextColor(225, 29, 72);
      doc.text(`-${formatQty(totalOutQty)}`, outColX, y + 5, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      doc.text(formatRs(totalValue), amtColX, y + 5, { align: 'right' });
    }
  }

  // Footer with page numbers
  const totalPages = doc.getNumberOfPages();
  const generatedStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 9, pageW - margin, pageH - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${companyName}  •  Stock Report  •  Generated ${generatedStr}`, margin, pageH - 4.5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4.5, { align: 'right' });
  }

  const rangeSlug =
    startDate && endDate
      ? `${startDate}_to_${endDate}`
      : startDate
      ? `from_${startDate}`
      : endDate
      ? `upto_${endDate}`
      : 'all_dates';
  doc.save(`Stock_Report_${reportMode}_${rangeSlug}.pdf`);
}

export function downloadStockReportCsv(options: StockReportExportOptions): void {
  const { rows, productSummaries, startDate, endDate, reportMode = 'transactions' } = options;

  const escapeCsv = (val: string | number | null) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  let csvLines: string[] = [];

  if (reportMode === 'summary') {
    csvLines.push(
      [
        'Product Name',
        'SKU',
        'Category',
        'Unit',
        'Purchased Qty (In)',
        'Sold Qty (Out)',
        'Sales Return Qty (In)',
        'Purchase Return Qty (Out)',
        'Net Qty Change',
        'Current Stock',
        'Sales Value (INR)',
        'Purchase Value (INR)',
      ]
        .map(escapeCsv)
        .join(',')
    );

    for (const p of productSummaries) {
      csvLines.push(
        [
          p.productName,
          p.sku,
          p.category,
          p.unit,
          p.purchasedQty,
          p.soldQty,
          p.salesReturnQty,
          p.purchaseReturnQty,
          p.netChange,
          p.currentStock ?? 'Custom',
          p.salesValue.toFixed(2),
          p.purchaseValue.toFixed(2),
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
  } else {
    csvLines.push(
      [
        'Date',
        'Invoice No',
        'Transaction Type',
        'Product Name',
        'SKU',
        'Product Category',
        'HSN',
        'Party Name',
        'Stock In Qty',
        'Stock Out Qty',
        'Unit',
        'Rate (INR)',
        'Amount (INR)',
      ]
        .map(escapeCsv)
        .join(',')
    );

    let totalIn = 0;
    let totalOut = 0;
    let totalAmt = 0;

    for (const r of rows) {
      totalIn += r.inQty;
      totalOut += r.outQty;
      totalAmt += r.total;

      csvLines.push(
        [
          r.date,
          r.voucherNo,
          getMovementLabel(r.movementType),
          r.productName,
          r.sku,
          r.category,
          r.hsn,
          r.partyName,
          r.inQty,
          r.outQty,
          r.unit,
          r.rate.toFixed(2),
          r.total.toFixed(2),
        ]
          .map(escapeCsv)
          .join(',')
      );
    }

    csvLines.push(
      [
        'TOTAL',
        `${rows.length} Movements`,
        '',
        '',
        '',
        '',
        '',
        '',
        totalIn,
        totalOut,
        '',
        '',
        totalAmt.toFixed(2),
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const rangeSlug =
    startDate && endDate ? `${startDate}_to_${endDate}` : startDate || endDate || 'all_dates';
  link.href = url;
  link.setAttribute('download', `Stock_Report_${reportMode}_${rangeSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
