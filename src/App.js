import React, { useEffect, useRef, useState } from "react";
import TextChannels from "./components/TextChannels";
import VoiceChannels from "./components/VoiceChannels";
import UserList from "./components/UserList";
import UserProfile from "./components/UserProfile";
import MessageList from "./components/MessageList";
import GifPickerModal from "./components/GifPickerModal";

const THEME_KEY = "meeps-theme";
const DEFAULT_USER_NAME = "Meeps User";
const CURRENT_USER_ID = 1;
const TEXT_CHANNELS = [
  { id: "general", name: "general" },
  { id: "dev", name: "dev-chat" },
  { id: "random", name: "random" }
];
const VOICE_CHANNELS = [
  { id: "lounge", name: "Lounge" },
  { id: "standup", name: "Daily Standup" }
];

const API_BASE =
  import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";
const WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:4000/ws";

function App() {
  const [theme, setTheme] = useState("dark");
  const [selectedChannelId, setSelectedChannelId] = useState("general");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [profiles, setProfiles] = useState({});
  const [presenceUsers, setPresenceUsers] = useState([]);
  const socketRef = useRef(null);
  const lastActivitySentRef = useRef(0);
  const [joinedVoiceChannelId, setJoinedVoiceChannelId] = useState(null);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [voiceSettings, setVoiceSettings] = useState({
    inputDeviceId: null,
    outputDeviceId: null,
    volume: 1,
    pushToTalkKey: "Space",
    pushToTalkEnabled: false
  });
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)")
        .matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    setSocketStatus("connecting");

    socket.onopen = () => {
      setSocketStatus("connected");
      // Introduce this user to the presence system
      const hello = {
        type: "presence:hello",
        userId: CURRENT_USER_ID,
        displayName: DEFAULT_USER_NAME
      };
      socket.send(JSON.stringify(hello));
    };

    socket.onclose = () => {
      setSocketStatus("disconnected");
      socketRef.current = null;
    };

    socket.onerror = () => {
      setSocketStatus("error");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message" && data.payload) {
          setMessages((prev) => [...prev, data.payload]);
        } else if (data.type === "profileUpdated" && data.payload) {
          const profile = data.payload;
          setProfiles((prev) => ({
            ...prev,
            [profile.id]: profile
          }));
          if (
            profile.id === CURRENT_USER_ID &&
            (profile.theme === "light" || profile.theme === "dark")
          ) {
            setTheme(profile.theme);
            applyTheme(profile.theme);
            window.localStorage.setItem(THEME_KEY, profile.theme);
          }
        } else if (data.type === "presence:state" && Array.isArray(data.payload)) {
          setPresenceUsers(data.payload);
        } else if (data.type === "presence:updated" && data.payload) {
          const presence = data.payload;
          setPresenceUsers((prev) => {
            const existingIndex = prev.findIndex((u) => u.id === presence.id);
            if (existingIndex === -1) {
              return [...prev, presence];
            }
            const copy = [...prev];
            copy[existingIndex] = { ...copy[existingIndex], ...presence };
            return copy;
          });
        } else if (data.type === "voice:participants" && data.payload) {
          const { roomId, participants } = data.payload;
          if (roomId === joinedVoiceChannelId) {
            setVoiceParticipants(participants || []);
          }
        } else if (data.type === "voice:signal" && data.payload) {
          handleIncomingVoiceSignal(data.payload);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    function handleActivity() {
      const now = Date.now();
      if (now - lastActivitySentRef.current < 30 * 1000) {
        return;
      }
      lastActivitySentRef.current = now;
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const msg = {
        type: "presence:activity",
        userId: CURRENT_USER_ID
      };
      socket.send(JSON.stringify(msg));
    }

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("focus", handleActivity);
    window.addEventListener("visibilitychange", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("focus", handleActivity);
      window.removeEventListener("visibilitychange", handleActivity);
    };
  }, []);

  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(
          `${API_BASE}/api/messages?channel=${encodeURIComponent(
            selectedChannelId
          )}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch {
        // ignore for skeleton
      }
    }

    loadMessages();
  }, [selectedChannelId]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`${API_BASE}/api/profile/${CURRENT_USER_ID}`);
        if (!res.ok) return;
        const data = await res.json();
        setProfiles((prev) => ({
          ...prev,
          [data.id]: data
        }));
        if (data.theme === "light" || data.theme === "dark") {
          setTheme(data.theme);
          applyTheme(data.theme);
          window.localStorage.setItem(THEME_KEY, data.theme);
        }
      } catch {
        // ignore for skeleton
      }
    }

    loadProfile();
  }, []);

  const applyTheme = (nextTheme) => {
    const root = document.documentElement;
    if (nextTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const saveThemePreference = async (nextTheme) => {
    try {
      await fetch(`${API_BASE}/api/profile/${CURRENT_USER_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          theme: nextTheme
        })
      });
    } catch {
      // ignore for skeleton
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
    saveThemePreference(nextTheme);
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = {
      type: "message",
      channel: selectedChannelId,
      sender: DEFAULT_USER_NAME,
      content: trimmed
    };

    socket.send(JSON.stringify(payload));
    setInputValue("");
  };

  const handleSelectGif = (gif) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (!gif || !gif.url) return;

    const content = `![gif](${gif.url})`;
    const payload = {
      type: "message",
      channel: selectedChannelId,
      sender: DEFAULT_USER_NAME,
      content
    };

    socket.send(JSON.stringify(payload));
  };

  const channelMessages = messages.filter(
    (m) => m.channel === selectedChannelId
  );

  const currentUserProfile = profiles[CURRENT_USER_ID] || null;

  const handleSaveProfile = async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/api/profile/${CURRENT_USER_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: payload.displayName,
          bio: payload.bio,
          achievements: payload.achievements,
          avatarUrl: payload.avatarUrl,
          theme
        })
      });

      if (!res.ok) return;
      const updated = await res.json();
      setProfiles((prev) => ({
        ...prev,
        [updated.id]: updated
      }));
    } catch {
      // ignore for skeleton
    }
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const constraints = {
        audio: voiceSettings.inputDeviceId
          ? { deviceId: { exact: voiceSettings.inputDeviceId } }
          : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      return stream;
    } catch (_err) {
      return null;
    }
  };

  const createPeerConnection = async (peerUserId) => {
    if (peerConnectionsRef.current[peerUserId]) {
      return peerConnectionsRef.current[peerUserId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    const localStream = await ensureLocalStream();
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          type: "voice:signal",
          roomId: joinedVoiceChannelId,
          fromUserId: CURRENT_USER_ID,
          toUserId: peerUserId,
          signalType: "ice-candidate",
          data: event.candidate
        })
      );
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams((prev) => ({
        ...prev,
        [peerUserId]: stream
      }));
    };

    peerConnectionsRef.current[peerUserId] = pc;
    return pc;
  };

  const handleIncomingVoiceSignal = async ({
    roomId,
    fromUserId,
    signalType,
    data
  }) => {
    if (roomId !== joinedVoiceChannelId) return;
    const pc = await createPeerConnection(fromUserId);

    if (signalType === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "voice:signal",
            roomId: joinedVoiceChannelId,
            fromUserId: CURRENT_USER_ID,
            toUserId: fromUserId,
            signalType: "answer",
            data: answer
          })
        );
      }
    } else if (signalType === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (signalType === "ice-candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch {
        // ignore invalid candidates
      }
    }
  };

  const joinVoiceChannel = async (roomId) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    setJoinedVoiceChannelId(roomId);
    setVoiceParticipants([]);
    peerConnectionsRef.current = {};
    setRemoteStreams({});

    await ensureLocalStream();

    socket.send(
      JSON.stringify({
        type: "voice:join",
        roomId,
        userId: CURRENT_USER_ID
      })
    );
  };

  const leaveVoiceChannel = () => {
    const socket = socketRef.current;
    if (joinedVoiceChannelId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "voice:leave",
          roomId: joinedVoiceChannelId,
          userId: CURRENT_USER_ID
        })
      );
    }

    setJoinedVoiceChannelId(null);
    setVoiceParticipants([]);
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    setRemoteStreams({});
  };

  return (
    <div className="h-screen w-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
            M
          </span>
          <div className="flex flex-col">
            <span className="text-base font-semibold">Meeps</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Next-gen desktop chat
            </span>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <span className="text-xs" aria-hidden="true">
            {theme === "dark" ? "🌙" : "☀️"}
          </span>
          <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
        </button>
      </header>

      <div className="flex h-[calc(100vh-48px)]">
        <aside className="flex w-72 flex-col border-r border-gray-200 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="mb-3">
            <UserProfile profile={currentUserProfile} onSave={handleSaveProfile} />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <section>
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Text Channels
              </h2>
              <TextChannels
                channels={TEXT_CHANNELS}
                selectedChannelId={selectedChannelId}
                onSelectChannel={setSelectedChannelId}
              />
            </section>

            <section>
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Voice Channels
              </h2>
              <VoiceChannels
                channels={VOICE_CHANNELS}
                joinedChannelId={joinedVoiceChannelId}
                onJoinChannel={joinVoiceChannel}
                onLeaveChannel={leaveVoiceChannel}
              />
              {joinedVoiceChannelId && (
                <div className="mt-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">
                      In {joinedVoiceChannelId}
                    </span>
                    <button
                      type="button"
                      onClick={leaveVoiceChannel}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Leave
                    </button>
                  </div>
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {voiceParticipants.length === 0 && (
                      <p className="text-gray-400 dark:text-gray-500">
                        No other users connected yet.
                      </p>
                    )}
                    {voiceParticipants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-gray-700 dark:text-gray-200"
                      >
                        <span className="truncate">{p.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Users
              </h2>
              <UserList users={presenceUsers} />
            </section>
          </div>
        </aside>

        <main className="flex flex-1 flex-col bg-gray-50/60 dark:bg-gray-950/70">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold">
                  # {selectedChannelId}
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {socketStatus === "connected" ? "Live" : socketStatus}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Welcome to Meeps – this is where your conversations will appear.
              </p>
            </div>
          </div>

          <MessageList
            messages={channelMessages}
            currentUserName={DEFAULT_USER_NAME}
          />

          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
            <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <textarea
                rows={1}
                className="min-h-[32px] max-h-24 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder={`Message #${selectedChannelId} (Markdown supported)…`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="inline-flex items-center rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => setIsGifModalOpen(true)}
                className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                GIF
              </button>
            </div>
            {/* hidden audio elements for remote peers */}
            <div className="sr-only">
              {Object.entries(remoteStreams).map(([userId, stream]) => (
                <audio
                  // eslint-disable-next-line react/no-array-index-key
                  key={userId}
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && stream) {
                      // eslint-disable-next-line no-param-reassign
                      el.srcObject = stream;
                      el.volume = voiceSettings.volume;
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelectGif={handleSelectGif}
        apiBase={API_BASE}
      />
    </div>
  );
}

export default App;
