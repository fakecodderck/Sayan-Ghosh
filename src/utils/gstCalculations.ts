import {
  InventoryItem,
  LedgerAccount,
  TransactionVoucher,
  VoucherLineItem
} from '../types/accounting';

export function isInterStateTransaction(companyStateCode: string, partyStateCode?: string): boolean {
  if (!partyStateCode || !companyStateCode) return false;
  return companyStateCode.trim() !== partyStateCode.trim();
}

export function calculateLineItem(
  qty: number,
  rate: number,
  discountPercent: number,
  gstRate: number,
  isInterState: boolean,
  isGstBill: boolean = true
): {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
} {
  const gross = qty * rate;
  const discountAmount = (gross * (discountPercent || 0)) / 100;
  const taxableAmount = Math.max(0, gross - discountAmount);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isGstBill) {
    if (isInterState) {
      igst = Number(((taxableAmount * gstRate) / 100).toFixed(2));
    } else {
      const halfRate = gstRate / 2;
      cgst = Number(((taxableAmount * halfRate) / 100).toFixed(2));
      sgst = Number(((taxableAmount * halfRate) / 100).toFixed(2));
    }
  }

  const total = Number((taxableAmount + cgst + sgst + igst).toFixed(2));

  return {
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgst,
    sgst,
    igst,
    total,
  };
}

