import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AccountingProvider, useAccounting } from './context/AccountingContext';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveModule } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { DayBookView } from './views/DayBookView';
import { LedgersView } from './views/LedgersView';
import { InvoicesRegisterView } from './views/InvoicesRegisterView';
import { PurchasesView } from './views/PurchasesView';
import { SalesView } from './views/SalesView';
import { InventoryView } from './views/InventoryView';
import { AddProductView } from './views/AddProductView';
import { CreateInvoiceView } from './views/CreateInvoiceView';
import { InvoiceBuilderView } from './views/InvoiceBuilderView';
import { PaymentsReceiptsView } from './views/PaymentsReceiptsView';
import { CustomersView } from './views/CustomersView';
import { CompaniesView } from './views/CompaniesView';
import { GSTBillInvoiceView } from './views/GSTBillInvoiceView';
import { GSTRReportsView } from './views/GSTRReportsView';
import { ProfitLossView } from './views/ProfitLossView';
import { CreditDebitNotesView } from './views/CreditDebitNotesView';
import { SettingsView } from './views/SettingsView';
import { NewVoucherModal } from './components/NewVoucherModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { TransactionVoucher, VoucherType } from './types/accounting';
import { applyThemeColor } from './utils/theme';

function MainApp() {
  const { settings, lastError, clearError } = useAccounting();
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
  const [voucherModalType, setVoucherModalType] = useState<VoucherType>('SALE');
  const [voucherModalPartyId, setVoucherModalPartyId] = useState<string>('');
  const [voucherModalIsGstBill, setVoucherModalIsGstBill] = useState<boolean>(true);

  const [focusedCustomerId, setFocusedCustomerId] = useState<string>('');
  const [focusedCompanyId, setFocusedCompanyId] = useState<string>('');

  const [printingVoucher, setPrintingVoucher] = useState<TransactionVoucher | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('apex_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('apex_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('apex_dark_mode', 'false');
    }
  }, [darkMode]);

  useEffect(() => {
    applyThemeColor(settings.themeColor || 'blue');
  }, [settings.themeColor]);

  useEffect(() => {
    document.title = settings.name?.trim() || 'Ghosh Agency';
  }, [settings.name]);

  const handleOpenPrint = (voucher: TransactionVoucher) => {
    setPrintingVoucher(voucher);
  };

  const handleOpenNewSale = (partyId?: string, isGst: boolean = true) => {
    setVoucherModalType('SALE');
    setVoucherModalPartyId(partyId || '');
    setVoucherModalIsGstBill(isGst);
    setShowNewVoucherModal(true);
  };

  const handleOpenNewPurchase = (partyId?: string) => {
    setVoucherModalType('PURCHASE');
    setVoucherModalPartyId(partyId || '');
    setVoucherModalIsGstBill(true);
    setShowNewVoucherModal(true);
  };

  const handleOpenNewPayment = (type: 'PAYMENT' | 'RECEIPT' = 'RECEIPT', partyId?: string) => {
    setVoucherModalType(type);
    setVoucherModalPartyId(partyId || '');
    setShowNewVoucherModal(true);
  };

  const handleNavigateCustomer = (customerId?: string) => {
    setFocusedCustomerId(customerId || '');
    setActiveModule('customers');
  };

  const handleNavigateCompany = (companyId?: string) => {
    setFocusedCompanyId(companyId || '');
    setActiveModule('companies');
  };

  return (
    <div className="print-app-shell min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans overflow-x-hidden w-full">
      {/* Main app shell is hidden from @media print whenever the InvoicePrintModal is open */}
      <div className={printingVoucher ? 'app-printing-hidden flex-1 flex flex-col w-full' : 'print-app-shell flex-1 flex flex-col w-full'}>
        <Navbar
          onOpenNewVoucher={() => setActiveModule('create_invoice')}
          onNavigate={setActiveModule}
          onSelectCustomer={handleNavigateCustomer}
          onSelectCompany={handleNavigateCompany}
          onSelectVoucherForPrint={handleOpenPrint}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

        <div className="print-flex-reset flex-1 flex w-full">
          <Sidebar
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />

          <main className="print-main-reset flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
            {lastError && (
              <div className="no-print mb-5 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="truncate font-medium">{lastError}</span>
                </div>
                <button
                  type="button"
                  onClick={clearError}
                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md shrink-0"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {activeModule === 'dashboard' && (
              <DashboardView
                onNavigate={setActiveModule}
                onSelectCustomer={handleNavigateCustomer}
                onOpenNewVoucher={(type) => {
                  setVoucherModalType(type);
                  setVoucherModalPartyId('');
                  setVoucherModalIsGstBill(true);
                  setShowNewVoucherModal(true);
                }}
                onSelectVoucherForPrint={handleOpenPrint}
              />
            )}

            {activeModule === 'create_invoice' && (
              <CreateInvoiceView
                onSelectVoucherForPrint={handleOpenPrint}
                onNavigateToInvoices={() => setActiveModule('all_invoices')}
                onNavigateToBuilder={() => setActiveModule('invoice_builder')}
              />
            )}

            {activeModule === 'daybook' && (
              <DayBookView
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewVoucher={() => handleOpenNewSale()}
              />
            )}

            {activeModule === 'ledgers' && <LedgersView />}

            {activeModule === 'all_invoices' && (
              <InvoicesRegisterView
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewSale={() => setActiveModule('create_invoice')}
                onOpenNewPurchase={() => handleOpenNewPurchase()}
              />
            )}

            {activeModule === 'purchases' && (
              <PurchasesView
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewPurchase={handleOpenNewPurchase}
                onNavigateToCompany={handleNavigateCompany}
              />
            )}

            {activeModule === 'sales' && (
              <SalesView
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewSale={handleOpenNewSale}
                onNavigateToCustomer={handleNavigateCustomer}
              />
            )}

            {activeModule === 'add_product' && (
              <AddProductView onNavigateToInventory={() => setActiveModule('inventory')} />
            )}

            {activeModule === 'inventory' && (
              <InventoryView onNavigateToAddProduct={() => setActiveModule('add_product')} />
            )}

            {activeModule === 'profit_loss' && <ProfitLossView />}

            {activeModule === 'payments' && (
              <PaymentsReceiptsView
                onOpenNewVoucher={handleOpenNewPayment}
                onSelectVoucherForPrint={handleOpenPrint}
              />
            )}

            {activeModule === 'customers' && (
              <CustomersView
                initialCustomerId={focusedCustomerId}
                onClearInitialCustomer={() => setFocusedCustomerId('')}
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewSale={handleOpenNewSale}
                onOpenNewReceipt={(partyId) => handleOpenNewPayment('RECEIPT', partyId)}
              />
            )}

            {activeModule === 'companies' && (
              <CompaniesView
                initialCompanyId={focusedCompanyId}
                onClearInitialCompany={() => setFocusedCompanyId('')}
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewPurchase={handleOpenNewPurchase}
                onOpenNewPayment={(partyId) => handleOpenNewPayment('PAYMENT', partyId)}
              />
            )}

            {activeModule === 'invoice_builder' && (
              <InvoiceBuilderView onPrintVoucher={handleOpenPrint} />
            )}

            {activeModule === 'gst_bill' && (
              <GSTBillInvoiceView
                onOpenNewInvoice={() => setActiveModule('create_invoice')}
                onOpenBuilder={() => setActiveModule('invoice_builder')}
              />
            )}

            {activeModule === 'gstr_reports' && <GSTRReportsView />}

            {activeModule === 'credit_debit' && (
              <CreditDebitNotesView
                onSelectVoucherForPrint={handleOpenPrint}
                onOpenNewVoucher={(noteType) => {
                  setVoucherModalType(noteType);
                  setVoucherModalPartyId('');
                  setVoucherModalIsGstBill(true);
                  setShowNewVoucherModal(true);
                }}
              />
            )}

            {activeModule === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>

      {showNewVoucherModal && (
        <NewVoucherModal
          initialType={voucherModalType}
          initialPartyId={voucherModalPartyId}
          initialIsGstBill={voucherModalIsGstBill}
          onClose={() => setShowNewVoucherModal(false)}
          onSuccess={(voucher, shouldPrint) => {
            if (shouldPrint) {
              setPrintingVoucher(voucher);
            }
          }}
        />
      )}

      {printingVoucher && (
        <InvoicePrintModal
          voucher={printingVoucher}
          onClose={() => setPrintingVoucher(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AccountingProvider>
      <MainApp />
    </AccountingProvider>
  );
}
