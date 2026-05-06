import { Outlet } from 'react-router-dom';
import { UniversalTopBar } from './UniversalTopBar';

export function SiteLayout() {
  return (
    <div className="site-shell">
      <UniversalTopBar />
      <div className="site-shell-content">
        <Outlet />
      </div>
    </div>
  );
}
