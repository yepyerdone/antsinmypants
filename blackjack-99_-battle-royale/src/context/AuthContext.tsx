import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getUserProfile, saveUserProfile, type SiteUserProfile } from '../lib/user';

const GUEST_MODE_KEY = 'global_games_guest_mode';
const GUEST_DISPLAY_NAME_KEY = 'global_games_guest_display_name';

type UsernameValidationResult = {
  value: string;
  error: string | null;
};

type AuthContextValue = {
  currentUser: User | null;
  firebaseUser: User | null;
  loading: boolean;
  profileLoading: boolean;
  profile: SiteUserProfile | null;
  isGuest: boolean;
  guestDisplayName: string;
  displayName: string;
  suggestedDisplayName: string;
  uid: string | null;
  hasAccess: boolean;
  needsUsernameSetup: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  continueAsGuest: (displayName?: string) => Promise<void>;
  saveUsername: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const getStoredGuestMode = () => localStorage.getItem(GUEST_MODE_KEY) === 'true';
const getStoredGuestDisplayName = () => localStorage.getItem(GUEST_DISPLAY_NAME_KEY)?.trim() || '';

const setStoredGuestMode = (value: boolean) => {
  if (value) {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(GUEST_MODE_KEY);
  }
};

const setStoredGuestDisplayName = (value: string) => {
  if (value) {
    localStorage.setItem(GUEST_DISPLAY_NAME_KEY, value);
  } else {
    localStorage.removeItem(GUEST_DISPLAY_NAME_KEY);
  }
};

const nameFromEmail = (email?: string | null) => {
  const fallback = email?.split('@')[0]?.trim();
  return fallback || 'Player';
};

const getSuggestedName = (user?: User | null) => {
  return user?.displayName?.trim() || nameFromEmail(user?.email);
};

const getProviderId = (user: User) => {
  return user.providerData[0]?.providerId || (user.email ? 'password' : 'firebase');
};

const createGuestName = () => `Guest${Math.floor(1000 + Math.random() * 9000)}`;

export const normalizePlayerName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const validatePlayerName = (value: string): UsernameValidationResult => {
  const normalized = normalizePlayerName(value);

  if (!normalized) {
    return { value: normalized, error: 'Choose a player name to continue.' };
  }

  if (normalized.length < 3) {
    return { value: normalized, error: 'Player names need at least 3 characters.' };
  }

  if (normalized.length > 16) {
    return { value: normalized, error: 'Keep your player name to 16 characters or fewer.' };
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(normalized)) {
    return { value: normalized, error: 'Use letters, numbers, spaces, underscores, or hyphens only.' };
  }

  return { value: normalized, error: null };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<SiteUserProfile | null>(null);
  const [guestMode, setGuestMode] = useState(getStoredGuestMode);
  const [guestDisplayName, setGuestDisplayName] = useState(getStoredGuestDisplayName);

  const loadUserProfile = useCallback(async (user: User) => {
    setProfileLoading(true);
    try {
      const savedProfile = await getUserProfile(user.uid);
      setProfile(savedProfile);

      if (savedProfile?.displayName && user.displayName !== savedProfile.displayName) {
        await updateProfile(user, { displayName: savedProfile.displayName });
      }
    } catch (error) {
      console.error('Failed to load site profile:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);

      if (user?.isAnonymous) {
        const nextGuestName = getStoredGuestDisplayName() || user.displayName?.trim() || createGuestName();
        setStoredGuestDisplayName(nextGuestName);
        setProfile(null);
        setProfileLoading(false);
        setStoredGuestMode(true);
        setGuestMode(true);
        setGuestDisplayName(nextGuestName);
      } else if (user) {
        setStoredGuestMode(false);
        setStoredGuestDisplayName('');
        setGuestMode(false);
        setGuestDisplayName('');
        void loadUserProfile(user);
      } else {
        setProfile(null);
        setProfileLoading(false);
        setGuestMode(getStoredGuestMode());
        setGuestDisplayName(getStoredGuestDisplayName());
      }

      setLoading(false);
    });
  }, [loadUserProfile]);

  const loginWithGoogle = useCallback(async () => {
    setStoredGuestMode(false);
    setStoredGuestDisplayName('');
    setGuestMode(false);
    setGuestDisplayName('');
    await signInWithPopup(auth, googleProvider);
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setStoredGuestMode(false);
    setStoredGuestDisplayName('');
    setGuestMode(false);
    setGuestDisplayName('');
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    const validation = displayName ? validatePlayerName(displayName) : { value: '', error: null };

    if (validation.error) {
      throw new Error(validation.error);
    }

    setStoredGuestMode(false);
    setStoredGuestDisplayName('');
    setGuestMode(false);
    setGuestDisplayName('');

    const result = await createUserWithEmailAndPassword(auth, email, password);

    if (validation.value) {
      await saveUserProfile({
        uid: result.user.uid,
        displayName: validation.value,
        email: result.user.email,
        provider: getProviderId(result.user),
      });
      await updateProfile(result.user, { displayName: validation.value });
      const savedProfile = await getUserProfile(result.user.uid);
      setProfile(savedProfile);
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    const nextName = getStoredGuestDisplayName() || createGuestName();
    setStoredGuestDisplayName(nextName);
    setGuestDisplayName(nextName);
    setStoredGuestMode(true);
    setGuestMode(true);

    try {
      const result = auth.currentUser?.isAnonymous
        ? { user: auth.currentUser }
        : await signInAnonymously(auth);

      if (nextName && result.user.displayName !== nextName) {
        await updateProfile(result.user, { displayName: nextName });
      }
    } catch (error) {
      console.warn('Anonymous Firebase auth failed; continuing with local guest mode:', error);
    }
  }, []);

  const saveUsername = useCallback(async (displayName: string) => {
    const validation = validatePlayerName(displayName);
    if (validation.error) {
      throw new Error(validation.error);
    }

    if (guestMode || firebaseUser?.isAnonymous) {
      throw new Error('Guest usernames are assigned automatically. Create an account to choose a leaderboard name.');
    }

    if (!firebaseUser) {
      throw new Error('Sign in before choosing a player name.');
    }

    await saveUserProfile({
      uid: firebaseUser.uid,
      displayName: validation.value,
      email: firebaseUser.email,
      provider: getProviderId(firebaseUser),
    });
    await updateProfile(firebaseUser, { displayName: validation.value });
    const savedProfile = await getUserProfile(firebaseUser.uid);
    setProfile(savedProfile);
  }, [firebaseUser, guestMode]);

  const logout = useCallback(async () => {
    setStoredGuestMode(false);
    setStoredGuestDisplayName('');
    setGuestMode(false);
    setGuestDisplayName('');
    setProfile(null);
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isGuest = guestMode || Boolean(firebaseUser?.isAnonymous);
    const savedProfileName = profile?.displayName || profile?.username || '';
    const displayName = isGuest ? guestDisplayName : savedProfileName;
    const hasAccess = Boolean(firebaseUser && !firebaseUser.isAnonymous) || isGuest;
    const needsUsernameSetup = hasAccess && !isGuest && !profileLoading && !displayName;

    return {
      currentUser: firebaseUser,
      firebaseUser,
      loading,
      profileLoading,
      profile,
      isGuest,
      guestDisplayName,
      displayName,
      suggestedDisplayName: isGuest ? guestDisplayName : getSuggestedName(firebaseUser),
      uid: firebaseUser && !isGuest ? firebaseUser.uid : null,
      hasAccess,
      needsUsernameSetup,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      continueAsGuest,
      saveUsername,
      logout,
    };
  }, [
    continueAsGuest,
    firebaseUser,
    guestDisplayName,
    guestMode,
    loading,
    loginWithEmail,
    loginWithGoogle,
    logout,
    profile,
    profileLoading,
    registerWithEmail,
    saveUsername,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
