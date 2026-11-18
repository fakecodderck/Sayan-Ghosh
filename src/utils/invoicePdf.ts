import { jsPDF } from 'jspdf';
import {
  CompanySettings,
  InvoiceBlockConfig,
  LedgerAccount,
  TransactionVoucher
} from '../types/accounting';
import { numberToWordsINR } from './gstCalculations';
import { buildUpiPaymentUri, generateQrMatrix } from './qrCode';

export interface DownloadInvoicePdfOptions {
  voucher: TransactionVoucher;
  settings: CompanySettings;
  party?: LedgerAccount;
  paperSize?: 'A5' | 'A4';
  useCustomTemplate?: boolean;
  customHeaderTitle?: string;
  showBankDetails?: boolean;
  showHsnSummary?: boolean;
  showQrCode?: boolean;
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#0f172a').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [isNaN(r) ? 15 : r, isNaN(g) ? 23 : g, isNaN(b) ? 42 : b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [isNaN(r) ? 15 : r, isNaN(g) ? 23 : g, isNaN(b) ? 42 : b];
  }
  return [15, 23, 42];
}

function getDocTitle(voucher: TransactionVoucher, overrideTitle?: string): string {
  if (overrideTitle) return overrideTitle;
  if (voucher.type === 'CREDIT_NOTE') return 'CREDIT NOTE (SALES RETURN)';
  if (voucher.type === 'DEBIT_NOTE') return 'DEBIT NOTE (PURCHASE RETURN)';
  if (voucher.type === 'PURCHASE') return 'PURCHASE INWARD VOUCHER';
  if (voucher.type === 'PAYMENT') return 'PAYMENT DISBURSAL VOUCHER';
  if (voucher.type === 'RECEIPT') return 'MONEY RECEIPT VOUCHER';
  if (voucher.type === 'CONTRA') return 'CONTRA VOUCHER';
  return voucher.isGstBill ? 'TAX INVOICE' : 'BILL OF SUPPLY';
}

function drawQrOnPdf(doc: jsPDF, value: string, x: number, y: number, sizeMm: number) {
  if (!value) return;
  const matrix = generateQrMatrix(value);
  if (matrix.length === 0) return;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(x, y, sizeMm, sizeMm, 'FD');

  const pad = 1.2;
  const innerSize = sizeMm - pad * 2;
  const cell = innerSize / matrix.length;
  doc.setFillColor(15, 23, 42);

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (matrix[r][c]) {
        doc.rect(x + pad + c * cell, y + pad + r * cell, cell + 0.04, cell + 0.04, 'F');
      }
    }
  }
}

