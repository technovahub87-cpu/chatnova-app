import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { User } from './types';
import { wsService } from './services/websocket';
import { ThemeProvider } from './context/ThemeContext';

const ALL_MOCK_USERS: User[] = [
  {
    id: 'user_deepak',
    customId: '@deepak_123',
    displayName: 'Deepak',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: 'ChatNova Admin',
    status: 'online',
    role: 'user',
  },
  {
    id: 'user_narendra',
    customId: '@narendra_56',
    displayName: 'Narendra Sharma',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: 'Software Developer',
    status: 'online',
    role: 'user',
  },
  {
    id: 'user_ritesh',
    customId: '@ritesh_84',
    displayName: 'Ritesh Kumar',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'Mobile App Creator',
    status: 'online',
    role: 'user',
  },
];

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('chatnova_current_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  useEffect(() => {
    if (currentUser) {
      wsService.connect({
        userId: currentUser.id,
        customId: currentUser.customId,
      });
    }
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('chatnova_current_user', JSON.stringify(user));
    } catch (e) {}
    wsService.connect({
      userId: user.id,
      customId: user.customId,
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
        <div className="h-dvh w-dvw flex items-center justify-center bg-[#0b141a] text-slate-100 p-4">
          <div className="text-center space-y-5 max-w-md w-full p-8 rounded-3xl bg-[#111b21] border border-slate-800 shadow-2xl">
            <h1 className="text-2xl font-extrabold text-white">
              Chat<span className="text-emerald-500">Nova</span> Secure Enclave
            </h1>
            <p className="text-xs text-slate-400">Select a profile to login and test encrypted messaging:</p>
            
            <div className="flex flex-col gap-3">
              {ALL_MOCK_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleLogin(u)}
                  className="w-full px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-between cursor-pointer transition shadow-md"
                >
                  <span className="flex items-center gap-2.5">
                    <img src={u.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                    <span>Login as {u.displayName}</span>
                  </span>
                  <span className="font-mono text-[11px] opacity-90 bg-black/20 px-2 py-1 rounded-lg">
                    {u.customId}
                  </span>
                </button>
              ))}
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
