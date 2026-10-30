import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
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
  deleteInventoryItemFromFirestore,
  deleteLedgerFromFirestore,
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
  deleteLedger: (id: string) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<string>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  updateStockQuantity: (itemId: string, deltaQty: number) => Promise<void>;
  updateSettings: (settings: CompanySettings) => Promise<void>;
  resetToSampleData: () => void;
  getLedgerById: (id?: string) => LedgerAccount | undefined;
  getItemById: (id?: string) => InventoryItem | undefined;
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
  VOUCHERS: 'apex_vouchers_v3',
  LEDGERS: 'apex_ledgers_v3',
  INVENTORY: 'apex_inventory_v3',
  SETTINGS: 'apex_settings_v3',
};

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize with clean local/seed data
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

  // Auth & Firestore real-time synchronization with auto anonymous sign in
  useEffect(() => {
    testConnection().then(connected => {
      setIsFirebaseConnected(connected);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser) {
        try {
          const anon = await signInAnonymously(auth);
          setUser(anon.user);
        } catch (err) {
          console.warn('Anonymous auth initialization:', err);
        }
      } else {
        setUser(currentUser);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Firestore real-time updates when authenticated
  useEffect(() => {
    if (!user) return;

    setIsSyncing(true);

    const unsubVouchers = onSnapshot(
      collection(db, Collections.VOUCHERS),
      snapshot => {
        const cloudVouchers: TransactionVoucher[] = [];
        snapshot.forEach(docSnap => cloudVouchers.push(docSnap.data() as TransactionVoucher));
        setVouchers(cloudVouchers);
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
        const cloudLedgers: LedgerAccount[] = [];
        snapshot.forEach(docSnap => cloudLedgers.push(docSnap.data() as LedgerAccount));
        if (cloudLedgers.length > 0) {
          setLedgers(cloudLedgers);
        } else {
          setLedgers(initialLedgers);
        }
      },
      error => {
        handleFirestoreError(error, OperationType.GET, Collections.LEDGERS);
      }
    );

    const unsubInventory = onSnapshot(
      collection(db, Collections.INVENTORY),
      snapshot => {
        const cloudInventory: InventoryItem[] = [];
        snapshot.forEach(docSnap => cloudInventory.push(docSnap.data() as InventoryItem));
        setInventory(cloudInventory);
      },
      error => {
        handleFirestoreError(error, OperationType.GET, Collections.INVENTORY);
      }
    );

    const unsubSettings = onSnapshot(
      collection(db, Collections.SETTINGS),
      snapshot => {
        if (!snapshot.empty) {
          const firstSettingDoc = snapshot.docs[0].data() as CompanySettings;
          if (firstSettingDoc && firstSettingDoc.name) {
            setSettings(firstSettingDoc);
          }
        }
      },
      error => {
        console.warn('Settings snapshot warn:', error);
      }
    );

    return () => {
      unsubVouchers();
      unsubLedgers();
      unsubInventory();
      unsubSettings();
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

    let updatedInventoryState = [...inventory];
    let updatedLedgerState = [...ledgers];

    // 1. Update Inventory Stock based on voucher type
    if (fullVoucher.type === 'SALE') {
      updatedInventoryState = updatedInventoryState.map(item => {
        const line = fullVoucher.items.find(it => it.itemId === item.id);
        if (!line) return item;
        return {
          ...item,
          currentStock: Math.max(0, (item.currentStock || 0) - line.qty),
        };
      });
    } else if (fullVoucher.type === 'PURCHASE') {
      updatedInventoryState = updatedInventoryState.map(item => {
        const line = fullVoucher.items.find(it => it.itemId === item.id);
        if (!line) return item;
        return {
          ...item,
          currentStock: (item.currentStock || 0) + line.qty,
        };
      });
    } else if (fullVoucher.type === 'CREDIT_NOTE') {
      updatedInventoryState = updatedInventoryState.map(item => {
        const line = fullVoucher.items.find(it => it.itemId === item.id);
        if (!line) return item;
        return {
          ...item,
          currentStock: (item.currentStock || 0) + line.qty,
        };
      });
    } else if (fullVoucher.type === 'DEBIT_NOTE') {
      updatedInventoryState = updatedInventoryState.map(item => {
        const line = fullVoucher.items.find(it => it.itemId === item.id);
        if (!line) return item;
        return {
          ...item,
          currentStock: Math.max(0, (item.currentStock || 0) - line.qty),
        };
      });
    }

    // 2. Update Ledger Balances (Double Entry Impact)
    if (fullVoucher.partyId) {
      updatedLedgerState = updatedLedgerState.map(l => {
        if (l.id !== fullVoucher.partyId) return l;

        let delta = 0;
        if (fullVoucher.type === 'SALE') {
          delta = fullVoucher.grandTotal;
        } else if (fullVoucher.type === 'RECEIPT') {
          delta = -fullVoucher.grandTotal;
        } else if (fullVoucher.type === 'PURCHASE') {
          delta = -fullVoucher.grandTotal;
        } else if (fullVoucher.type === 'PAYMENT') {
          delta = fullVoucher.grandTotal;
        } else if (fullVoucher.type === 'CREDIT_NOTE') {
          delta = -fullVoucher.grandTotal;
        } else if (fullVoucher.type === 'DEBIT_NOTE') {
          delta = fullVoucher.grandTotal;
        }

        return {
          ...l,
          currentBalance: Number((l.currentBalance + delta).toFixed(2)),
        };
      });
    }

    setInventory(updatedInventoryState);
    setLedgers(updatedLedgerState);
    setVouchers(prev => [fullVoucher, ...prev]);

    // 3. Firestore cloud persistence
    if (user) {
      try {
        await saveVoucherToFirestore(fullVoucher);

        // Also persist updated stock quantities for involved items
        for (const line of fullVoucher.items) {
          const updatedItem = updatedInventoryState.find(i => i.id === line.itemId);
          if (updatedItem) {
            await saveInventoryItemToFirestore(updatedItem);
          }
        }

        // Also persist updated party balance
        if (fullVoucher.partyId) {
          const updatedParty = updatedLedgerState.find(l => l.id === fullVoucher.partyId);
          if (updatedParty) {
            await saveLedgerToFirestore(updatedParty);
          }
        }
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

  const deleteLedger = async (id: string) => {
    setLedgers(prev => prev.filter(l => l.id !== id));
    if (user) {
      await deleteLedgerFromFirestore(id);
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

  const deleteInventoryItem = async (id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
    if (user) {
      await deleteInventoryItemFromFirestore(id);
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
        deleteLedger,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
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
