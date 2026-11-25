import { jsPDF } from 'jspdf';
import { CompanySettings, PrintTextSize, TransactionVoucher, VoucherType } from '../types/accounting';

export interface DayGroupSummary {
  date: string;
  entries: TransactionVoucher[];
  sales: number;
  purchases: number;
  receipts: number;
  payments: number;
  creditNotes: number;
  debitNotes: number;
  taxable: number;
  gst: number;
  grandTotal: number;
}

export interface DayBookReportOptions {
  vouchers: TransactionVoucher[];
  settings: CompanySettings;
  startDate: string;
  endDate: string;
  selectedCategories: VoucherType[]; // empty means ALL categories
  sortOrder?: 'asc' | 'desc';
  textSize?: PrintTextSize;
}

export const DAYBOOK_CATEGORY_META: { key: VoucherType; label: string; shortLabel: string }[] = [
  { key: 'SALE', label: 'Sales', shortLabel: 'Sale' },
  { key: 'PURCHASE', label: 'Purchases', shortLabel: 'Purchase' },
  { key: 'RECEIPT', label: 'Receipts', shortLabel: 'Receipt' },
  { key: 'PAYMENT', label: 'Payments', shortLabel: 'Payment' },
  { key: 'CREDIT_NOTE', label: 'Credit Notes', shortLabel: 'Credit Note' },
  { key: 'DEBIT_NOTE', label: 'Debit Notes', shortLabel: 'Debit Note' },
];

export function formatCategoryLabel(type: VoucherType): string {
  const found = DAYBOOK_CATEGORY_META.find(c => c.key === type);
  return found ? found.shortLabel : type.replace('_', ' ');
}

