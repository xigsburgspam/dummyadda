import React, { useState, useEffect } from "react";
import { Shield, Ban, Image as ImageIcon } from "lucide-react";

export default function XigAdmin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [bannedIPs, setBannedIPs] = useState<string[]>([]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/xigadmin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports);
      setBannedIPs(data.bannedIPs);
      setLoggedIn(true);
    } else {
      alert("Invalid credentials");
    }
  };

  const banIP = async (ip: string) => {
    const res = await fetch("/api/xigadmin/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, ip }),
    });
    if (res.ok) {
      setBannedIPs([...bannedIPs, ip]);
    }
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <form onSubmit={login} className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-4 w-full max-w-md">
          <h2 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-500" />
            Admin Login
          </h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100"
          />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            <h1 className="text-2xl font-bold">XigAdmin Dashboard</h1>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-zinc-400" />
              18+ Reports
            </h2>
            {reports.length === 0 ? (
              <p className="text-zinc-500">No reports yet.</p>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-zinc-400">IP Address: <span className="text-zinc-200 font-mono">{report.ip}</span></p>
                        <p className="text-sm text-zinc-500">{new Date(report.timestamp).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => banIP(report.ip)}
                        disabled={bannedIPs.includes(report.ip)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" />
                        {bannedIPs.includes(report.ip) ? "Banned" : "Ban IP"}
                      </button>
                    </div>
                    {report.screenshot && (
                      <img src={report.screenshot} alt="Reported content" className="w-full rounded-xl border border-zinc-800" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-400" />
              Banned IPs
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              {bannedIPs.length === 0 ? (
                <p className="text-zinc-500 text-sm">No IPs banned.</p>
              ) : (
                <ul className="space-y-2">
                  {bannedIPs.map((ip) => (
                    <li key={ip} className="text-zinc-300 font-mono text-sm bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800">
                      {ip}
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
