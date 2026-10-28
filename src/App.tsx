import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { User } from './types';
import { wsService } from './services/websocket';

function AppContent() {
  const { isDark } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  // Initialize offshore WebSocket service on launch
  useEffect(() => {
    wsService.connect();

    // Check if URL has /master-admin or #master-admin
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
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
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
      {/* 1. Animated Splash & Loading Handshake Screen */}
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}

      {/* 2. Custom ID & Password Login / Register with 2FA / OTP */}
      {!showSplash && !currentUser && (
        <AuthScreen
          onLoginSuccess={handleLoginSuccess}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
        />
      )}

      {/* 3. Main WhatsApp-Style Encrypted Dashboard */}
      {!showSplash && currentUser && (
        <Dashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenMasterAdmin={() => setShowMasterAdmin(true)}
        />
      )}

      {/* 4. Master Admin Panel (Hidden/Protected Route /master-admin with Strict RBAC) */}
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