export function downloadInvoicePdf(options: DownloadInvoicePdfOptions): void {
  const {
    voucher,
    settings,
    party,
    paperSize: optPaperSize,
    useCustomTemplate = false,
    customHeaderTitle,
    showBankDetails = true,
    showHsnSummary = true,
    showQrCode = settings.showQrCode !== false,
  } = options;

  const tpl = useCustomTemplate && settings.invoiceTemplate?.blocks.length ? settings.invoiceTemplate : undefined;
  const paperSize = optPaperSize || tpl?.paperSize || settings.paperSize || 'A5';
  const isA5 = paperSize === 'A5';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA5 ? 'a5' : 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = isA5 ? 6.5 : 9.5;
  const cw = pageW - margin * 2;
  const maxY = pageH - margin;

  const fontName =
    tpl?.fontFamily === 'mono' ? 'courier' : tpl?.fontFamily === 'serif' ? 'times' : 'helvetica';
  const [ar, ag, ab] = hexToRgb(tpl?.accentColor || '#0f172a');

  const itemsCount = (voucher.items || []).length;
  // Auto-tighten spacing when there are many items so invoice stays on 1 page
  const isDense = isA5 ? itemsCount > 6 : itemsCount > 12;
  const fsBase = isA5 ? (isDense ? 7.2 : 7.8) : isDense ? 8.2 : 9;
  const fsSmall = fsBase - 1;
  const lineH = isA5 ? (isDense ? 3.2 : 3.6) : isDense ? 3.6 : 4.2;

  const partyName =
    party?.name ||
    voucher.guestDetails?.name ||
    voucher.partyName ||
    (voucher.type === 'PAYMENT' ? 'Expense Payment' : 'Walk-in / Cash Customer');
  const partyAddress = party?.address || voucher.guestDetails?.address || '';
  const partyGstin = party?.gstin || voucher.guestDetails?.gstin || '';
  const partyPhone = party?.phone || voucher.guestDetails?.phone || '';
  const partyStateCode = party?.stateCode || voucher.guestDetails?.stateCode || settings.stateCode || '';

  const isGoodsDoc = ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(voucher.type);

  const upiUri =
    showQrCode && settings.upiId
      ? buildUpiPaymentUri(settings.upiId, settings.name, voucher.grandTotal, `Inv ${voucher.voucherNo}`)
      : '';

  const hsnBreakup: Record<
    string,
    {
      hsn: string;
      taxableAmount: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
    }
  > = {};

  if (isGoodsDoc) {
    (voucher.items || []).forEach(item => {
      const key = `${item.hsn || '9999'}_${item.gstRate}`;
      if (!hsnBreakup[key]) {
        hsnBreakup[key] = {
          hsn: item.hsn || '9999',
          taxableAmount: 0,
          gstRate: item.gstRate,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
        };
      }
      hsnBreakup[key].taxableAmount += item.taxableAmount;
      hsnBreakup[key].cgst += item.cgst;
      hsnBreakup[key].sgst += item.sgst;
      hsnBreakup[key].igst += item.igst;
      hsnBreakup[key].totalTax += item.cgst + item.sgst + item.igst;
    });
  }

  let y = margin;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > maxY) {
      doc.addPage();
      y = margin;
    }
  };

  const drawHeader = (headingOverride?: string) => {
    const title = getDocTitle(voucher, headingOverride || customHeaderTitle);
    const leftW = cw * 0.62;
    const rightX = margin + cw;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(isA5 ? 11.5 : 13.5);
    doc.setTextColor(ar, ag, ab);
    doc.text((settings.name || 'GHOSH AGENCY').toUpperCase(), margin, y + 4);

    let leftY = y + 8;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(fsSmall);
    doc.setTextColor(71, 85, 105);

    if (settings.address) {
      const addrLines = doc.splitTextToSize(settings.address, leftW) as string[];
      doc.text(addrLines.slice(0, 2), margin, leftY);
      leftY += addrLines.slice(0, 2).length * (lineH - 0.3);
    }

    const metaParts: string[] = [];
    if (settings.gstin) metaParts.push(`GSTIN: ${settings.gstin}`);
    if (settings.state) metaParts.push(`State: ${settings.state} (${settings.stateCode})`);
    if (settings.phone) metaParts.push(`Ph: ${settings.phone}`);
    if (metaParts.length > 0) {
      doc.setTextColor(30, 41, 59);
      const metaLines = doc.splitTextToSize(metaParts.join('  |  '), leftW) as string[];
      doc.text(metaLines, margin, leftY + 0.5);
      leftY += metaLines.length * (lineH - 0.2);
    }

    // Badge + Doc Meta on Right
    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsSmall);
    const badgeW = Math.min(cw * 0.36, doc.getTextWidth(title) + 6);
    const badgeH = 5.2;
    doc.setFillColor(ar, ag, ab);
    doc.rect(rightX - badgeW, y, badgeW, badgeH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(title, rightX - badgeW / 2, y + 3.6, { align: 'center' });

    let rightY = y + badgeH + 3.2;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(fsSmall);
    doc.setTextColor(51, 65, 85);
    doc.text(`Doc No: ${voucher.voucherNo}`, rightX, rightY, { align: 'right' });
    rightY += lineH - 0.3;
    doc.text(`Date: ${voucher.date}  |  Mode: ${voucher.paymentMode}`, rightX, rightY, { align: 'right' });
    if (voucher.referenceNo) {
      rightY += lineH - 0.3;
      doc.text(`Ref: ${voucher.referenceNo}`, rightX, rightY, { align: 'right' });
    }

    y = Math.max(leftY, rightY) + 2.2;
    doc.setDrawColor(ar, ag, ab);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + cw, y);
    y += 2.5;
  };

  const drawPartyBox = (headingOverride?: string) => {
    const label =
      headingOverride ||
      (voucher.type === 'PAYMENT'
        ? 'PAID TO (BENEFICIARY)'
        : voucher.type === 'RECEIPT'
        ? 'RECEIVED FROM (CUSTOMER)'
        : voucher.type === 'PURCHASE'
        ? 'SUPPLIER DETAILS'
        : 'BILLED TO (PARTY DETAILS)');
    const modeTag = voucher.customerMode === 'guest' ? '  [Guest]' : '';

    const addrLines = partyAddress ? (doc.splitTextToSize(partyAddress, cw - 5) as string[]).slice(0, 2) : [];
    const detailsLineParts: string[] = [];
    if (partyGstin) detailsLineParts.push(`GSTIN: ${partyGstin}`);
    if (partyStateCode) detailsLineParts.push(`State Code: ${partyStateCode}`);
    if (partyPhone) detailsLineParts.push(`Ph: ${partyPhone}`);
    const noteLines = voucher.notes ? (doc.splitTextToSize(`Note: ${voucher.notes}`, cw - 5) as string[]).slice(0, 1) : [];

    const boxH =
      7.5 +
      addrLines.length * (lineH - 0.3) +
      (detailsLineParts.length > 0 ? lineH - 0.2 : 0) +
      (noteLines.length > 0 ? lineH : 0);

    ensureSpace(boxH + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, cw, boxH, 'FD');

    let py = y + 3.4;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsSmall - 0.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}${modeTag}`, margin + 2.5, py);

    py += lineH;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsBase + 0.6);
    doc.setTextColor(15, 23, 42);
    doc.text(partyName, margin + 2.5, py);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(fsSmall);
    doc.setTextColor(71, 85, 105);

    if (addrLines.length > 0) {
      py += lineH - 0.3;
      doc.text(addrLines, margin + 2.5, py);
      py += (addrLines.length - 1) * (lineH - 0.3);
    }
    if (detailsLineParts.length > 0) {
      py += lineH - 0.2;
      doc.text(detailsLineParts.join('   |   '), margin + 2.5, py);
    }
    if (noteLines.length > 0) {
      py += lineH - 0.1;
      doc.setTextColor(100, 116, 139);
      doc.text(noteLines, margin + 2.5, py);
    }

    y += boxH + 2.5;
  };

  const drawItemsTable = (opts?: {
    showHsn?: boolean;
    showDisc?: boolean;
    showTax?: boolean;
    showUnit?: boolean;
  }) => {
    if (!isGoodsDoc) {
      const boxH = 16;
      ensureSpace(boxH + 2);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, cw, boxH, 'FD');
      doc.setFont(fontName, 'bold');
      doc.setFontSize(fsBase);
      doc.setTextColor(15, 23, 42);
      doc.text(`Payment Mode: ${voucher.paymentMode}`, margin + 3, y + 5.5);
      if (voucher.referenceNo) {
        doc.setFont(fontName, 'normal');
        doc.text(`Ref: ${voucher.referenceNo}`, margin + cw - 3, y + 5.5, { align: 'right' });
      }
      doc.setFont(fontName, 'bold');
      doc.setFontSize(fsBase + 1.5);
      doc.text(`Settlement Amount: ${formatRs(voucher.grandTotal)}`, margin + 3, y + 12.2);
      y += boxH + 3;
      return;
    }

    const showHsn = opts?.showHsn !== false;
    const showDisc = Boolean(opts?.showDisc);
    const showTax = opts?.showTax !== false;
    const showUnit = opts?.showUnit !== false;

    const cols: { key: string; label: string; w: number; align: 'left' | 'center' | 'right' }[] = [
      { key: 'idx', label: '#', w: cw * 0.055, align: 'center' },
      { key: 'name', label: 'Item Description', w: cw * 0.32, align: 'left' },
    ];
    if (showHsn) cols.push({ key: 'hsn', label: 'HSN', w: cw * 0.1, align: 'center' });
    cols.push({ key: 'qty', label: 'Qty', w: cw * 0.1, align: 'right' });
    cols.push({
      key: 'rate',
      label: voucher.isGstInclusive ? 'Rate(Inc)' : 'Rate',
      w: cw * 0.115,
      align: 'right',
    });
    if (showDisc) cols.push({ key: 'disc', label: 'Disc', w: cw * 0.075, align: 'right' });
    cols.push({ key: 'taxable', label: 'Taxable', w: cw * 0.125, align: 'right' });
    if (showTax) cols.push({ key: 'gst', label: 'GST', w: cw * 0.07, align: 'center' });
    cols.push({ key: 'total', label: 'Total', w: cw * 0.14, align: 'right' });

    // Normalize widths to exact cw
    const sumW = cols.reduce((acc, c) => acc + c.w, 0);
    const extraToDesc = cw - sumW;
    cols[1].w += extraToDesc;

    const headerH = isA5 ? 5.2 : 6;
    ensureSpace(headerH + 6);

    const drawTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.rect(margin, y, cw, headerH, 'FD');
      doc.setFont(fontName, 'bold');
      doc.setFontSize(fsSmall - 0.3);
      doc.setTextColor(30, 41, 59);

      let cx = margin;
      for (const col of cols) {
        const tx =
          col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w - 1.2 : cx + 1.2;
        doc.text(col.label, tx, y + headerH - 1.6, { align: col.align });
        cx += col.w;
      }
      y += headerH;
    };

    drawTableHeader();

    const items = voucher.items || [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const descLines = doc.splitTextToSize(item.name || '', cols[1].w - 2.4) as string[];
      const rowH = Math.max(isA5 ? 4.5 : 5.2, descLines.length * (lineH - 0.2) + 1.4);

      if (y + rowH > maxY - 4) {
        doc.addPage();
        y = margin;
        drawTableHeader();
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, cw, rowH, 'S');

      doc.setFont(fontName, 'normal');
      doc.setFontSize(fsSmall);
      doc.setTextColor(15, 23, 42);

      let cx = margin;
      for (const col of cols) {
        let val = '';
        if (col.key === 'idx') val = String(idx + 1);
        else if (col.key === 'hsn') val = item.hsn || '-';
        else if (col.key === 'qty') val = `${item.qty}${showUnit ? ` ${item.unit}` : ''}`;
        else if (col.key === 'rate') val = item.rate.toFixed(2);
        else if (col.key === 'disc') val = `${item.discount}%`;
        else if (col.key === 'taxable') val = item.taxableAmount.toFixed(2);
        else if (col.key === 'gst') val = `${item.gstRate}%`;
        else if (col.key === 'total') val = item.total.toFixed(2);

        if (col.key === 'name') {
          doc.setFont(fontName, 'bold');
          doc.text(descLines, cx + 1.2, y + 3.2);
          doc.setFont(fontName, 'normal');
        } else {
          if (col.key === 'total') doc.setFont(fontName, 'bold');
          const tx =
            col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w - 1.2 : cx + 1.2;
          doc.text(val, tx, y + 3.2, { align: col.align });
          if (col.key === 'total') doc.setFont(fontName, 'normal');
        }
        cx += col.w;
      }

      y += rowH;
    }

    y += 2.5;
  };

  const drawWordsBankAndTotals = (opts?: { showBank?: boolean; showQr?: boolean }) => {
    const showBank = opts?.showBank !== false && Boolean(settings.bankName);
    const showQr = opts?.showQr !== false && Boolean(upiUri);

    const leftW = cw * 0.58;
    const rightW = cw * 0.39;
    const rightX = margin + cw - rightW;

    const wordsLines = doc.splitTextToSize(numberToWordsINR(voucher.grandTotal), leftW - 2) as string[];
    const taxRows: [string, string][] = [['Taxable Subtotal:', formatRs(voucher.subtotal)]];
    if (voucher.cgstTotal > 0) taxRows.push(['CGST:', formatRs(voucher.cgstTotal)]);
    if (voucher.sgstTotal > 0) taxRows.push(['SGST:', formatRs(voucher.sgstTotal)]);
    if (voucher.igstTotal > 0) taxRows.push(['IGST:', formatRs(voucher.igstTotal)]);

    const totalsBoxH = taxRows.length * (lineH + 0.3) + 7.5;
    const qrSize = isA5 ? 15 : 18;
    const bankBoxH = showBank || showQr ? Math.max(qrSize + 2, 16) : 0;
    const leftTotalH = 4 + wordsLines.length * (lineH - 0.3) + (bankBoxH > 0 ? 2.5 + bankBoxH : 0);
    const sectionH = Math.max(totalsBoxH, leftTotalH);

    ensureSpace(sectionH + 2);

    // Left: Amount in words + Bank / UPI QR
    let ly = y + 3;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsSmall - 0.5);
    doc.setTextColor(100, 116, 139);
    doc.text('AMOUNT CHARGEABLE (IN WORDS):', margin, ly);
    ly += lineH - 0.3;
    doc.setFont(fontName, 'bolditalic');
    doc.setFontSize(fsSmall);
    doc.setTextColor(15, 23, 42);
    doc.text(wordsLines, margin, ly);
    ly += wordsLines.length * (lineH - 0.3) + 2;

    if (showBank || showQr) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(margin, ly, leftW, bankBoxH, 'FD');

      const textMaxW = showQr ? leftW - qrSize - 5 : leftW - 4;
      let by = ly + 3.5;
      doc.setFont(fontName, 'bold');
      doc.setFontSize(fsSmall - 0.6);
      doc.setTextColor(51, 65, 85);
      doc.text(showBank ? 'ELECTRONIC PAYMENT (BANK / UPI)' : 'PAY VIA UPI', margin + 2, by);

      doc.setFont(fontName, 'normal');
      doc.setFontSize(fsSmall - 0.6);
      if (showBank) {
        by += lineH - 0.4;
        const bLines = doc.splitTextToSize(
          `${settings.bankName} | A/c: ${settings.accountNo}`,
          textMaxW
        ) as string[];
        doc.text(bLines.slice(0, 2), margin + 2, by);
        by += bLines.slice(0, 2).length * (lineH - 0.5);
        const iLines = doc.splitTextToSize(
          `IFSC: ${settings.ifsc}${settings.upiId ? ` | UPI: ${settings.upiId}` : ''}`,
          textMaxW
        ) as string[];
        doc.text(iLines.slice(0, 2), margin + 2, by);
      } else if (settings.upiId) {
        by += lineH;
        doc.text(settings.upiId, margin + 2, by);
      }

      if (showQr && upiUri) {
        drawQrOnPdf(doc, upiUri, margin + leftW - qrSize - 1.5, ly + (bankBoxH - qrSize) / 2, qrSize);
      }
    }

    // Right: Totals Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(rightX, y, rightW, totalsBoxH, 'FD');

    let ty = y + 4;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(fsSmall);
    doc.setTextColor(51, 65, 85);

    for (const [k, v] of taxRows) {
      doc.text(k, rightX + 2.5, ty);
      doc.text(v, rightX + rightW - 2.5, ty, { align: 'right' });
      ty += lineH + 0.3;
    }

    doc.setDrawColor(ar, ag, ab);
    doc.setLineWidth(0.45);
    doc.line(rightX + 2, ty - 2, rightX + rightW - 2, ty - 2);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(isA5 ? 8.8 : 10);
    doc.setTextColor(ar, ag, ab);
    doc.text('Grand Total:', rightX + 2.5, ty + 2);
    doc.text(formatRs(voucher.grandTotal), rightX + rightW - 2.5, ty + 2, { align: 'right' });

    y += sectionH + 2.5;
  };

  const drawHsnTable = () => {
    const entries = Object.values(hsnBreakup);
    if (!isGoodsDoc || entries.length === 0) return;

    const hsnCols = [
      { label: 'HSN/SAC', w: cw * 0.16 },
      { label: 'Taxable', w: cw * 0.18 },
      { label: 'Rate', w: cw * 0.1 },
      { label: 'CGST', w: cw * 0.14 },
      { label: 'SGST', w: cw * 0.14 },
      { label: 'IGST', w: cw * 0.13 },
      { label: 'Total Tax', w: cw * 0.15 },
    ];

    const rowH = isA5 ? 4 : 4.6;
    const totalH = 4.2 + rowH + entries.length * rowH;
    ensureSpace(totalH + 2);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, cw, 4.2, 'FD');
    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsSmall - 0.6);
    doc.setTextColor(51, 65, 85);
    doc.text('HSN / SAC Tax Breakdown Summary', margin + 2, y + 3);
    y += 4.2;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, cw, rowH, 'FD');
    let cx = margin;
    for (const col of hsnCols) {
      doc.text(col.label, cx + col.w / 2, y + rowH - 1.2, { align: 'center' });
      cx += col.w;
    }
    y += rowH;

    doc.setFont(fontName, 'normal');
    for (const h of entries) {
      doc.rect(margin, y, cw, rowH, 'S');
      const vals = [
        h.hsn,
        h.taxableAmount.toFixed(2),
        `${h.gstRate}%`,
        h.cgst.toFixed(2),
        h.sgst.toFixed(2),
        h.igst.toFixed(2),
        h.totalTax.toFixed(2),
      ];
      cx = margin;
      vals.forEach((v, i) => {
        if (i === vals.length - 1) doc.setFont(fontName, 'bold');
        doc.text(v, cx + hsnCols[i].w / 2, y + rowH - 1.2, { align: 'center' });
        if (i === vals.length - 1) doc.setFont(fontName, 'normal');
        cx += hsnCols[i].w;
      });
      y += rowH;
    }

    y += 2.5;
  };

  const drawFooter = () => {
    const terms =
      settings.invoiceTerms ||
      '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.';
    const termLines = (doc.splitTextToSize(terms, cw * 0.58) as string[]).slice(0, 4);
    const footerH = Math.max(16, 5 + termLines.length * (lineH - 0.3));

    ensureSpace(footerH + 1);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + cw, y);
    y += 3;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsSmall - 0.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TERMS & DECLARATION:', margin, y);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(fsSmall - 0.7);
    doc.setTextColor(100, 116, 139);
    doc.text(termLines, margin, y + lineH - 0.3);

    const rightX = margin + cw;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(fsSmall);
    doc.setTextColor(30, 41, 59);
    doc.text(settings.authorizedSignatoryTitle || `For ${settings.name}`, rightX, y, {
      align: 'right',
    });

    const sigLineY = y + Math.max(10, footerH - 7);
    doc.setDrawColor(148, 163, 184);
    doc.line(rightX - 36, sigLineY, rightX, sigLineY);
    doc.setFont(fontName, 'normal');
    doc.setFontSize(fsSmall - 0.7);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signatory', rightX - 18, sigLineY + 3, { align: 'center' });

    y += footerH;
  };

  if (tpl) {
    // Render following Custom Drag & Drop Invoice Builder block order
    const blocks = tpl.blocks.filter(b => b.visible);
    // Group adjacent totals_box + amount_words if standard order, or render sequentially cleanly
    const renderCustomBlock = (block: InvoiceBlockConfig) => {
      switch (block.type) {
        case 'company_header':
          drawHeader(block.customHeading);
          break;
        case 'invoice_meta':
          ensureSpace(10);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, cw, 7.5, 'FD');
          doc.setFont(fontName, 'bold');
          doc.setFontSize(fsSmall - 0.3);
          doc.setTextColor(30, 41, 59);
          doc.text(
            `Doc: ${voucher.voucherNo}   |   Date: ${voucher.date}   |   Mode: ${voucher.paymentMode}   |   State: ${partyStateCode}`,
            margin + 2.5,
            y + 4.8
          );
          y += 9.5;
          break;
        case 'bill_to':
          drawPartyBox(block.customHeading);
          break;
        case 'dispatch_info': {
          const isInter = partyStateCode && settings.stateCode && partyStateCode !== settings.stateCode;
          ensureSpace(8);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y, cw, 6.2, 'FD');
          doc.setFont(fontName, 'normal');
          doc.setFontSize(fsSmall - 0.4);
          doc.setTextColor(51, 65, 85);
          doc.text(
            `Place of Supply: Code ${partyStateCode} (${isInter ? 'Inter-State IGST' : 'Intra-State CGST+SGST'})`,
            margin + 2.5,
            y + 4.1
          );
          y += 8;
          break;
        }
        case 'items_table':
          drawItemsTable({
            showHsn: block.showHsnColumn,
            showDisc: block.showDiscountColumn,
            showTax: block.showTaxColumn,
            showUnit: block.showUnitColumn,
          });
          break;
        case 'totals_box':
          drawWordsBankAndTotals({ showBank: false, showQr: false });
          break;
        case 'amount_words': {
          // Already rendered with totals_box if both visible; if standalone without totals_box, render compact bar
          const hasTotals = blocks.some(b => b.type === 'totals_box');
          if (!hasTotals) {
            ensureSpace(8);
            doc.setFont(fontName, 'bolditalic');
            doc.setFontSize(fsSmall);
            doc.setTextColor(15, 23, 42);
            doc.text(`Amount in Words: ${numberToWordsINR(voucher.grandTotal)}`, margin, y + 4);
            y += 7;
          }
          break;
        }
        case 'hsn_summary':
          drawHsnTable();
          break;
        case 'bank_qr': {
          const showQrBlk = block.showQrCode !== false && Boolean(upiUri);
          const showBankBlk = block.showBankDetails !== false && Boolean(settings.bankName);
          if (showQrBlk || showBankBlk) {
            const qrSize = isA5 ? 14 : 17;
            const bH = Math.max(qrSize + 2, 15);
            ensureSpace(bH + 2);
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.rect(margin, y, cw, bH, 'FD');
            doc.setFont(fontName, 'bold');
            doc.setFontSize(fsSmall - 0.5);
            doc.setTextColor(51, 65, 85);
            doc.text('BANK & ELECTRONIC PAYMENT', margin + 2.5, y + 4);
            doc.setFont(fontName, 'normal');
            if (showBankBlk) {
              doc.text(`${settings.bankName}  |  A/c: ${settings.accountNo}`, margin + 2.5, y + 8);
              doc.text(
                `IFSC: ${settings.ifsc}${settings.upiId ? `  |  UPI: ${settings.upiId}` : ''}`,
                margin + 2.5,
                y + 11.8
              );
            } else if (settings.upiId) {
              doc.text(`UPI ID: ${settings.upiId}`, margin + 2.5, y + 8.5);
            }
            if (showQrBlk && upiUri) {
              drawQrOnPdf(doc, upiUri, margin + cw - qrSize - 1.5, y + (bH - qrSize) / 2, qrSize);
            }
            y += bH + 2.5;
          }
          break;
        }
        case 'terms_signatory':
          drawFooter();
          break;
        case 'custom_text': {
          const body = block.customBody || '';
          const lines = doc.splitTextToSize(body, cw - 4) as string[];
          const h = (block.customHeading ? 4 : 0) + lines.length * lineH + 2;
          ensureSpace(h);
          if (block.customHeading) {
            doc.setFont(fontName, 'bold');
            doc.setFontSize(fsSmall - 0.4);
            doc.setTextColor(100, 116, 139);
            doc.text(block.customHeading, margin, y + 3);
            y += 4;
          }
          doc.setFont(fontName, 'normal');
          doc.setFontSize(fsSmall);
          doc.setTextColor(51, 65, 85);
          doc.text(lines, margin, y + 3);
          y += lines.length * lineH + 2;
          break;
        }
        case 'divider':
          ensureSpace(3);
          doc.setDrawColor(ar, ag, ab);
          doc.setLineWidth(0.25);
          doc.line(margin, y + 1, margin + cw, y + 1);
          y += 2.5;
          break;
      }
    };

    for (const blk of blocks) {
      renderCustomBlock(blk);
    }
  } else {
    // Standard Crisp Single-Page Invoice Layout
    drawHeader();
    drawPartyBox();
    drawItemsTable();
    drawWordsBankAndTotals({ showBank: showBankDetails, showQr: showQrCode });
    if (showHsnSummary) {
      drawHsnTable();
    }
    drawFooter();
  }

  const safeVoucherNo = (voucher.voucherNo || 'Invoice').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeParty = (partyName || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 24);
  const fileName = safeParty ? `${safeVoucherNo}_${safeParty}.pdf` : `${safeVoucherNo}.pdf`;
  doc.save(fileName);
}
