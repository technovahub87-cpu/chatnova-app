
import React, { useEffect, useState } from 'react';

import { BackendDashboard } from './components/BackendDashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { SplashScreen } from './components/SplashScreen';

import { User } from './types';
import { wsService } from './services/websocket';
import {
  authAPI,
  getAuthToken,
  removeAuthToken
} from './services/api';

import { ThemeProvider } from './context/ThemeContext';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = getAuthToken();

      if (!token) {
        if (!cancelled) {
          setCurrentUser(null);
          setCheckingSession(false);
        }
        return;
      }

      try {
        const result = await authAPI.getMe();

        if (!result.success || !result.data) {
          removeAuthToken();

          if (!cancelled) {
            setCurrentUser(null);
            setCheckingSession(false);
          }
          return;
        }

        const responseData: any = result.data;
        const userData = responseData.user || responseData;

        if (!userData || !(userData._id || userData.id)) {
          removeAuthToken();

          if (!cancelled) {
            setCurrentUser(null);
            setCheckingSession(false);
          }
          return;
        }

        const restoredUser: User = {
          id: String(userData._id || userData.id),
          customId: userData.customId || '',
          displayName: userData.displayName || 'ChatNova User',
          avatar:
            userData.avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          bio: userData.bio || '',
          status: userData.status || 'offline',
          lastSeen: userData.lastSeen || 'Recently',
          publicKeyFingerprint: userData.publicKeyFingerprint || '',
          role: userData.role || 'user',
          twoFactorEnabled: Boolean(userData.twoFactorEnabled),
          createdAt: userData.createdAt
            ? new Date(userData.createdAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          isBanned: Boolean(userData.isBanned)
        };

        if (!cancelled) {
          setCurrentUser(restoredUser);
        }
      } catch (error) {
        console.error('[ChatNova] Session restore failed:', error);
        removeAuthToken();

        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      wsService.disconnect();
      return;
    }

    const token = getAuthToken();

    if (!token) {
      setCurrentUser(null);
      return;
    }

    wsService.connect(token);

    return () => {
      wsService.disconnect();
    };
  }, [currentUser?.id]);

  const handleLogin = (user: User) => {
    const token = getAuthToken();

    if (!token) {
      console.error(
        '[ChatNova] Login rejected because JWT token is missing.'
      );
      setCurrentUser(null);
      return;
    }

    setCurrentUser(user);
    setShowMasterAdmin(false);
  };

  const handleLogout = () => {
    wsService.disconnect();
    removeAuthToken();
    setCurrentUser(null);
    setShowMasterAdmin(false);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  if (showSplash || checkingSession) {
    return <SplashScreen />;
  }

  return (
    <>
      {currentUser ? (
        <BackendDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
          onUpdateUser={handleUpdateUser}
        />
      ) : (
        <AuthScreen
          onLogin={handleLogin}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
        />
      )}

      <MasterAdminPanel
        isOpen={showMasterAdmin}
        onClose={() => setShowMasterAdmin(false)}
        currentUser={currentUser}
      />
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
