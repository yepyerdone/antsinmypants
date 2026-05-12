import { doc, collection, onSnapshot, updateDoc, setDoc, deleteDoc, query, where, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../../../../lib/firebase';
import { GameState, GamePlayer } from './types';
import { Engine } from './Engine';

export { auth };
export { db };

export class MultiplayerManager {
  static async startMatchmaking(player: GamePlayer, onMatch: (matchId: string, role: 'white' | 'black') => void) {
    const queueCol = collection(db, 'queue');
    const q = query(queueCol, limit(10));
    const snapshot = await getDocs(q);
    const opponentDoc = snapshot.docs.find((queuedPlayer) => {
      const queuedData = queuedPlayer.data() as Partial<GamePlayer>;
      return queuedPlayer.id !== player.uid && !!queuedData.uid && queuedData.uid !== player.uid;
    });

    if (opponentDoc) {
      const otherData = opponentDoc.data() as Pick<GamePlayer, 'uid' | 'name'>;
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
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'matches', matchId), matchData);
      await deleteDoc(doc(db, 'queue', opponentDoc.id));
      await deleteDoc(doc(db, 'queue', player.uid)).catch(() => undefined);
      onMatch(matchId, 'black');
    } else {
      // Join queue
      await setDoc(doc(db, 'queue', player.uid), {
        uid: player.uid,
        name: player.name,
        createdAt: new Date().toISOString()
      });

      // Listen for a match created for us
      const matchesCol = collection(db, 'matches');
      const qMatch = query(matchesCol, where('players.white.uid', '==', player.uid));
      const unsubscribe = onSnapshot(qMatch, (snap) => {
        if (!snap.empty) {
          unsubscribe();
          deleteDoc(doc(db, 'queue', player.uid)).catch(() => undefined);
          onMatch(snap.docs[0].id, 'white');
        }
      });
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
