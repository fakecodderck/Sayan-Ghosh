import React from 'react';
import { FilePlus2, ArrowRight, LayoutTemplate } from 'lucide-react';
import { VoucherCreatorForm } from '../components/VoucherCreatorForm';
import { TransactionVoucher } from '../types/accounting';

interface CreateInvoiceViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onNavigateToInvoices: () => void;
  onNavigateToBuilder: () => void;
}

export const CreateInvoiceView: React.FC<CreateInvoiceViewProps> = ({
  onSelectVoucherForPrint,
  onNavigateToInvoices,
  onNavigateToBuilder,
}) => {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 theme-text" />
            <span>Create Invoice &amp; Billing</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bill an existing customer, add a new customer on the fly, or create a quick guest/walk-in bill
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToBuilder}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 theme-ring focus:outline-none"
          >
            <LayoutTemplate className="w-3.5 h-3.5 theme-text" />
            <span>Customize Format</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToInvoices}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 theme-ring focus:outline-none"
          >
            <span>All Invoices Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
        <VoucherCreatorForm
          initialType="SALE"
          initialIsGstBill={true}
          onSuccess={(voucher, shouldPrint) => {
            if (shouldPrint) {
              onSelectVoucherForPrint(voucher);
            }
          }}
        />
      </div>
    </div>
  );
};
