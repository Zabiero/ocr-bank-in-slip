import type { SlipRecord } from '../types';

const DB_NAME = 'bank-slip-ocr';
const DB_VERSION = 1;
const STORE_NAME = 'slips';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSlips(): Promise<SlipRecord[]> {
  const records = await withStore<SlipRecord[]>('readonly', (store) => store.getAll());
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putSlip(record: SlipRecord): Promise<void> {
  await withStore('readwrite', (store) => store.put(record));
}

export async function deleteSlip(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearAllSlips(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
