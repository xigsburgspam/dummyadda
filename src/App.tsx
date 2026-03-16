/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ChatRoom } from './components/ChatRoom';
import { AdminPanel } from './components/AdminPanel';
import { Video, MessageSquare, Users, Shield } from 'lucide-react';
import { useSocket } from "./hooks/useSocket";

function Home() {
  const [mode, setMode] = useState<'text' | 'video' | null>(null);
  const [interests, setInterests] = useState('');
  const socket = useSocket();

  if (!socket) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        Connecting to server...
      </div>
    );
  }

  if (mode) {
    return <ChatRoom socket={socket} mode={mode} interests={interests.split(',').map(i => i.trim()).filter(i => i)} onExit={() => setMode(null)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tighter text-white">
            Addagle
          </h1>
          <p className="text-zinc-400 text-lg">
            Talk to strangers instantly.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-zinc-400">Add your interests (optional)</label>
            <input
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="anime, gaming, music..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-zinc-500">Separate with commas. We'll try to find someone with similar interests.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('text')}
              className="flex flex-col items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 transition-colors p-6 rounded-xl border border-zinc-700"
            >
              <MessageSquare className="w-8 h-8 text-indigo-400" />
              <span className="font-semibold">Text Chat</span>
            </button>
            <button
              onClick={() => setMode('video')}
              className="flex flex-col items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 transition-colors p-6 rounded-xl border border-indigo-500"
            >
              <Video className="w-8 h-8 text-white" />
              <span className="font-semibold text-white">Video Chat</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Anonymous</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Moderated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