export function formatINR(val: number): string {
  if (isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

// Convert number to Indian English words (Lakhs, Crores)
export function numberToWordsINR(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  if (num < 0) return 'Minus ' + numberToWordsINR(-num);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    if (n === 0) return '';
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const hundredPart = hundred > 0 ? a[hundred] + ' Hundred' : '';
    const restPart = rest > 0 ? (hundredPart ? ' and ' : '') + convertTwoDigits(rest) : '';
    return hundredPart + restPart;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = '';

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  if (crore > 0) result += convertThreeDigits(crore) + ' Crore ';
  if (lakh > 0) result += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) result += convertTwoDigits(thousand) + ' Thousand ';
  if (remainder > 0) result += convertThreeDigits(remainder) + ' ';

  result = result.trim() + ' Rupees';

  if (decimalPart > 0) {
    result += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }

  return result + ' Only';
}

export interface ProfitAndLossReport {
  grossSales: number;
  salesReturns: number;
  netSales: number;

  grossPurchases: number;
  purchaseReturns: number;
  netPurchases: number;

  openingStockValue: number;
  closingStockValue: number;
  directExpenses: number;

  costOfGoodsSold: number;
  grossProfit: number;
  grossProfitMargin: number;

  indirectExpenses: number;
  indirectIncome: number;
  netProfit: number;
  netProfitMargin: number;

  expenseBreakdown: { name: string; amount: number }[];
}

export function computeProfitAndLoss(
  vouchers: TransactionVoucher[],
  inventory: InventoryItem[],
  ledgers: LedgerAccount[]
): ProfitAndLossReport {
  // Sales & Sales Returns (Credit Notes)
  let grossSales = 0;
  let salesReturns = 0;
  let grossPurchases = 0;
  let purchaseReturns = 0;
  let directExpenses = 0;
  let indirectExpenses = 0;
  let indirectIncome = 0;

  for (const v of vouchers) {
    if (v.type === 'SALE') {
      grossSales += v.subtotal;
    } else if (v.type === 'CREDIT_NOTE') {
      salesReturns += v.subtotal;
    } else if (v.type === 'PURCHASE') {
      grossPurchases += v.subtotal;
    } else if (v.type === 'DEBIT_NOTE') {
      purchaseReturns += v.subtotal;
    } else if (v.type === 'PAYMENT') {
      // Check if linked to expense ledger
      const ledger = ledgers.find(l => l.id === v.partyId);
      if (ledger?.group === 'Direct Expenses') {
        directExpenses += v.grandTotal;
      } else if (ledger?.group === 'Indirect Expenses') {
        indirectExpenses += v.grandTotal;
      }
    } else if (v.type === 'RECEIPT') {
      const ledger = ledgers.find(l => l.id === v.partyId);
      if (ledger?.group === 'Direct Expenses' || ledger?.group === 'Indirect Expenses') {
        indirectIncome += v.grandTotal;
      }
    }
  }

  const netSales = Math.max(0, grossSales - salesReturns);
  const netPurchases = Math.max(0, grossPurchases - purchaseReturns);

  // Closing Stock valuation (quantity * purchasePrice)
  let closingStockValue = 0;
  for (const item of inventory) {
    const totalQty = typeof item.currentStock === 'number' ? item.currentStock : 0;
    closingStockValue += totalQty * (item.purchasePrice || 0);
  }

  // Opening stock baseline (approximate 25% of purchases + initial baseline)
  const openingStockValue = Math.round(closingStockValue * 0.7);

  const costOfGoodsSold = openingStockValue + netPurchases + directExpenses - closingStockValue;
  const grossProfit = netSales - costOfGoodsSold;
  const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Add default categorized indirect expenses if any
  const expenseMap: Record<string, number> = {};
  for (const l of ledgers) {
    if (l.group === 'Indirect Expenses' || l.group === 'Direct Expenses') {
      expenseMap[l.name] = Math.abs(l.currentBalance || 0);
    }
  }

  const expenseBreakdown = Object.entries(expenseMap).map(([name, amount]) => ({
    name,
    amount,
  }));

  const totalCalculatedIndirectExpenses = Math.max(
    indirectExpenses,
    expenseBreakdown.reduce((acc, cur) => acc + cur.amount, 0)
  );

  const netProfit = grossProfit - totalCalculatedIndirectExpenses + indirectIncome;
  const netProfitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  return {
    grossSales,
    salesReturns,
    netSales,
    grossPurchases,
    purchaseReturns,
    netPurchases,
    openingStockValue,
    closingStockValue,
    directExpenses,
    costOfGoodsSold,
    grossProfit,
    grossProfitMargin,
    indirectExpenses: totalCalculatedIndirectExpenses,
    indirectIncome,
    netProfit,
    netProfitMargin,
    expenseBreakdown,
  };
}

export interface Gstr1Summary {
  b2bInvoicesCount: number;
  b2bTaxableValue: number;
  b2bTaxAmount: number;

  b2cInvoicesCount: number;
  b2cTaxableValue: number;
  b2cTaxAmount: number;

  creditNotesCount: number;
  creditNotesTaxableValue: number;
  creditNotesTaxAmount: number;

  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;

  hsnSummary: {
    hsn: string;
    description: string;
    unit: string;
    totalQty: number;
    taxableValue: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }[];
}

export function computeGSTR1Summary(
  vouchers: TransactionVoucher[],
  ledgers: LedgerAccount[]
): Gstr1Summary {
  let b2bInvoicesCount = 0;
  let b2bTaxableValue = 0;
  let b2bTaxAmount = 0;

  let b2cInvoicesCount = 0;
  let b2cTaxableValue = 0;
  let b2cTaxAmount = 0;

  let creditNotesCount = 0;
  let creditNotesTaxableValue = 0;
  let creditNotesTaxAmount = 0;

  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const hsnMap: Record<
    string,
    {
      hsn: string;
      description: string;
      unit: string;
      totalQty: number;
      taxableValue: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
    }
  > = {};

  for (const v of vouchers) {
    if (v.type === 'SALE') {
      const party = ledgers.find(l => l.id === v.partyId);
      const isB2B = Boolean(party?.gstin && party.gstin.trim().length === 15);
      const taxSum = v.cgstTotal + v.sgstTotal + v.igstTotal;

      if (isB2B) {
        b2bInvoicesCount++;
        b2bTaxableValue += v.subtotal;
        b2bTaxAmount += taxSum;
      } else {
        b2cInvoicesCount++;
        b2cTaxableValue += v.subtotal;
        b2cTaxAmount += taxSum;
      }

      totalCgst += v.cgstTotal;
      totalSgst += v.sgstTotal;
      totalIgst += v.igstTotal;

      // HSN aggregation
      for (const item of v.items || []) {
        const key = `${item.hsn}_${item.gstRate}`;
        if (!hsnMap[key]) {
          hsnMap[key] = {
            hsn: item.hsn || '9999',
            description: item.name,
            unit: item.unit || 'Pcs',
            totalQty: 0,
            taxableValue: 0,
            gstRate: item.gstRate,
            cgst: 0,
            sgst: 0,
            igst: 0,
          };
        }
        hsnMap[key].totalQty += item.qty;
        hsnMap[key].taxableValue += item.taxableAmount;
        hsnMap[key].cgst += item.cgst;
        hsnMap[key].sgst += item.sgst;
        hsnMap[key].igst += item.igst;
      }
    } else if (v.type === 'CREDIT_NOTE') {
      creditNotesCount++;
      creditNotesTaxableValue += v.subtotal;
      creditNotesTaxAmount += v.cgstTotal + v.sgstTotal + v.igstTotal;
    }
  }

  const hsnSummary = Object.values(hsnMap).map(h => ({
    ...h,
    totalTax: Number((h.cgst + h.sgst + h.igst).toFixed(2)),
    taxableValue: Number(h.taxableValue.toFixed(2)),
  }));

  const totalTaxable = b2bTaxableValue + b2cTaxableValue - creditNotesTaxableValue;
  const totalTax = totalCgst + totalSgst + totalIgst - creditNotesTaxAmount;

  return {
    b2bInvoicesCount,
    b2bTaxableValue: Number(b2bTaxableValue.toFixed(2)),
    b2bTaxAmount: Number(b2bTaxAmount.toFixed(2)),
    b2cInvoicesCount,
    b2cTaxableValue: Number(b2cTaxableValue.toFixed(2)),
    b2cTaxAmount: Number(b2cTaxAmount.toFixed(2)),
    creditNotesCount,
    creditNotesTaxableValue: Number(creditNotesTaxableValue.toFixed(2)),
    creditNotesTaxAmount: Number(creditNotesTaxAmount.toFixed(2)),
    totalTaxable: Number(totalTaxable.toFixed(2)),
    totalCgst: Number(totalCgst.toFixed(2)),
    totalSgst: Number(totalSgst.toFixed(2)),
    totalIgst: Number(totalIgst.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    hsnSummary,
  };
}
