import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, addDoc, increment } from 'firebase/firestore';
import { getFriendChessFirebase } from '../lib/friendChessFirebase';
import type { LobbyData } from '../types';
import { BOARD_THEMES, DEFAULT_THEME, FC_COLLECTIONS } from '../constants';
import { Trophy, User, ArrowLeft, Copy, Check, Info, History } from 'lucide-react';
import { motion } from 'motion/react';

interface FriendChessGameProps {
  lobbyId: string;
  onExit: () => void;
}

export default function FriendChessGame({ lobbyId, onExit }: FriendChessGameProps) {
  const { db, auth } = getFriendChessFirebase();
  const [game, setGame] = useState(new Chess());
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [localClocks, setLocalClocks] = useState<{ w: number; b: number }>({ w: 600, b: 600 });

  useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, [auth]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, FC_COLLECTIONS.lobbies, lobbyId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as LobbyData;

          if (data.clocks) {
            let w = data.clocks.w;
            let b = data.clocks.b;

            if (data.status === 'playing' && data.clocks.lastTickAt && typeof (data.clocks.lastTickAt as { toDate?: () => Date }).toDate === 'function') {
              const lastTick = (data.clocks.lastTickAt as { toDate: () => Date }).toDate().getTime();
              const now = Date.now();
              const elapsed = Math.max(0, Math.floor((now - lastTick) / 1000));

              if (data.turn === 'w') w = Math.max(0, w - elapsed);
              else b = Math.max(0, b - elapsed);
            }
            setLocalClocks({ w, b });
          }

          setLobby(data);
        } else {
          setErrorMsg('Match session no longer exists.');
        }
      },
      (error) => {
        console.error('Snapshot Error:', error);
        setErrorMsg('Lost connection to match.');
      },
    );

    return unsub;
  }, [lobbyId, db]);

  useEffect(() => {
    if (!lobby?.fen) return;
    setGame((prev) => {
      if (prev.fen() === lobby.fen) return prev;
      return new Chess(lobby.fen);
    });
  }, [lobby?.fen, lobby]);

  useEffect(() => {
    if (!lobby || lobby.status !== 'playing' || !lobby.clocks?.lastTickAt) return;

    const interval = setInterval(() => {
      setLocalClocks((prev) => {
        const next = { ...prev };
        if (lobby.turn === 'w') {
          next.w = Math.max(0, next.w - 1);
          if (next.w === 0) void handleTimeout('w');
        } else {
          next.b = Math.max(0, next.b - 1);
          if (next.b === 0) void handleTimeout('b');
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby?.status, lobby?.turn, lobby?.clocks?.lastTickAt, lobby]);

  const handleTimeout = async (color: 'w' | 'b') => {
    if (!lobbyId || !lobby || lobby.status !== 'playing') return;
    const winner = color === 'w' ? 'Black' : 'White';
    try {
      await updateDoc(doc(db, FC_COLLECTIONS.lobbies, lobbyId), {
        status: 'finished',
        winner,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Timeout update failed:', err);
    }
  };

  const onDrop = useCallback(
    (args: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
      const { sourceSquare, targetSquare } = args;

      if (!lobby || !user || !targetSquare) return false;

      const isPlayerW = user.uid === lobby.playerW;
      const isPlayerB = user.uid === lobby.playerB;
      const myColor = isPlayerW ? 'w' : isPlayerB ? 'b' : null;

      if (lobby.status !== 'playing' || !myColor || lobby.turn !== myColor) {
        return false;
      }

      try {
        const g = new Chess(game.fen());
        const move = g.move({
          from: sourceSquare as never,
          to: targetSquare as never,
          promotion: 'q',
        });

        if (move === null) return false;

        setMoveFrom(null);
        setOptionSquares({});

        setGame(g);
        setErrorMsg(null);

        const status = g.isGameOver() ? 'finished' : 'playing';
        let winner: string | null = null;
        if (g.isCheckmate()) winner = g.turn() === 'w' ? 'Black' : 'White';
        else if (g.isDraw() || g.isGameOver()) winner = 'Draw';

        const lobbyRef = doc(db, FC_COLLECTIONS.lobbies, lobbyId);
        const movesRef = collection(db, FC_COLLECTIONS.lobbies, lobbyId, 'moves');

        const moveIndex = lobby.moveCount || 0;

        const newClocks = { ...lobby.clocks } as {
          w: number;
          b: number;
          lastTickAt?: unknown;
        };
        if (lobby.clocks?.lastTickAt && typeof (lobby.clocks.lastTickAt as { toDate?: () => Date }).toDate === 'function') {
          const lastTick = (lobby.clocks.lastTickAt as { toDate: () => Date }).toDate().getTime();
          const now = Date.now();
          const elapsed = Math.max(0, Math.floor((now - lastTick) / 1000));

          if (lobby.turn === 'w') newClocks.w = Math.max(0, newClocks.w - elapsed);
          else newClocks.b = Math.max(0, newClocks.b - elapsed);

          setLocalClocks({ w: newClocks.w, b: newClocks.b });
        }
        newClocks.lastTickAt = serverTimestamp();

        updateDoc(lobbyRef, {
          fen: g.fen(),
          turn: g.turn(),
          status,
          winner,
          moveCount: increment(1),
          clocks: newClocks,
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          console.error('Firestore Update Failed:', err);
          setErrorMsg('Failed to sync move with server.');
        });

        addDoc(movesRef, {
          move: move.san,
          index: moveIndex,
          player: user.uid,
          timestamp: serverTimestamp(),
        });

        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [game, lobby, lobbyId, user, db],
  );

  const getMoveOptions = (square: string) => {
    const moves = game.moves({
      square: square as never,
      verbose: true,
    });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, React.CSSProperties> = {};
    moves.map((m) => {
      newSquares[m.to] = {
        background:
          game.get(m.to as never) && game.get(m.to as never).color !== game.get(square as never).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 20%, transparent 20%)',
        borderRadius: '50%',
      };
      return m;
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };
    setOptionSquares(newSquares);
    return true;
  };

  const onSquareClick = (args: { square: string }) => {
    const { square } = args;

    if (!lobby || !user || lobby.status !== 'playing') return;

    const isPlayerW = user.uid === lobby.playerW;
    const isPlayerB = user.uid === lobby.playerB;
    const myColor = isPlayerW ? 'w' : isPlayerB ? 'b' : null;

    if (!myColor || lobby.turn !== myColor) return;

    if (moveFrom === square) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    if (moveFrom) {
      const result = onDrop({
        piece: null,
        sourceSquare: moveFrom,
        targetSquare: square,
      });

      if (result) {
        setMoveFrom(null);
        setOptionSquares({});
        return;
      }
    }

    const piece = game.get(square as never);
    if (piece && piece.color === myColor) {
      const hasMoves = getMoveOptions(square);
      if (hasMoves) {
        setMoveFrom(square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
    } else {
      setMoveFrom(null);
      setOptionSquares({});
    }
  };

  const copyCode = () => {
    if (lobby) {
      void navigator.clipboard.writeText(lobby.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!lobby)
    return (
      <div className="flex items-center justify-center h-screen bg-fc-bg-dark text-white">
        <div className="w-12 h-12 border-4 border-fc-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  const orientation = user?.uid === lobby.playerB ? 'black' : 'white';
  const isMyTurn = (lobby.turn === 'w' && user?.uid === lobby.playerW) || (lobby.turn === 'b' && user?.uid === lobby.playerB);

  const activeTheme = BOARD_THEMES.find((t) => t.id === lobby.theme) || DEFAULT_THEME;

  return (
    <div className="w-full h-screen bg-fc-bg-dark text-[#E0E0E0] font-sans flex flex-col lg:flex-row overflow-hidden">
      <aside className="w-full lg:w-80 border-r border-fc-border-dim bg-fc-bg-panel flex flex-col shrink-0">
        <div className="p-6 border-b border-fc-border-dim">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-6 group text-xs uppercase tracking-widest font-bold"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Back to Arena
          </button>

          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase text-[#666] font-bold tracking-widest">Match Session</span>
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                lobby.status === 'playing' ? 'text-green-500 bg-green-500/10' : 'text-fc-gold bg-fc-gold/10'
              }`}
            >
              {lobby.status}
            </span>
          </div>
          <div className="flex items-center justify-between mb-4 text-[10px] uppercase tracking-widest text-[#666] font-bold">
            <span>{lobby.variant === 'chess960' ? 'Fischer Random' : 'Standard Chess'}</span>
            <span className="text-[#999]">{lobby.turn === 'w' ? 'White to move' : 'Black to move'}</span>
          </div>
          <h2 className="text-xl font-bold tracking-widest text-white flex items-center gap-2 uppercase">
            {lobby.code}
            <button
              onClick={copyCode}
              className="p-1.5 hover:bg-[#222] rounded-lg transition-colors text-[#444] hover:text-fc-gold"
              type="button"
              title="Copy join code"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="space-y-3">
            <div className="text-[10px] uppercase text-[#666] font-bold tracking-widest mb-2 flex items-center gap-2">
              <User size={10} /> Competitors
            </div>

            <div
              className={`p-4 rounded-xl border transition-all ${
                lobby.turn === 'b'
                  ? 'border-fc-gold bg-fc-gold/5 shadow-[0_0_15px_rgba(196,164,100,0.1)]'
                  : 'border-[#222] bg-[#0d0d0d]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#333] flex items-center justify-center text-white text-xl shadow-inner">♖</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#666] uppercase tracking-tighter">
                    Black {orientation === 'black' ? '(You)' : '(Top)'}
                  </p>
                  <p className="font-bold text-sm truncate uppercase tracking-wide">{lobby.blackName || 'Seeking opponent...'}</p>
                </div>
                <div
                  className={`px-2 py-1 rounded bg-black/40 font-mono text-xs tabular-nums border ${
                    lobby.turn === 'b' ? 'text-fc-gold border-fc-gold/30' : 'text-[#444] border-transparent'
                  }`}
                >
                  {formatTime(localClocks.b)}
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border transition-all ${
                lobby.turn === 'w'
                  ? 'border-fc-gold bg-fc-gold/5 shadow-[0_0_15px_rgba(196,164,100,0.1)]'
                  : 'border-[#222] bg-[#0d0d0d]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-black text-xl shadow-md">♖</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#666] uppercase tracking-tighter">
                    White {orientation === 'white' ? '(You)' : '(Bottom)'}
                  </p>
                  <p className="font-bold text-sm truncate uppercase tracking-wide">{lobby.whiteName}</p>
                </div>
                <div
                  className={`px-2 py-1 rounded bg-black/40 font-mono text-xs tabular-nums border ${
                    lobby.turn === 'w' ? 'text-fc-gold border-fc-gold/30' : 'text-[#444] border-transparent'
                  }`}
                >
                  {formatTime(localClocks.w)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#222] p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] uppercase text-[#666] font-bold tracking-widest">Live Sync</span>
              <History size={12} className="text-[#444]" />
            </div>

            <div className="space-y-2 font-mono text-[11px] h-32 overflow-auto scrollbar-none">
              <div className="text-[#444] text-[9px] uppercase tracking-wider mb-2 text-right italic">
                {lobby.updatedAt && typeof lobby.updatedAt === 'object' && lobby.updatedAt !== null && 'seconds' in lobby.updatedAt
                  ? `Last Sync: ${new Date((lobby.updatedAt as { seconds: number }).seconds * 1000).toLocaleTimeString()}`
                  : 'Syncing...'}
              </div>
              <div className="pt-2 border-t border-[#111]">
                {lobby.status === 'finished' ? (
                  <div className="text-fc-gold font-bold uppercase tracking-widest flex items-center gap-2 py-2">
                    <Trophy size={14} /> Result: {lobby.winner === 'Draw' ? 'Draw' : `${lobby.winner} wins`}
                  </div>
                ) : (
                  <div className="text-[#666] uppercase tracking-widest flex items-center gap-2 py-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${lobby.turn === 'w' ? 'bg-white' : 'bg-fc-gold animate-pulse'}`}></span>
                    {lobby.turn === 'w' ? "White's turn" : "Black's turn"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {lobby.status === 'waiting' && (
            <div className="p-4 bg-fc-gold/10 border border-fc-gold/30 rounded-xl">
              <div className="flex gap-3">
                <Info size={16} className="text-fc-gold shrink-0 mt-0.5" />
                <p className="text-[10px] text-fc-gold/80 leading-relaxed uppercase tracking-wider font-medium">
                  Waiting for a friend to enter the arena using code{' '}
                  <span className="font-bold bg-fc-gold text-black px-1 rounded">{lobby.code}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-fc-border-dim mt-auto">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 uppercase tracking-widest font-bold">
              {errorMsg}
            </div>
          )}
          <p className={`text-center font-bold tracking-[0.2em] uppercase text-xs ${isMyTurn ? 'text-fc-gold' : 'text-[#444]'}`}>
            {isMyTurn ? 'Your Turn' : 'Opponent Moving'}
          </p>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(196,164,100,0.05)_0%,transparent_70%)] pointer-events-none"></div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-[min(85vh,850px)] aspect-square relative z-10"
        >
          <div className="absolute -inset-4 border border-fc-gold/10 rounded-2xl pointer-events-none"></div>
          <div className="absolute -inset-8 border border-white/5 rounded-3xl pointer-events-none"></div>

          <div className="rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-[12px] border-[#1A1A1A]">
            <Chessboard
              options={{
                id: 'FriendChessBoard',
                position: game.fen(),
                onPieceDrop: onDrop,
                onSquareClick: onSquareClick,
                boardOrientation: orientation,
                allowDragging: isMyTurn && lobby.status === 'playing',
                darkSquareStyle: { backgroundColor: activeTheme.dark },
                lightSquareStyle: { backgroundColor: activeTheme.light },
                squareStyles: optionSquares,
                animationDurationInMs: 300,
              }}
            />
          </div>

          {lobby.status === 'finished' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 rounded-xl"
            >
              <div className="text-center p-8 bg-[#141414] border border-fc-gold rounded-2xl shadow-2xl">
                <Trophy className="mx-auto text-fc-gold mb-4" size={48} />
                <h2 className="text-3xl font-bold text-white mb-2 uppercase tracking-widest italic">
                  {game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : lobby.winner === (orientation === 'white' ? 'White' : 'Black') ? 'Won on Time' : 'Lost on Time'}
                </h2>
                <p className="text-fc-gold uppercase tracking-[0.3em] font-medium mb-6">
                  {lobby.winner === 'Draw' ? 'Universal Balance' : `${lobby.winner} Triumphs`}
                </p>
                <button
                  onClick={onExit}
                  className="bg-fc-gold hover:bg-fc-gold-light text-black font-bold py-3 px-8 rounded-md transition-all uppercase tracking-widest text-xs"
                  type="button"
                >
                  Return
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
