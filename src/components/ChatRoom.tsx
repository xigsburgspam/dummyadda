import { useEffect, useRef, useState, FormEvent, ChangeEvent } from "react";
import { Socket } from "socket.io-client";
import { Video, Mic, MicOff, VideoOff, Send, X, SkipForward, Download, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmModal } from "./ConfirmModal";

interface ChatRoomProps {
  socket: Socket;
  mode: "text" | "video";
  interests: string[];
  onExit: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: "me" | "stranger";
  timestamp: string;
}

export function ChatRoom({ socket, mode, interests, onExit }: ChatRoomProps) {
  const [status, setStatus] = useState<"connecting" | "waiting" | "matched">("connecting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const isInitiatorRef = useRef(false);
  const partnerReadyRef = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);

  // Initialize matching
  useEffect(() => {
    findMatch();
    return () => {
      cleanup();
    };
  }, []);

  const findMatch = () => {
    setStatus("waiting");
    setMessages([]);
    setRoomId(null);
    setRemoteStream(null);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    socket.emit("find_match", { mode, interests });
  };

  const cleanup = () => {
    socket.emit("skip");
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  // Socket listeners
  useEffect(() => {
    socket.on("waiting", () => {
      setStatus("waiting");
    });

    socket.on("match_found", async (data: { roomId: string; partnerId: string; initiator: boolean }) => {
      setStatus("matched");
      setRoomId(data.roomId);
      isInitiatorRef.current = data.initiator;
      partnerReadyRef.current = false;
      iceCandidateQueue.current = [];
      setMessages([{
        id: "sys-match",
        text: "You're now chatting with a random stranger. Say hi!",
        sender: "stranger",
        timestamp: new Date().toISOString()
      }]);

      if (mode === "video") {
        await setupWebRTC(data.roomId);
      }
    });

    socket.on("receive_message", (data: { message: string; senderId: string; timestamp: string }) => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: data.message, sender: "stranger", timestamp: data.timestamp },
      ]);
    });

    socket.on("partner_typing", (isTyping: boolean) => {
      setPartnerTyping(isTyping);
    });

    socket.on("partner_left", () => {
      setMessages((prev) => [
        ...prev,
        { id: "sys-left", text: "Stranger has disconnected.", sender: "stranger", timestamp: new Date().toISOString() },
      ]);
      setStatus("waiting");
      setRemoteStream(null);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });

    socket.on("skipped", () => {
      findMatch();
    });

    socket.on("banned_warning", () => {
      alert("You have been disconnected and reported for violating terms of service.");
      window.location.reload();
    });

    // WebRTC Signaling
    socket.on("webrtc_ready", async () => {
      partnerReadyRef.current = true;
      if (isInitiatorRef.current && peerConnectionRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit("offer", { offer, roomId });
        } catch (e) {
          console.error("Error creating offer", e);
        }
      }
    });

    socket.on("offer", async (offer) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit("answer", { answer, roomId });
      processIceQueue();
    });

    socket.on("answer", async (answer) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      processIceQueue();
    });

    socket.on("ice_candidate", async (candidate) => {
      if (!peerConnectionRef.current) return;
      if (!peerConnectionRef.current.remoteDescription) {
        iceCandidateQueue.current.push(candidate);
      } else {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    return () => {
      socket.off("waiting");
      socket.off("match_found");
      socket.off("receive_message");
      socket.off("partner_typing");
      socket.off("partner_left");
      socket.off("skipped");
      socket.off("banned_warning");
      socket.off("webrtc_ready");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice_candidate");
    };
  }, [socket, mode, roomId]);

  const processIceQueue = async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding queued ice candidate", e);
        }
      }
    }
  };

  // WebRTC Setup
  const setupWebRTC = async (currentRoomId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", { candidate: event.candidate, roomId: currentRoomId });
        }
      };

      socket.emit("webrtc_ready", { roomId: currentRoomId });

      if (isInitiatorRef.current && partnerReadyRef.current) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { offer, roomId: currentRoomId });
      }
    } catch (err) {
      console.error("Error accessing media devices.", err);
      setMessages((prev) => [
        ...prev,
        { id: "sys-err", text: "Could not access camera/microphone.", sender: "me", timestamp: new Date().toISOString() },
      ]);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !camEnabled;
      });
      setCamEnabled(!camEnabled);
    }
  };

  // Chat functions
  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId) return;

    const msg = input.trim();
    socket.emit("send_message", { message: msg, roomId });
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text: msg, sender: "me", timestamp: new Date().toISOString() },
    ]);
    setInput("");
    setIsTyping(false);
    socket.emit("typing", { isTyping: false, roomId });
  };

  const handleTyping = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!isTyping && e.target.value && roomId) {
      setIsTyping(true);
      socket.emit("typing", { isTyping: true, roomId });
    } else if (isTyping && !e.target.value && roomId) {
      setIsTyping(false);
      socket.emit("typing", { isTyping: false, roomId });
    }
  };

  const downloadChat = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender === 'me' ? 'You' : 'Stranger'}: ${m.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `addagle-chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const captureScreenshot = () => {
    if (!remoteVideoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = remoteVideoRef.current.videoWidth || 640;
    canvas.height = remoteVideoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(remoteVideoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.5);
    }
    return null;
  };

  const confirmReport = () => {
    const screenshot = mode === 'video' ? captureScreenshot() : null;
    socket.emit("report_18plus", { roomId, screenshot });
    setMessages(prev => [...prev, { id: "sys-report", text: "User reported. Thank you for keeping Addagle safe.", sender: "me", timestamp: new Date().toISOString() }]);
    setShowReportModal(false);
    cleanup();
    findMatch();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <ConfirmModal
        isOpen={showReportModal}
        title="Report User"
        message="Are you sure you want to report this user for 18+ content? A screenshot of their video will be sent to our moderation team."
        onConfirm={confirmReport}
        onCancel={() => setShowReportModal(false)}
      />
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-500 bg-clip-text text-transparent">
            Addagle
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${status === "matched" ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="text-zinc-400 capitalize">{status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {status === "matched" && (
            <>
              <button
                onClick={downloadChat}
                title="Download Chat"
                className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-xl transition-colors hidden sm:block"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                title="Report 18+"
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <AlertTriangle className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            onClick={() => {
              cleanup();
              findMatch();
            }}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span className="hidden sm:inline">Skip</span>
          </button>
          <button
            onClick={onExit}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className={`flex-1 flex ${mode === "video" ? "flex-col md:flex-row" : "flex-col"} overflow-hidden`}>
        {/* Video Section */}
        {mode === "video" && (
          <div className="flex-1 bg-black relative flex flex-col p-4 gap-4">
            <div className="flex-1 relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
              {status === "matched" ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p>Looking for someone you can chat with...</p>
                </div>
              )}
              
              {/* Local Video Picture-in-Picture */}
              <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video bg-zinc-800 rounded-xl overflow-hidden border-2 border-zinc-700 shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>

              {/* Video Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-zinc-700">
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-xl transition-colors ${micEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"}`}
                >
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleCam}
                  className={`p-3 rounded-xl transition-colors ${camEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"}`}
                >
                  {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Section */}
        <div className={`${mode === "video" ? "w-full md:w-96 border-l border-zinc-800" : "max-w-3xl w-full mx-auto"} flex flex-col h-full bg-zinc-950`}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {status === "waiting" && messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Looking for someone you can chat with...</p>
                {interests.length > 0 && (
                  <p className="text-sm">Matching based on: {interests.join(", ")}</p>
                )}
              </div>
            )}
            
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      msg.id.startsWith("sys-")
                        ? "bg-zinc-900 text-zinc-400 text-sm mx-auto text-center"
                        : msg.sender === "me"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {partnerTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-zinc-800 text-zinc-400 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={handleTyping}
                disabled={status !== "matched"}
                placeholder={status === "matched" ? "Type a message..." : "Waiting for partner..."}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
              <button
                type="submit"
                disabled={status !== "matched" || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white p-3 rounded-xl transition-colors flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
