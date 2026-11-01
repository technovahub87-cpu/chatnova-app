import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { User } from './types';
import { wsService } from './services/websocket';
import { ThemeProvider } from './context/ThemeContext';
import { Shield, Lock, UserPlus, ArrowRight } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('chatnova_current_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [showMasterAdmin, setShowMasterAdmin] = useState(false);
  const [customIdInput, setCustomIdInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (currentUser) {
      wsService.connect({
        userId: currentUser.id,
        customId: currentUser.customId,
      });
    }
  }, [currentUser]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawId = customIdInput.trim().toLowerCase();
    if (!rawId) return;

    const formattedCustomId = rawId.startsWith('@') ? rawId : `@${rawId}`;
    const name = displayNameInput.trim() || formattedId.replace('@', '').toUpperCase();

    const loggedUser: User = {
      id: 'usr_' + formattedId.replace('@', ''),
      customId: formattedCustomId,
      displayName: name,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: 'online',
      role: formattedCustomId === '@deepak_123' ? 'master_admin' : 'user',
    };

    setCurrentUser(loggedUser);
    try {
      localStorage.setItem('chatnova_current_user', JSON.stringify(loggedUser));
    } catch (e) {}

    wsService.connect({
      userId: loggedUser.id,
      customId: loggedUser.customId,
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('chatnova_current_user');
    } catch (e) {}
  };

  return (
    <ThemeProvider>
      {currentUser ? (
        <Dashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
          onUpdateUser={(updated) => setCurrentUser(updated)}
        />
      ) : (
        <div className="h-dvh w-dvw flex items-center justify-center bg-[#0b141a] text-slate-100 p-4 select-none">
          <div className="max-w-md w-full p-8 rounded-3xl bg-[#111b21] border border-slate-800 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <Shield className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-extrabold text-white">
                Chat<span className="text-emerald-500">Nova</span> Enclave
              </h1>
              <p className="text-xs text-slate-400">
                End-to-end encrypted decentralized messaging protocol. Enter your Custom ID to enter.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-emerald-500 font-bold mb-1.5">
                  Your Custom ID
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-mono">@</span>
                  <input
                    type="text"
                    value={customIdInput}
                    onChange={(e) => setCustomIdInput(e.target.value)}
                    placeholder="ritesh_84 or deepak_123"
                    required
                    autoFocus
                    className="w-full rounded-2xl bg-[#0b141a] border border-slate-700 pl-8 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-emerald-500 font-bold mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Ritesh Kumar"
                  className="w-full rounded-2xl bg-[#0b141a] border border-slate-700 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer font-mono tracking-wide"
              >
                <span>ENTER SECURE ENCLAVE</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-mono">
                <Lock className="w-3 h-3 text-emerald-500" /> Zero Logs • 256-bit AES-GCM Ratchet
              </p>
            </div>
          </div>
        </div>
      )}

      <MasterAdminPanel
        isOpen={showMasterAdmin}
        onClose={() => setShowMasterAdmin(false)}
        currentUser={currentUser}
      />
    </ThemeProvider>
  );
}

export default App;
