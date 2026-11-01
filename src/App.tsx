import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { User } from './types';
import { INITIAL_USERS } from './data/mockData';
import { wsService } from './services/websocket';
import { ThemeProvider } from './context/ThemeContext';

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
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-emerald-500">ChatNova Secure Enclave</h1>
            <p className="text-xs text-slate-400">Please select a profile to login:</p>
            <div className="flex gap-4 justify-center">
              {INITIAL_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleLogin(u)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition"
                >
                  Login as {u.displayName} ({u.customId})
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
