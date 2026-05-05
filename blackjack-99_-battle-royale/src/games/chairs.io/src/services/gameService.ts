import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  type DocumentData,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Game, Player, Chair, GameStatus } from '../types';
import { nanoid } from 'nanoid';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#d946ef', '#f43f5e'
];

export const gameService = {
  async createGame(isPublic: boolean = true) {
    if (!auth.currentUser) throw new Error('Must be signed in');
    
    const gameId = isPublic ? nanoid(10) : nanoid(6).toUpperCase();
    const path = `games/${gameId}`;
    
    try {
      const gameData = {
        status: 'lobby' as GameStatus,
        hostId: auth.currentUser.uid,
        isPublic,
        currentRound: 1,
        timerValue: 0,
        timerStartTime: null,
        winnerId: null,
        lastEliminatedId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await setDoc(doc(db, 'games', gameId), gameData);
      
      await this.joinGame(gameId);
      
      return gameId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async joinGame(gameId: string) {
    if (!auth.currentUser) throw new Error('Must be signed in');
    
    const path = `games/${gameId}/players/${auth.currentUser.uid}`;
    try {
      const playerDoc = doc(db, 'games', gameId, 'players', auth.currentUser.uid);
      const snap = await getDoc(playerDoc);
      
      if (snap.exists()) return;

      const player: Player = {
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName || `Player ${auth.currentUser.uid.slice(0, 4)}`,
        isEliminated: false,
        isReady: false,
        chairId: null,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        joinedAt: Date.now()
      };

      await setDoc(playerDoc, player);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async startGame(gameId: string, playerCount: number) {
    const path = `games/${gameId}`;
    try {
      const batch = writeBatch(db);
      
      // Update game status
      batch.update(doc(db, 'games', gameId), {
        status: 'playing',
        currentRound: 1,
        timerValue: 15 + Math.floor(Math.random() * 10), // Random starting music duration
        timerStartTime: Date.now(),
        updatedAt: Date.now()
      });

      // Create chairs (playerCount - 1)
      const chairCount = playerCount - 1;
      for (let i = 0; i < chairCount; i++) {
        const chairId = nanoid(5);
        batch.set(doc(db, 'games', gameId, 'chairs', chairId), {
          id: chairId,
          claimedBy: null,
          angle: (i / chairCount) * 360
        });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async claimChair(gameId: string, chairId: string) {
    if (!auth.currentUser) return;
    const path = `games/${gameId}/chairs/${chairId}`;
    try {
      const chairRef = doc(db, 'games', gameId, 'chairs', chairId);
      const playerRef = doc(db, 'games', gameId, 'players', auth.currentUser.uid);
      
      // We check if already claimed in security rules, but here too for UI
      const chairSnap = await getDoc(chairRef);
      if (chairSnap.data()?.claimedBy) return;

      await updateDoc(chairRef, { claimedBy: auth.currentUser.uid });
      await updateDoc(playerRef, { chairId: chairId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async endRound(gameId: string) {
    // Usually called by host
    const path = `games/${gameId}`;
    try {
      const playersSnap = await getDocs(collection(db, 'games', gameId, 'players'));
      const activePlayers = playersSnap.docs
        .map(d => d.data() as Player)
        .filter(p => !p.isEliminated);
      
      const eliminated = activePlayers.find(p => !p.chairId);
      
      if (eliminated) {
        const batch = writeBatch(db);
        
        // Eliminate player
        batch.update(doc(db, 'games', gameId, 'players', eliminated.uid), {
          isEliminated: true,
          chairId: null
        });

        const remainingActive = activePlayers.filter(p => p.uid !== eliminated.uid);
        
        if (remainingActive.length === 1) {
          // Final winner!
          batch.update(doc(db, 'games', gameId), {
            status: 'ended',
            winnerId: remainingActive[0].uid,
            lastEliminatedId: eliminated.uid,
            updatedAt: Date.now()
          });
        } else {
          // Move to next round
          batch.update(doc(db, 'games', gameId), {
            status: 'elimination',
            lastEliminatedId: eliminated.uid,
            updatedAt: Date.now()
          });
        }

        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async nextRound(gameId: string) {
    const path = `games/${gameId}`;
    try {
      const batch = writeBatch(db);
      const gameRef = doc(db, 'games', gameId);
      const gameSnap = await getDoc(gameRef);
      const currentRound = gameSnap.data()?.currentRound;
      
      // Delete old chairs
      const chairsSnap = await getDocs(collection(db, 'games', gameId, 'chairs'));
      chairsSnap.docs.forEach(d => batch.delete(d.ref));

      // Reset players' chairIds
      const playersSnap = await getDocs(collection(db, 'games', gameId, 'players'));
      playersSnap.docs.forEach(d => {
        batch.update(d.ref, { chairId: null });
      });

      // Setup new chairs
      const activePlayersCount = playersSnap.docs
        .map(d => d.data() as Player)
        .filter(p => !p.isEliminated).length;
      
      const nextChairCount = activePlayersCount - 1;
      for (let i = 0; i < nextChairCount; i++) {
        const chairId = nanoid(5);
        batch.set(doc(db, 'games', gameId, 'chairs', chairId), {
          id: chairId,
          claimedBy: null,
          angle: (i / nextChairCount) * 360
        });
      }

      batch.update(gameRef, {
        status: 'playing',
        currentRound: typeof currentRound === 'number' ? currentRound + 1 : 1,
        timerValue: 10 + Math.floor(Math.random() * 8),
        timerStartTime: Date.now(),
        updatedAt: Date.now()
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeToGame(gameId: string, callback: (game: Game) => void) {
    return onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as Game);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `games/${gameId}`));
  },

  subscribeToPlayers(gameId: string, callback: (players: Player[]) => void) {
    return onSnapshot(collection(db, 'games', gameId, 'players'), (snap) => {
      callback(snap.docs.map(d => d.data() as Player));
    }, (error) => handleFirestoreError(error, OperationType.GET, `games/${gameId}/players`));
  },

  subscribeToChairs(gameId: string, callback: (chairs: Chair[]) => void) {
    return onSnapshot(collection(db, 'games', gameId, 'chairs'), (snap) => {
      callback(snap.docs.map(d => d.data() as Chair));
    }, (error) => handleFirestoreError(error, OperationType.GET, `games/${gameId}/chairs`));
  }
};
