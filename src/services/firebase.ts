import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CompanySettings,
  InventoryItem,
  LedgerAccount,
  TransactionVoucher
} from '../types/accounting';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
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
      console.warn('Firebase client is currently offline or unreachable.');
    }
    return false;
  }
}

export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Sign in failed:', error);
    throw error;
  }
}

export async function logOut() {
  return await signOut(auth);
}

// Collection Helpers
export const Collections = {
  LEDGERS: 'ledgers',
  INVENTORY: 'inventory',
  VOUCHERS: 'vouchers',
  BRANCHES: 'branches',
  SETTINGS: 'settings',
};

// Firestore CRUD operations with standardized error handling
export async function saveLedgerToFirestore(ledger: LedgerAccount) {
  try {
    await setDoc(doc(db, Collections.LEDGERS, ledger.id), ledger);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.LEDGERS}/${ledger.id}`);
  }
}

export async function saveInventoryItemToFirestore(item: InventoryItem) {
  try {
    await setDoc(doc(db, Collections.INVENTORY, item.id), item);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.INVENTORY}/${item.id}`);
  }
}

export async function saveVoucherToFirestore(voucher: TransactionVoucher) {
  try {
    await setDoc(doc(db, Collections.VOUCHERS, voucher.id), voucher);
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
    await setDoc(doc(db, Collections.SETTINGS, settings.id), settings);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.SETTINGS}/${settings.id}`);
  }
}
