import type { FirebaseOptions } from 'firebase/app';
import fileConfig from '../../firebase-applet-config.json';

declare global {
  interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY?: string;
    readonly VITE_FIREBASE_PROJECT_ID?: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
    readonly VITE_FIREBASE_APP_ID?: string;
    readonly VITE_FIRESTORE_DATABASE_ID?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

/**
 * Single Firebase project for the whole site (Blackjack, Friend Chess, Molar Madness, etc.).
 *
 * Resolution order:
 * 1. If `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are set → build config from env
 *    (optional fields fall back to firebase-applet-config.json where noted).
 * 2. Otherwise → use firebase-applet-config.json only (local dev default).
 *
 * Firestore database id: `VITE_FIRESTORE_DATABASE_ID`, or the JSON file’s `firestoreDatabaseId`,
 * or `(default)` for `getFirestore(app)` without a custom id.
 */
type FileShape = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId: string;
  measurementId?: string;
};

const file = fileConfig as FileShape;

export type ResolvedFirebase = {
  options: FirebaseOptions;
  /** Pass to getFirestore — empty / (default) means default database */
  firestoreDatabaseId: string;
  /** True when env-based override is active */
  configSource: 'env' | 'file';
};

export function resolveFirebaseWebConfig(): ResolvedFirebase {
  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim();
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim();

  if (apiKey && projectId) {
    const dbIdRaw =
      (import.meta.env.VITE_FIRESTORE_DATABASE_ID as string | undefined)?.trim() ||
      file.firestoreDatabaseId ||
      '(default)';

    return {
      options: {
        apiKey,
        authDomain:
          (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim() ||
          `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket:
          (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined)?.trim() ||
          file.storageBucket,
        messagingSenderId:
          (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined)?.trim() ||
          file.messagingSenderId,
        appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined)?.trim() || file.appId,
      },
      firestoreDatabaseId: dbIdRaw,
      configSource: 'env',
    };
  }

  return {
    options: {
      apiKey: file.apiKey,
      authDomain: file.authDomain,
      projectId: file.projectId,
      storageBucket: file.storageBucket,
      messagingSenderId: file.messagingSenderId,
      appId: file.appId,
    },
    firestoreDatabaseId: file.firestoreDatabaseId,
    configSource: 'file',
  };
}
