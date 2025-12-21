import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const DB_NAME = 'RorkAppDB_Files';
const STORE_NAME = 'files';

// Web: IndexedDB Helper
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

export const FileStorage = {
  // Saves a file and returns a URI reference
  save: async (uri: string, fileName: string): Promise<string> => {
    const uniqueName = `${Date.now()}_${fileName}`;
    
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const db = await initWebDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(blob, uniqueName);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        
        return `dbfile://${uniqueName}`;
      } catch (e) {
        console.error('Web file save failed', e);
        throw e;
      }
    } else {
      // Native: Copy to document directory
      try {
        const docDir = (FileSystem as any).documentDirectory;
        if (!docDir) {
          throw new Error('documentDirectory is not available');
        }
        const imagesDir = `${docDir}images/`;
        
        const dirInfo = await FileSystem.getInfoAsync(imagesDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
        }

        const destUri = `${imagesDir}${uniqueName}`;
        
        if (uri.startsWith('http') || uri.startsWith('https')) {
          await FileSystem.downloadAsync(uri, destUri);
        } else {
          // Local file (e.g. from image picker)
          await FileSystem.copyAsync({ from: uri, to: destUri });
        }

        return destUri;
      } catch (e) {
        console.error('Native file save error', e);
        throw e;
      }
    }
  },

  // Resolves a URI (http, file, or dbfile) to a displayable source
  resolve: async (path: string): Promise<string> => {
    if (!path) return '';
    
    if (path.startsWith('dbfile://')) {
      const fileName = path.replace('dbfile://', '');
      
      if (Platform.OS === 'web') {
        try {
          const db = await initWebDB();
          const blob = await new Promise<Blob>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(fileName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          
          if (!blob) return '';
          return URL.createObjectURL(blob);
        } catch (e) {
          console.warn('Failed to resolve web file', e);
          return '';
        }
      } else {
        return path; 
      }
    }
    
    return path;
  }
};
