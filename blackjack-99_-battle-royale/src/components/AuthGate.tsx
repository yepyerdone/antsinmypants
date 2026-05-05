import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SiteAuthStart } from './SiteAuthStart';
import { UsernameSetup } from './UsernameSetup';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, profileLoading, hasAccess, needsUsernameSetup, displayName, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading || profileLoading) {
    return (
      <div className="site-auth-loading">
        <Loader2 className="animate-spin" size={34} />
        <span>{loading ? 'Loading account' : 'Loading profile'}</span>
      </div>
    );
  }

  if (!hasAccess) {
    return <SiteAuthStart />;
  }

  if (needsUsernameSetup) {
    return <UsernameSetup />;
  }

  if (location.pathname === '/') {
    return <>{children}</>;
  }

  if (location.pathname === '/space-runner' || location.pathname === '/neon-rush') {
    return <>{children}</>;
  }

  return (
    <>
      <div className="site-account-bar">
        <div>
          <UserRound size={16} />
          <span>{displayName}</span>
          {isGuest && <small>Guest</small>}
        </div>
        <button type="button" onClick={handleLogout} title="Sign out">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
      {children}
    </>
  );
}
