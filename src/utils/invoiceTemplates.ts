import {
  InvoiceBlockConfig,
  InvoiceBlockType,
  InvoiceTemplateConfig
} from '../types/accounting';

export interface BlockPaletteItem {
  type: InvoiceBlockType;
  label: string;
  description: string;
  defaultConfig: Omit<InvoiceBlockConfig, 'id'>;
}

export const INVOICE_BLOCK_PALETTE: BlockPaletteItem[] = [
  {
    type: 'company_header',
    label: 'Business Header & Logo',
    description: 'Company name, GSTIN, address & phone',
    defaultConfig: {
      type: 'company_header',
      label: 'Business Header & Logo',
      visible: true,
      align: 'left',
      customHeading: 'TAX INVOICE',
    },
  },
  {
    type: 'invoice_meta',
    label: 'Invoice Metadata Strip',
    description: 'Invoice No, Date, Payment Mode & Ref No',
    defaultConfig: {
      type: 'invoice_meta',
      label: 'Invoice Metadata Strip',
      visible: true,
      align: 'left',
    },
  },
  {
    type: 'bill_to',
    label: 'Bill To / Customer Box',
    description: 'Customer / Guest name, GSTIN, phone & address',
    defaultConfig: {
      type: 'bill_to',
      label: 'Bill To / Customer Box',
      visible: true,
      align: 'left',
      customHeading: 'Billed To',
    },
  },
  {
    type: 'dispatch_info',
    label: 'Place of Supply Strip',
    description: 'State code, intra/inter-state & remarks',
    defaultConfig: {
      type: 'dispatch_info',
      label: 'Place of Supply Strip',
      visible: true,
      align: 'left',
    },
  },
  {
    type: 'items_table',
    label: 'Line Items Table',
    description: 'Products, HSN, qty, rate, discount & GST',
    defaultConfig: {
      type: 'items_table',
      label: 'Line Items Table',
      visible: true,
      showHsnColumn: true,
      showDiscountColumn: false,
      showTaxColumn: true,
      showUnitColumn: true,
    },
  },
  {
    type: 'totals_box',
    label: 'Tax & Grand Total Summary',
    description: 'Subtotal, CGST, SGST, IGST & Grand Total',
    defaultConfig: {
      type: 'totals_box',
      label: 'Tax & Grand Total Summary',
      visible: true,
      align: 'right',
    },
  },
  {
    type: 'amount_words',
    label: 'Amount in Words',
    description: 'Grand total written in Indian Rupees words',
    defaultConfig: {
      type: 'amount_words',
      label: 'Amount in Words',
      visible: true,
      align: 'left',
    },
  },
  {
    type: 'hsn_summary',
    label: 'HSN / SAC Tax Breakup',
    description: 'Tax summary table grouped by HSN slab',
    defaultConfig: {
      type: 'hsn_summary',
      label: 'HSN / SAC Tax Breakup',
      visible: true,
    },
  },
  {
    type: 'bank_qr',
    label: 'Bank Details & UPI QR Code',
    description: 'Scannable UPI QR + NEFT/IFSC details',
    defaultConfig: {
      type: 'bank_qr',
      label: 'Bank Details & UPI QR Code',
      visible: true,
      showQrCode: true,
      showBankDetails: true,
    },
  },
  {
    type: 'terms_signatory',
    label: 'Terms & Authorized Signatory',
    description: 'Terms & conditions with signature stamp box',
    defaultConfig: {
      type: 'terms_signatory',
      label: 'Terms & Authorized Signatory',
      visible: true,
    },
  },
  {
    type: 'custom_text',
    label: 'Custom Text / Footer Note',
    description: 'Editable greeting, warranty, or delivery note',
    defaultConfig: {
      type: 'custom_text',
      label: 'Custom Text / Footer Note',
      visible: true,
      align: 'center',
      customHeading: 'Note',
      customBody: 'Thank you for doing business with us!',
    },
  },
  {
    type: 'divider',
    label: 'Horizontal Divider Line',
    description: 'Clean visual separator between sections',
    defaultConfig: {
      type: 'divider',
      label: 'Horizontal Divider Line',
      visible: true,
    },
  },
];

