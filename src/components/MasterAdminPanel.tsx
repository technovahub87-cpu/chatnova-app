import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  Radio,
  Ban,
  CheckCircle,
  Lock,
  KeyRound,
  AlertTriangle,
  Server,
  Globe,
  RefreshCw
} from 'lucide-react';

import { User, AuditLog, ServerNode } from '../types';
import { SERVER_NODES } from '../data/mockData';
import { adminAPI, AdminCredentials } from '../services/api';

interface MasterAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const MasterAdminPanel: React.FC<MasterAdminPanelProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<
    'users' | 'audit' | 'broadcast' | 'nodes'
  >('users');

  const [adminSecret, setAdminSecret] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [credentials, setCredentials] = useState<AdminCredentials | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [serverNodes] = useState<ServerNode[]>(SERVER_NODES);

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState('');

  if (!isOpen) return null;

  const normalizeUser = (item: any): User => ({
    id: String(item._id || item.id || ''),
    customId: item.customId || '',
    displayName: item.displayName || 'ChatNova User',
    avatar: item.avatar || '',
    bio: item.bio || '',
    status: item.status || 'offline',
    lastSeen: item.lastSeen || '',
    publicKeyFingerprint: item.publicKeyFingerprint || '',
    role: item.role || 'user',
    twoFactorEnabled: Boolean(item.twoFactorEnabled),
    createdAt: item.createdAt || '',
    isBanned: Boolean(item.isBanned)
  });

  const loadUsers = async (auth: AdminCredentials) => {
    const result = await adminAPI.getUsers(auth);

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Unable to load users.');
    }

    const records = result.data.users || [];
    setUsers(records.map(normalizeUser));
  };

  const loadAuditLogs = async (auth: AdminCredentials) => {
    const result = await adminAPI.getAuditLogs(auth);

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Unable to load audit logs.');
    }

    const records = result.data.logs || [];

    setAuditLogs(records.map((item: any) => ({
      id: String(item._id || item.id || ''),
      timestamp: item.createdAt || item.timestamp || '',
      action: item.action || '',
      targetUser: item.targetUser || '',
      actor: item.actor || '',
      ipAddress: item.ipAddress || '',
      severity: item.severity || 'low',
      details: item.details || ''
    })));
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');

    if (!adminSecret.trim() || !/^\d{6}$/.test(twoFactorToken)) {
      setAuthError('Enter your Master Admin Secret and valid 6-digit Authenticator code.');
      return;
    }

    const auth: AdminCredentials = {
      secret: adminSecret,
      authenticatorCode: twoFactorToken
    };

    setLoading(true);

    try {
      await loadUsers(auth);
      setCredentials(auth);
      setIsAuthenticated(true);
      await loadAuditLogs(auth);
    } catch (error) {
      setCredentials(null);
      setIsAuthenticated(false);
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Master Admin verification failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    if (!credentials) return;

    setLoading(true);

    try {
      await loadUsers(credentials);
      await loadAuditLogs(credentials);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to refresh Master Admin data.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCredentials(null);
    setIsAuthenticated(false);
    setAdminSecret('');
    setTwoFactorToken('');
    setUsers([]);
    setAuditLogs([]);
    setAuthError('');
  };

  const handleToggleBan = async (
    userId: string,
    currentBanState: boolean
  ) => {
    if (!credentials) return;

    const reason = !currentBanState
      ? window.prompt('Enter reason for suspending this user:')
      : '';

    if (!currentBanState && !reason?.trim()) return;

    setLoading(true);

    try {
      const result = await adminAPI.toggleBan(
        credentials,
        userId,
        !currentBanState,
        reason || ''
      );

      if (!result.success) {
        throw new Error(result.message || 'User status update failed.');
      }

      await loadUsers(credentials);
      await loadAuditLogs(credentials);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to update user status.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!credentials || !broadcastMessage.trim()) return;

    setLoading(true);
    setBroadcastStatus('');

    try {
      const result = await adminAPI.broadcast(
        credentials,
        broadcastMessage.trim()
      );

      if (!result.success) {
        throw new Error(result.message || 'Broadcast failed.');
      }

      setBroadcastStatus('Announcement sent successfully.');
      setBroadcastMessage('');
      await loadAuditLogs(credentials);
    } catch (error) {
      setBroadcastStatus(
        error instanceof Error
          ? error.message
          : 'Unable to send announcement.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#111b21] border border-red-500/30 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        <div className="bg-[#1f2c34] px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-xl border border-red-500/30 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                ChatNova Master Administration
              </h2>
              <p className="text-xs text-slate-400">
                Secure Administrative Control Panel
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleLogout();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <form
              onSubmit={handleLogin}
              className="bg-[#0b141a] border border-slate-800 p-8 rounded-2xl w-full max-w-md space-y-5"
            >
              <div className="text-center space-y-2">
                <Lock className="w-10 h-10 text-red-400 mx-auto" />
                <h3 className="text-xl font-bold text-slate-100">
                  Master Authentication
                </h3>
                <p className="text-xs text-slate-400">
                  Verify your credentials with the secure ChatNova backend.
                </p>
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {authError}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Master Admin Secret
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={adminSecret}
                    onChange={(event) => setAdminSecret(event.target.value)}
                    placeholder="Enter Master Admin Secret"
                    className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-3 pl-10 text-sm text-slate-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Authenticator App Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorToken}
                  onChange={(event) =>
                    setTwoFactorToken(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="6-digit code"
                  className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-3 text-sm text-slate-200 tracking-widest"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm"
              >
                {loading ? 'Verifying...' : 'Authenticate Master Session'}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

            <div className="w-full md:w-64 bg-[#0b141a] border-r border-slate-800 p-4 space-y-2 flex flex-row md:flex-col justify-around md:justify-start">
              <button
                onClick={() => setActiveTab('users')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-slate-800"
              >
                <Users className="w-4 h-4" />
                <span className="hidden md:inline">User Management</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-slate-800"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden md:inline">Audit Logs</span>
              </button>

              <button
                onClick={() => setActiveTab('broadcast')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-slate-800"
              >
                <Radio className="w-4 h-4" />
                <span className="hidden md:inline">Broadcast</span>
              </button>

              <button
                onClick={() => setActiveTab('nodes')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-300 hover:bg-slate-800"
              >
                <Server className="w-4 h-4" />
                <span className="hidden md:inline">Relay Nodes</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden md:inline">Secure Logout</span>
              </button>
            </div>

            <div className="flex-1 bg-[#111b21] p-6 overflow-y-auto">

              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {activeTab === 'users' && 'Registered Users'}
                    {activeTab === 'audit' && 'Security Audit Logs'}
                    {activeTab === 'broadcast' && 'Global Broadcast'}
                    {activeTab === 'nodes' && 'Relay Nodes'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Authenticated Master Admin controls
                  </p>
                </div>

                <button
                  onClick={refreshData}
                  disabled={loading}
                  className="p-2 bg-slate-800 rounded-lg text-slate-300"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {authError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">
                  {authError}
                </div>
              )}

              {activeTab === 'users' && (
                <div className="bg-[#0b141a] rounded-2xl border border-slate-800 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="p-4">Custom ID</th>
                        <th className="p-4">Display Name</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-sm">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="p-4 font-mono text-emerald-400">
                            {user.customId}
                          </td>
                          <td className="p-4 text-slate-200">
                            {user.displayName}
                          </td>
                          <td className="p-4 text-slate-300">
                            {user.role}
                          </td>
                          <td className="p-4">
                            <span className={user.isBanned ? 'text-red-400' : 'text-emerald-400'}>
                              {user.isBanned ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {user.role !== 'master_admin' && (
                              <button
                                onClick={() => handleToggleBan(user.id, !!user.isBanned)}
                                disabled={loading}
                                className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10"
                              >
                                {user.isBanned ? (
                                  <><CheckCircle className="w-3 h-3 inline mr-1" />Unban</>
                                ) : (
                                  <><Ban className="w-3 h-3 inline mr-1" />Suspend</>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {users.length === 0 && (
                    <p className="p-6 text-center text-sm text-slate-400">
                      No registered users found.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="bg-[#0b141a] border border-slate-800 p-4 rounded-xl">
                      <div className="flex justify-between gap-3">
                        <span className="text-red-400 font-bold text-xs">
                          {log.action}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {log.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs mt-2">
                        Target: {log.targetUser} | Actor: {log.actor}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {log.details}
                      </p>
                    </div>
                  ))}

                  {auditLogs.length === 0 && (
                    <p className="text-slate-400 text-sm">No audit records found.</p>
                  )}
                </div>
              )}

              {activeTab === 'broadcast' && (
                <form onSubmit={handleBroadcast} className="max-w-xl space-y-4">
                  {broadcastStatus && (
                    <p className="text-sm text-emerald-400">{broadcastStatus}</p>
                  )}

                  <textarea
                    rows={5}
                    value={broadcastMessage}
                    onChange={(event) => setBroadcastMessage(event.target.value)}
                    placeholder="Enter announcement message..."
                    className="w-full bg-[#0b141a] border border-slate-700 rounded-xl p-4 text-sm text-slate-200"
                    required
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl text-sm disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Announcement'}
                  </button>
                </form>
              )}

              {activeTab === 'nodes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serverNodes.map((node) => (
                    <div key={node.id} className="bg-[#0b141a] border border-slate-800 p-5 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-100 font-bold">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        {node.region || node.location}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">
                        Status: {node.status}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Latency: {node.latency || `${node.latencyMs} ms`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Active connections: {node.connections ?? node.activeTunnels}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
