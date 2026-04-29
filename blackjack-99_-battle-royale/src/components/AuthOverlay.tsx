import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { updateUserProfile } from '../lib/user';

const googleProvider = new GoogleAuthProvider();

interface AuthOverlayProps {
  onClose: () => void;
}

export function AuthOverlay({ onClose }: AuthOverlayProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await updateUserProfile(result.user.uid, result.user.displayName || 'Player');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (username.length < 3) {
          throw new Error('Username must be at least 3 characters');
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        await updateUserProfile(userCredential.user.uid, username, true);
      }
      onClose();
    } catch (err: any) {
      let message = err.message;
      if (err.code === 'auth/operation-not-allowed') {
        message = 'Email/Password sign-in is not enabled in Firebase. Please enable it in the Firebase Console: Authentication > Sign-in method > Add new provider > Email/Password.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Network error. This is often caused by ad-blockers or strict firewalls blocking Firebase. Please disable ad-blockers and check your connection.';
      } else {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) message = parsed.error;
        } catch (e) {
          // Not a JSON error, use original
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-bg-accent rounded-3xl border border-white/5 p-8 shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white mb-2 italic tracking-tight">
            {isLogin ? 'WELCOME BACK' : 'JOIN THE TABLE'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isLogin ? 'Enter your credentials to continue' : 'Create an account to track your progress'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center space-x-3 mb-6"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
            <span>CONTINUE WITH GOOGLE</span>
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black">
              <span className="bg-bg-accent px-4 text-gray-500 tracking-widest">Or use email</span>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-stake-green/50 focus:ring-1 focus:ring-stake-green/50 outline-none transition-all"
                  placeholder="LuckyPlayer777"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-stake-green/50 focus:ring-1 focus:ring-stake-green/50 outline-none transition-all"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-stake-green/50 focus:ring-1 focus:ring-stake-green/50 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center mt-2 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stake-green hover:bg-green-400 disabled:opacity-50 text-bg-dark font-black py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center space-x-2 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            <span>{isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-gray-500 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-stake-green font-bold hover:underline"
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
