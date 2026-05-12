import { doc, collection, onSnapshot, updateDoc, setDoc, deleteDoc, query, where, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../../../../lib/firebase';
import { GameState, GamePlayer } from './types';
import { Engine } from './Engine';

export { auth };
export { db };

type QueuedEightBallPlayer = Pick<GamePlayer, 'uid' | 'name'> & {
  queueToken?: string;
  lastSeenAt?: number;
  createdAtMs?: number;
};

export class MultiplayerManager {
  private static readonly QUEUE_TTL_MS = 20000;

  static async startMatchmaking(player: GamePlayer, onMatch: (matchId: string, role: 'white' | 'black') => void): Promise<() => void> {
    const queueCol = collection(db, 'queue');
    const now = Date.now();
    const q = query(queueCol, limit(50));
    const snapshot = await getDocs(q);
    const opponentDoc = snapshot.docs.find((queuedPlayer) => {
      const queuedData = queuedPlayer.data() as QueuedEightBallPlayer;
      const isActive = typeof queuedData.lastSeenAt === 'number' && now - queuedData.lastSeenAt <= MultiplayerManager.QUEUE_TTL_MS;
      return queuedPlayer.id !== player.uid && !!queuedData.uid && queuedData.uid !== player.uid && !!queuedData.queueToken && isActive;
    });

    const staleDocs = snapshot.docs.filter((queuedPlayer) => {
      const queuedData = queuedPlayer.data() as QueuedEightBallPlayer;
      return typeof queuedData.lastSeenAt !== 'number' || now - queuedData.lastSeenAt > MultiplayerManager.QUEUE_TTL_MS;
    });
    await Promise.all(staleDocs.map((queuedPlayer) => deleteDoc(doc(db, 'queue', queuedPlayer.id)).catch(() => undefined)));

    if (opponentDoc) {
      const otherData = opponentDoc.data() as QueuedEightBallPlayer;
      const matchId = `match_${Date.now()}_${player.uid}`;
      const whitePlayer: GamePlayer = { uid: otherData.uid, name: otherData.name || 'Player 1', group: null, violations: 0 };
      const blackPlayer: GamePlayer = { uid: player.uid, name: player.name || 'Player 2', group: null, violations: 0 };
      
      const matchData = {
        mode: 'online',
        state: 'playing',
        balls: Engine.createBalls(),
        firstBallHit: null,
        ballsPocketedThisTurn: [],
        isMoving: false,
        isFoul: false,
        foulReason: null,
        isBallInHand: true,
        nominatedPocket: null,
        players: {
          white: whitePlayer,
          black: blackPlayer
        },
        turn: whitePlayer.uid,
        turnStartTime: Date.now(),
        status: 'playing',
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now(),
        whiteQueueToken: otherData.queueToken,
      };

      await setDoc(doc(db, 'matches', matchId), matchData);
      await deleteDoc(doc(db, 'queue', opponentDoc.id));
      await deleteDoc(doc(db, 'queue', player.uid)).catch(() => undefined);
      onMatch(matchId, 'black');
      return () => undefined;
    } else {
      let isSearching = true;
      const queueToken = `${player.uid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const queueRef = doc(db, 'queue', player.uid);
      const refreshQueue = () => setDoc(queueRef, {
        uid: player.uid,
        name: player.name,
        queueToken,
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now(),
        lastSeenAt: Date.now()
      }, { merge: true });

      // Join queue
      await refreshQueue();
      const heartbeat = window.setInterval(() => {
        if (isSearching) refreshQueue().catch(() => undefined);
      }, 5000);

      // Listen for a match created for us
      const matchesCol = collection(db, 'matches');
      const qMatch = query(matchesCol, where('whiteQueueToken', '==', queueToken));
      const unsubscribe = onSnapshot(qMatch, (snap) => {
        const matchDoc = snap.docs.find((match) => match.data()?.players?.white?.uid === player.uid && match.data()?.status === 'playing');
        if (matchDoc) {
          isSearching = false;
          window.clearInterval(heartbeat);
          unsubscribe();
          deleteDoc(queueRef).catch(() => undefined);
          onMatch(matchDoc.id, 'white');
        }
      });

      return () => {
        isSearching = false;
        window.clearInterval(heartbeat);
        unsubscribe();
        deleteDoc(queueRef).catch(() => undefined);
      };
    }
  }

  static syncGameState(matchId: string, state: Partial<GameState>) {
    const matchRef = doc(db, 'matches', matchId);
    updateDoc(matchRef, state);
  }

  static listenToMatch(matchId: string, callback: (data: any) => void) {
    return onSnapshot(doc(db, 'matches', matchId), (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      }
    });
  }
}
