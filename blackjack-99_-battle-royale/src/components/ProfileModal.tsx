import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, Trophy, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  acceptFriendRequest,
  declineFriendRequest,
  ensurePublicProfile,
  getProfileDashboard,
  sendFriendRequest,
  subscribeToFriends,
  subscribeToNotifications,
  type FriendEntry,
  type ProfileDashboard,
  type ProfileNotification,
} from '../lib/profileSocial';

type ProfileModalProps = {
  isOpen: boolean;
  initialView?: 'profile' | 'inbox';
  onClose: () => void;
};

const emptyDashboard: ProfileDashboard = {
  profile: null,
  highScores: {
    blackjackWins: 0,
    snakeRush: 0,
    molarMadness: 0,
  },
};

const getFriendlyError = (error: unknown) => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      return parsed.error || error.message;
    } catch {
      return error.message;
    }
  }

  return 'Something went wrong.';
};

export function ProfileModal({ isOpen, initialView = 'profile', onClose }: ProfileModalProps) {
  const { uid, displayName, isGuest } = useAuth();
  const [view, setView] = useState<'profile' | 'inbox'>(initialView);
  const [dashboard, setDashboard] = useState<ProfileDashboard>(emptyDashboard);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [notifications, setNotifications] = useState<ProfileNotification[]>([]);
  const [friendName, setFriendName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingRequests = useMemo(
    () => notifications.filter((notification) => notification.status === 'pending'),
    [notifications]
  );

  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [initialView, isOpen]);

  useEffect(() => {
    if (!isOpen || !uid) return;

    let isMounted = true;
    setLoading(true);
    void ensurePublicProfile(uid, displayName);
    getProfileDashboard(uid)
      .then((nextDashboard) => {
        if (isMounted) setDashboard(nextDashboard);
      })
      .catch((err) => {
        if (isMounted) setError(getFriendlyError(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const unsubscribeFriends = subscribeToFriends(uid, setFriends);
    const unsubscribeNotifications = subscribeToNotifications(uid, setNotifications);

    return () => {
      isMounted = false;
      unsubscribeFriends();
      unsubscribeNotifications();
    };
  }, [isOpen, uid]);

  const handleSendRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!uid) return;

    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      await sendFriendRequest(uid, displayName, friendName);
      setFriendName('');
      setMessage('Friend request sent.');
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (notification: ProfileNotification) => {
    if (!uid) return;

    setError(null);
    try {
      await acceptFriendRequest(uid, displayName, notification);
      setMessage('Friend request accepted.');
    } catch (err) {
      setError(getFriendlyError(err));
    }
  };

  const handleDecline = async (notification: ProfileNotification) => {
    if (!uid) return;

    setError(null);
    try {
      await declineFriendRequest(uid, notification);
      setMessage('Friend request declined.');
    } catch (err) {
      setError(getFriendlyError(err));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="site-profile-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button type="button" className="site-profile-backdrop" onClick={onClose} aria-label="Close profile" />

        <motion.section
          className="site-profile-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-profile-title"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
        >
          <header className="site-profile-header">
            <div>
              <span className="site-profile-kicker">Player Profile</span>
              <h2 id="site-profile-title">{displayName}</h2>
              {isGuest && <p>Guest profiles save locally and cannot use friends yet.</p>}
            </div>
            <button type="button" className="site-profile-close" onClick={onClose} aria-label="Close profile">
              <X size={20} />
            </button>
          </header>

          {!uid ? (
            <div className="site-profile-empty">
              Sign in with Google or email to use profile stats, friends, and notifications.
            </div>
          ) : (
            <>
              <div className="site-profile-tabs" role="tablist" aria-label="Profile sections">
                <button
                  type="button"
                  className={view === 'profile' ? 'is-active' : ''}
                  onClick={() => setView('profile')}
                >
                  <Users size={16} />
                  Profile
                </button>
                <button
                  type="button"
                  className={view === 'inbox' ? 'is-active' : ''}
                  onClick={() => setView('inbox')}
                >
                  <Bell size={16} />
                  Inbox
                  {pendingRequests.length > 0 && <span>{pendingRequests.length}</span>}
                </button>
              </div>

              {message && <div className="site-profile-message">{message}</div>}
              {error && <div className="site-profile-error">{error}</div>}

              {view === 'profile' ? (
                <div className="site-profile-content">
                  <section className="site-profile-section" aria-labelledby="site-profile-stats-title">
                    <h3 id="site-profile-stats-title">High Scores</h3>
                    <div className="site-profile-stats">
                      <div>
                        <Trophy size={18} />
                        <span>Blackjack 99 Wins</span>
                        <strong>{dashboard.highScores.blackjackWins}</strong>
                      </div>
                      <div>
                        <Trophy size={18} />
                        <span>Molar Madness</span>
                        <strong>{dashboard.highScores.molarMadness.toLocaleString()}</strong>
                      </div>
                      <div>
                        <Trophy size={18} />
                        <span>Snake Rush</span>
                        <strong>{dashboard.highScores.snakeRush.toLocaleString()}</strong>
                      </div>
                    </div>
                    {loading && <p className="site-profile-muted">Loading stats...</p>}
                  </section>

                  <section className="site-profile-section" aria-labelledby="site-profile-friends-title">
                    <div className="site-profile-section-heading">
                      <h3 id="site-profile-friends-title">Friends</h3>
                      <span>{friends.length}</span>
                    </div>

                    <form className="site-profile-add-friend" onSubmit={handleSendRequest}>
                      <label htmlFor="site-profile-friend-name">Add by username</label>
                      <div>
                        <input
                          id="site-profile-friend-name"
                          value={friendName}
                          onChange={(event) => setFriendName(event.target.value)}
                          placeholder="Username"
                          maxLength={16}
                        />
                        <button type="submit" disabled={loading || !friendName.trim()}>
                          <UserPlus size={17} />
                          Add
                        </button>
                      </div>
                    </form>

                    <div className="site-profile-list">
                      {friends.length === 0 ? (
                        <div className="site-profile-empty">No friends yet.</div>
                      ) : (
                        friends.map((friend) => (
                          <div key={friend.uid} className="site-profile-row">
                            <span>{friend.displayName}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <section className="site-profile-section" aria-labelledby="site-profile-inbox-title">
                  <div className="site-profile-section-heading">
                    <h3 id="site-profile-inbox-title">Notifications</h3>
                    <span>{pendingRequests.length} pending</span>
                  </div>

                  <div className="site-profile-list">
                    {notifications.length === 0 ? (
                      <div className="site-profile-empty">Your inbox is clear.</div>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="site-profile-row site-profile-notification">
                          <div>
                            <strong>{notification.fromName}</strong>
                            <span>
                              {notification.status === 'pending'
                                ? 'sent you a friend request'
                                : `friend request ${notification.status}`}
                            </span>
                          </div>

                          {notification.status === 'pending' && (
                            <div className="site-profile-actions">
                              <button type="button" onClick={() => handleAccept(notification)}>
                                <Check size={15} />
                                Accept
                              </button>
                              <button type="button" onClick={() => handleDecline(notification)}>
                                <X size={15} />
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
