import { useEffect, useState } from "react";
import { Shield, Users, Activity, AlertTriangle } from "lucide-react";

interface Stats {
  activeUsers: number;
  waitingUsers: number;
  activeRooms: number;
  recentReports: { id: string | number; user: string; reason: string; date: string }[];
}

export default function Admin({ onExit }: { onExit: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors"
          >
            Back to App
          </button>
        </header>

        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="p-4 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Active Users</p>
                <p className="text-3xl font-bold">{stats.activeUsers}</p>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="p-4 bg-emerald-500/10 rounded-xl text-emerald-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Active Rooms</p>
                <p className="text-3xl font-bold">{stats.activeRooms}</p>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
              <div className="p-4 bg-amber-500/10 rounded-xl text-amber-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Waiting Users</p>
                <p className="text-3xl font-bold">{stats.waitingUsers}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-zinc-500">Loading stats...</div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold">Recent Reports</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {stats?.recentReports.map((report) => (
              <div key={report.id} className="p-6 flex items-center justify-between">
                <div>
                  <p className="font-medium">{report.user}</p>
                  <p className="text-sm text-zinc-400">{report.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-500">{new Date(report.date).toLocaleString()}</p>
                  <button className="text-sm text-red-400 hover:text-red-300 mt-1">Ban User</button>
                </div>
              </div>
            ))}
            {stats?.recentReports.length === 0 && (
              <div className="p-6 text-zinc-500 text-center">No recent reports.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
