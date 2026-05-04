import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Gamepad2, Play, Star, TrendingUp, Clock, Info } from 'lucide-react';

interface IntroScreenProps {
  onLaunchGame: (gameId: string) => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onLaunchGame }) => {
  const navigate = useNavigate();
  const games = [
    {
      id: 'blackjack-99',
      title: 'Blackjack 99',
      description: 'Survival Battle Royale',
      image: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&q=80&w=400',
      category: 'Strategy',
      rating: 4.8,
      players: '2.4k'
    },
    {
      id: 'neon-snake',
      title: 'Neon Snake',
      description: 'Multiplayer glowing snake arena',
      image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400',
      category: 'Arcade',
      rating: 4.7,
      players: 'Live',
      externalUrl: 'https://multiplayer-neon-snake.onrender.com/'
    },
    {
      id: 'punchy',
      title: 'Punchy',
      description: 'A fast-paced fighting game.',
      image: 'https://share.google/n4lfjvg8FThBjYAxx',
      category: 'Action',
      rating: 4.5,
      players: '1 Player',
      externalUrl: 'https://fishfolk.github.io/punchy/player/latest/'
    },
    {
      id: 'friend-chess',
      title: 'Friend Chess',
      description: 'Play real-time chess against a friend with lobby codes.',
      image: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&q=80&w=400',
      category: 'Strategy',
      rating: 4.6,
      players: '2 Players',
      internalPath: '/friend-chess',
    },
    {
      id: 'molar-madness',
      title: 'Molar Madness',
      description: 'Familiarly-styled arcade game with cavitites, candy, and hygeine',
      image: 'images/molar-madness.png',
      category: 'Arcade',
      rating: 4.7,
      players: '1 Player'
    }
  ];

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans selection:bg-orange-500 selection:text-white">
      {/* Navigation / Header */}
      <nav className="bg-[#121212] border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Gamepad2 className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-black italic tracking-tighter uppercase text-orange-500 font-display">
            Ants In My Pants
          </span>
        </div>

        <div className="hidden md:flex items-center space-x-8 text-xs font-bold uppercase tracking-widest text-gray-400">
          <a href="#" className="hover:text-orange-500 transition-colors">New Games</a>
          <a href="#" className="hover:text-orange-500 transition-colors">Strategy</a>
          <a href="#" className="hover:text-orange-500 transition-colors">Action</a>
          <a href="#" className="hover:text-orange-500 transition-colors">About</a>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative hidden sm:block">
            <input
              type="text"
              placeholder="Search games..."
              className="bg-white/5 border border-white/10 rounded-full py-2 px-6 text-xs focus:outline-none focus:border-orange-500/50 w-48 transition-all"
            />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative py-16 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase italic text-white mb-6 drop-shadow-2xl font-display">
              <span className="text-orange-600">ANTS</span> IN MY <br /> PANTS
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
              The premier playground for high-stakes games and addictive puzzles. Join the colony and start your win streak today.
            </p>
          </motion.div>
        </div>
      </header>

      {/* Featured / Catalog Section */}
      <main className="max-w-6xl mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <TrendingUp className="text-orange-500 w-5 h-5" />
            <h2 className="text-2xl font-black uppercase italic tracking-tight">Game Catalog</h2>
          </div>

          <div className="flex space-x-2">
            <button className="bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/5 transition-all">
              All
            </button>
            <button className="text-gray-500 hover:text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all">
              Popular
            </button>
            <button className="text-gray-500 hover:text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all">
              Strategy
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {games.map((game) => (
            <motion.div
              key={game.id}
              whileHover={{ y: -10 }}
              className="group relative bg-[#222] rounded-[2rem] overflow-hidden border border-white/5 hover:border-orange-500/30 transition-all duration-300 shadow-xl"
            >
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#222] via-transparent to-transparent opacity-60" />

                <div className="absolute top-4 left-4 bg-orange-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                  {game.category}
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-black italic uppercase tracking-tight font-display">
                    {game.title}
                  </h3>

                  <div className="flex items-center space-x-1 text-orange-500">
                    <Star size={14} fill="currentColor" />
                    <span className="text-xs font-black">{game.rating}</span>
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  {game.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Clock size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {game.players} playing now
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if ('internalPath' in game && game.internalPath) {
                        navigate(game.internalPath);
                      } else if ('externalUrl' in game && game.externalUrl) {
                        window.location.href = game.externalUrl;
                      } else {
                        onLaunchGame(game.id);
                      }
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-3 rounded-2xl shadow-lg shadow-orange-600/20 transition-all group-hover:scale-110 flex items-center justify-center gap-2 min-w-[3rem]"
                  >
                    <Play size={18} fill="currentColor" className="shrink-0" />
                    {'internalPath' in game && game.internalPath ? (
                      <span className="text-[10px] font-black uppercase tracking-widest pr-1">Play Now</span>
                    ) : null}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Catalog Placeholders for "vibe" */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white/5 rounded-[2rem] border border-white/5 border-dashed flex flex-col items-center justify-center p-12 opacity-50 grayscale"
            >
              <div className="w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center mb-4">
                <Clock className="text-gray-500 w-6 h-6" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 italic">
                Coming Soon to the Colony
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#121212] border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-8 md:space-y-0">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center space-x-2 mb-4">
              <Gamepad2 className="text-orange-500 w-5 h-5" />
              <span className="text-xl font-black italic uppercase tracking-tighter text-white">
                Ants In My Pants
              </span>
            </div>

            <p className="text-gray-500 text-xs font-medium tracking-tight max-w-xs text-center md:text-left">
              The ultimate destination for gamers who demand more from their playtime.
            </p>
          </div>

          <div className="flex space-x-12">
            <div className="flex flex-col space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Platform</span>
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">Games</a>
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">Community</a>
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">Support</a>
            </div>

            <div className="flex flex-col space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Legal</span>
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-600">
          <span>&copy; 2024 Ants In My Pants Gaming</span>

          <div className="flex items-center space-x-2">
            <Info size={12} />
            <span>Play Responsibly</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
