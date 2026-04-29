import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Users, LogIn, Plus } from 'lucide-react';
import { getUserStats } from '../lib/user';

interface Room {
  id: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  playersCount: number;
}

export function OnlineLobby({ onJoinRoom }: { onJoinRoom: (roomId: string, isHost: boolean) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomList: Room[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      setRooms(roomList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'));

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  const createRoom = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const stats = await getUserStats(user.uid);
      const roomRef = await addDoc(collection(db, 'rooms'), {
        hostId: user.uid,
        status: 'waiting',
        round: 1,
        createdAt: serverTimestamp(),
        phase: 'waiting',
      });
      
      // Join as player
      await setDoc(doc(db, `rooms/${roomRef.id}/players`, user.uid), {
        userId: user.uid,
        name: stats?.username || user.displayName || 'Player',
        status: 'playing',
        joinedAt: serverTimestamp(),
        hand: [],
        wins: stats?.totalWins || 0,
      });

      onJoinRoom(roomRef.id, true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rooms');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const stats = await getUserStats(user.uid);
      await setDoc(doc(db, `rooms/${roomId}/players`, user.uid), {
        userId: user.uid,
        name: stats?.username || user.displayName || 'Player',
        status: 'playing',
        joinedAt: serverTimestamp(),
        hand: [],
        wins: stats?.totalWins || 0,
      });
      onJoinRoom(roomId, false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}/players`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-bg-accent rounded-3xl border border-white/5">
        <h2 className="text-3xl font-black mb-4 italic uppercase tracking-tighter">Login Required</h2>
        <p className="text-gray-400 mb-8 text-center max-w-xs">You must be signed in to enter the online battle royale arena.</p>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-auth'))}
          className="bg-stake-green text-bg-dark font-black px-12 py-4 rounded-2xl flex items-center space-x-3 hover:scale-105 transition-transform"
        >
          <LogIn size={20} />
          <span>JOIN THE TABLE</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col space-y-8">
      
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold italic uppercase tracking-tighter">Active Lobbies</h2>
        <button 
          onClick={createRoom}
          disabled={loading}
          className="bg-white text-bg-dark font-bold px-6 py-2 rounded-xl flex items-center space-x-2 hover:bg-stake-green transition-colors"
        >
          <Plus size={18} />
          <span>New Game</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-secondary border-2 border-dashed border-stake-blue rounded-3xl">
            No active lobbies. Create one to start!
          </div>
        ) : (
          rooms.map(room => (
            <motion.div 
              key={room.id}
              whileHover={{ scale: 1.02 }}
              className="bg-bg-accent p-6 rounded-3xl border border-stake-blue flex justify-between items-center"
            >
              <div>
                <div className="text-xs font-bold text-stake-green uppercase tracking-widest mb-1">Waiting for Players</div>
                <div className="text-lg font-bold">Lobby #{room.id.substring(0, 5)}</div>
              </div>
              <button 
                onClick={() => joinRoom(room.id)}
                className="bg-stake-blue hover:bg-stake-green hover:text-bg-dark text-white px-6 py-2 rounded-xl text-sm font-bold transition-all"
              >
                Join Battle
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
