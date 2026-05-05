import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import FriendChessApp from './games/friend-chess/FriendChessApp.tsx';
import SnakeRushApp from './games/snake-rush/SnakeRushApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/friend-chess" element={<FriendChessApp />} />
        <Route path="/snake-rush" element={<SnakeRushApp />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
