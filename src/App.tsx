import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { User } from './types';
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
        <AuthScreen onLogin={handleLogin} />
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
