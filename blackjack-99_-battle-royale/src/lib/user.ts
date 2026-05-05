import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface UserStats {
  username: string;
  displayName?: string;
  uid?: string;
  email?: string | null;
  provider?: string | null;
  winsOffline: number;
  gamesOffline: number;
  winsOnline: number;
  gamesOnline: number;
  totalWins: number;
  updatedAt: any;
}

export interface DailyWin {
  userId: string;
  name: string;
  wins: number;
  date: string;
}

export interface SiteUserProfile extends UserStats {
  uid: string;
  displayName: string;
  email: string | null;
  provider: string | null;
  createdAt: any;
}

type SaveUserProfileInput = {
  uid: string;
  displayName: string;
  email?: string | null;
  provider?: string | null;
};

const getSavedName = (data: Partial<UserStats> | undefined) => {
  const saved = data?.displayName || data?.username;
  return typeof saved === 'string' ? saved.trim() : '';
};

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<UserStats>;
      const savedName = getSavedName(data) || 'Player';
      return {
        ...data,
        username: savedName,
        displayName: savedName,
        winsOffline: data.winsOffline ?? 0,
        gamesOffline: data.gamesOffline ?? 0,
        winsOnline: data.winsOnline ?? 0,
        gamesOnline: data.gamesOnline ?? 0,
        totalWins: data.totalWins ?? 0,
        updatedAt: data.updatedAt,
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<SiteUserProfile | null> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data() as Partial<SiteUserProfile>;
    const savedName = getSavedName(data);

    return {
      ...data,
      uid: data.uid || userId,
      username: savedName,
      displayName: savedName,
      email: data.email ?? null,
      provider: data.provider ?? null,
      winsOffline: data.winsOffline ?? 0,
      gamesOffline: data.gamesOffline ?? 0,
      winsOnline: data.winsOnline ?? 0,
      gamesOnline: data.gamesOnline ?? 0,
      totalWins: data.totalWins ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function saveUserProfile({ uid, displayName, email = null, provider = null }: SaveUserProfileInput) {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    const baseProfile = {
      uid,
      username: displayName,
      displayName,
      email,
      provider,
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      await setDoc(docRef, {
        ...baseProfile,
        winsOffline: 0,
        gamesOffline: 0,
        winsOnline: 0,
        gamesOnline: 0,
        totalWins: 0,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, baseProfile, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(userId: string, username: string) {
  await saveUserProfile({ uid: userId, displayName: username });
}

export async function trackGameResult(userId: string, mode: 'offline' | 'online', isWin: boolean, username?: string) {
  const path = `users/${userId}`;
  try {
    const today = new Date().toISOString().split('T')[0];
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      const fallbackName = username || 'Player';
      await setDoc(docRef, {
        uid: userId,
        username: fallbackName,
        displayName: fallbackName,
        winsOffline: 0,
        gamesOffline: 0,
        winsOnline: 0,
        gamesOnline: 0,
        totalWins: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    
    const updates: any = {
      updatedAt: serverTimestamp()
    };

    if (mode === 'offline') {
      updates.gamesOffline = increment(1);
      if (isWin) {
        updates.winsOffline = increment(1);
        updates.totalWins = increment(1);
      }
    } else {
      updates.gamesOnline = increment(1);
      if (isWin) {
        updates.winsOnline = increment(1);
        updates.totalWins = increment(1);
      }
    }

    await updateDoc(docRef, updates);

    // Update Daily Stats only for wins
    if (isWin) {
      const dailyPath = `daily_leaderboard/${today}/players/${userId}`;
      try {
        const dailyRef = doc(db, `daily_leaderboard/${today}/players`, userId);
        const dailySnap = await getDoc(dailyRef);

        if (!dailySnap.exists()) {
          await setDoc(dailyRef, {
            userId,
            name: username || 'Player',
            wins: 1,
            date: today
          });
        } else {
          await updateDoc(dailyRef, {
            wins: increment(1)
          });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, dailyPath);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getDailyLeaderboard(): Promise<DailyWin[]> {
  const today = new Date().toISOString().split('T')[0];
  const path = `daily_leaderboard/${today}/players`;
  try {
    const q = query(
      collection(db, `daily_leaderboard/${today}/players`),
      orderBy('wins', 'desc'),
      limit(3)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DailyWin);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
