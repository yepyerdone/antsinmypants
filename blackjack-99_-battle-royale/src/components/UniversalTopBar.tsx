import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Gamepad2, Home, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToNotifications, type ProfileNotification } from '../lib/profileSocial';
import { getPrimarySectionForPath, siteSections, type SiteSectionId } from '../data/siteGames';
import { ProfileModal } from './ProfileModal';

const sectionByPath = new Map(siteSections.map((section) => [section.path, section.id]));

export function UniversalTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { displayName, isGuest, logout, uid } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileView, setProfileView] = useState<'profile' | 'inbox'>('profile');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<ProfileNotification[]>([]);

  const activeSection = useMemo<SiteSectionId | 'home' | null>(() => {
    if (location.pathname === '/') return 'home';
    return sectionByPath.get(location.pathname) || getPrimarySectionForPath(location.pathname);
  }, [location.pathname]);

  const pendingCount = useMemo(
    () => notifications.filter((notification) => notification.status === 'pending').length,
    [notifications],
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      return;
    }

    return subscribeToNotifications(uid, setNotifications);
  }, [uid]);

  const openProfile = (view: 'profile' | 'inbox') => {
    setProfileView(view);
    setProfileOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderNavLinks = () => (
    <>
      <Link className={activeSection === 'home' ? 'is-active' : ''} to="/">
        <Home size={15} />
        Home
      </Link>
      {siteSections.map((section) => (
        <Link
          key={section.id}
          className={activeSection === section.id ? 'is-active' : ''}
          to={section.path}
        >
          {section.navLabel}
        </Link>
      ))}
    </>
  );

  return (
    <>
      <header className="universal-topbar">
        <Link to="/" className="universal-topbar__brand" aria-label="The Honor Roll home">
          <span>
            <Gamepad2 size={23} />
          </span>
          <strong>The Honor Roll</strong>
        </Link>

        <nav className="universal-topbar__nav" aria-label="Site navigation">
          {renderNavLinks()}
        </nav>

        <div className="universal-topbar__account">
          <button type="button" className="universal-topbar__profile" onClick={() => openProfile('profile')}>
            <UserRound size={16} />
            <span>{displayName}</span>
            {isGuest && <small>Guest</small>}
          </button>
          <button
            type="button"
            className="universal-topbar__icon-button"
            onClick={() => openProfile('inbox')}
            aria-label="Open notifications"
          >
            <Bell size={17} />
            {pendingCount > 0 && <span>{pendingCount}</span>}
          </button>
          <button type="button" className="universal-topbar__signout" onClick={() => void handleLogout()}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <button
            type="button"
            className="universal-topbar__menu-button"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
            <span>Menu</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav className="universal-topbar__mobile-menu" aria-label="Mobile site navigation">
          {renderNavLinks()}
        </nav>
      )}

      <ProfileModal isOpen={profileOpen} initialView={profileView} onClose={() => setProfileOpen(false)} />
    </>
  );
}
