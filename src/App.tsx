import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { User } from './types';
import { wsService } from './services/websocket';
import { INITIAL_USERS } from './data/mockData';

function AppContent() {
  const { isDark } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('chatnova_current_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {}
    return null;
  });
  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  // Safety fallback: Force hide splash after 3.5 seconds if callback fails
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    wsService.connect();

    try {
      const existingUsers = JSON.parse(localStorage.getItem('chatnova_all_users') || '[]');
      const defaultPool = [
        ...INITIAL_USERS,
        {
          id: 'user_1',
          customId: '@narendra_56',
          displayName: 'Narendra Sharma',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          role: 'master_admin',
          status: 'online',
          publicKeyFingerprint: 'E2EE-9842-X791-ALPHA',
        },
        {
          id: 'user_2',
          customId: '@ritesh_84',
          displayName: 'Ritesh Kumar',
          avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
          role: 'user',
          status: 'online',
          publicKeyFingerprint: 'E2EE-4421-B882-BETA',
        }
      ];

      defaultPool.forEach((defUser) => {
        if (defUser && defUser.customId) {
          const exists = existingUsers.some((u: any) => u && u.customId && u.customId.toLowerCase() === defUser.customId.toLowerCase());
          if (!exists) {
            existingUsers.push(defUser);
          }
        }
      });

      localStorage.setItem('chatnova_all_users', JSON.stringify(existingUsers));
    } catch (err) {}

    const checkHashRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('master-admin') || hash.includes('master-admin')) {
        setShowMasterAdmin(true);
      }
    };

    checkHashRoute();
    window.addEventListener('hashchange', checkHashRoute);
    return () => window.removeEventListener('hashchange', checkHashRoute);
  }, []);

  const handleLoginSuccess = (user: User) => {
    if (!user || !user.id) return;
    setCurrentUser(user);
    try {
      localStorage.setItem('chatnova_current_user', JSON.stringify(user));
    } catch (e) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('chatnova_current_user');
      localStorage.removeItem('chatnova_jwt_token');
    } catch (e) {}
  };

  const handleBanUserUpdate = (userId: string, isBanned: boolean) => {
    if (currentUser && currentUser.id === userId && isBanned) {
      setCurrentUser(null);
    }
  };

  return (
    <main
      className={`w-full h-full min-h-dvh flex flex-col overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#0b141a] text-slate-100' : 'bg-[#f0f2f5] text-slate-900'
      }`}
    >
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}

      {!showSplash && !currentUser && (
        <AuthScreen
          onLoginSuccess={handleLoginSuccess}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
        />
      )}

      {!showSplash && currentUser && currentUser.id && (
        <Dashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
          onUpdateUser={(updated) => {
            if (updated && updated.id) {
              setCurrentUser(updated);
              try {
                localStorage.setItem('chatnova_current_user', JSON.stringify(updated));
              } catch (e) {}
            }
          }}
        />
      )}

      <MasterAdminPanel
        isOpen={showMasterAdmin}
        currentUser={currentUser}
        onClose={() => {
          setShowMasterAdmin(false);
          if (window.location.hash.includes('master-admin')) {
            window.location.hash = '';
          }
        }}
        onBanUserUpdate={handleBanUserUpdate}
      />
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
