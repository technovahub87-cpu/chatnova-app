import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { SplashScreen } from './components/SplashScreen';
import { User } from './types';
import { wsService } from './services/websocket';
import { ThemeProvider } from './context/ThemeContext';

export function App() {
  const [showSplash, setShowSplash] = useState(true);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('chatnova_current_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  // Splash screen timeout (2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

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

  if (showSplash) {
    return <SplashScreen />;
  }

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
