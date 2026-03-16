import { useState, KeyboardEvent } from "react";
import { Video, MessageSquare, Shield, Users, Settings } from "lucide-react";
import { motion } from "motion/react";

interface LandingProps {
  onStart: (mode: "text" | "video", interests: string[]) => void;
  onAdmin: () => void;
}

export default function Landing({ onStart, onAdmin }: LandingProps) {
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const handleAddInterest = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && interestInput.trim()) {
      e.preventDefault();
      if (!interests.includes(interestInput.trim().toLowerCase())) {
        setInterests([...interests, interestInput.trim().toLowerCase()]);
      }
      setInterestInput("");
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Admin Button */}
      <button
        onClick={onAdmin}
        className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-xl transition-colors"
        title="Admin Dashboard"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/20 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl w-full text-center space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tighter bg-gradient-to-r from-zinc-100 to-zinc-500 bg-clip-text text-transparent">
            Addagle
          </h1>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto">
            Connect instantly with strangers around the world. Safe, anonymous, and fast.
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
          <div className="space-y-4 text-left">
            <label className="block text-sm font-medium text-zinc-400">
              Add your interests (optional)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {interest}
                  <button
                    onClick={() => removeInterest(interest)}
                    className="hover:text-red-400 transition-colors"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={handleAddInterest}
              placeholder="Type an interest and press Enter (e.g., anime, coding)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => onStart("text", interests)}
              className="group relative flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-4 px-6 rounded-2xl font-medium transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <MessageSquare className="w-5 h-5" />
              <span>Text Chat</span>
            </button>
            <button
              onClick={() => onStart("video", interests)}
              className="group relative flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white py-4 px-6 rounded-2xl font-medium transition-all shadow-lg shadow-indigo-500/25 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <Video className="w-5 h-5" />
              <span>Video Chat</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-zinc-800/50">
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="font-medium text-zinc-200">Safe & Anonymous</h3>
            <p className="text-sm text-center">No registration required. AI moderation keeps the community safe.</p>
          </div>
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="font-medium text-zinc-200">Interest Matching</h3>
            <p className="text-sm text-center">Find people who share your hobbies and passions instantly.</p>
          </div>
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
              <Video className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-medium text-zinc-200">HD Video</h3>
            <p className="text-sm text-center">Crystal clear peer-to-peer video connections.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
