import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export interface UserStats {
  username: string;
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

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserStats;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function updateUserProfile(userId: string, username: string, isNew: boolean = false) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    
    if (isNew) {
      await setDoc(docRef, {
        username,
        winsOffline: 0,
        gamesOffline: 0,
        winsOnline: 0,
        gamesOnline: 0,
        totalWins: 0,
        updatedAt: serverTimestamp()
      });
      return;
    }

    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        username,
        winsOffline: 0,
        gamesOffline: 0,
        winsOnline: 0,
        gamesOnline: 0,
        totalWins: 0,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(docRef, {
        username,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function trackGameResult(userId: string, mode: 'offline' | 'online', isWin: boolean, username?: string) {
  const path = `users/${userId}`;
  try {
    const today = new Date().toISOString().split('T')[0];
    const docRef = doc(db, 'users', userId);
    
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
            name: username || 'Anonymous',
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
