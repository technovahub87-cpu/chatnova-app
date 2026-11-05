import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

import { BackendDashboard } from './components/BackendDashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { SplashScreen } from './components/SplashScreen';

import { User } from './types';
import { wsService } from './services/websocket';
import {
  authAPI,
  getAuthToken,
  removeAuthToken,
  API_BASE_URL
} from './services/api';

import { ThemeProvider } from './context/ThemeContext';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  // Restore existing login session
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
          avatar: userData.avatar || '',
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

        if (!cancelled) setCurrentUser(restoredUser);
      } catch (error) {
        console.error('[ChatNova] Session restore failed:', error);
        removeAuthToken();
        if (!cancelled) setCurrentUser(null);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Connect WebSocket after login
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

  // Register Android device for Firebase push notifications
  useEffect(() => {
    if (!currentUser || Capacitor.getPlatform() !== 'android') {
      return;
    }

    let cancelled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    const setupPushNotifications = async () => {
      try {
        // Create the channel used by the backend FCM sender
        await PushNotifications.createChannel({
          id: 'chatnova_messages',
          name: 'ChatNova Messages',
          description: 'New ChatNova message notifications',
          importance: 5,
          visibility: 1,
          vibration: true
        });

        // Receive the FCM device token
        const registrationListener =
          await PushNotifications.addListener(
            'registration',
            async (token) => {
              if (cancelled) return;

              const authToken = getAuthToken();

              if (!authToken || !token.value) return;

              try {
                const response = await fetch(
                  `${API_BASE_URL}/auth/push-token`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                      token: token.value,
                      platform: 'android',
                      deviceName: 'Android Device'
                    })
                  }
                );

                const result = await response.json().catch(() => ({}));

                if (response.ok && result.success) {
                  console.log(
                    '[ChatNova] Push device registered successfully.'
                  );
                } else {
                  console.error(
                    '[ChatNova] Push token registration failed:',
                    result.message
                  );
                }
              } catch (error) {
                console.error(
                  '[ChatNova] Push token API error:',
                  error
                );
              }
            }
          );

        listeners.push(registrationListener);

        const errorListener =
          await PushNotifications.addListener(
            'registrationError',
            (error) => {
              console.error(
                '[ChatNova] Push registration error:',
                error
              );
            }
          );

        listeners.push(errorListener);

        const notificationListener =
          await PushNotifications.addListener(
            'pushNotificationReceived',
            (notification) => {
              console.log(
                '[ChatNova] Push notification received:',
                notification.title
              );
            }
          );

        listeners.push(notificationListener);

        const actionListener =
          await PushNotifications.addListener(
            'pushNotificationActionPerformed',
            (action) => {
              console.log(
                '[ChatNova] Notification opened:',
                action.notification.data
              );
            }
          );

        listeners.push(actionListener);

        if (cancelled) return;

        // Check and request Android notification permission
        let permission =
          await PushNotifications.checkPermissions();

        if (permission.receive === 'prompt') {
          permission = await PushNotifications.requestPermissions();
        }

        if (permission.receive !== 'granted') {
          console.warn(
            '[ChatNova] Notification permission was not granted.'
          );
          return;
        }

        // Register this Android device with Firebase
        await PushNotifications.register();

        console.log(
          '[ChatNova] Firebase push registration started.'
        );
      } catch (error) {
        console.error(
          '[ChatNova] Push notification setup failed:',
          error
        );
      }
    };

    setupPushNotifications();

    return () => {
      cancelled = true;

      listeners.forEach((listener) => {
        listener.remove().catch(console.error);
      });
    };
  }, [currentUser?.id]);

  const handleLogin = (user: User) => {
    if (!getAuthToken()) {
      console.error('[ChatNova] Login rejected: JWT token is missing.');
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
    return (
      <SplashScreen
        onComplete={() => setShowSplash(false)}
      />
    );
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
