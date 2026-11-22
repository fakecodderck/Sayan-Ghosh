import React, { useEffect } from 'react';
import { X, FileCheck, Edit2 } from 'lucide-react';
import { TransactionVoucher, VoucherType } from '../types/accounting';
import { VoucherCreatorForm } from './VoucherCreatorForm';

interface NewVoucherModalProps {
  initialType?: VoucherType;
  initialPartyId?: string;
  initialIsGstBill?: boolean;
  editingVoucher?: TransactionVoucher;
  onClose: () => void;
  onSuccess?: (voucher: TransactionVoucher, shouldPrint?: boolean) => void;
}

export const NewVoucherModal: React.FC<NewVoucherModalProps> = ({
  initialType = 'SALE',
  initialPartyId = '',
  initialIsGstBill = true,
  editingVoucher,
  onClose,
  onSuccess,
}) => {
  const isEditMode = Boolean(editingVoucher);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 my-6 sm:my-8 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 theme-soft-badge rounded-lg shrink-0">
              {isEditMode ? <Edit2 className="w-5 h-5" /> : <FileCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                {isEditMode ? `Edit Invoice #${editingVoucher?.voucherNo}` : 'New Invoice'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEditMode
                  ? 'Changes automatically recalculate ledger balances & inventory stock in Firebase'
                  : 'Double-Entry Posting & Auto Inventory Balance'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 max-h-[82vh] overflow-y-auto">
          <VoucherCreatorForm
            key={editingVoucher ? `edit_${editingVoucher.id}` : `new_${initialType}_${initialPartyId}`}
            initialType={initialType}
            initialPartyId={initialPartyId}
            initialIsGstBill={initialIsGstBill}
            editingVoucher={editingVoucher}
            onCancel={onClose}
            onSuccess={(voucher, shouldPrint) => {
              if (onSuccess) onSuccess(voucher, shouldPrint);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
