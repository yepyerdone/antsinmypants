import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import FriendChessApp from './games/friend-chess/FriendChessApp.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import { SiteLayout } from './components/SiteLayout.tsx';
import { GameSectionPage } from './pages/GameSectionPage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route path="/featured" element={<GameSectionPage sectionId="featured" />} />
              <Route path="/arcade" element={<GameSectionPage sectionId="arcade" />} />
              <Route path="/multiplayer" element={<GameSectionPage sectionId="multiplayer" />} />
              <Route path="/academic-weapon" element={<GameSectionPage sectionId="academic-weapon" />} />
              <Route path="/casino" element={<GameSectionPage sectionId="casino" />} />
              <Route path="/friend-chess" element={<FriendChessApp />} />
              <Route path="/blackjack-99" element={<App />} />
              <Route path="/snake-rush" element={<App />} />
              <Route path="/molar-madness" element={<App />} />
              <Route path="/chairs-io" element={<App />} />
              <Route path="/space-runner" element={<App />} />
              <Route path="/neon-rush" element={<App />} />
              <Route path="/dont-stop" element={<App />} />
              <Route path="/do-we-have-a-deal" element={<App />} />
              <Route path="*" element={<App />} />
            </Route>
          </Routes>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
