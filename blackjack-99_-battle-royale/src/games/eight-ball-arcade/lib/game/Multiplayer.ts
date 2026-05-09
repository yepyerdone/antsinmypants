import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, updateDoc, setDoc, deleteDoc, query, where, limit, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import { GameState, GamePlayer } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export class MultiplayerManager {
  static async startMatchmaking(player: GamePlayer, onMatch: (matchId: string, role: 'white' | 'black') => void) {
    const queueCol = collection(db, 'queue');
    const q = query(queueCol, limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Find someone in queue
      const other = snapshot.docs[0];
      if (other.id === player.uid) return;

      const otherData = other.data();
      const matchId = `match_${Date.now()}_${player.uid}`;
      
      const matchData = {
        state: 'playing',
        players: {
          white: { uid: otherData.uid, name: otherData.name, group: null, violations: 0 },
          black: { uid: player.uid, name: player.name, group: null, violations: 0 }
        },
        turn: otherData.uid,
        turnStartTime: Date.now(),
        status: 'playing',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'matches', matchId), matchData);
      await deleteDoc(doc(db, 'queue', other.id));
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
