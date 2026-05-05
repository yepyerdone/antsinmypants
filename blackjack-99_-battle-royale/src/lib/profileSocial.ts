import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getUserProfile, type SiteUserProfile } from './user';

export type ProfileHighScores = {
  blackjackWins: number;
  snakeRush: number;
  molarMadness: number;
};

export type FriendEntry = {
  uid: string;
  displayName: string;
  createdAt?: any;
};

export type ProfileNotification = {
  id: string;
  type: 'friend_request';
  status: 'pending' | 'accepted' | 'declined';
  fromUid: string;
  fromName: string;
  createdAt?: any;
  updatedAt?: any;
};

export type ProfileDashboard = {
  profile: SiteUserProfile | null;
  highScores: ProfileHighScores;
};

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

async function getBestScore(collectionName: string, uid: string) {
  const scoresQuery = query(
    collection(db, collectionName),
    where('playerId', '==', uid),
    limit(100)
  );
  const snap = await getDocs(scoresQuery);
  return snap.docs.reduce((bestScore, scoreDoc) => {
    const score = scoreDoc.data()?.score;
    return typeof score === 'number' ? Math.max(bestScore, score) : bestScore;
  }, 0);
}

export async function getProfileDashboard(uid: string): Promise<ProfileDashboard> {
  const path = `users/${uid}`;
  try {
    const profile = await getUserProfile(uid);
    const [molarMadness, snakeRush] = await Promise.all([
      getBestScore('leaderboard', uid),
      getBestScore('snake_rush_leaderboard', uid),
    ]);

    return {
      profile,
      highScores: {
        blackjackWins: profile?.totalWins ?? 0,
        snakeRush,
        molarMadness,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return {
      profile: null,
      highScores: {
        blackjackWins: 0,
        snakeRush: 0,
        molarMadness: 0,
      },
    };
  }
}

export async function ensurePublicProfile(uid: string, displayName: string) {
  const path = `publicProfiles/${uid}`;
  try {
    await setDoc(doc(db, 'publicProfiles', uid), {
      uid,
      username: displayName,
      displayName,
      searchName: normalizeUsername(displayName),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToFriends(uid: string, callback: (friends: FriendEntry[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users', uid, 'friends'), orderBy('displayName')),
    (snap) => callback(snap.docs.map((friendDoc) => friendDoc.data() as FriendEntry)),
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}/friends`)
  );
}

export function subscribeToNotifications(uid: string, callback: (notifications: ProfileNotification[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc')),
    (snap) => callback(snap.docs.map((notificationDoc) => ({
      id: notificationDoc.id,
      ...notificationDoc.data(),
    } as ProfileNotification))),
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}/notifications`)
  );
}

export async function sendFriendRequest(fromUid: string, fromName: string, username: string) {
  const path = 'publicProfiles';
  try {
    const searchName = normalizeUsername(username);
    if (!searchName) throw new Error('Enter a username.');

    const profileQuery = query(
      collection(db, 'publicProfiles'),
      where('searchName', '==', searchName),
      limit(1)
    );
    const snap = await getDocs(profileQuery);
    const target = snap.docs[0]?.data() as { uid?: string; displayName?: string } | undefined;

    if (!target?.uid) throw new Error('No player found with that username.');
    if (target.uid === fromUid) throw new Error('You cannot send a friend request to yourself.');

    await setDoc(doc(db, 'users', target.uid, 'notifications', fromUid), {
      type: 'friend_request',
      status: 'pending',
      fromUid,
      fromName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await setDoc(doc(db, 'users', fromUid, 'sentFriendRequests', target.uid), {
      toUid: target.uid,
      toName: target.displayName || username,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function acceptFriendRequest(uid: string, displayName: string, notification: ProfileNotification) {
  const path = `users/${uid}/notifications/${notification.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'friends', notification.fromUid), {
      uid: notification.fromUid,
      displayName: notification.fromName,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', notification.fromUid, 'friends', uid), {
      uid,
      displayName,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', uid, 'notifications', notification.id), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', notification.fromUid, 'sentFriendRequests', uid), {
      toUid: uid,
      toName: displayName,
      status: 'accepted',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function declineFriendRequest(uid: string, notification: ProfileNotification) {
  const path = `users/${uid}/notifications/${notification.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notification.id), {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'users', notification.fromUid, 'sentFriendRequests', uid), {
      toUid: uid,
      toName: notification.fromName,
      status: 'declined',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
