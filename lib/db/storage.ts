import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'RorkAppDB';
const STORE_NAME = 'keyval';

// IndexedDB Helper for Web
const initWebDB = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject('IndexedDB not available');
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const db = await initWebDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as string || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB getItem failed', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const db = await initWebDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  removeItem: async (key: string): Promise<void> => {
    const db = await initWebDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

export const Storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return await webStorage.getItem(key);
      } catch (e) {
        console.warn('Web storage (IndexedDB) failed, trying localStorage fallback', e);
        return AsyncStorage.getItem(key);
      }
    }
    return AsyncStorage.getItem(key);
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        await webStorage.setItem(key, value);
        return;
      } catch (e) {
        console.warn('Web storage (IndexedDB) set failed, trying localStorage fallback', e);
        return AsyncStorage.setItem(key, value);
      }
    }
    return AsyncStorage.setItem(key, value);
  },
  
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        await webStorage.removeItem(key);
        return;
      } catch {
        return AsyncStorage.removeItem(key);
      }
    }
    return AsyncStorage.removeItem(key);
  }
};
