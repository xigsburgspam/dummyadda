import React, { useState, useEffect } from 'react';
import { Shield, Ban, Trash2, Users, Activity, AlertTriangle } from 'lucide-react';

export function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState({ activeUsers: 0, waitingUsers: 0, activeRooms: 0, totalReports: 0 });
  const [reports, setReports] = useState<any[]>([]);
  const [bannedIPs, setBannedIPs] = useState<any[]>([]);
  const [error, setError] = useState('');

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        fetchData();
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Login failed');
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/data', {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setReports(data.reports);
        setBannedIPs(data.bannedIPs);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  const banUser = async (ip: string, reason: string) => {
    if (!confirm(`Are you sure you want to ban IP: ${ip}?`)) return;
    try {
      await fetch('/api/admin/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ ip, reason })
      });
      fetchData();
    } catch (err) {
      console.error('Failed to ban user', err);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    try {
      await fetch(`/api/admin/reports/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      fetchData();
    } catch (err) {
      console.error('Failed to delete report', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-sm w-full space-y-6">
          <div className="flex items-center justify-center mb-6">
            <Shield className="w-12 h-12 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center">Admin Login</h2>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin Password"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            Addagle Moderation
          </h1>
          <button onClick={() => fetchData()} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors">
            Refresh Data
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-lg"><Users className="w-6 h-6 text-indigo-400" /></div>
            <div><p className="text-zinc-400 text-sm">Active Users</p><p className="text-2xl font-bold">{stats.activeUsers}</p></div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg"><Activity className="w-6 h-6 text-emerald-400" /></div>
            <div><p className="text-zinc-400 text-sm">Active Rooms</p><p className="text-2xl font-bold">{stats.activeRooms}</p></div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-lg"><Users className="w-6 h-6 text-amber-400" /></div>
            <div><p className="text-zinc-400 text-sm">Waiting Queue</p><p className="text-2xl font-bold">{stats.waitingUsers}</p></div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
            <div><p className="text-zinc-400 text-sm">Total Reports</p><p className="text-2xl font-bold">{stats.totalReports}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-white">Recent Reports</h2>
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl text-center text-zinc-500">No pending reports.</div>
              ) : (
                reports.map((report) => (
                  <div key={report._id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col md:flex-row gap-6">
                    {report.screenshot && (
                      <div className="w-full md:w-48 h-32 bg-black rounded-lg overflow-hidden shrink-0 border border-zinc-800">
                        <img src={report.screenshot} alt="Evidence" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded uppercase tracking-wider">18+ Report</span>
                        <span className="text-xs text-zinc-500">{new Date(report.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-zinc-400"><strong>Reported IP:</strong> {report.reportedIp}</p>
                      <p className="text-sm text-zinc-400"><strong>Reporter ID:</strong> {report.reporterId}</p>
                      <div className="flex gap-3 pt-4">
                        <button onClick={() => banUser(report.reportedIp, '18+ content')} className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
                          <Ban className="w-4 h-4" /> Ban IP
                        </button>
                        <button onClick={() => deleteReport(report._id)} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" /> Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Banned IPs</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {bannedIPs.length === 0 ? (
                <div className="p-6 text-center text-zinc-500">No banned IPs.</div>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {bannedIPs.map((ban) => (
                    <li key={ban._id} className="p-4 flex flex-col gap-1">
                      <span className="font-mono text-sm text-red-400">{ban.ip}</span>
                      <span className="text-xs text-zinc-500">Reason: {ban.reason}</span>
                      <span className="text-xs text-zinc-600">{new Date(ban.timestamp).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
