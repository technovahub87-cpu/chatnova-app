import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Activity, 
  Radio, 
  Ban, 
  CheckCircle, 
  Terminal, 
  RefreshCw, 
  LogOut, 
  Lock, 
  KeyRound, 
  AlertTriangle,
  Server,
  Globe,
  Cpu
} from 'lucide-react';
import { User, AuditLog, ServerNode } from '../types';
import { INITIAL_USERS, INITIAL_AUDIT_LOGS, SERVER_NODES } from '../data/mockData';

interface MasterAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const MasterAdminPanel: React.FC<MasterAdminPanelProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'broadcast' | 'nodes'>('users');
  const [adminSecret, setAdminSecret] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [serverNodes, setServerNodes] = useState<ServerNode[]>(SERVER_NODES);
  
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [broadcastStatus, setBroadcastStatus] = useState('');

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (adminSecret === 'NovaMaster@2026' && twoFactorToken === '774921') {
      setIsAuthenticated(true);
      fetchMasterData();
    } else {
      setAuthError('Invalid Master Admin Secret or 2FA Token. Security event logged.');
    }
  };

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'x-master-admin-secret': adminSecret,
          'x-master-2fa-token': twoFactorToken,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.users) {
          setUsers(data.users);
        }
      }
    } catch (e) {
      console.error('Using offline fallback data for admin panel:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (userId: string, currentBanState: boolean) => {
    const reason = !currentBanState ? prompt('Enter reason for administrative suspension:', 'Violation of network security policy') : '';
    if (!currentBanState && !reason) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-master-admin-secret': adminSecret,
          'x-master-2fa-token': twoFactorToken,
        },
        body: JSON.stringify({ isBanned: !currentBanState, banReason: reason }),
      });

      if (response.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, isBanned: !currentBanState, banReason: reason || '' } : u));
        setAuditLogs([
          {
            id: Date.now().toString(),
            action: !currentBanState ? 'USER_BANNED' : 'USER_UNBANNED',
            targetUser: userId,
            actor: 'MASTER_ADMIN',
            timestamp: new Date().toLocaleTimeString(),
            severity: 'high',
            details: `Identity status toggled. Reason: ${reason || 'N/A'}`
          },
          ...auditLogs
        ]);
      }
    } catch (e) {
      // Fallback local state update if API is unreachable
      setUsers(users.map(u => u.id === userId ? { ...u, isBanned: !currentBanState, banReason: reason || '' } : u));
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-master-admin-secret': adminSecret,
          'x-master-2fa-token': twoFactorToken,
        },
        body: JSON.stringify({ message: broadcastMessage, severity: broadcastSeverity }),
      });

      if (response.ok) {
        setBroadcastStatus('Broadcast successfully transmitted across all offshore relay nodes.');
        setBroadcastMessage('');
        setTimeout(() => setBroadcastStatus(''), 4000);
      } else {
        setBroadcastStatus('Failed to transmit broadcast across network.');
      }
    } catch (e) {
      setBroadcastStatus('Broadcast simulated successfully (Offline mode).');
      setTimeout(() => setBroadcastStatus(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#111b21] border border-red-500/30 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl shadow-red-950/50">
        
        {/* Header */}
        <div className="bg-[#1f2c34] px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="bg-red-500/10 p-2 rounded-xl border border-red-500/30 text-red-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                ChatNova Master Administration <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 font-mono">ROOT LEVEL</span>
              </h2>
              <p className="text-xs text-slate-400">Offshore Relay Security Enclave & Node Governance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          /* Authentication Screen */
          <div className="flex-1 flex items-center justify-center p-6">
            <form onSubmit={handleLogin} className="bg-[#0b141a] border border-slate-800 p-8 rounded-2xl w-full max-w-md space-y-5 shadow-xl">
              <div className="text-center space-y-2">
                <div className="inline-flex bg-red-500/10 p-3 rounded-full text-red-400 mb-2">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-100">Master Authentication Required</h3>
                <p className="text-xs text-slate-400">Enter your Master Passphrase and 2FA hardware token to access administrative controls.</p>
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Master Admin Secret</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input 
                      type="password" 
                      value={adminSecret} 
                      onChange={(e) => setAdminSecret(e.target.value)}
                      placeholder="NovaMaster@2026"
                      className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-3 pl-10 text-sm text-slate-200 focus:outline-none focus:border-red-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">2FA Hardware Token</label>
                  <div className="relative">
                    <Terminal className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input 
                      type="text" 
                      value={twoFactorToken} 
                      onChange={(e) => setTwoFactorToken(e.target.value)}
                      placeholder="774921"
                      className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-3 pl-10 text-sm text-slate-200 focus:outline-none focus:border-red-500 font-mono tracking-widest"
                      required
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl text-sm transition shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                Authenticate Master Session
              </button>
            </form>
          </div>
        ) : (
          /* Dashboard Content */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-[#0b141a] border-r border-slate-800 p-4 space-y-2 flex flex-row md:flex-col justify-around md:justify-start">
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'users' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden md:inline">Identity Governance</span>
              </button>

              <button 
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'audit' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
              >
                <Activity className="w-4 h-4" />
                <span className="hidden md:inline">Security Audit Logs</span>
              </button>

              <button 
                onClick={() => setActiveTab('broadcast')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'broadcast' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
              >
                <Radio className="w-4 h-4" />
                <span className="hidden md:inline">Global Broadcast</span>
              </button>

              <button 
                onClick={() => setActiveTab('nodes')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'nodes' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
              >
                <Server className="w-4 h-4" />
                <span className="hidden md:inline">Relay Nodes</span>
              </button>
            </div>

            {/* Main Panel View */}
            <div className="flex-1 bg-[#111b21] p-6 overflow-y-auto">
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">Registered Identities</h3>
                      <p className="text-xs text-slate-400">Manage user access, status, and administrative suspensions.</p>
                    </div>
                    <button onClick={fetchMasterData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition">
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="bg-[#0b141a] rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-[#111b21]">
                          <th className="p-4">Custom ID</th>
                          <th className="p-4">Display Name</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 text-sm">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-800/20 transition">
                            <td className="p-4 font-mono text-emerald-400 text-xs">{u.customId}</td>
                            <td className="p-4 font-medium text-slate-200">{u.displayName}</td>
                            <td className="p-4">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-mono ${u.role === 'master_admin' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs ${u.isBanned ? 'text-red-400' : 'text-emerald-400'}`}>
                                <span className={`w-2 h-2 rounded-full ${u.isBanned ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                {u.isBanned ? 'Suspended' : 'Active'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {u.role !== 'master_admin' && (
                                <button 
                                  onClick={() => handleToggleBan(u.id, !!u.isBanned)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ml-auto ${u.isBanned ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'}`}
                                >
                                  {u.isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                  {u.isBanned ? 'Unban' : 'Suspend'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Security Audit Logs</h3>
                    <p className="text-xs text-slate-400">Real-time telemetry and administrative action trails.</p>
                  </div>

                  <div className="bg-[#0b141a] rounded-2xl border border-slate-800 p-4 space-y-3 font-mono text-xs">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-[#111b21] rounded-xl border border-slate-800/80 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-red-400 font-bold">[{log.action}]</span>
                          <span className="text-slate-500">{log.timestamp}</span>
                        </div>
                        <div className="text-slate-300">Target: <span className="text-emerald-400">{log.targetUser}</span> | Actor: {log.actor}</div>
                        <div className="text-slate-400 text-[11px]">{log.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'broadcast' && (
                <div className="space-y-4 max-w-xl">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Global Network Broadcast</h3>
                    <p className="text-xs text-slate-400">Transmit real-time system alerts to all active ChatNova clients.</p>
                  </div>

                  {broadcastStatus && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl">
                      {broadcastStatus}
                    </div>
                  )}

                  <form onSubmit={handleBroadcast} className="bg-[#0b141a] border border-slate-800 p-6 rounded-2xl space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Broadcast Severity</label>
                      <select 
                        value={broadcastSeverity}
                        onChange={(e) => setBroadcastSeverity(e.target.value as any)}
                        className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-red-500"
                      >
                        <option value="info">Info / Notice</option>
                        <option value="warning">Warning / Maintenance</option>
                        <option value="critical">Critical Security Alert</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Message Content</label>
                      <textarea 
                        rows={4}
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Type system-wide broadcast notification..."
                        className="w-full bg-[#111b21] border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-red-500 resize-none"
                        required
                      ></textarea>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl text-sm transition shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                    >
                      <Radio className="w-4 h-4" />
                      Transmit Global Broadcast
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'nodes' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Offshore Relay Nodes</h3>
                    <p className="text-xs text-slate-400">Decentralized WebSocket and database cluster health status.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {serverNodes.map((node, i) => (
                      <div key={i} className="bg-[#0b141a] border border-slate-800 p-5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-emerald-400" />
                            {node.region}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-mono ${node.status === 'operational' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            {node.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1 font-mono">
                          <div>Latency: <span className="text-slate-200">{node.latency}</span></div>
                          <div>Active Tunnels: <span className="text-slate-200">{node.connections}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
