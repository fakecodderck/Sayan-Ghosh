import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
  batchSeedDocumentsToFirestore,
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
  isFirebaseConnected: boolean;
  isSyncing: boolean;
  lastError: string | null;
  clearError: () => void;

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
  SYNCED_VOUCHERS: 'apex_synced_vouchers_v1',
  SYNCED_LEDGERS: 'apex_synced_ledgers_v1',
  SYNCED_INVENTORY: 'apex_synced_inventory_v1',
  SYNCED_SETTINGS: 'apex_synced_settings_v1',
};

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const clearError = () => setLastError(null);

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
      if (!saved) return initialCompanySettings;
      const parsed = JSON.parse(saved) as CompanySettings;
      if (!parsed.name?.trim() || /^apex\b/i.test(parsed.name.trim())) {
        return {
          ...parsed,
          name: 'Ghosh Agency',
          authorizedSignatoryTitle:
            !parsed.authorizedSignatoryTitle || /apex/i.test(parsed.authorizedSignatoryTitle)
              ? 'For Ghosh Agency'
              : parsed.authorizedSignatoryTitle,
        };
      }
      return parsed;
    } catch {
      return initialCompanySettings;
    }
  });

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Keep refs of latest local state for initial one-time cloud bootstrap
  const latestVouchersRef = useRef(vouchers);
  latestVouchersRef.current = vouchers;
  const latestLedgersRef = useRef(ledgers);
  latestLedgersRef.current = ledgers;
  const latestInventoryRef = useRef(inventory);
  latestInventoryRef.current = inventory;
  const latestSettingsRef = useRef(settings);
  latestSettingsRef.current = settings;

  // Local storage persistence backup (instant offline/cache recovery)
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

  // Direct passwordless Firebase Firestore real-time synchronization
  useEffect(() => {
    testConnection().then(connected => {
      setIsFirebaseConnected(connected);
    });

    setIsSyncing(true);

    const unsubVouchers = onSnapshot(
      collection(db, Collections.VOUCHERS),
      snapshot => {
        const cloudVouchers: TransactionVoucher[] = [];
        snapshot.forEach(docSnap => cloudVouchers.push(docSnap.data() as TransactionVoucher));
        cloudVouchers.sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        const hasSyncedBefore = localStorage.getItem(LOCAL_STORAGE_KEYS.SYNCED_VOUCHERS) === 'true';
        if (
          !snapshot.metadata.fromCache &&
          cloudVouchers.length === 0 &&
          !hasSyncedBefore &&
          latestVouchersRef.current.length > 0
        ) {
          // Migrate any pre-existing local vouchers up to Firebase on first connection
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_VOUCHERS, 'true');
          batchSeedDocumentsToFirestore(Collections.VOUCHERS, latestVouchersRef.current).catch(err =>
            console.warn('Initial voucher migration failed:', err)
          );
        } else if (cloudVouchers.length > 0 || !snapshot.metadata.fromCache) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_VOUCHERS, 'true');
          setVouchers(cloudVouchers);
        }

        if (!snapshot.metadata.fromCache) {
          setIsFirebaseConnected(true);
        }
        setIsSyncing(false);
      },
      error => {
        setIsSyncing(false);
        try {
          handleFirestoreError(error, OperationType.GET, Collections.VOUCHERS);
        } catch {
          // Structured error already logged
        }
      }
    );

    const unsubLedgers = onSnapshot(
      collection(db, Collections.LEDGERS),
      snapshot => {
        const cloudLedgers: LedgerAccount[] = [];
        snapshot.forEach(docSnap => cloudLedgers.push(docSnap.data() as LedgerAccount));

        const hasSyncedBefore = localStorage.getItem(LOCAL_STORAGE_KEYS.SYNCED_LEDGERS) === 'true';
        if (
          !snapshot.metadata.fromCache &&
          cloudLedgers.length === 0 &&
          !hasSyncedBefore &&
          latestLedgersRef.current.length > 0
        ) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_LEDGERS, 'true');
          batchSeedDocumentsToFirestore(Collections.LEDGERS, latestLedgersRef.current).catch(err =>
            console.warn('Initial ledger migration failed:', err)
          );
        } else if (cloudLedgers.length > 0 || !snapshot.metadata.fromCache) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_LEDGERS, 'true');
          setLedgers(ensureSystemLedgers(cloudLedgers, latestSettingsRef.current.id));
        }
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.GET, Collections.LEDGERS);
        } catch {
          // Structured error already logged
        }
      }
    );

    const unsubInventory = onSnapshot(
      collection(db, Collections.INVENTORY),
      snapshot => {
        const cloudInventory: InventoryItem[] = [];
        snapshot.forEach(docSnap => cloudInventory.push(docSnap.data() as InventoryItem));

        const hasSyncedBefore = localStorage.getItem(LOCAL_STORAGE_KEYS.SYNCED_INVENTORY) === 'true';
        if (
          !snapshot.metadata.fromCache &&
          cloudInventory.length === 0 &&
          !hasSyncedBefore &&
          latestInventoryRef.current.length > 0
        ) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_INVENTORY, 'true');
          batchSeedDocumentsToFirestore(Collections.INVENTORY, latestInventoryRef.current).catch(err =>
            console.warn('Initial inventory migration failed:', err)
          );
        } else if (cloudInventory.length > 0 || !snapshot.metadata.fromCache) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_INVENTORY, 'true');
          setInventory(cloudInventory);
        }
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.GET, Collections.INVENTORY);
        } catch {
          // Structured error already logged
        }
      }
    );

    const unsubSettings = onSnapshot(
      collection(db, Collections.SETTINGS),
      snapshot => {
        if (!snapshot.empty) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_SETTINGS, 'true');
          const firstSettingDoc = snapshot.docs[0].data() as CompanySettings;
          if (firstSettingDoc) {
            const isLegacyPlaceholder =
              !firstSettingDoc.name?.trim() || /^apex\b/i.test(firstSettingDoc.name.trim());
            const normalizedSettings: CompanySettings = isLegacyPlaceholder
              ? {
                  ...firstSettingDoc,
                  name: 'Ghosh Agency',
                  authorizedSignatoryTitle:
                    !firstSettingDoc.authorizedSignatoryTitle || /apex/i.test(firstSettingDoc.authorizedSignatoryTitle)
                      ? 'For Ghosh Agency'
                      : firstSettingDoc.authorizedSignatoryTitle,
                }
              : firstSettingDoc;
            setSettings(normalizedSettings);
            if (isLegacyPlaceholder) {
              saveSettingsToFirestore(normalizedSettings).catch(() => {});
            }
          }
        } else if (
          !snapshot.metadata.fromCache &&
          localStorage.getItem(LOCAL_STORAGE_KEYS.SYNCED_SETTINGS) !== 'true'
        ) {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_SETTINGS, 'true');
          saveSettingsToFirestore(latestSettingsRef.current).catch(err =>
            console.warn('Initial settings seed failed:', err)
          );
        }
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.GET, Collections.SETTINGS);
        } catch {
          // Structured error already logged
        }
      }
    );

    return () => {
      unsubVouchers();
      unsubLedgers();
      unsubInventory();
      unsubSettings();
    };
  }, []);

  // Helpers
  const getLedgerById = (id?: string) => ledgers.find(l => l.id === id);
  const getItemById = (id?: string) => inventory.find(i => i.id === id);

  /**
   * Atomic Double-Entry Voucher Creation (Saved directly to Firebase Firestore)
   */
  const addVoucher = async (voucherData: Omit<TransactionVoucher, 'id'>): Promise<string> => {
    const newId = `vouch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const companyId = latestSettingsRef.current.id || 'company_ghosh_01';
    const currentLedgers = latestLedgersRef.current;
    const currentInventory = latestInventoryRef.current;

    // 1. Generate balanced journal entries
    const journalEntries = generateJournalEntries(voucherData, currentLedgers);

    const fullVoucher: TransactionVoucher = {
      ...voucherData,
      id: newId,
      companyId,
      journalEntries,
      createdAt: new Date().toISOString(),
    };

    // 2. Compute ledger adjustments from journal entries
    const ledgerDeltas = computeLedgerDeltas(journalEntries, false);
    const updatedLedgers = currentLedgers.map(l => {
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
    const updatedInventory = currentInventory.map(item => {
      if (!itemDeltas.has(item.id)) return item;
      const delta = itemDeltas.get(item.id) || 0;
      return {
        ...item,
        currentStock: Math.max(0, (item.currentStock || 0) + delta),
        updatedAt: new Date().toISOString(),
      };
    });

    // 4. Update refs and local state immediately for snappy UX
    latestInventoryRef.current = updatedInventory;
    latestLedgersRef.current = updatedLedgers;
    latestVouchersRef.current = [fullVoucher, ...latestVouchersRef.current];
    setInventory(updatedInventory);
    setLedgers(updatedLedgers);
    setVouchers(prev => [fullVoucher, ...prev]);

    // 5. Commit atomically to Firestore
    const affectedLedgers = updatedLedgers.filter(l => ledgerDeltas.has(l.id));
    const affectedItems = updatedInventory.filter(i => itemDeltas.has(i.id));

    try {
      await commitVoucherAtomicBatch(fullVoucher, affectedItems, affectedLedgers);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_VOUCHERS, 'true');
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync voucher to Firebase.';
      setLastError(message);
      throw err;
    }

    return newId;
  };

  /**
   * Atomic Double-Entry Voucher Deletion & Reversal (Synced directly to Firebase Firestore)
   */
  const deleteVoucher = async (id: string) => {
    const currentVouchers = latestVouchersRef.current;
    const currentLedgers = latestLedgersRef.current;
    const currentInventory = latestInventoryRef.current;
    const targetVoucher = currentVouchers.find(v => v.id === id);
    if (!targetVoucher) return;

    // 1. Compute reversal ledger adjustments
    const journalEntries = targetVoucher.journalEntries || generateJournalEntries(targetVoucher, currentLedgers);
    const reverseLedgerDeltas = computeLedgerDeltas(journalEntries, true);

    const restoredLedgers = currentLedgers.map(l => {
      if (!reverseLedgerDeltas.has(l.id)) return l;
      const delta = reverseLedgerDeltas.get(l.id) || 0;
      return {
        ...l,
        currentBalance: Number(((l.currentBalance || 0) + delta).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
    });

    // 2. Compute reversal inventory stock adjustments
    const reverseItemDeltas = computeInventoryDeltas(targetVoucher, true);
    const restoredInventory = currentInventory.map(item => {
      if (!reverseItemDeltas.has(item.id)) return item;
      const delta = reverseItemDeltas.get(item.id) || 0;
      return {
        ...item,
        currentStock: Math.max(0, (item.currentStock || 0) + delta),
        updatedAt: new Date().toISOString(),
      };
    });

    // 3. Update refs and local state immediately
    latestVouchersRef.current = currentVouchers.filter(v => v.id !== id);
    latestLedgersRef.current = restoredLedgers;
    latestInventoryRef.current = restoredInventory;
    setVouchers(prev => prev.filter(v => v.id !== id));
    setLedgers(restoredLedgers);
    setInventory(restoredInventory);

    // 4. Commit atomic batch reversal to Firestore
    const affectedLedgers = restoredLedgers.filter(l => reverseLedgerDeltas.has(l.id));
    const affectedItems = restoredInventory.filter(i => reverseItemDeltas.has(i.id));

    try {
      await revertVoucherAtomicBatch(id, affectedItems, affectedLedgers);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete voucher in Firebase.';
      setLastError(message);
      throw err;
    }
  };

  /**
   * Add Ledger with Duplicate Check (Saved directly to Firebase Firestore)
   */
  const addLedger = async (ledgerData: Omit<LedgerAccount, 'id'>): Promise<string> => {
    const currentLedgers = latestLedgersRef.current;
    const duplicate = currentLedgers.find(
      l => l.group === ledgerData.group && l.name.trim().toLowerCase() === ledgerData.name.trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A ledger account "${ledgerData.name.trim()}" already exists in ${ledgerData.group}.`);
    }

    const newId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullLedger: LedgerAccount = {
      ...ledgerData,
      id: newId,
      companyId: latestSettingsRef.current.id || 'company_ghosh_01',
      currentBalance: ledgerData.openingBalance || 0,
      createdAt: new Date().toISOString(),
    };

    latestLedgersRef.current = [fullLedger, ...currentLedgers];
    setLedgers(prev => [fullLedger, ...prev]);
    try {
      await saveLedgerToFirestore(fullLedger);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_LEDGERS, 'true');
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save ledger to Firebase.';
      setLastError(message);
      throw err;
    }
    return newId;
  };

  const updateLedger = async (updated: LedgerAccount) => {
    const withTimestamp: LedgerAccount = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    latestLedgersRef.current = latestLedgersRef.current.map(l => (l.id === withTimestamp.id ? withTimestamp : l));
    setLedgers(prev => prev.map(l => (l.id === withTimestamp.id ? withTimestamp : l)));
    try {
      await saveLedgerToFirestore(withTimestamp);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update ledger in Firebase.';
      setLastError(message);
      throw err;
    }
  };

  const deleteLedger = async (id: string) => {
    latestLedgersRef.current = latestLedgersRef.current.filter(l => l.id !== id);
    setLedgers(prev => prev.filter(l => l.id !== id));
    try {
      await deleteLedgerFromFirestore(id);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete ledger in Firebase.';
      setLastError(message);
      throw err;
    }
  };

  /**
   * Add Inventory Item with SKU & Name Duplicate Validation (Saved directly to Firebase Firestore)
   */
  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id'>): Promise<string> => {
    const currentInventory = latestInventoryRef.current;
    if (itemData.sku && itemData.sku.trim()) {
      const dupSku = currentInventory.find(
        i => i.sku.trim().toLowerCase() === itemData.sku.trim().toLowerCase()
      );
      if (dupSku) {
        throw new Error(`An item with SKU "${itemData.sku.trim()}" already exists (${dupSku.name}).`);
      }
    }

    const dupName = currentInventory.find(
      i => i.name.trim().toLowerCase() === itemData.name.trim().toLowerCase()
    );
    if (dupName) {
      throw new Error(`An item named "${itemData.name.trim()}" already exists.`);
    }

    const newId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullItem: InventoryItem = {
      ...itemData,
      id: newId,
      companyId: latestSettingsRef.current.id || 'company_ghosh_01',
      openingStock: itemData.openingStock ?? itemData.currentStock ?? 0,
      createdAt: new Date().toISOString(),
    };

    latestInventoryRef.current = [fullItem, ...currentInventory];
    setInventory(prev => [fullItem, ...prev]);
    try {
      await saveInventoryItemToFirestore(fullItem);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_INVENTORY, 'true');
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save product to Firebase.';
      setLastError(message);
      throw err;
    }
    return newId;
  };

  const updateInventoryItem = async (updated: InventoryItem) => {
    const withTimestamp: InventoryItem = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    latestInventoryRef.current = latestInventoryRef.current.map(i => (i.id === withTimestamp.id ? withTimestamp : i));
    setInventory(prev => prev.map(i => (i.id === withTimestamp.id ? withTimestamp : i)));
    try {
      await saveInventoryItemToFirestore(withTimestamp);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product in Firebase.';
      setLastError(message);
      throw err;
    }
  };

  const deleteInventoryItem = async (id: string) => {
    latestInventoryRef.current = latestInventoryRef.current.filter(i => i.id !== id);
    setInventory(prev => prev.filter(i => i.id !== id));
    try {
      await deleteInventoryItemFromFirestore(id);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product in Firebase.';
      setLastError(message);
      throw err;
    }
  };

  const updateStockQuantity = async (itemId: string, deltaQty: number) => {
    const target = latestInventoryRef.current.find(i => i.id === itemId);
    if (!target) return;

    const updatedItem: InventoryItem = {
      ...target,
      currentStock: Math.max(0, (target.currentStock || 0) + deltaQty),
      updatedAt: new Date().toISOString(),
    };

    latestInventoryRef.current = latestInventoryRef.current.map(i => (i.id === itemId ? updatedItem : i));
    setInventory(prev => prev.map(i => (i.id === itemId ? updatedItem : i)));
    try {
      await saveInventoryItemToFirestore(updatedItem);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update stock in Firebase.';
      setLastError(message);
      throw err;
    }
  };

  const updateSettings = async (updated: CompanySettings) => {
    const withTimestamp: CompanySettings = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    latestSettingsRef.current = withTimestamp;
    setSettings(withTimestamp);
    try {
      await saveSettingsToFirestore(withTimestamp);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_SETTINGS, 'true');
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings to Firebase.';
      setLastError(message);
      throw err;
    }
  };

  const resetToSampleData = () => {
    latestVouchersRef.current = initialVouchers;
    latestLedgersRef.current = ensureSystemLedgers(initialLedgers);
    latestInventoryRef.current = initialInventory;
    latestSettingsRef.current = initialCompanySettings;
    setVouchers(initialVouchers);
    setLedgers(latestLedgersRef.current);
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
        isFirebaseConnected,
        isSyncing,
        lastError,
        clearError,
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
