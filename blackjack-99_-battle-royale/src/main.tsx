import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import FriendChessApp from './games/friend-chess/FriendChessApp.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
          <Routes>
            <Route path="/friend-chess" element={<FriendChessApp />} />
            <Route path="/blackjack-99" element={<App />} />
            <Route path="/snake-rush" element={<App />} />
            <Route path="/molar-madness" element={<App />} />
            <Route path="/chairs-io" element={<App />} />
            <Route path="/space-runner" element={<App />} />
            <Route path="/neon-rush" element={<App />} />
            <Route path="*" element={<App />} />
          </Routes>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
