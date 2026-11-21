import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CompanySettings,
  InventoryItem,
  LedgerAccount,
  TransactionVoucher
} from '../types/accounting';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

function initFirestore(): Firestore {
  if (typeof window === 'undefined') {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    // Fallback if Firestore was already initialized (e.g., module reload)
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = initFirestore();

/**
 * Recursively strips `undefined` properties so Firestore never throws
 * "Function setDoc() called with invalid data. Unsupported field value: undefined".
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        result[k] = stripUndefined(v);
      }
    }
    return result as T;
  }
  return value;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration. Client is currently offline.');
    }
    return false;
  }
}

// Collection Helpers
export const Collections = {
  LEDGERS: 'ledgers',
  INVENTORY: 'inventory',
  VOUCHERS: 'vouchers',
  SETTINGS: 'settings',
};

// Firestore CRUD operations with standardized error handling & undefined sanitization
export async function saveLedgerToFirestore(ledger: LedgerAccount) {
  try {
    await setDoc(doc(db, Collections.LEDGERS, ledger.id), stripUndefined(ledger));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.LEDGERS}/${ledger.id}`);
  }
}

export async function saveInventoryItemToFirestore(item: InventoryItem) {
  try {
    await setDoc(doc(db, Collections.INVENTORY, item.id), stripUndefined(item));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.INVENTORY}/${item.id}`);
  }
}

export async function saveVoucherToFirestore(voucher: TransactionVoucher) {
  try {
    await setDoc(doc(db, Collections.VOUCHERS, voucher.id), stripUndefined(voucher));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.VOUCHERS}/${voucher.id}`);
  }
}

export async function deleteVoucherFromFirestore(voucherId: string) {
  try {
    await deleteDoc(doc(db, Collections.VOUCHERS, voucherId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${Collections.VOUCHERS}/${voucherId}`);
  }
}

export async function deleteLedgerFromFirestore(ledgerId: string) {
  try {
    await deleteDoc(doc(db, Collections.LEDGERS, ledgerId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${Collections.LEDGERS}/${ledgerId}`);
  }
}

export async function deleteInventoryItemFromFirestore(itemId: string) {
  try {
    await deleteDoc(doc(db, Collections.INVENTORY, itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${Collections.INVENTORY}/${itemId}`);
  }
}

export async function saveSettingsToFirestore(settings: CompanySettings) {
  try {
    await setDoc(doc(db, Collections.SETTINGS, settings.id), stripUndefined(settings));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.SETTINGS}/${settings.id}`);
  }
}

/**
 * Batch-pushes local documents to Firestore when bootstrapping an empty cloud collection.
 */
export async function batchSeedDocumentsToFirestore<T extends { id: string }>(
  collectionName: string,
  docsList: T[]
) {
  if (docsList.length === 0) return;
  try {
    // Firestore writeBatch supports up to 500 ops per batch
    for (let i = 0; i < docsList.length; i += 400) {
      const chunk = docsList.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const entry of chunk) {
        batch.set(doc(db, collectionName, entry.id), stripUndefined(entry));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}

/**
 * Atomically commits a transaction voucher, its affected inventory items, and its affected ledgers.
 */
export async function commitVoucherAtomicBatch(
  voucher: TransactionVoucher,
  updatedItems: InventoryItem[],
  updatedLedgers: LedgerAccount[]
) {
  try {
    const batch = writeBatch(db);

    const voucherRef = doc(db, Collections.VOUCHERS, voucher.id);
    batch.set(voucherRef, stripUndefined(voucher));

    for (const item of updatedItems) {
      const itemRef = doc(db, Collections.INVENTORY, item.id);
      batch.set(itemRef, stripUndefined(item));
    }

    for (const ledger of updatedLedgers) {
      const ledgerRef = doc(db, Collections.LEDGERS, ledger.id);
      batch.set(ledgerRef, stripUndefined(ledger));
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.VOUCHERS}/${voucher.id}`);
  }
}

/**
 * Atomically deletes a voucher and restores affected inventory items and ledgers.
 */
export async function revertVoucherAtomicBatch(
  voucherId: string,
  restoredItems: InventoryItem[],
  restoredLedgers: LedgerAccount[]
) {
  try {
    const batch = writeBatch(db);

    const voucherRef = doc(db, Collections.VOUCHERS, voucherId);
    batch.delete(voucherRef);

    for (const item of restoredItems) {
      const itemRef = doc(db, Collections.INVENTORY, item.id);
      batch.set(itemRef, stripUndefined(item));
    }

    for (const ledger of restoredLedgers) {
      const ledgerRef = doc(db, Collections.LEDGERS, ledger.id);
      batch.set(ledgerRef, stripUndefined(ledger));
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${Collections.VOUCHERS}/${voucherId}`);
  }
}
