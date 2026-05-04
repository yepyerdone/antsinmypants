import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Save, Palette, Check } from 'lucide-react';
import { BOARD_THEMES, DEFAULT_THEME } from '../constants';
import { Chessboard } from 'react-chessboard';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [selectedThemeId, setSelectedThemeId] = useState(DEFAULT_THEME.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    async function fetchUserSettings() {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.theme) {
            setSelectedThemeId(data.theme);
          }
        }
      } catch (err) {
        console.error('Error fetching user settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        theme: selectedThemeId,
        updatedAt: new Date()
      }, { merge: true });
      
      setTimeout(() => setSaving(false), 500);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaving(false);
    }
  };

  const selectedTheme = BOARD_THEMES.find(t => t.id === selectedThemeId) || DEFAULT_THEME;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl font-bold tracking-widest animate-pulse">LOADING SETTINGS...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="h-16 border-b border-[#222] flex items-center px-8 bg-[#0a0a0a] shrink-0">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-[#222] rounded-full transition-colors mr-4"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold tracking-widest uppercase">Settings</h1>
      </header>

      <main className="flex-1 overflow-auto p-6 lg:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-12">
            <Palette className="text-gold" size={24} />
            <h2 className="text-2xl font-bold uppercase italic tracking-tight">Board Customization</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-4">
              <div className="aspect-square w-full max-w-[400px] mx-auto rounded-xl overflow-hidden border-8 border-[#1A1A1A] shadow-2xl relative bg-[#111]">
                {/* We wrap Chessboard to catch potential mount errors if needed, though we don't have a boundary here */}
                <Chessboard 
                  options={{
                    id: "PreviewBoard",
                    position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                    boardOrientation: "white",
                    darkSquareStyle: { backgroundColor: selectedTheme.dark },
                    lightSquareStyle: { backgroundColor: selectedTheme.light },
                    allowDragging: false
                  }}
                />
              </div>
              <p className="text-center text-[10px] uppercase tracking-widest text-[#666]">Preview: {selectedTheme.name}</p>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold mb-4">Select Theme</h3>
              <div className="grid grid-cols-2 gap-3">
                {BOARD_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      selectedThemeId === theme.id 
                      ? 'bg-[#1a1a1a] border-[#d4af37] shadow-lg' 
                      : 'bg-[#0f0f0f] border-[#222] hover:border-[#444]'
                    }`}
                  >
                    {selectedThemeId === theme.id && (
                      <div className="absolute top-2 right-2 text-[#d4af37]">
                        <Check size={14} />
                      </div>
                    )}
                    <div className="flex gap-1 mb-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.light }}></div>
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.dark }}></div>
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${selectedThemeId === theme.id ? 'text-white' : 'text-[#888]'}`}>
                      {theme.name}
                    </p>
                  </button>
                ))}
              </div>

              <div className="pt-8">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-white text-black font-bold py-4 rounded-lg uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#d4af37] transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={16} />
                      Apply & Save Theme
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
