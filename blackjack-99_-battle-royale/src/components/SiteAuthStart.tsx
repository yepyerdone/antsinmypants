import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Crown, Flame, Gamepad2, Loader2, Lock, Mail, Sparkles, User, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'register';

const friendlyAuthError = (error: unknown) => {
  const err = error as { code?: string; message?: string };

  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email or password does not look right.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Use a stronger password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed before it finished.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase sign-in yet.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase. Check your connection or blockers.';
    default:
      return err?.message && !err.message.includes('Firebase:')
        ? err.message
        : 'Sign-in failed. Please try again.';
  }
};

export function SiteAuthStart() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState<'google' | 'email' | 'guest' | null>(null);

  const handleGoogle = async () => {
    setError('');
    setLoadingAction('google');
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoadingAction('email');

    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password, displayName.trim());
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGuest = async () => {
    setError('');
    setLoadingAction('guest');
    try {
      await continueAsGuest();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const isBusy = loadingAction !== null;

  return (
    <main className="site-auth-page">
      <div className="site-auth-page__grid" aria-hidden="true" />
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="site-auth-shell"
        aria-label="Games website sign in"
      >
        <div className="site-auth-hero">
          <div className="site-auth-badge">
            <Flame size={16} />
            <span>Arcade Access</span>
          </div>

          <div className="site-auth-brand">
            <div className="site-auth-mark">
              <Gamepad2 size={30} />
            </div>
            <div>
              <h1>Honor Roll Arcade</h1>
            </div>
          </div>

          <p className="site-auth-subtitle">
            Jump into quick games, chase high scores, and play your way.
          </p>

          <div className="site-auth-highlights" aria-label="Site features">
            <div>
              <Crown size={17} />
              <span>Online scores</span>
            </div>
            <div>
              <Sparkles size={17} />
              <span>Guest play</span>
            </div>
            <div>
              <Gamepad2 size={17} />
              <span>Fast games</span>
            </div>
          </div>
        </div>

        <div className="site-auth-card">
          <div className="site-auth-card__header">
            <p>Player Login</p>
            <h2>{mode === 'login' ? 'Ready up' : 'Create your player'}</h2>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isBusy}
            className="site-auth-google"
          >
            {loadingAction === 'google' ? <Loader2 className="animate-spin" size={19} /> : <UserRound size={19} />}
            <span>Continue with Google</span>
          </button>

          <div className="site-auth-divider">
            <span>Email account</span>
          </div>

          <form onSubmit={handleEmail} className="site-auth-form">
            {mode === 'register' && (
              <label>
                <span>Display name</span>
                <div>
                  <User size={17} />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="LuckyPlayer"
                    maxLength={16}
                  />
                </div>
              </label>
            )}

            <label>
              <span>Email</span>
              <div>
                <Mail size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="player@example.com"
                  autoComplete="email"
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div>
                <Lock size={17} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </label>

            {error && (
              <div className="site-auth-error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isBusy} className="site-auth-submit">
              {loadingAction === 'email' && <Loader2 className="animate-spin" size={18} />}
              <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            </button>
          </form>

          <div className="site-auth-switch">
            <span>{mode === 'login' ? 'New here?' : 'Already have an account?'}</span>
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} disabled={isBusy}>
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>

          <button type="button" onClick={handleGuest} disabled={isBusy} className="site-auth-guest">
            {loadingAction === 'guest' ? <Loader2 className="animate-spin" size={17} /> : <Gamepad2 size={17} />}
            <span>Play as Guest</span>
          </button>
          <p className="site-auth-guest-note">
            Guest players choose a display name next and stay marked as guests.
          </p>
        </div>
      </motion.section>
    </main>
  );
}
