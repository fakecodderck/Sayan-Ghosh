import {
  InventoryItem,
  LedgerAccount,
  TransactionVoucher,
  VoucherLineItem
} from '../types/accounting';

export function isInterStateTransaction(
  companyStateCode: string,
  partyStateCode?: string,
  partyGstin?: string
): boolean {
  let targetCode = partyStateCode?.trim();
  if (!targetCode && partyGstin && partyGstin.trim().length >= 2) {
    const prefix = partyGstin.trim().substring(0, 2);
    if (/^\d{2}$/.test(prefix)) {
      targetCode = prefix;
    }
  }
  if (!targetCode || !companyStateCode) return false;
  return companyStateCode.trim() !== targetCode;
}

export function calculateLineItem(
  qty: number,
  rate: number,
  discountPercent: number,
  gstRate: number,
  isInterState: boolean,
  isGstBill: boolean = true,
  isGstInclusive: boolean = false
): {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
} {
  const gross = qty * rate;
  const discountAmount = (gross * (discountPercent || 0)) / 100;
  const netRateTotal = Math.max(0, gross - discountAmount);

  let taxableAmount = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let total = 0;

  if (isGstBill) {
    if (isGstInclusive && gstRate > 0) {
      total = Number(netRateTotal.toFixed(2));
      taxableAmount = Number((total / (1 + gstRate / 100)).toFixed(2));
      const totalTax = Number((total - taxableAmount).toFixed(2));

      if (isInterState) {
        igst = totalTax;
      } else {
        const halfTax = Number((totalTax / 2).toFixed(2));
        cgst = halfTax;
        sgst = Number((totalTax - halfTax).toFixed(2));
      }
    } else {
      taxableAmount = Number(netRateTotal.toFixed(2));
      if (isInterState) {
        igst = Number(((taxableAmount * gstRate) / 100).toFixed(2));
      } else {
        const halfRate = gstRate / 2;
        cgst = Number(((taxableAmount * halfRate) / 100).toFixed(2));
        sgst = Number(((taxableAmount * halfRate) / 100).toFixed(2));
      }
      total = Number((taxableAmount + cgst + sgst + igst).toFixed(2));
    }
  } else {
    taxableAmount = Number(netRateTotal.toFixed(2));
    total = taxableAmount;
  }

  return {
    taxableAmount,
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

  // Opening stock value from inventory master item opening quantities
  let openingStockValue = 0;
  for (const item of inventory) {
    const openQty = typeof item.openingStock === 'number' ? item.openingStock : 0;
    openingStockValue += openQty * (item.purchasePrice || 0);
  }

  const costOfGoodsSold = Math.max(0, openingStockValue + netPurchases + directExpenses - closingStockValue);
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
  b2bCgst: number;
  b2bSgst: number;
  b2bIgst: number;
  b2bTaxAmount: number;

  b2cInvoicesCount: number;
  b2cTaxableValue: number;
  b2cCgst: number;
  b2cSgst: number;
  b2cIgst: number;
  b2cTaxAmount: number;

  creditNotesCount: number;
  creditNotesTaxableValue: number;
  creditNotesCgst: number;
  creditNotesSgst: number;
  creditNotesIgst: number;
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
  let b2bCgst = 0;
  let b2bSgst = 0;
  let b2bIgst = 0;

  let b2cInvoicesCount = 0;
  let b2cTaxableValue = 0;
  let b2cCgst = 0;
  let b2cSgst = 0;
  let b2cIgst = 0;

  let creditNotesCount = 0;
  let creditNotesTaxableValue = 0;
  let creditNotesCgst = 0;
  let creditNotesSgst = 0;
  let creditNotesIgst = 0;

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

      if (isB2B) {
        b2bInvoicesCount++;
        b2bTaxableValue += v.subtotal;
        b2bCgst += v.cgstTotal;
        b2bSgst += v.sgstTotal;
        b2bIgst += v.igstTotal;
      } else {
        b2cInvoicesCount++;
        b2cTaxableValue += v.subtotal;
        b2cCgst += v.cgstTotal;
        b2cSgst += v.sgstTotal;
        b2cIgst += v.igstTotal;
      }

      // HSN aggregation for sales
      for (const item of v.items || []) {
        const key = `${item.hsn || '9999'}_${item.gstRate}`;
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
      creditNotesCgst += v.cgstTotal;
      creditNotesSgst += v.sgstTotal;
      creditNotesIgst += v.igstTotal;

      // HSN reduction for sales returns (Credit Notes)
      for (const item of v.items || []) {
        const key = `${item.hsn || '9999'}_${item.gstRate}`;
        if (hsnMap[key]) {
          hsnMap[key].totalQty -= item.qty;
          hsnMap[key].taxableValue -= item.taxableAmount;
          hsnMap[key].cgst -= item.cgst;
          hsnMap[key].sgst -= item.sgst;
          hsnMap[key].igst -= item.igst;
        }
      }
    }
  }

  const hsnSummary = Object.values(hsnMap)
    .map(h => {
      const taxableValue = Number(Math.max(0, h.taxableValue).toFixed(2));
      const cgst = Number(Math.max(0, h.cgst).toFixed(2));
      const sgst = Number(Math.max(0, h.sgst).toFixed(2));
      const igst = Number(Math.max(0, h.igst).toFixed(2));
      const totalTax = Number((cgst + sgst + igst).toFixed(2));
      return {
        ...h,
        totalQty: Math.max(0, h.totalQty),
        taxableValue,
        cgst,
        sgst,
        igst,
        totalTax,
      };
    })
    .filter(h => h.totalQty > 0 || h.taxableValue > 0 || h.totalTax > 0);

  const totalCgst = Number(Math.max(0, b2bCgst + b2cCgst - creditNotesCgst).toFixed(2));
  const totalSgst = Number(Math.max(0, b2bSgst + b2cSgst - creditNotesSgst).toFixed(2));
  const totalIgst = Number(Math.max(0, b2bIgst + b2cIgst - creditNotesIgst).toFixed(2));

  const totalTaxable = Number(Math.max(0, b2bTaxableValue + b2cTaxableValue - creditNotesTaxableValue).toFixed(2));
  const totalTax = Number((totalCgst + totalSgst + totalIgst).toFixed(2));

  const b2bTaxAmount = Number((b2bCgst + b2bSgst + b2bIgst).toFixed(2));
  const b2cTaxAmount = Number((b2cCgst + b2cSgst + b2cIgst).toFixed(2));
  const creditNotesTaxAmount = Number((creditNotesCgst + creditNotesSgst + creditNotesIgst).toFixed(2));

  return {
    b2bInvoicesCount,
    b2bTaxableValue: Number(b2bTaxableValue.toFixed(2)),
    b2bCgst: Number(b2bCgst.toFixed(2)),
    b2bSgst: Number(b2bSgst.toFixed(2)),
    b2bIgst: Number(b2bIgst.toFixed(2)),
    b2bTaxAmount,

    b2cInvoicesCount,
    b2cTaxableValue: Number(b2cTaxableValue.toFixed(2)),
    b2cCgst: Number(b2cCgst.toFixed(2)),
    b2cSgst: Number(b2cSgst.toFixed(2)),
    b2cIgst: Number(b2cIgst.toFixed(2)),
    b2cTaxAmount,

    creditNotesCount,
    creditNotesTaxableValue: Number(creditNotesTaxableValue.toFixed(2)),
    creditNotesCgst: Number(creditNotesCgst.toFixed(2)),
    creditNotesSgst: Number(creditNotesSgst.toFixed(2)),
    creditNotesIgst: Number(creditNotesIgst.toFixed(2)),
    creditNotesTaxAmount,

    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    hsnSummary,
  };
}

