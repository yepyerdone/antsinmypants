import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFriendChessFirebase } from './lib/friendChessFirebase';
import FriendChessHome from './components/FriendChessHome';
import FriendChessGame from './components/FriendChessGame';
import FriendChessHistoryView from './components/FriendChessHistoryView';
import FriendChessSettings from './components/FriendChessSettings';
import type { LobbyData } from './types';

export default function FriendChessApp() {
  const { auth } = getFriendChessFirebase();
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'history' | 'settings'>('home');
  const [preSelectedGame, setPreSelectedGame] = useState<LobbyData | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => {
      setInitializing(false);
    });
    return unsub;
  }, [auth]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-fc-bg-dark flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-fc-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-bg-dark">
      <div className="fixed top-4 left-4 z-[200] flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest border border-white/10 backdrop-blur"
        >
          ← Game catalog
        </Link>
      </div>

      {currentLobbyId ? (
        <FriendChessGame lobbyId={currentLobbyId} onExit={() => setCurrentLobbyId(null)} />
      ) : view === 'history' ? (
        <FriendChessHistoryView
          initialGame={preSelectedGame}
          onBack={() => {
            setView('home');
            setPreSelectedGame(null);
          }}
        />
      ) : view === 'settings' ? (
        <FriendChessSettings onBack={() => setView('home')} />
      ) : (
        <FriendChessHome
          onJoinLobby={(id) => setCurrentLobbyId(id)}
          onShowHistory={(game) => {
            if (game) setPreSelectedGame(game);
            setView('history');
          }}
          onShowSettings={() => setView('settings')}
        />
      )}
    </div>
  );
}
