import React, { useState, useEffect } from 'react';
import { AccountingProvider } from './context/AccountingContext';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveModule } from './components/Sidebar';
import { DayBookView } from './views/DayBookView';
import { LedgersView } from './views/LedgersView';
import { SalesPurchaseView } from './views/SalesPurchaseView';
import { InventoryView } from './views/InventoryView';
import { PaymentsReceiptsView } from './views/PaymentsReceiptsView';
import { CreditDebitNotesView } from './views/CreditDebitNotesView';
import { GSTBillInvoiceView } from './views/GSTBillInvoiceView';
import { ProfitLossView } from './views/ProfitLossView';
import { GSTRReportsView } from './views/GSTRReportsView';
import { SettingsView } from './views/SettingsView';
import { NewVoucherModal } from './components/NewVoucherModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { TransactionVoucher } from './types/accounting';

function MainApp() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('daybook');
  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
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

  const handleOpenPrint = (voucher: TransactionVoucher) => {
    setPrintingVoucher(voucher);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Bar with Mobile Hamburger */}
      <Navbar
        onOpenNewVoucher={() => setShowNewVoucherModal(true)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex w-full">
        {/* Responsive Sidebar & Mobile Drawer */}
        <Sidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

        {/* Viewport Canvas (Responsive padding for mobile/tablet) */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {activeModule === 'daybook' && (
            <DayBookView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewVoucher={() => setShowNewVoucherModal(true)}
            />
          )}

          {activeModule === 'ledgers' && <LedgersView />}

          {activeModule === 'sales_purchase' && (
            <SalesPurchaseView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewVoucher={() => setShowNewVoucherModal(true)}
            />
          )}

          {activeModule === 'inventory' && <InventoryView />}

          {activeModule === 'payments' && (
            <PaymentsReceiptsView
              onOpenNewVoucher={() => setShowNewVoucherModal(true)}
              onSelectVoucherForPrint={handleOpenPrint}
            />
          )}

          {activeModule === 'credit_debit' && (
            <CreditDebitNotesView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewVoucher={() => setShowNewVoucherModal(true)}
            />
          )}

          {activeModule === 'gst_bill' && <GSTBillInvoiceView />}

          {activeModule === 'profit_loss' && <ProfitLossView />}

          {activeModule === 'gstr_reports' && <GSTRReportsView />}

          {activeModule === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* New Voucher Creator Modal */}
      {showNewVoucherModal && (
        <NewVoucherModal
          onClose={() => setShowNewVoucherModal(false)}
        />
      )}

      {/* Invoice Print & Preview Modal (A5 Optimized) */}
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