export interface Gstr3bSummary {
  outwardTaxableValue: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardIgst: number;
  outwardTotalTax: number;

  itcTaxableValue: number;
  itcCgst: number;
  itcSgst: number;
  itcIgst: number;
  totalItc: number;

  netCgstPayable: number;
  netSgstPayable: number;
  netIgstPayable: number;
  netTotalPayable: number;
}

export function computeGSTR3BSummary(
  vouchers: TransactionVoucher[],
  ledgers: LedgerAccount[]
): Gstr3bSummary {
  const gstr1 = computeGSTR1Summary(vouchers, ledgers);

  let purchaseTaxable = 0;
  let purchaseCgst = 0;
  let purchaseSgst = 0;
  let purchaseIgst = 0;

  let debitNoteTaxable = 0;
  let debitNoteCgst = 0;
  let debitNoteSgst = 0;
  let debitNoteIgst = 0;

  for (const v of vouchers) {
    if (v.type === 'PURCHASE') {
      purchaseTaxable += v.subtotal;
      purchaseCgst += v.cgstTotal;
      purchaseSgst += v.sgstTotal;
      purchaseIgst += v.igstTotal;
    } else if (v.type === 'DEBIT_NOTE') {
      debitNoteTaxable += v.subtotal;
      debitNoteCgst += v.cgstTotal;
      debitNoteSgst += v.sgstTotal;
      debitNoteIgst += v.igstTotal;
    }
  }

  const itcTaxableValue = Number(Math.max(0, purchaseTaxable - debitNoteTaxable).toFixed(2));
  const itcCgst = Number(Math.max(0, purchaseCgst - debitNoteCgst).toFixed(2));
  const itcSgst = Number(Math.max(0, purchaseSgst - debitNoteSgst).toFixed(2));
  const itcIgst = Number(Math.max(0, purchaseIgst - debitNoteIgst).toFixed(2));
  const totalItc = Number((itcCgst + itcSgst + itcIgst).toFixed(2));

  const netCgstPayable = Number(Math.max(0, gstr1.totalCgst - itcCgst).toFixed(2));
  const netSgstPayable = Number(Math.max(0, gstr1.totalSgst - itcSgst).toFixed(2));
  const netIgstPayable = Number(Math.max(0, gstr1.totalIgst - itcIgst).toFixed(2));
  const netTotalPayable = Number((netCgstPayable + netSgstPayable + netIgstPayable).toFixed(2));

  return {
    outwardTaxableValue: gstr1.totalTaxable,
    outwardCgst: gstr1.totalCgst,
    outwardSgst: gstr1.totalSgst,
    outwardIgst: gstr1.totalIgst,
    outwardTotalTax: gstr1.totalTax,

    itcTaxableValue,
    itcCgst,
    itcSgst,
    itcIgst,
    totalItc,

    netCgstPayable,
    netSgstPayable,
    netIgstPayable,
    netTotalPayable,
  };
}

