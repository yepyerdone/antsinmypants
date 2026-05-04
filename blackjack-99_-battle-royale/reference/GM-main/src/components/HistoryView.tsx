import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { LobbyData, MoveRecord } from '../types';
import { BOARD_THEMES, DEFAULT_THEME } from '../constants';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ChevronLeft, ChevronRight, RotateCcw, Calendar, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryViewProps {
  onBack: () => void;
  initialGame?: LobbyData | null;
}

export default function HistoryView({ onBack, initialGame }: HistoryViewProps) {
  const [games, setGames] = useState<LobbyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<LobbyData | null>(initialGame || null);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [viewerGame, setViewerGame] = useState(new Chess());

  const user = auth.currentUser;

  useEffect(() => {
    async function fetchHistory() {
      if (!user) return;
      try {
        const qW = query(collection(db, 'lobbies'), where('playerW', '==', user.uid), where('status', '==', 'finished'));
        const qB = query(collection(db, 'lobbies'), where('playerB', '==', user.uid), where('status', '==', 'finished'));

        const [snapW, snapB] = await Promise.all([getDocs(qW), getDocs(qB)]);
        const allGames = [...snapW.docs, ...snapB.docs].map(doc => ({ id: doc.id, ...doc.data() } as LobbyData));
        allGames.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setGames(allGames);
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user]);

  // Fetch moves when a game is selected
  useEffect(() => {
    async function fetchMoves() {
      if (!selectedGame) return;
      const movesRef = collection(db, 'lobbies', selectedGame.id, 'moves');
      const q = query(movesRef, orderBy('index', 'asc'));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const moveData = snap.docs.map(doc => doc.data() as MoveRecord);
        // Explicit client-side sort by index to double-ensure order
        moveData.sort((a, b) => a.index - b.index);
        setMoves(moveData);
      } else if (selectedGame.moves) {
        // Fallback to legacy moves array
        const legacyMoves = selectedGame.moves.map((m, idx) => ({
          move: m,
          index: idx,
          player: '', 
          timestamp: null
        } as MoveRecord));
        setMoves(legacyMoves);
      }
    }
    fetchMoves();
  }, [selectedGame]);

  // Replay moves
  useEffect(() => {
    if (selectedGame) {
      const g = new Chess(); 
      for (let i = 0; i <= moveIndex; i++) {
        if (moves[i]) {
          try {
            const result = g.move(moves[i].move);
            if (!result) {
              console.warn(`Illegal move in history at index ${i}: ${moves[i].move}`);
              // Try UCI if SAN fails? No, moves are stored as SAN.
              // If it fails, the replay stops being accurate for that board.
            }
          } catch (e) {
            console.error(`Replay error: ${moves[i].move}`, e);
          }
        }
      }
      setViewerGame(g);
    }
  }, [selectedGame, moveIndex, moves]);

  const selectGame = (game: LobbyData) => {
    setSelectedGame(game);
    setMoveIndex(-1);
    setMoves([]);
    setViewerGame(new Chess());
  };

  const nextMove = () => {
    if (selectedGame && moveIndex < moves.length - 1) {
      setMoveIndex(prev => prev + 1);
    }
  };

  const prevMove = () => {
    if (moveIndex >= 0) {
      setMoveIndex(prev => prev - 1);
    }
  };

  const resetView = () => setMoveIndex(-1);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-dark">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg-dark text-white font-sans">
      <header className="h-16 border-b border-border-dim flex items-center justify-between px-8 bg-bg-header shrink-0">
        <button 
          onClick={selectedGame ? () => setSelectedGame(null) : onBack}
          className="flex items-center gap-2 text-[#888] hover:text-white transition-colors uppercase tracking-widest text-xs font-bold"
        >
          <ChevronLeft size={16} />
          {selectedGame ? 'Back to List' : 'Back to Hall'}
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gold" />
          <h1 className="text-sm font-bold tracking-widest uppercase">
            {selectedGame ? `Analysis: ${selectedGame.code}` : 'Chess History'}
          </h1>
        </div>
        <div className="w-20"></div>
      </header>

      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {!selectedGame ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 lg:p-12 max-w-5xl mx-auto w-full"
            >
              

              {games.length === 0 ? (
                <div className="p-20 border border-dashed border-[#222] rounded-3xl text-center">
                  <p className="text-[#444] uppercase tracking-[0.2em] text-xs font-bold">No combat records found yet.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {games.map(game => (
                    <div 
                      key={game.id}
                      onClick={() => selectGame(game)}
                      className="bg-bg-panel border border-border-dim p-6 rounded-xl hover:border-gold transition-all cursor-pointer group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-[#141414] rounded-lg flex items-center justify-center text-gold border border-[#222]">
                          <Trophy size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-lg uppercase tracking-wider">{game.code}</h3>
                            <span className="text-[10px] text-[#444] font-mono tracking-widest">
                              {new Date(game.updatedAt?.seconds * 1000).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#666] tracking-wide">
                            <span className={game.winner === 'White' ? 'text-gold' : ''}>{game.whiteName} (W)</span>
                            <span className="text-[#333]">vs</span>
                            <span className={game.winner === 'Black' ? 'text-gold' : ''}>{game.blackName} (B)</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-[0.2em] border border-gold/20 text-gold px-2 py-1 rounded">
                          {game.winner === 'Draw' ? 'Draw' : `${game.winner} Won`}
                        </span>
                        <div className="text-[9px] text-[#444] uppercase tracking-widest font-bold">
                          GAME FINISHED
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col lg:flex-row"
            >
              <div className="flex-1 p-4 lg:p-12 flex items-center justify-center bg-[#080808]">
                <div className="w-full max-w-[min(85vh,750px)] aspect-square rounded-xl overflow-hidden shadow-2xl border-[12px] border-[#1A1A1A]">
                  <Chessboard 
                    options={{
                      id: `HistoryBoard-${selectedGame.id}`,
                      position: viewerGame.fen(),
                      boardOrientation: selectedGame.playerB === user?.uid ? 'black' : 'white',
                      darkSquareStyle: { backgroundColor: (BOARD_THEMES.find(t => t.id === selectedGame.theme) || DEFAULT_THEME).dark },
                      lightSquareStyle: { backgroundColor: (BOARD_THEMES.find(t => t.id === selectedGame.theme) || DEFAULT_THEME).light },
                      animationDurationInMs: 200,
                      allowDragging: false
                    }}
                  />
                </div>
              </div>

              <div className="w-full lg:w-[400px] border-l border-border-dim bg-bg-panel p-8 flex flex-col shrink-0">
                <div className="mb-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-gold text-[10px] uppercase font-bold tracking-[0.2em] mb-2">Game Review</p>
                      <h2 className="text-2xl font-bold text-white uppercase italic">{selectedGame.code}</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#444] uppercase font-bold tracking-widest mb-1">Result</p>
                      <p className="text-sm font-bold text-white uppercase tracking-wider">{selectedGame.winner}</p>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-[#0d0d0d] border border-[#222] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white text-black flex items-center justify-center font-bold text-xs">W</div>
                      <span className="text-sm font-bold tracking-wide">{selectedGame.whiteName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-[#333] text-white flex items-center justify-center font-bold text-xs">B</div>
                      <span className="text-sm font-bold tracking-wide">{selectedGame.blackName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-[#080808] border border-[#111] p-4 rounded-xl mb-8 font-mono text-xs">
                  <div className="mb-4 text-[#444] uppercase text-[9px] tracking-[0.2em] font-bold">Move Sequence</div>
                  <div className="grid grid-cols-2 gap-2">
                    {moves.map((m, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setMoveIndex(idx)}
                        className={`p-2 rounded text-left transition-all ${moveIndex === idx ? 'bg-gold text-black font-bold' : 'text-[#666] hover:bg-[#111]'}`}
                      >
                        <span className="opacity-40 mr-2">{Math.floor(idx / 2) + 1}{idx % 2 === 0 ? '.' : '...'}</span>
                        {m.move}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button onClick={prevMove} disabled={moveIndex < 0} className="flex-1 py-4 bg-[#111] border border-[#222] text-white rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#1A1A1A] transition-all">
                      <ChevronLeft />
                    </button>
                    <button onClick={nextMove} disabled={moveIndex >= moves.length - 1} className="flex-1 py-4 bg-[#111] border border-[#222] text-white rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#1A1A1A] transition-all">
                      <ChevronRight />
                    </button>
                  </div>
                  <button onClick={resetView} className="w-full py-3 text-[10px] uppercase font-bold tracking-[0.3em] text-[#444] hover:text-white transition-colors flex items-center justify-center gap-2">
                    <RotateCcw size={12} /> Reset Position
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
