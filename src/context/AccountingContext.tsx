import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  CompanySettings,
  InventoryItem,
  LedgerAccount,
  TransactionVoucher,
  VoucherType
} from '../types/accounting';
import {
  initialCompanySettings,
  initialInventory,
  initialLedgers,
  initialVouchers
} from '../data/seedData';
import {
  auth,
  Collections,
  db,
  deleteVoucherFromFirestore,
  handleFirestoreError,
  OperationType,
  saveInventoryItemToFirestore,
  saveLedgerToFirestore,
  saveSettingsToFirestore,
  saveVoucherToFirestore,
  testConnection
} from '../services/firebase';

interface DateFilter {
  startDate: string;
  endDate: string;
}

interface AccountingContextType {
  vouchers: TransactionVoucher[];
  ledgers: LedgerAccount[];
  inventory: InventoryItem[];
  settings: CompanySettings;
  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;
  user: User | null;
  isFirebaseConnected: boolean;
  isSyncing: boolean;

  // Actions
  addVoucher: (voucher: Omit<TransactionVoucher, 'id'>) => Promise<string>;
  deleteVoucher: (id: string) => Promise<void>;
  addLedger: (ledger: Omit<LedgerAccount, 'id'>) => Promise<string>;
  updateLedger: (ledger: LedgerAccount) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<string>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
  updateStockQuantity: (itemId: string, deltaQty: number) => Promise<void>;
  updateSettings: (settings: CompanySettings) => Promise<void>;
  resetToSampleData: () => void;
  getLedgerById: (id?: string) => LedgerAccount | undefined;
  getItemById: (id?: string) => InventoryItem | undefined;
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
  VOUCHERS: 'apex_vouchers_v2',
  LEDGERS: 'apex_ledgers_v2',
  INVENTORY: 'apex_inventory_v2',
  SETTINGS: 'apex_settings_v2',
};

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize with local/seed data
  const [vouchers, setVouchers] = useState<TransactionVoucher[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.VOUCHERS);
    return saved ? JSON.parse(saved) : initialVouchers;
  });

  const [ledgers, setLedgers] = useState<LedgerAccount[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LEDGERS);
    return saved ? JSON.parse(saved) : initialLedgers;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.INVENTORY);
    return saved ? JSON.parse(saved) : initialInventory;
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : initialCompanySettings;
  });

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Local storage persistence backup
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.VOUCHERS, JSON.stringify(vouchers));
  }, [vouchers]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.LEDGERS, JSON.stringify(ledgers));
  }, [ledgers]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Auth & Firestore real-time synchronization
  useEffect(() => {
    testConnection().then(connected => {
      setIsFirebaseConnected(connected);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Firestore if authenticated
  useEffect(() => {
    if (!user) return;

    setIsSyncing(true);

    const unsubVouchers = onSnapshot(
      collection(db, Collections.VOUCHERS),
      snapshot => {
        if (!snapshot.empty) {
          const cloudVouchers: TransactionVoucher[] = [];
          snapshot.forEach(docSnap => cloudVouchers.push(docSnap.data() as TransactionVoucher));
          setVouchers(cloudVouchers);
        }
        setIsSyncing(false);
      },
      error => {
        handleFirestoreError(error, OperationType.GET, Collections.VOUCHERS);
        setIsSyncing(false);
      }
    );

    const unsubLedgers = onSnapshot(
      collection(db, Collections.LEDGERS),
      snapshot => {
        if (!snapshot.empty) {
          const cloudLedgers: LedgerAccount[] = [];
          snapshot.forEach(docSnap => cloudLedgers.push(docSnap.data() as LedgerAccount));
          setLedgers(cloudLedgers);
        }
      },
      error => {
        handleFirestoreError(error, OperationType.GET, Collections.LEDGERS);
      }
    );

    const unsubInventory = onSnapshot(
      collection(db, Collections.INVENTORY),
      snapshot => {
        if (!snapshot.empty) {
          const cloudInventory: InventoryItem[] = [];
          snapshot.forEach(docSnap => cloudInventory.push(docSnap.data() as InventoryItem));
          setInventory(cloudInventory);
        }
      },
      error => {
        handleFirestoreError(error, OperationType.GET, Collections.INVENTORY);
      }
    );

    return () => {
      unsubVouchers();
      unsubLedgers();
      unsubInventory();
    };
  }, [user]);

  // Helpers
  const getLedgerById = (id?: string) => ledgers.find(l => l.id === id);
  const getItemById = (id?: string) => inventory.find(i => i.id === id);

  // Recalculate party current balance and inventory counts
  const addVoucher = async (voucherData: Omit<TransactionVoucher, 'id'>): Promise<string> => {
    const newId = `vouch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullVoucher: TransactionVoucher = {
      ...voucherData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    // 1. Update Inventory Stock based on voucher type
    if (fullVoucher.type === 'SALE') {
      setInventory(prev =>
        prev.map(item => {
          const line = fullVoucher.items.find(it => it.itemId === item.id);
          if (!line) return item;
          return {
            ...item,
            currentStock: Math.max(0, (item.currentStock || 0) - line.qty),
          };
        })
      );
    } else if (fullVoucher.type === 'PURCHASE') {
      setInventory(prev =>
        prev.map(item => {
          const line = fullVoucher.items.find(it => it.itemId === item.id);
          if (!line) return item;
          return {
            ...item,
            currentStock: (item.currentStock || 0) + line.qty,
          };
        })
      );
    } else if (fullVoucher.type === 'CREDIT_NOTE') {
      // Sales Return: add returned items back to stock
      setInventory(prev =>
        prev.map(item => {
          const line = fullVoucher.items.find(it => it.itemId === item.id);
          if (!line) return item;
          return {
            ...item,
            currentStock: (item.currentStock || 0) + line.qty,
          };
        })
      );
    } else if (fullVoucher.type === 'DEBIT_NOTE') {
      // Purchase Return: reduce stock
      setInventory(prev =>
        prev.map(item => {
          const line = fullVoucher.items.find(it => it.itemId === item.id);
          if (!line) return item;
          return {
            ...item,
            currentStock: Math.max(0, (item.currentStock || 0) - line.qty),
          };
        })
      );
    }

    // 2. Update Ledger Balances (Double Entry Impact)
    if (fullVoucher.partyId) {
      setLedgers(prev =>
        prev.map(l => {
          if (l.id !== fullVoucher.partyId) return l;

          let delta = 0;
          if (fullVoucher.type === 'SALE') {
            // Sale to Customer increases Debt (debit)
            delta = fullVoucher.grandTotal;
          } else if (fullVoucher.type === 'RECEIPT') {
            // Receipt from Customer decreases Debt (credit)
            delta = -fullVoucher.grandTotal;
          } else if (fullVoucher.type === 'PURCHASE') {
            // Purchase from Supplier increases our Payable (credit/negative balance)
            delta = -fullVoucher.grandTotal;
          } else if (fullVoucher.type === 'PAYMENT') {
            // Payment to Supplier reduces our Payable (debit/positive delta)
            delta = fullVoucher.grandTotal;
          } else if (fullVoucher.type === 'CREDIT_NOTE') {
            // Credit Note reduces Customer Debt
            delta = -fullVoucher.grandTotal;
          } else if (fullVoucher.type === 'DEBIT_NOTE') {
            // Debit Note reduces Supplier Payable
            delta = fullVoucher.grandTotal;
          }

          return {
            ...l,
            currentBalance: Number((l.currentBalance + delta).toFixed(2)),
          };
        })
      );
    }

    // 3. Add to voucher register
    setVouchers(prev => [fullVoucher, ...prev]);

    // 4. Cloud sync if signed in
    if (user) {
      try {
        await saveVoucherToFirestore(fullVoucher);
      } catch (err) {
        console.warn('Voucher saved locally, cloud sync pending:', err);
      }
    }

    return newId;
  };

  const deleteVoucher = async (id: string) => {
    setVouchers(prev => prev.filter(v => v.id !== id));
    if (user) {
      try {
        await deleteVoucherFromFirestore(id);
      } catch (err) {
        console.warn('Voucher deleted locally:', err);
      }
    }
  };

  const addLedger = async (ledgerData: Omit<LedgerAccount, 'id'>): Promise<string> => {
    const newId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullLedger: LedgerAccount = {
      ...ledgerData,
      id: newId,
      currentBalance: ledgerData.openingBalance || 0,
      createdAt: new Date().toISOString(),
    };

    setLedgers(prev => [fullLedger, ...prev]);
    if (user) {
      await saveLedgerToFirestore(fullLedger);
    }
    return newId;
  };

  const updateLedger = async (updated: LedgerAccount) => {
    setLedgers(prev => prev.map(l => (l.id === updated.id ? updated : l)));
    if (user) {
      await saveLedgerToFirestore(updated);
    }
  };

  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id'>): Promise<string> => {
    const newId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullItem: InventoryItem = {
      ...itemData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setInventory(prev => [fullItem, ...prev]);
    if (user) {
      await saveInventoryItemToFirestore(fullItem);
    }
    return newId;
  };

  const updateInventoryItem = async (updated: InventoryItem) => {
    setInventory(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    if (user) {
      await saveInventoryItemToFirestore(updated);
    }
  };

  const updateStockQuantity = async (itemId: string, deltaQty: number) => {
    setInventory(prev =>
      prev.map(i => {
        if (i.id !== itemId) return i;
        const current = i.currentStock || 0;
        const updated = {
          ...i,
          currentStock: Math.max(0, current + deltaQty),
        };
        if (user) {
          saveInventoryItemToFirestore(updated);
        }
        return updated;
      })
    );
  };

  const updateSettings = async (updated: CompanySettings) => {
    setSettings(updated);
    if (user) {
      await saveSettingsToFirestore(updated);
    }
  };

  const resetToSampleData = () => {
    setVouchers(initialVouchers);
    setLedgers(initialLedgers);
    setInventory(initialInventory);
    setSettings(initialCompanySettings);
    localStorage.clear();
  };

  return (
    <AccountingContext.Provider
      value={{
        vouchers,
        ledgers,
        inventory,
        settings,
        dateFilter,
        setDateFilter,
        user,
        isFirebaseConnected,
        isSyncing,
        addVoucher,
        deleteVoucher,
        addLedger,
        updateLedger,
        addInventoryItem,
        updateInventoryItem,
        updateStockQuantity,
        updateSettings,
        resetToSampleData,
        getLedgerById,
        getItemById,
      }}
    >
      {children}
    </AccountingContext.Provider>
  );
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider');
  }
  return context;
};
