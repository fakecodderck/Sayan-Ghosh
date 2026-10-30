import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CompanySettings,
  InventoryItem,
  LedgerAccount,
  TransactionVoucher
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
  commitVoucherAtomicBatch,
  db,
  deleteInventoryItemFromFirestore,
  deleteLedgerFromFirestore,
  handleFirestoreError,
  OperationType,
  revertVoucherAtomicBatch,
  saveInventoryItemToFirestore,
  saveLedgerToFirestore,
  saveSettingsToFirestore,
  testConnection
} from '../services/firebase';
import {
  computeInventoryDeltas,
  computeLedgerDeltas,
  ensureSystemLedgers,
  generateJournalEntries
} from '../utils/doubleEntryEngine';

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
  VOUCHERS: 'apex_vouchers_v4',
  LEDGERS: 'apex_ledgers_v4',
  INVENTORY: 'apex_inventory_v4',
  SETTINGS: 'apex_settings_v4',
};

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize with clean local data and ensured system chart of accounts
  const [vouchers, setVouchers] = useState<TransactionVoucher[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.VOUCHERS);
      return saved ? JSON.parse(saved) : initialVouchers;
    } catch {
      return initialVouchers;
    }
  });

  const [ledgers, setLedgers] = useState<LedgerAccount[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LEDGERS);
      const parsed = saved ? JSON.parse(saved) : initialLedgers;
      return ensureSystemLedgers(parsed);
    } catch {
      return ensureSystemLedgers(initialLedgers);
    }
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.INVENTORY);
      return saved ? JSON.parse(saved) : initialInventory;
    } catch {
      return initialInventory;
    }
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : initialCompanySettings;
    } catch {
      return initialCompanySettings;
    }
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

  // Auth & Connection Check
  useEffect(() => {
    testConnection().then(connected => {
      setIsFirebaseConnected(connected);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async currentUser => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Attempt anonymous sign-in gracefully if enabled, otherwise fallback to guest mode
        try {
          const anon = await signInAnonymously(auth);
          setUser(anon.user);
        } catch {
          // Anonymous authentication not enabled on this project; proceed in secure offline/local mode
          setUser(null);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Firestore real-time updates ONLY when authenticated
  useEffect(() => {
    if (!user) {
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);

    const unsubVouchers = onSnapshot(
      collection(db, Collections.VOUCHERS),
      snapshot => {
        const cloudVouchers: TransactionVoucher[] = [];
        snapshot.forEach(docSnap => cloudVouchers.push(docSnap.data() as TransactionVoucher));
        if (cloudVouchers.length > 0) {
          setVouchers(cloudVouchers);
        }
        setIsSyncing(false);
      },
      error => {
        console.warn('Vouchers sync info:', error.message);
        setIsSyncing(false);
      }
    );

    const unsubLedgers = onSnapshot(
      collection(db, Collections.LEDGERS),
      snapshot => {
        const cloudLedgers: LedgerAccount[] = [];
        snapshot.forEach(docSnap => cloudLedgers.push(docSnap.data() as LedgerAccount));
        if (cloudLedgers.length > 0) {
          setLedgers(ensureSystemLedgers(cloudLedgers, user.uid));
        }
      },
      error => {
        console.warn('Ledgers sync info:', error.message);
      }
    );

    const unsubInventory = onSnapshot(
      collection(db, Collections.INVENTORY),
      snapshot => {
        const cloudInventory: InventoryItem[] = [];
        snapshot.forEach(docSnap => cloudInventory.push(docSnap.data() as InventoryItem));
        if (cloudInventory.length > 0) {
          setInventory(cloudInventory);
        }
      },
      error => {
        console.warn('Inventory sync info:', error.message);
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
        console.warn('Settings sync info:', error.message);
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

  /**
   * Atomic Double-Entry Voucher Creation
   */
  const addVoucher = async (voucherData: Omit<TransactionVoucher, 'id'>): Promise<string> => {
    const newId = `vouch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const companyId = user?.uid || settings.id || 'company_apex_01';

    // 1. Generate balanced journal entries
    const journalEntries = generateJournalEntries(voucherData, ledgers);

    const fullVoucher: TransactionVoucher = {
      ...voucherData,
      id: newId,
      companyId,
      journalEntries,
      createdAt: new Date().toISOString(),
    };

    // 2. Compute ledger adjustments from journal entries
    const ledgerDeltas = computeLedgerDeltas(journalEntries, false);
    const updatedLedgers = ledgers.map(l => {
      if (!ledgerDeltas.has(l.id)) return l;
      const delta = ledgerDeltas.get(l.id) || 0;
      return {
        ...l,
        currentBalance: Number(((l.currentBalance || 0) + delta).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
    });

    // 3. Compute inventory adjustments
    const itemDeltas = computeInventoryDeltas(fullVoucher, false);
    const updatedInventory = inventory.map(item => {
      if (!itemDeltas.has(item.id)) return item;
      const delta = itemDeltas.get(item.id) || 0;
      return {
        ...item,
        currentStock: Math.max(0, (item.currentStock || 0) + delta),
        updatedAt: new Date().toISOString(),
      };
    });

    // 4. Update local state immediately
    setInventory(updatedInventory);
    setLedgers(updatedLedgers);
    setVouchers(prev => [fullVoucher, ...prev]);

    // 5. Commit atomically to Firestore if authenticated
    if (user) {
      const affectedLedgers = updatedLedgers.filter(l => ledgerDeltas.has(l.id));
      const affectedItems = updatedInventory.filter(i => itemDeltas.has(i.id));

      try {
        await commitVoucherAtomicBatch(fullVoucher, affectedItems, affectedLedgers);
      } catch (err) {
        console.warn('Cloud batch sync pending, stored in local cache:', err);
      }
    }

    return newId;
  };

  /**
   * Atomic Double-Entry Voucher Deletion & Reversal
   */
  const deleteVoucher = async (id: string) => {
    const targetVoucher = vouchers.find(v => v.id === id);
    if (!targetVoucher) return;

    // 1. Compute reversal ledger adjustments
    const journalEntries = targetVoucher.journalEntries || generateJournalEntries(targetVoucher, ledgers);
    const reverseLedgerDeltas = computeLedgerDeltas(journalEntries, true); // true = reversal

    const restoredLedgers = ledgers.map(l => {
      if (!reverseLedgerDeltas.has(l.id)) return l;
      const delta = reverseLedgerDeltas.get(l.id) || 0;
      return {
        ...l,
        currentBalance: Number(((l.currentBalance || 0) + delta).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
    });

    // 2. Compute reversal inventory stock adjustments
    const reverseItemDeltas = computeInventoryDeltas(targetVoucher, true); // true = reversal
    const restoredInventory = inventory.map(item => {
      if (!reverseItemDeltas.has(item.id)) return item;
      const delta = reverseItemDeltas.get(item.id) || 0;
      return {
        ...item,
        currentStock: Math.max(0, (item.currentStock || 0) + delta),
        updatedAt: new Date().toISOString(),
      };
    });

    // 3. Update local state immediately
    setVouchers(prev => prev.filter(v => v.id !== id));
    setLedgers(restoredLedgers);
    setInventory(restoredInventory);

    // 4. Commit atomic batch reversal to Firestore if authenticated
    if (user) {
      const affectedLedgers = restoredLedgers.filter(l => reverseLedgerDeltas.has(l.id));
      const affectedItems = restoredInventory.filter(i => reverseItemDeltas.has(i.id));

      try {
        await revertVoucherAtomicBatch(id, affectedItems, affectedLedgers);
      } catch (err) {
        console.warn('Cloud reversal batch pending, restored in local cache:', err);
      }
    }
  };

  /**
   * Add Ledger with Duplicate Check
   */
  const addLedger = async (ledgerData: Omit<LedgerAccount, 'id'>): Promise<string> => {
    // Duplicate check within same group
    const duplicate = ledgers.find(
      l => l.group === ledgerData.group && l.name.trim().toLowerCase() === ledgerData.name.trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A ledger account "${ledgerData.name.trim()}" already exists in ${ledgerData.group}.`);
    }

    const newId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullLedger: LedgerAccount = {
      ...ledgerData,
      id: newId,
      companyId: user?.uid || settings.id,
      currentBalance: ledgerData.openingBalance || 0,
      createdAt: new Date().toISOString(),
    };

    setLedgers(prev => [fullLedger, ...prev]);
    if (user) {
      try {
        await saveLedgerToFirestore(fullLedger);
      } catch (err) {
        console.warn('Ledger saved in local storage, cloud sync pending:', err);
      }
    }
    return newId;
  };

  const updateLedger = async (updated: LedgerAccount) => {
    setLedgers(prev => prev.map(l => (l.id === updated.id ? updated : l)));
    if (user) {
      try {
        await saveLedgerToFirestore(updated);
      } catch (err) {
        console.warn('Ledger update saved locally:', err);
      }
    }
  };

  const deleteLedger = async (id: string) => {
    setLedgers(prev => prev.filter(l => l.id !== id));
    if (user) {
      try {
        await deleteLedgerFromFirestore(id);
      } catch (err) {
        console.warn('Ledger deleted locally:', err);
      }
    }
  };

  /**
   * Add Inventory Item with SKU & Name Duplicate Validation
   */
  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id'>): Promise<string> => {
    // Check duplicate SKU
    if (itemData.sku && itemData.sku.trim()) {
      const dupSku = inventory.find(
        i => i.sku.trim().toLowerCase() === itemData.sku.trim().toLowerCase()
      );
      if (dupSku) {
        throw new Error(`An item with SKU "${itemData.sku.trim()}" already exists (${dupSku.name}).`);
      }
    }

    // Check duplicate Name
    const dupName = inventory.find(
      i => i.name.trim().toLowerCase() === itemData.name.trim().toLowerCase()
    );
    if (dupName) {
      throw new Error(`An item named "${itemData.name.trim()}" already exists.`);
    }

    const newId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullItem: InventoryItem = {
      ...itemData,
      id: newId,
      companyId: user?.uid || settings.id,
      openingStock: itemData.openingStock ?? itemData.currentStock ?? 0,
      createdAt: new Date().toISOString(),
    };

    setInventory(prev => [fullItem, ...prev]);
    if (user) {
      try {
        await saveInventoryItemToFirestore(fullItem);
      } catch (err) {
        console.warn('Inventory item saved locally, cloud sync pending:', err);
      }
    }
    return newId;
  };

  const updateInventoryItem = async (updated: InventoryItem) => {
    setInventory(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    if (user) {
      try {
        await saveInventoryItemToFirestore(updated);
      } catch (err) {
        console.warn('Inventory update saved locally:', err);
      }
    }
  };

  const deleteInventoryItem = async (id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
    if (user) {
      try {
        await deleteInventoryItemFromFirestore(id);
      } catch (err) {
        console.warn('Inventory item deleted locally:', err);
      }
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
          updatedAt: new Date().toISOString(),
        };
        if (user) {
          saveInventoryItemToFirestore(updated).catch(e => console.warn(e));
        }
        return updated;
      })
    );
  };

  const updateSettings = async (updated: CompanySettings) => {
    setSettings(updated);
    if (user) {
      try {
        await saveSettingsToFirestore(updated);
      } catch (err) {
        console.warn('Settings saved locally:', err);
      }
    }
  };

  const resetToSampleData = () => {
    setVouchers(initialVouchers);
    setLedgers(ensureSystemLedgers(initialLedgers));
    setInventory(initialInventory);
    setSettings(initialCompanySettings);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.VOUCHERS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LEDGERS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.INVENTORY);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SETTINGS);
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