export function createBlockInstance(type: InvoiceBlockType): InvoiceBlockConfig {
  const found = INVOICE_BLOCK_PALETTE.find(p => p.type === type);
  const base = found
    ? found.defaultConfig
    : { type, label: type, visible: true };
  return {
    ...base,
    id: `blk_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
}

export const STARTER_TEMPLATES: Record<'blank' | 'classic_gst' | 'compact_a5' | 'modern_minimal', InvoiceTemplateConfig> = {
  blank: {
    id: 'tpl_blank',
    name: 'Blank Canvas (From Scratch)',
    paperSize: 'A5',
    accentColor: '#0f172a',
    fontFamily: 'sans',
    borderStyle: 'sharp',
    density: 'comfortable',
    useAsDefault: false,
    blocks: [],
  },
  classic_gst: {
    id: 'tpl_classic_gst',
    name: 'Classic GST Tax Invoice',
    paperSize: 'A4',
    accentColor: '#1e3a8a',
    fontFamily: 'sans',
    borderStyle: 'sharp',
    density: 'comfortable',
    useAsDefault: true,
    blocks: [
      { id: 'b1', type: 'company_header', label: 'Business Header & Logo', visible: true, align: 'left', customHeading: 'TAX INVOICE' },
      { id: 'b2', type: 'invoice_meta', label: 'Invoice Metadata Strip', visible: true },
      { id: 'b3', type: 'bill_to', label: 'Bill To / Customer Box', visible: true, customHeading: 'Billed To' },
      { id: 'b4', type: 'items_table', label: 'Line Items Table', visible: true, showHsnColumn: true, showDiscountColumn: true, showTaxColumn: true, showUnitColumn: true },
      { id: 'b5', type: 'totals_box', label: 'Tax & Grand Total Summary', visible: true, align: 'right' },
      { id: 'b6', type: 'amount_words', label: 'Amount in Words', visible: true },
      { id: 'b7', type: 'hsn_summary', label: 'HSN / SAC Tax Breakup', visible: true },
      { id: 'b8', type: 'bank_qr', label: 'Bank Details & UPI QR Code', visible: true, showQrCode: true, showBankDetails: true },
      { id: 'b9', type: 'terms_signatory', label: 'Terms & Authorized Signatory', visible: true },
    ],
  },
  compact_a5: {
    id: 'tpl_compact_a5',
    name: 'Compact A5 Counter Bill',
    paperSize: 'A5',
    accentColor: '#0f172a',
    fontFamily: 'sans',
    borderStyle: 'sharp',
    density: 'compact',
    useAsDefault: true,
    blocks: [
      { id: 'c1', type: 'company_header', label: 'Business Header & Logo', visible: true, align: 'center', customHeading: 'RETAIL INVOICE' },
      { id: 'c2', type: 'invoice_meta', label: 'Invoice Metadata Strip', visible: true },
      { id: 'c3', type: 'bill_to', label: 'Bill To / Customer Box', visible: true, customHeading: 'Customer' },
      { id: 'c4', type: 'items_table', label: 'Line Items Table', visible: true, showHsnColumn: true, showDiscountColumn: false, showTaxColumn: true, showUnitColumn: true },
      { id: 'c5', type: 'totals_box', label: 'Tax & Grand Total Summary', visible: true, align: 'right' },
      { id: 'c6', type: 'bank_qr', label: 'Bank Details & UPI QR Code', visible: true, showQrCode: true, showBankDetails: false },
      { id: 'c7', type: 'custom_text', label: 'Custom Text / Footer Note', visible: true, align: 'center', customHeading: '', customBody: 'Thank you for shopping with Ghosh Agency!' },
    ],
  },
  modern_minimal: {
    id: 'tpl_modern_minimal',
    name: 'Modern Clean Invoice',
    paperSize: 'A4',
    accentColor: '#2563eb',
    fontFamily: 'sans',
    borderStyle: 'rounded',
    density: 'comfortable',
    useAsDefault: true,
    blocks: [
      { id: 'm1', type: 'company_header', label: 'Business Header & Logo', visible: true, align: 'left', customHeading: 'INVOICE' },
      { id: 'm2', type: 'divider', label: 'Horizontal Divider Line', visible: true },
      { id: 'm3', type: 'bill_to', label: 'Bill To / Customer Box', visible: true, customHeading: 'Bill To' },
      { id: 'm4', type: 'invoice_meta', label: 'Invoice Metadata Strip', visible: true },
      { id: 'm5', type: 'items_table', label: 'Line Items Table', visible: true, showHsnColumn: false, showDiscountColumn: false, showTaxColumn: true, showUnitColumn: true },
      { id: 'm6', type: 'totals_box', label: 'Tax & Grand Total Summary', visible: true, align: 'right' },
      { id: 'm7', type: 'amount_words', label: 'Amount in Words', visible: true },
      { id: 'm8', type: 'terms_signatory', label: 'Terms & Authorized Signatory', visible: true },
    ],
  },
};
