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
  private static readonly QUEUE_TTL_MS = 7000;

  static async startMatchmaking(player: GamePlayer, onMatch: (matchId: string, role: 'white' | 'black') => void): Promise<() => void> {
    const queueCol = collection(db, 'queue');
    const findActiveOpponent = async (now: number, joinedAtMs?: number) => {
      const q = query(queueCol, limit(50));
      const snapshot = await getDocs(q);
      const staleDocs = snapshot.docs.filter((queuedPlayer) => {
        const queuedData = queuedPlayer.data() as QueuedEightBallPlayer;
        return typeof queuedData.lastSeenAt !== 'number' || now - queuedData.lastSeenAt > MultiplayerManager.QUEUE_TTL_MS;
      });
      await Promise.all(staleDocs.map((queuedPlayer) => deleteDoc(doc(db, 'queue', queuedPlayer.id)).catch(() => undefined)));

      return snapshot.docs.find((queuedPlayer) => {
        const queuedData = queuedPlayer.data() as QueuedEightBallPlayer;
        const isActive = typeof queuedData.lastSeenAt === 'number' && now - queuedData.lastSeenAt <= MultiplayerManager.QUEUE_TTL_MS;
        const isOpponent = queuedPlayer.id !== player.uid && !!queuedData.uid && queuedData.uid !== player.uid && !!queuedData.queueToken;
        const queuedBeforeUs = joinedAtMs === undefined
          || (typeof queuedData.createdAtMs === 'number' && queuedData.createdAtMs < joinedAtMs)
          || (queuedData.createdAtMs === joinedAtMs && queuedData.uid < player.uid);
        return isOpponent && isActive && queuedBeforeUs;
      });
    };

    const createMatchFromOpponent = async (opponentDoc: Awaited<ReturnType<typeof findActiveOpponent>>) => {
      if (!opponentDoc) return false;
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
        connectionReady: {
          white: false,
          black: true,
        },
        connectionReadyAt: {
          black: Date.now(),
        },
      };

      await setDoc(doc(db, 'matches', matchId), matchData);
      await deleteDoc(doc(db, 'queue', opponentDoc.id));
      await deleteDoc(doc(db, 'queue', player.uid)).catch(() => undefined);
      onMatch(matchId, 'black');
      return true;
    };

    const opponentDoc = await findActiveOpponent(Date.now());
    if (opponentDoc) {
      await createMatchFromOpponent(opponentDoc);
      return () => undefined;
    } else {
      let isSearching = true;
      let hasMatched = false;
      const joinedAtMs = Date.now();
      const queueToken = `${player.uid}_${joinedAtMs}_${Math.random().toString(36).slice(2)}`;
      const queueRef = doc(db, 'queue', player.uid);
      const refreshQueue = () => setDoc(queueRef, {
        uid: player.uid,
        name: player.name,
        queueToken,
        createdAt: new Date().toISOString(),
        createdAtMs: joinedAtMs,
        lastSeenAt: Date.now()
      }, { merge: true });

      const tryMatchWaitingOpponent = async () => {
        if (!isSearching || hasMatched) return;
        const opponent = await findActiveOpponent(Date.now(), joinedAtMs);
        if (!opponent || hasMatched || !isSearching) return;
        hasMatched = true;
        isSearching = false;
        window.clearInterval(heartbeat);
        unsubscribe();
        await createMatchFromOpponent(opponent);
      };

      // Join queue
      await refreshQueue();
      const heartbeat = window.setInterval(() => {
        if (isSearching) {
          refreshQueue().catch(() => undefined);
          tryMatchWaitingOpponent().catch(() => {
            if (!hasMatched) isSearching = true;
          });
        }
      }, 2000);

      // Listen for a match created for us
      const matchesCol = collection(db, 'matches');
      const qMatch = query(matchesCol, where('players.white.uid', '==', player.uid));
      const unsubscribe = onSnapshot(qMatch, (snap) => {
        const matchDoc = snap.docs.find((match) => {
          const matchData = match.data();
          return matchData?.whiteQueueToken === queueToken && matchData?.status === 'playing';
        });
        if (matchDoc) {
          if (hasMatched) return;
          hasMatched = true;
          isSearching = false;
          window.clearInterval(heartbeat);
          unsubscribe();
          deleteDoc(queueRef).catch(() => undefined);
          onMatch(matchDoc.id, 'white');
        }
      });
      window.setTimeout(() => {
        tryMatchWaitingOpponent().catch(() => {
          if (!hasMatched) isSearching = true;
        });
      }, 800);

      return () => {
        isSearching = false;
        hasMatched = true;
        window.clearInterval(heartbeat);
        unsubscribe();
        deleteDoc(queueRef).catch(() => undefined);
      };
    }
  }

  static markPlayerConnected(matchId: string, role: 'white' | 'black') {
    return updateDoc(doc(db, 'matches', matchId), {
      [`connectionReady.${role}`]: true,
      [`connectionReadyAt.${role}`]: Date.now(),
    });
  }

  static syncGameState(matchId: string, state: Partial<GameState>) {
    const matchRef = doc(db, 'matches', matchId);
    return updateDoc(matchRef, state);
  }

  static listenToMatch(matchId: string, callback: (data: any) => void) {
    return onSnapshot(doc(db, 'matches', matchId), (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      }
    });
  }
}
