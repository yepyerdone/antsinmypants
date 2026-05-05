import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Gamepad2, Loader2, Sparkles, UserRound } from 'lucide-react';
import { useAuth, validatePlayerName } from '../context/AuthContext';

export function UsernameSetup() {
  const { isGuest, suggestedDisplayName, saveUsername, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestion = useMemo(() => {
    const validation = validatePlayerName(suggestedDisplayName || '');
    return validation.error ? '' : validation.value;
  }, [suggestedDisplayName]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const validation = validatePlayerName(username || suggestion);
    if (validation.error) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    try {
      await saveUsername(validation.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that player name. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    await logout();
  };

  return (
    <main className="site-auth-page site-username-page">
      <div className="site-auth-page__grid" aria-hidden="true" />
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="site-username-card"
        aria-label="Choose your player name"
      >
        <div className="site-auth-mark site-username-mark">
          <Gamepad2 size={30} />
        </div>

        <div className="site-auth-badge">
          <Sparkles size={16} />
          <span>{isGuest ? 'Guest profile' : 'Player profile'}</span>
        </div>

        <h1>Choose your player name</h1>
        <p>This is the name that will show on leaderboards.</p>

        <form onSubmit={handleSubmit} className="site-auth-form site-username-form">
          <label>
            <span>Player name</span>
            <div>
              <UserRound size={17} />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={suggestion || 'Orange Ace'}
                minLength={3}
                maxLength={16}
                autoFocus
              />
            </div>
          </label>

          <div className="site-username-rules">
            3-16 characters. Letters, numbers, spaces, underscores, and hyphens are okay.
          </div>

          {error && (
            <div className="site-auth-error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={saving} className="site-auth-submit">
            {saving && <Loader2 className="animate-spin" size={18} />}
            <span>Save & Continue</span>
          </button>
        </form>

        <button type="button" onClick={handleCancel} disabled={saving} className="site-username-cancel">
          Back to sign in
        </button>
      </motion.section>
    </main>
  );
}
