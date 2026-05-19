import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { audioManager } from '../logic/audioSystem';

interface BankerOfferProps {
  offer: number;
  message: string;
  onDeal: () => void;
  onNoDeal: () => void;
}

export const BankerOffer: React.FC<BankerOfferProps> = ({ offer, message, onDeal, onNoDeal }) => {
  const [displayOffer, setDisplayOffer] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setDisplayOffer(Math.floor(progress * offer));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    audioManager.playOfferReveal();
  }, [offer]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      id="banker-modal"
    >
      <div className="relative overflow-hidden border border-amber-400/50 rounded-3xl max-w-4xl w-full shadow-[0_0_70px_rgba(185,28,28,0.35)]">
        <img src="/assets/banker-devil.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center brightness-125 contrast-125" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,8,0.98)_0%,rgba(5,5,8,0.88)_36%,rgba(5,5,8,0.18)_100%)]" />
        <div className="relative z-10 grid md:grid-cols-[1.05fr_0.95fr] min-h-[520px]">
          <div className="p-6 md:p-10 flex flex-col justify-between">
            <div>
              <h2 className="text-amber-300 text-xl font-bold uppercase tracking-widest mb-2">The Banker Calls</h2>
              <div className="h-1 w-24 bg-red-700 mb-6" />
              <p className="italic text-slate-200 mb-8 min-h-[3rem] max-w-md">"{message}"</p>
            </div>
            <div>
              <div className="text-sm text-slate-400 uppercase font-bold mb-1">Banker's Offer</div>
              <div className="text-5xl md:text-7xl font-black text-white drop-shadow-md">
                ${displayOffer.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="relative flex flex-col justify-end p-6 md:p-10">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-red-200/80 mb-4">Do we have a deal?</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onDeal}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition-transform active:scale-95 shadow-lg shadow-emerald-900/40"
                  id="deal-button"
                >
                  DEAL
                </button>
                <button
                  onClick={onNoDeal}
                  className="px-8 py-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-full transition-transform active:scale-95 shadow-lg shadow-red-950/40"
                  id="no-deal-button"
                >
                  NO DEAL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