export function formatDateReadable(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateWithWeekday(isoDate: string): string {
  if (!isoDate) return 'Unspecified Date';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getDateRangeLabel(startDate: string, endDate: string): string {
  if (startDate && endDate) {
    if (startDate === endDate) return formatDateReadable(startDate);
    return `${formatDateReadable(startDate)} to ${formatDateReadable(endDate)}`;
  }
  if (startDate) return `From ${formatDateReadable(startDate)}`;
  if (endDate) return `Up to ${formatDateReadable(endDate)}`;
  return 'All Dates';
}

export function getCategoriesLabel(selectedCategories: VoucherType[]): string {
  if (selectedCategories.length === 0 || selectedCategories.length === DAYBOOK_CATEGORY_META.length) {
    return 'All Categories';
  }
  return selectedCategories
    .map(cat => DAYBOOK_CATEGORY_META.find(c => c.key === cat)?.label || cat)
    .join(', ');
}

export function filterDayBookEntries(
  vouchers: TransactionVoucher[],
  startDate: string,
  endDate: string,
  selectedCategories: VoucherType[],
  searchQuery: string = ''
): TransactionVoucher[] {
  const categorySet = selectedCategories.length > 0 ? new Set(selectedCategories) : null;
  const q = searchQuery.trim().toLowerCase();

  return vouchers.filter(v => {
    if (startDate && v.date < startDate) return false;
    if (endDate && v.date > endDate) return false;
    if (categorySet && !categorySet.has(v.type)) return false;

    if (q) {
      const matchesNo = (v.voucherNo || '').toLowerCase().includes(q);
      const matchesParty = (v.guestDetails?.name || v.partyName || '').toLowerCase().includes(q);
      const matchesReceiptEntries = Boolean(
        v.receiptEntries?.some(r => r.partyName.toLowerCase().includes(q))
      );
      const matchesNotes = (v.notes || '').toLowerCase().includes(q);
      const matchesRef = (v.referenceNo || '').toLowerCase().includes(q);
      if (!matchesNo && !matchesParty && !matchesReceiptEntries && !matchesNotes && !matchesRef) return false;
    }
    return true;
  });
}

export function groupDayBookEntriesByDate(
  entries: TransactionVoucher[],
  sortOrder: 'asc' | 'desc' = 'asc'
): DayGroupSummary[] {
  const map = new Map<string, TransactionVoucher[]>();

  for (const v of entries) {
    const key = v.date || 'Unspecified';
    const list = map.get(key);
    if (list) {
      list.push(v);
    } else {
      map.set(key, [v]);
    }
  }

  const dates = Array.from(map.keys()).sort((a, b) =>
    sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  );

  return dates.map(date => {
    const dayEntries = (map.get(date) || []).sort((a, b) =>
      sortOrder === 'asc'
        ? (a.createdAt || '').localeCompare(b.createdAt || '')
        : (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    let sales = 0;
    let purchases = 0;
    let receipts = 0;
    let payments = 0;
    let creditNotes = 0;
    let debitNotes = 0;
    let taxable = 0;
    let gst = 0;
    let grandTotal = 0;

    for (const v of dayEntries) {
      const amt = Number(v.grandTotal || 0);
      const sub = Number(v.subtotal || 0);
      const tax = Number(v.cgstTotal || 0) + Number(v.sgstTotal || 0) + Number(v.igstTotal || 0);

      taxable += sub;
      gst += tax;
      grandTotal += amt;

      if (v.type === 'SALE') sales += amt;
      else if (v.type === 'PURCHASE') purchases += amt;
      else if (v.type === 'RECEIPT') receipts += amt;
      else if (v.type === 'PAYMENT') payments += amt;
      else if (v.type === 'CREDIT_NOTE') creditNotes += amt;
      else if (v.type === 'DEBIT_NOTE') debitNotes += amt;
    }

    return {
      date,
      entries: dayEntries,
      sales,
      purchases,
      receipts,
      payments,
      creditNotes,
      debitNotes,
      taxable,
      gst,
      grandTotal,
    };
  });
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

function truncateText(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export function downloadDayBookPdf(options: DayBookReportOptions): void {
  const {
    vouchers,
    settings,
    startDate,
    endDate,
    selectedCategories,
    sortOrder = 'asc',
    textSize: optTextSize,
  } = options;

  const textSize: PrintTextSize = optTextSize || settings.printTextSize || 'lg';
  const textScale =
    textSize === 'sm' ? 0.88 : textSize === 'md' ? 1.0 : textSize === 'xl' ? 1.24 : 1.12;
  const fs = (pt: number) => Number((pt * textScale).toFixed(2));
  const rowScale = 0.65 + textScale * 0.35;

  const filtered = filterDayBookEntries(vouchers, startDate, endDate, selectedCategories);
  const groups = groupDayBookEntriesByDate(filtered, sortOrder);

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
  const footerReserve = 12;
  const maxY = pageH - footerReserve;

  const rangeLabel = getDateRangeLabel(startDate, endDate);
  const categoryLabel = getCategoriesLabel(selectedCategories);
  const companyName = settings.name || 'Ghosh Agency';

  let y = margin;

  const drawReportHeader = (isContinuation: boolean) => {
    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs(isContinuation ? 10 : 13));
    doc.setTextColor(15, 23, 42);
    doc.text(companyName.toUpperCase(), margin, y + 4.5);

    doc.setFontSize(fs(isContinuation ? 8.5 : 10));
    doc.setTextColor(37, 99, 235);
    doc.text(isContinuation ? 'DAY BOOK REPORT (CONT.)' : 'DAY BOOK REPORT', pageW - margin, y + 4.5, {
      align: 'right',
    });

    y += (isContinuation ? 6.5 : 6.2) * rowScale;

    if (!isContinuation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fs(8));
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
      doc.setFontSize(fs(8));
      doc.setTextColor(30, 41, 59);
      doc.text(`Period: ${rangeLabel}`, pageW - margin, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Category: ${truncateText(categoryLabel, Math.max(22, Math.floor(38 / textScale)))}`,
        pageW - margin,
        y + 3 + 4 * rowScale,
        { align: 'right' }
      );
      y += 10.5 * rowScale;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fs(7.5));
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${rangeLabel}  |  Category: ${categoryLabel}`, margin, y + 2);
      y += 4.2 * rowScale;
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  drawReportHeader(false);

  // Period Summary Cards Row
  const totalSales = groups.reduce((acc, g) => acc + g.sales, 0);
  const totalPurchases = groups.reduce((acc, g) => acc + g.purchases, 0);
  const totalReceipts = groups.reduce((acc, g) => acc + g.receipts, 0);
  const totalPayments = groups.reduce((acc, g) => acc + g.payments, 0);
  const totalTaxable = groups.reduce((acc, g) => acc + g.taxable, 0);
  const totalGst = groups.reduce((acc, g) => acc + g.gst, 0);
  const totalGrand = groups.reduce((acc, g) => acc + g.grandTotal, 0);

  const summaryItems: { label: string; value: string; color: [number, number, number] }[] = [
    { label: 'TOTAL SALES', value: formatRs(totalSales), color: [5, 150, 105] },
    { label: 'TOTAL PURCHASES', value: formatRs(totalPurchases), color: [37, 99, 235] },
    { label: 'RECEIPTS (IN)', value: formatRs(totalReceipts), color: [13, 148, 136] },
    { label: 'PAYMENTS (OUT)', value: formatRs(totalPayments), color: [225, 29, 72] },
  ];

  const boxGap = 2.5;
  const boxW = (cw - boxGap * 3) / 4;
  const boxH = 13.5 * rowScale;

  summaryItems.forEach((item, i) => {
    const bx = margin + i * (boxW + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs(6.5));
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, bx + 2.5, y + 4.5 * rowScale);

    doc.setFontSize(fs(9));
    doc.setTextColor(...item.color);
    doc.text(item.value, bx + 2.5, y + 10.5 * rowScale);
  });

  y += boxH + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fs(7.5));
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Days Covered: ${groups.length}   |   Total Invoices: ${filtered.length}   |   Total GST: ${formatRs(totalGst)}   |   Combined Volume: ${formatRs(totalGrand)}`,
    margin,
    y + 2.5
  );
  y += 6 * rowScale;

  // Column layout for Day-wise table
  const cols = [
    { label: 'Invoice No', w: 30, align: 'left' as const },
    { label: 'Category', w: 22, align: 'left' as const },
    { label: 'Party / Particulars', w: 54, align: 'left' as const },
    { label: 'Mode', w: 16, align: 'center' as const },
    { label: 'Taxable', w: 22, align: 'right' as const },
    { label: 'GST', w: 20, align: 'right' as const },
    { label: 'Amount (Rs.)', w: 26, align: 'right' as const },
  ];

  const ensureSpace = (neededMm: number): boolean => {
    if (y + neededMm > maxY) {
      doc.addPage();
      drawReportHeader(true);
      return true;
    }
    return false;
  };

  const colHeaderH = 6 * rowScale;
  const drawTableColHeaders = () => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, cw, colHeaderH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs(7));
    doc.setTextColor(51, 65, 85);

    let cx = margin;
    for (const col of cols) {
      const tx =
        col.align === 'right'
          ? cx + col.w - 1.5
          : col.align === 'center'
          ? cx + col.w / 2
          : cx + 1.5;
      doc.text(col.label, tx, y + colHeaderH * 0.68, { align: col.align });
      cx += col.w;
    }
    y += colHeaderH;
  };

  if (groups.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, cw, 16, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fs(9));
    doc.setTextColor(100, 116, 139);
    doc.text('No Day Book invoices found for the selected date range and category filter.', pageW / 2, y + 9.5, {
      align: 'center',
    });
    y += 18;
  } else {
    const bannerH = 6.5 * rowScale;
    const rowH = 6.2 * rowScale;
    const subH = 6.8 * rowScale;

    for (const group of groups) {
      // Ensure enough room for Date header + Column headers + at least 1 row
      ensureSpace(bannerH + colHeaderH + rowH + 4);

      // Day Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, cw, bannerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fs(8));
      doc.setTextColor(255, 255, 255);
      doc.text(formatDateWithWeekday(group.date), margin + 2.5, y + bannerH * 0.68);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fs(7.5));
      doc.text(
        `${group.entries.length} ${group.entries.length === 1 ? 'Invoice' : 'Invoices'}  |  Day Total: ${formatRs(group.grandTotal)}`,
        pageW - margin - 2.5,
        y + bannerH * 0.68,
        { align: 'right' }
      );
      y += bannerH;

      drawTableColHeaders();

      // Entries for this day
      group.entries.forEach((v, idx) => {
        if (ensureSpace(rowH + 1)) {
          drawTableColHeaders();
        }

        if (idx % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, y, cw, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(margin, y + rowH, pageW - margin, y + rowH);

        const partyText = v.guestDetails?.name || v.partyName || 'Direct Cash Entry';
        const gstAmt = Number(v.cgstTotal || 0) + Number(v.sgstTotal || 0) + Number(v.igstTotal || 0);
        const cells = [
          truncateText(v.voucherNo || '-', Math.max(12, Math.floor(19 / textScale))),
          formatCategoryLabel(v.type),
          truncateText(partyText, Math.max(20, Math.floor(34 / textScale))),
          v.paymentMode || '-',
          Number(v.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(v.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ];

        let cx = margin;
        cells.forEach((val, ci) => {
          const col = cols[ci];
          doc.setFont('helvetica', ci === 0 || ci === 6 ? 'bold' : 'normal');
          doc.setFontSize(fs(7.5));
          doc.setTextColor(ci === 6 ? 15 : 51, ci === 6 ? 23 : 65, ci === 6 ? 42 : 85);
          const tx =
            col.align === 'right'
              ? cx + col.w - 1.5
              : col.align === 'center'
              ? cx + col.w / 2
              : cx + 1.5;
          doc.text(val, tx, y + rowH * 0.68, { align: col.align });
          cx += col.w;
        });

        y += rowH;
      });

      // Day Subtotal Row
      ensureSpace(subH + 2);
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.25);
      doc.rect(margin, y, cw, subH, 'FD');

      const breakdownParts: string[] = [];
      if (group.sales > 0) breakdownParts.push(`Sales: ${formatRs(group.sales)}`);
      if (group.purchases > 0) breakdownParts.push(`Purchases: ${formatRs(group.purchases)}`);
      if (group.receipts > 0) breakdownParts.push(`Receipts: ${formatRs(group.receipts)}`);
      if (group.payments > 0) breakdownParts.push(`Payments: ${formatRs(group.payments)}`);
      if (group.creditNotes > 0) breakdownParts.push(`CN: ${formatRs(group.creditNotes)}`);
      if (group.debitNotes > 0) breakdownParts.push(`DN: ${formatRs(group.debitNotes)}`);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fs(7));
      doc.setTextColor(30, 58, 138);
      doc.text(
        truncateText(
          `Day Subtotal (${formatDateReadable(group.date)}):  ${breakdownParts.join('  |  ')}`,
          Math.max(46, Math.floor(78 / textScale))
        ),
        margin + 2,
        y + subH * 0.65
      );

      // Align taxable, GST, and total under the last 3 columns
      const colTaxableX = margin + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w - 1.5;
      const colGstX = colTaxableX + cols[5].w;
      const colTotalX = colGstX + cols[6].w;

      doc.setFontSize(fs(7.5));
      doc.text(
        group.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colTaxableX,
        y + subH * 0.65,
        { align: 'right' }
      );
      doc.text(
        group.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colGstX,
        y + subH * 0.65,
        { align: 'right' }
      );
      doc.text(
        group.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colTotalX,
        y + subH * 0.65,
        { align: 'right' }
      );

      y += subH + 4;
    }

    // Period Grand Total Box
    const grandBoxH = 11 * rowScale;
    ensureSpace(grandBoxH + 8);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, cw, grandBoxH, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs(8.5));
    doc.setTextColor(255, 255, 255);
    doc.text(
      `PERIOD GRAND TOTAL (${filtered.length} Invoices across ${groups.length} Days)`,
      margin + 3,
      y + grandBoxH * 0.62
    );

    const colTaxableX = margin + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w - 1.5;
    const colGstX = colTaxableX + cols[5].w;
    const colTotalX = colGstX + cols[6].w;

    doc.setFontSize(fs(8));
    doc.text(
      totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      colTaxableX,
      y + grandBoxH * 0.62,
      { align: 'right' }
    );
    doc.text(
      totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      colGstX,
      y + grandBoxH * 0.62,
      { align: 'right' }
    );
    doc.setFontSize(fs(9));
    doc.text(formatRs(totalGrand), colTotalX, y + grandBoxH * 0.62, { align: 'right' });
  }

  // Page numbers footer
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
    doc.setFontSize(fs(7));
    doc.setTextColor(100, 116, 139);
    doc.text(`${companyName}  •  Day Book Report  •  Generated ${generatedStr}`, margin, pageH - 4.5);
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
  const catSlug =
    selectedCategories.length === 0 || selectedCategories.length === DAYBOOK_CATEGORY_META.length
      ? 'all'
      : selectedCategories.map(c => c.toLowerCase()).join('_');

  doc.save(`DayBook_${catSlug}_${rangeSlug}.pdf`);
}

export function downloadDayBookCsv(options: DayBookReportOptions): void {
  const { vouchers, startDate, endDate, selectedCategories, sortOrder = 'asc' } = options;
  const filtered = filterDayBookEntries(vouchers, startDate, endDate, selectedCategories);
  const groups = groupDayBookEntriesByDate(filtered, sortOrder);

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [
    ['Date', 'Invoice No', 'Category', 'Party / Particulars', 'Payment Mode', 'Reference No', 'Taxable (INR)', 'GST (INR)', 'Grand Total (INR)', 'Notes']
      .map(escapeCsv)
      .join(','),
  ];

  for (const group of groups) {
    for (const v of group.entries) {
      const gst = Number(v.cgstTotal || 0) + Number(v.sgstTotal || 0) + Number(v.igstTotal || 0);
      rows.push(
        [
          v.date,
          v.voucherNo || '-',
          formatCategoryLabel(v.type),
          v.guestDetails?.name || v.partyName || 'Direct Cash Entry',
          v.paymentMode,
          v.referenceNo || '',
          Number(v.subtotal || 0).toFixed(2),
          gst.toFixed(2),
          Number(v.grandTotal || 0).toFixed(2),
          v.notes || '',
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
    rows.push(
      [
        group.date,
        'DAY SUBTOTAL',
        `${group.entries.length} Invoice(s)`,
        '',
        '',
        '',
        group.taxable.toFixed(2),
        group.gst.toFixed(2),
        group.grandTotal.toFixed(2),
        '',
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const rangeSlug =
    startDate && endDate ? `${startDate}_to_${endDate}` : startDate || endDate || 'all_dates';
  link.href = url;
  link.setAttribute('download', `DayBook_Report_${rangeSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
