import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Castle, History, LayoutDashboard, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { getFriendChessFirebase } from './lib/friendChessFirebase';
import FriendChessHome from './components/FriendChessHome';
import FriendChessGame from './components/FriendChessGame';
import FriendChessHistoryView from './components/FriendChessHistoryView';
import FriendChessSettings from './components/FriendChessSettings';
import { BOT_DIFFICULTIES, DEFAULT_THEME } from './constants';
import type { BotDifficultyId, BotGameConfig, LobbyData } from './types';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';
import { useAuth } from '../../context/AuthContext';

type FriendChessView = 'home' | 'history' | 'settings';

export default function FriendChessApp() {
  const { auth } = getFriendChessFirebase();
  const { logout } = useAuth();
  const { playerName } = usePlayerIdentity();
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [botGameConfig, setBotGameConfig] = useState<BotGameConfig | null>(null);
  const [view, setView] = useState<FriendChessView>('home');
  const [preSelectedGame, setPreSelectedGame] = useState<LobbyData | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
    return unsub;
  }, [auth]);

  const showDashboard = () => {
    setPreSelectedGame(null);
    setView('home');
  };

  const showHistory = () => {
    setPreSelectedGame(null);
    setView('history');
  };

  const handleStartBotGame = (difficultyId: string, timeControl: number) => {
    const difficulty =
      BOT_DIFFICULTIES.find((item) => item.id === (difficultyId as BotDifficultyId)) || BOT_DIFFICULTIES[2];
    setBotGameConfig({
      difficulty,
      timeControl,
      playerName,
      theme: DEFAULT_THEME.id,
    });
  };

  const renderSidebar = () => (
    <aside className="friend-chess-sidebar border-r border-fc-border-dim bg-fc-bg-panel hidden lg:flex flex-col shrink-0">
      <div className="friend-chess-sidebar-brand p-8">
        <Link to="/" className="inline-flex items-center gap-3 text-fc-gold font-black tracking-[0.18em] uppercase">
          <Castle size={26} />
          Friend Chess
        </Link>
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#8a8276] font-bold">
          Tables, matches, reviews
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          type="button"
          onClick={showDashboard}
          className={`friend-chess-nav-button w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            view === 'home' ? 'is-active text-white' : 'text-[#8a8276] hover:text-white'
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        <button
          type="button"
          onClick={showHistory}
          className={`friend-chess-nav-button w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            view === 'history' ? 'is-active text-white' : 'text-[#8a8276] hover:text-white'
          }`}
        >
          <History size={18} />
          History
        </button>
      </nav>

      <div className="p-6 border-t border-fc-border-dim space-y-4">
        <button
          type="button"
          onClick={() => setView('settings')}
          className={`friend-chess-secondary-button w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest ${
            view === 'settings' ? 'is-active' : ''
          }`}
        >
          <SettingsIcon size={16} />
          Settings
        </button>

        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-10 h-10 rounded-lg object-cover border border-fc-gold/30" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-fc-gold text-black flex items-center justify-center font-black">
              {playerName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white truncate">{playerName}</p>
            <p className="text-[10px] uppercase tracking-widest text-[#7c7468] font-bold">Player</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="p-2 text-[#8a8276] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );

  const renderMobileNav = () => (
    <div className="friend-chess-mobile-nav lg:hidden">
      <button type="button" onClick={showDashboard} className={view === 'home' ? 'is-active' : ''}>
        Dashboard
      </button>
      <button type="button" onClick={showHistory} className={view === 'history' ? 'is-active' : ''}>
        History
      </button>
      <button type="button" onClick={() => setView('settings')} className={view === 'settings' ? 'is-active' : ''}>
        Settings
      </button>
    </div>
  );

  const renderContent = () => {
    if (view === 'history') {
      return <FriendChessHistoryView initialGame={preSelectedGame} onBack={showDashboard} />;
    }

    if (view === 'settings') {
      return <FriendChessSettings onBack={showDashboard} />;
    }

    return (
      <FriendChessHome
        onJoinLobby={(id) => setCurrentLobbyId(id)}
        onStartBotGame={handleStartBotGame}
        onShowHistory={(game) => {
          if (game) setPreSelectedGame(game);
          setView('history');
        }}
      />
    );
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-fc-bg-dark flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-fc-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (botGameConfig) {
    return (
      <div className="min-h-screen bg-fc-bg-dark">
        <FriendChessGame botConfig={botGameConfig} onExit={() => setBotGameConfig(null)} />
      </div>
    );
  }

  if (currentLobbyId) {
    return (
      <div className="min-h-screen bg-fc-bg-dark">
        <FriendChessGame lobbyId={currentLobbyId} onExit={() => setCurrentLobbyId(null)} />
      </div>
    );
  }

  return (
    <div className="friend-chess-home-page w-full h-screen bg-fc-bg-dark text-[#E0E0E0] font-sans flex overflow-hidden">
      {renderSidebar()}

      <main className="friend-chess-main flex-1 flex flex-col overflow-auto">
        {renderMobileNav()}
        {renderContent()}
      </main>
    </div>
  );
}
