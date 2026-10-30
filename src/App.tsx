import React, { useState, useEffect } from 'react';
import { AccountingProvider } from './context/AccountingContext';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveModule } from './components/Sidebar';
import { DayBookView } from './views/DayBookView';
import { LedgersView } from './views/LedgersView';
import { PurchasesView } from './views/PurchasesView';
import { SalesView } from './views/SalesView';
import { InventoryView } from './views/InventoryView';
import { PaymentsReceiptsView } from './views/PaymentsReceiptsView';
import { CustomersView } from './views/CustomersView';
import { CompaniesView } from './views/CompaniesView';
import { GSTBillInvoiceView } from './views/GSTBillInvoiceView';
import { ProfitLossView } from './views/ProfitLossView';
import { CreditDebitNotesView } from './views/CreditDebitNotesView';
import { SettingsView } from './views/SettingsView';
import { NewVoucherModal } from './components/NewVoucherModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { TransactionVoucher, VoucherType } from './types/accounting';

import { useAccounting } from './context/AccountingContext';
import { applyThemeColor } from './utils/theme';

function MainApp() {
  const { settings } = useAccounting();
  const [activeModule, setActiveModule] = useState<ActiveModule>('daybook');
  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
  const [voucherModalType, setVoucherModalType] = useState<VoucherType>('SALE');
  const [voucherModalPartyId, setVoucherModalPartyId] = useState<string>('');
  const [voucherModalIsGstBill, setVoucherModalIsGstBill] = useState<boolean>(true);

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Bar with Mobile Hamburger */}
      <Navbar
        onOpenNewVoucher={() => handleOpenNewSale()}
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
              onOpenNewVoucher={() => handleOpenNewSale()}
            />
          )}

          {activeModule === 'ledgers' && <LedgersView />}

          {activeModule === 'purchases' && (
            <PurchasesView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewPurchase={handleOpenNewPurchase}
              onNavigateToCompany={() => setActiveModule('companies')}
            />
          )}

          {activeModule === 'sales' && (
            <SalesView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewSale={handleOpenNewSale}
              onNavigateToCustomer={() => setActiveModule('customers')}
            />
          )}

          {activeModule === 'inventory' && <InventoryView />}

          {activeModule === 'profit_loss' && <ProfitLossView />}

          {activeModule === 'payments' && (
            <PaymentsReceiptsView
              onOpenNewVoucher={handleOpenNewPayment}
              onSelectVoucherForPrint={handleOpenPrint}
            />
          )}

          {activeModule === 'customers' && (
            <CustomersView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewSale={handleOpenNewSale}
              onOpenNewReceipt={(partyId) => handleOpenNewPayment('RECEIPT', partyId)}
            />
          )}

          {activeModule === 'companies' && (
            <CompaniesView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewPurchase={handleOpenNewPurchase}
              onOpenNewPayment={(partyId) => handleOpenNewPayment('PAYMENT', partyId)}
            />
          )}

          {activeModule === 'gst_bill' && (
            <GSTBillInvoiceView
              onOpenNewInvoice={(isGst) => handleOpenNewSale(undefined, isGst)}
            />
          )}

          {activeModule === 'credit_debit' && (
            <CreditDebitNotesView
              onSelectVoucherForPrint={handleOpenPrint}
              onOpenNewVoucher={() => {
                setVoucherModalType('CREDIT_NOTE');
                setVoucherModalPartyId('');
                setShowNewVoucherModal(true);
              }}
            />
          )}

          {activeModule === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* New Voucher Creator Modal */}
      {showNewVoucherModal && (
        <NewVoucherModal
          initialType={voucherModalType}
          initialPartyId={voucherModalPartyId}
          initialIsGstBill={voucherModalIsGstBill}
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
