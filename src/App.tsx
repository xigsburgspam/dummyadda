/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import Landing from "./components/Landing";
import ChatRoom from "./components/ChatRoom";
import Admin from "./components/Admin";
import XigAdmin from "./components/XigAdmin";
import { useSocket } from "./hooks/useSocket";

export default function App() {
  const [mode, setMode] = useState<"text" | "video" | "admin" | "xigadmin" | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const socket = useSocket();

  useEffect(() => {
    if (window.location.pathname === "/xigadmin") {
      setMode("xigadmin");
    }
  }, []);

  const handleStart = (selectedMode: "text" | "video", selectedInterests: string[]) => {
    setMode(selectedMode);
    setInterests(selectedInterests);
  };

  const handleExit = () => {
    setMode(null);
    setInterests([]);
    if (window.location.pathname === "/xigadmin") {
      window.history.pushState({}, "", "/");
    }
  };

  if (!socket) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        Connecting to server...
      </div>
    );
  }

  return (
    <main className="font-sans antialiased bg-zinc-950 text-zinc-100 min-h-screen">
      {!mode ? (
        <Landing onStart={handleStart} onAdmin={() => setMode("admin")} />
      ) : mode === "admin" ? (
        <Admin onExit={handleExit} />
      ) : mode === "xigadmin" ? (
        <XigAdmin />
      ) : (
        <ChatRoom socket={socket} mode={mode} interests={interests} onExit={handleExit} />
      )}
    </main>
  );
}
