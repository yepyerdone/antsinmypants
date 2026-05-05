import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const GUEST_MODE_KEY = 'global_games_guest_mode';
const GUEST_DISPLAY_NAME_KEY = 'global_games_guest_display_name';

export type PlayerIdentity = {
  playerName: string;
  playerId: string | null;
  isGuest: boolean;
};

export function usePlayerIdentity(): PlayerIdentity {
  const { displayName, uid, isGuest } = useAuth();

  return {
    playerName: displayName || 'Player',
    playerId: uid,
    isGuest,
  };
}

export function getCurrentPlayerIdentity(): PlayerIdentity {
  const user = auth.currentUser;
  const isGuest = localStorage.getItem(GUEST_MODE_KEY) === 'true' || Boolean(user?.isAnonymous);
  const guestDisplayName = localStorage.getItem(GUEST_DISPLAY_NAME_KEY)?.trim() || '';

  return {
    playerName: isGuest ? guestDisplayName || 'Guest Player' : user?.displayName || user?.email?.split('@')[0] || 'Player',
    playerId: user && !isGuest ? user.uid : null,
    isGuest,
  };
}
