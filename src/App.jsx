import React, { useEffect, useMemo, useRef, useState } from "react";
import TextChannels from "./components/TextChannels";
import VoiceChannels from "./components/VoiceChannels";
import UserList from "./components/UserList";
import UserProfile from "./components/UserProfile";
import MessageList from "./components/MessageList";
import GifPickerModal from "./components/GifPickerModal";
import AuthModal from "./components/AuthModal";
import ProfileSetupPage from "./components/ProfileSetupPage";
import VoiceSettingsModal from "./components/VoiceSettingsModal";
import VoiceChannelModal from "./components/VoiceChannelModal";
import UserProfileModal from "./components/UserProfileModal";
import Board from "./components/Board";
import {
  setNotificationAudioElement,
  setUserHasInteracted,
  unlockAudio,
  unlockNotificationElement,
  preloadNotificationSound,
  playConnectSound,
  playUserJoinedSound,
  playUserLeftSound,
  playJoinedSound,
  playDisconnectedSound,
  playMessageSentSound,
  playMessageReceivedSound
} from "./utils/voiceSounds";

const THEME_KEY = "meeps-theme";
const DEFAULT_USER_NAME = "Meeps User";
const CURRENT_USER_ID = 1;
const TEXT_CHANNELS = [
  { id: "general", name: "general" },
  { id: "dev", name: "dev-chat" },
  { id: "Builds", name: "Builds" }
];
const VOICE_CHANNELS = [{ id: "voice", name: "Voice" }];

const API_BASE =
  import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";
const WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:4000/ws";

function App() {
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "board"
  const [selectedChannelId, setSelectedChannelId] = useState("general");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [profiles, setProfiles] = useState({});
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const socketRef = useRef(null);
  const lastActivitySentRef = useRef(0);
  const [joinedVoiceChannelId, setJoinedVoiceChannelId] = useState(null);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [voiceChannelParticipants, setVoiceChannelParticipants] = useState({}); // roomId -> participants[]
  const [voiceChannelModalRoomId, setVoiceChannelModalRoomId] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState({
    inputDeviceId: null,
    outputDeviceId: null,
    volume: 1,
    pushToTalkKey: "Space",
    pushToTalkEnabled: false
  });
  const peerConnectionsRef = useRef({});
  const voiceOfferSentToRef = useRef(new Set());
  const localStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const remoteStreamsFlushScheduledRef = useRef(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [voicePingMs, setVoicePingMs] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const screenStreamRef = useRef(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [localCameraStream, setLocalCameraStream] = useState(null);
  const cameraStreamRef = useRef(null);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState(null);
  const micPermissionRequestedRef = useRef(false);
  const voiceParticipantCountRef = useRef(0);
  const justJoinedVoiceRef = useRef(false);
  const notificationAudioRef = useRef(null);
  const joinedVoiceChannelIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef({}); // peerUserId -> RTCIceCandidate[]
  const [speakingUserIds, setSpeakingUserIds] = useState([]);
  const voiceAudioContextRef = useRef(null);
  const voiceAnalysersRef = useRef({}); // userId -> { source, analyser }
  const voiceSpeakingIntervalRef = useRef(null);
  const previousSpeakingRef = useRef(new Set());

  // Keep ref in sync so WebSocket onmessage always sees current voice channel (avoids stale closure).
  useEffect(() => {
    joinedVoiceChannelIdRef.current = joinedVoiceChannelId;
  }, [joinedVoiceChannelId]);

  // Detect who is speaking (local + remote) via Web Audio analyser; update speakingUserIds.
  const SPEAK_THRESHOLD = 0.028;
  const SILENCE_THRESHOLD = 0.018;
  useEffect(() => {
    if (!joinedVoiceChannelId) {
      setSpeakingUserIds([]);
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    voiceAudioContextRef.current = ctx;
    const analysers = voiceAnalysersRef.current;

    const addStream = (userId, stream) => {
      if (!stream || typeof stream.getAudioTracks !== "function") return;
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analysers[userId] = { source, analyser };
      } catch (_) {}
    };

    const myId = String(currentUser?.id ?? CURRENT_USER_ID);
    if (localStreamRef.current) addStream(myId, localStreamRef.current);
    Object.entries(remoteStreams).forEach(([uid, stream]) => {
      addStream(uid, stream);
    });

    const dataArray = new Uint8Array(128);
    voiceSpeakingIntervalRef.current = setInterval(() => {
      const next = new Set();
      Object.entries(analysers).forEach(([userId, { analyser: a }]) => {
        a.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((s, v) => s + v, 0);
        const level = sum / (dataArray.length * 255);
        const wasSpeaking = previousSpeakingRef.current.has(userId);
        if (level >= SPEAK_THRESHOLD) next.add(userId);
        else if (wasSpeaking && level >= SILENCE_THRESHOLD) next.add(userId);
      });
      previousSpeakingRef.current = next;
      setSpeakingUserIds((prev) => {
        const arr = Array.from(next);
        if (arr.length !== prev.length || arr.some((id, i) => id !== prev[i])) return arr;
        return prev;
      });
    }, 100);

    return () => {
      if (voiceSpeakingIntervalRef.current) clearInterval(voiceSpeakingIntervalRef.current);
      voiceSpeakingIntervalRef.current = null;
      Object.values(analysers).forEach(({ source }) => {
        try { source.disconnect(); } catch (_) {}
      });
      voiceAnalysersRef.current = {};
      try { ctx.close(); } catch (_) {}
      voiceAudioContextRef.current = null;
    };
  }, [joinedVoiceChannelId, remoteStreams]);

  // Request microphone permission once when main app is shown (desktop/Tauri often
  // only shows the system prompt when getUserMedia is called, not when opening a modal).
  useEffect(() => {
    if (!isAuthenticated || showProfileSetup) return;
    if (micPermissionRequestedRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    micPermissionRequestedRef.current = true;
    navigator.mediaDevices
      .getUserMedia({ video: false, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {});
  }, [isAuthenticated, showProfileSetup]);

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

    // Check for existing authentication
    const token = localStorage.getItem("meeps_token");
    const user = localStorage.getItem("meeps_user");
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        setCurrentUser(parsedUser);
        setIsAuthenticated(true);
      } catch {
        // Invalid user data, clear storage
        localStorage.removeItem("meeps_token");
        localStorage.removeItem("meeps_user");
      }
    }
  }, []);

  const handleAuth = (payload) => {
    const user = payload?.user ?? payload;
    const needsProfileSetup = payload?.needsProfileSetup === true;
    setCurrentUser(user);
    setIsAuthenticated(true);
    setShowProfileSetup(!!needsProfileSetup);
  };

  const handleLogout = () => {
    localStorage.removeItem("meeps_token");
    localStorage.removeItem("meeps_user");
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const userId = currentUser?.id ?? CURRENT_USER_ID;
    const displayName = currentUser?.displayName ?? DEFAULT_USER_NAME;

    console.log("Connecting to WebSocket at:", WS_URL);
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    setSocketStatus("connecting");

    socket.onopen = () => {
      console.log("WebSocket connected successfully");
      setSocketStatus("connected");
      playJoinedSound();
      const hello = {
        type: "presence:hello",
        userId,
        displayName
      };
      socket.send(JSON.stringify(hello));
      // Request current voice channel participants so we show who's in each channel before joining
      socket.send(
        JSON.stringify({
          type: "voice:get_participants",
          roomIds: VOICE_CHANNELS.map((c) => c.id)
        })
      );
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setSocketStatus("disconnected");
      playDisconnectedSound();
      socketRef.current = null;
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setSocketStatus("error");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message" && data.payload) {
          setMessages((prev) => [...prev, data.payload]);
          const myId = currentUser?.id ?? CURRENT_USER_ID;
          if (Number(data.payload.senderId) !== Number(myId)) playMessageReceivedSound();
        } else if (data.type === "message:updated" && data.payload) {
          const payload = data.payload;
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m))
          );
        } else if (data.type === "message:deleted" && data.payload?.id != null) {
          setMessages((prev) => prev.filter((m) => m.id !== data.payload.id));
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
          const list = participants || [];
          setVoiceChannelParticipants((prev) => ({ ...prev, [roomId]: list }));
          const joinedRoomId = joinedVoiceChannelIdRef.current;
          const isOurRoom = joinedRoomId != null && String(roomId) === String(joinedRoomId);
          if (isOurRoom) {
            const newCount = list.length;
            const oldCount = voiceParticipantCountRef.current;
            const isOurOwnJoin = justJoinedVoiceRef.current || (oldCount === 0 && newCount >= 1);
            if (isOurOwnJoin) {
              justJoinedVoiceRef.current = false;
            } else if (newCount !== oldCount) {
              unlockAudio();
              if (newCount > oldCount) {
                setTimeout(() => playUserJoinedSound(), 0);
              } else {
                setTimeout(() => playUserLeftSound(), 0);
              }
            }
            voiceParticipantCountRef.current = newCount;
            setVoiceParticipants(list);
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
  }, [isAuthenticated, currentUser?.id, currentUser?.displayName]);

  // Request voice channel participants when socket is connected (with delay so server is ready)
  const requestVoiceParticipants = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "voice:get_participants",
        roomIds: VOICE_CHANNELS.map((c) => c.id)
      })
    );
  };

  useEffect(() => {
    if (!isAuthenticated || socketStatus !== "connected") return;
    const t = setTimeout(requestVoiceParticipants, 400);
    return () => clearTimeout(t);
  }, [isAuthenticated, socketStatus]);

  // When opening the voice channel modal, request current participants so we show who's in the channel
  useEffect(() => {
    if (!voiceChannelModalRoomId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: "voice:get_participants",
        roomId: voiceChannelModalRoomId
      })
    );
  }, [voiceChannelModalRoomId]);

  // Unlock notification audio on first user interaction so sounds can play later
  useEffect(() => {
    let done = false;
    function unlock() {
      if (done) return;
      done = true;
      setUserHasInteracted();
      unlockAudio();
      const el = notificationAudioRef.current;
      if (el) unlockNotificationElement(el);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    }
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
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
        userId: currentUser.id || CURRENT_USER_ID
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
    if (!isAuthenticated) return;
    
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
  }, [selectedChannelId, isAuthenticated]);

  // Preload profiles for message senders so avatars show in channel
  useEffect(() => {
    if (!isAuthenticated) return;
    const channelMessages = messages.filter((m) => m.channel === selectedChannelId);
    const senderIds = [...new Set(channelMessages.map((m) => m.senderId).filter(Boolean))];
    senderIds.forEach((userId) => {
      if (profiles[userId]) return;
      fetch(`${API_BASE}/api/profile/${userId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setProfiles((prev) => ({ ...prev, [data.id]: data }));
          }
        })
        .catch(() => {});
    });
  }, [selectedChannelId, isAuthenticated, messages, profiles]);

  // Preload profiles for voice channel participants so avatars show in sidebar and modal
  useEffect(() => {
    if (!isAuthenticated) return;
    const participantIds = new Set();
    Object.values(voiceChannelParticipants).forEach((list) => {
      (list || []).forEach((p) => {
        if (p.id != null) participantIds.add(p.id);
      });
    });
    participantIds.forEach((userId) => {
      if (profiles[userId]) return;
      fetch(`${API_BASE}/api/profile/${userId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setProfiles((prev) => ({ ...prev, [data.id]: data }));
          }
        })
        .catch(() => {});
    });
  }, [isAuthenticated, voiceChannelParticipants, profiles]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    async function loadProfile() {
      try {
        const userId = currentUser.id || CURRENT_USER_ID;
        const res = await fetch(`${API_BASE}/api/profile/${userId}`);
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
  }, [isAuthenticated, currentUser]);

  // Ping viewer: poll WebRTC RTT when in a voice call (must be before early return)
  useEffect(() => {
    if (!joinedVoiceChannelId) {
      setVoicePingMs(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const pcs = peerConnectionsRef.current;
      const peerIds = Object.keys(pcs);
      if (peerIds.length === 0) {
        if (!cancelled) setVoicePingMs(null);
        return;
      }
      let totalRtt = 0;
      let count = 0;
      for (const userId of peerIds) {
        const pc = pcs[userId];
        if (!pc || pc.connectionState !== "connected") continue;
        try {
          const stats = await pc.getStats();
          for (const report of stats.values()) {
            if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime) {
              totalRtt += report.currentRoundTripTime * 1000;
              count += 1;
            }
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled && count > 0) {
        setVoicePingMs(Math.round(totalRtt / count));
      } else if (!cancelled && peerIds.length > 0) {
        setVoicePingMs(null);
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [joinedVoiceChannelId, voiceParticipants.length]);

  const applyTheme = (nextTheme) => {
    const root = document.documentElement;
    if (nextTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const saveThemePreference = async (nextTheme) => {
    if (!isAuthenticated) return;
    
    try {
      const userId = currentUser.id || CURRENT_USER_ID;
      await fetch(`${API_BASE}/api/profile/${userId}`, {
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
      console.log("Cannot send message - WebSocket not ready. State:", socket?.readyState);
      return;
    }

    const payload = {
      type: "message",
      channel: selectedChannelId,
      sender: currentUser.displayName || DEFAULT_USER_NAME,
      senderId: currentUser.id ?? undefined,
      content: trimmed
    };

    console.log("Sending message:", payload);
    socket.send(JSON.stringify(payload));
    playMessageSentSound();
    setInputValue("");
  };

  const handleEditMessage = (messageId, content) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const senderName = currentUser?.displayName || DEFAULT_USER_NAME;
    socket.send(JSON.stringify({ type: "message:edit", messageId, content, senderName }));
  };

  const handleDeleteMessage = (messageId) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const senderName = currentUser?.displayName || DEFAULT_USER_NAME;
    socket.send(JSON.stringify({ type: "message:delete", messageId, senderName }));
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
      sender: currentUser.displayName || DEFAULT_USER_NAME,
      senderId: currentUser.id ?? undefined,
      content
    };

    socket.send(JSON.stringify(payload));
    playMessageSentSound();
  };

  const channelMessages = messages.filter(
    (m) => m.channel === selectedChannelId
  );

  const currentUserProfile = profiles[currentUser?.id || CURRENT_USER_ID] || null;

  // Map sender display name -> avatar URL (for messages without senderId or when profile not loaded yet)
  const senderNameToAvatar = useMemo(() => {
    const m = {};
    const curName = currentUser?.displayName || DEFAULT_USER_NAME;
    if (currentUserProfile?.avatarUrl) m[curName] = currentUserProfile.avatarUrl;
    (presenceUsers || []).forEach((u) => {
      const name = u.displayName || u.name;
      if (name && profiles[u.id]?.avatarUrl) m[name] = profiles[u.id].avatarUrl;
    });
    return m;
  }, [currentUser?.displayName, currentUserProfile?.avatarUrl, presenceUsers, profiles]);

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
    const useScreenAsVideo = screenStreamRef.current?.getVideoTracks()?.length > 0;
    const useCameraAsVideo = !useScreenAsVideo && cameraStreamRef.current?.getVideoTracks()?.length > 0;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        if (track.kind === "video" && (useScreenAsVideo || useCameraAsVideo)) return;
        pc.addTrack(track, localStream);
      });
    }
    if (useScreenAsVideo) {
      const screenStream = screenStreamRef.current;
      const videoTrack = screenStream.getVideoTracks()[0];
      pc.addTrack(videoTrack, screenStream);
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (screenAudioTrack) pc.addTrack(screenAudioTrack, screenStream);
    } else if (useCameraAsVideo) {
      const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
      pc.addTrack(videoTrack, cameraStreamRef.current);
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const socket = socketRef.current;
      const roomId = joinedVoiceChannelIdRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !roomId) return;
      socket.send(
        JSON.stringify({
          type: "voice:signal",
          roomId,
          fromUserId: currentUser?.id ?? CURRENT_USER_ID,
          toUserId: peerUserId,
          signalType: "ice-candidate",
          data: event.candidate
        })
      );
    };

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track || typeof track.kind !== "string") return;
      try {
        let peerStream = remoteStreamsRef.current[peerUserId];
        if (!peerStream) {
          peerStream = new MediaStream();
          remoteStreamsRef.current[peerUserId] = peerStream;
        }
        peerStream.addTrack(track);
        if (!remoteStreamsFlushScheduledRef.current) {
          remoteStreamsFlushScheduledRef.current = true;
          queueMicrotask(() => {
            setRemoteStreams((prev) => ({ ...prev, ...remoteStreamsRef.current }));
            remoteStreamsFlushScheduledRef.current = false;
          });
        }
      } catch (err) {
        console.warn("ontrack error:", err);
      }
    };

    peerConnectionsRef.current[peerUserId] = pc;
    return pc;
  };

  const drainIceCandidates = async (pc, peerUserId) => {
    const queue = pendingIceCandidatesRef.current[peerUserId];
    if (!queue?.length) return;
    delete pendingIceCandidatesRef.current[peerUserId];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore
      }
    }
  };

  const sendOfferToPeer = async (peerUserId) => {
    const pc = peerConnectionsRef.current[peerUserId];
    if (!pc || pc.connectionState === "closed" || pc.signalingState === "closed") return;
    const socket = socketRef.current;
    const roomId = joinedVoiceChannelIdRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !roomId) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.send(
        JSON.stringify({
          type: "voice:signal",
          roomId,
          fromUserId: currentUser?.id ?? CURRENT_USER_ID,
          toUserId: peerUserId,
          signalType: "offer",
          data: offer
        })
      );
    } catch (err) {
      console.warn("Renegotiation offer failed:", err);
    }
  };

  const handleIncomingVoiceSignal = async ({
    roomId,
    fromUserId,
    signalType,
    data
  }) => {
    if (roomId !== joinedVoiceChannelIdRef.current) return;
    const pc = await createPeerConnection(fromUserId);

    if (signalType === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      await drainIceCandidates(pc, fromUserId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "voice:signal",
            roomId: joinedVoiceChannelIdRef.current,
            fromUserId: currentUser?.id ?? CURRENT_USER_ID,
            toUserId: fromUserId,
            signalType: "answer",
            data: answer
          })
        );
      }
    } else if (signalType === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      await drainIceCandidates(pc, fromUserId);
    } else if (signalType === "ice-candidate") {
      const candidate = new RTCIceCandidate(data);
      if (!pc.remoteDescription) {
        const queue = pendingIceCandidatesRef.current[fromUserId] ?? [];
        queue.push(candidate);
        pendingIceCandidatesRef.current[fromUserId] = queue;
      } else {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // ignore invalid candidates
        }
      }
    }
  };

  // When we're in a voice room: create/send offers to peers (lower userId offers to higher),
  // and close PCs for users who left the room. Must run every render (before any early return).
  useEffect(() => {
    if (!joinedVoiceChannelId) return;
    const myId = currentUser?.id ?? CURRENT_USER_ID;
    const participantIds = new Set((voiceParticipants || []).map((p) => Number(p.id)));

    const toRemove = [];
    for (const peerId of Object.keys(peerConnectionsRef.current)) {
      const id = Number(peerId);
      if (!participantIds.has(id)) {
        const pc = peerConnectionsRef.current[peerId];
        if (pc && pc.signalingState !== "closed") pc.close();
        delete peerConnectionsRef.current[peerId];
        delete pendingIceCandidatesRef.current[peerId];
        voiceOfferSentToRef.current.delete(id);
        toRemove.push(id);
      }
    }
    if (toRemove.length > 0) {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        toRemove.forEach((id) => delete next[id]);
        return next;
      });
      toRemove.forEach((id) => delete remoteStreamsRef.current[id]);
    }

    if (!voiceParticipants?.length) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const run = async () => {
      for (const p of voiceParticipants) {
        const peerId = Number(p.id);
        if (peerId === myId) continue;
        if (myId > peerId) continue;
        if (voiceOfferSentToRef.current.has(peerId)) continue;
        voiceOfferSentToRef.current.add(peerId);
        try {
          const pc = await createPeerConnection(peerId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const s = socketRef.current;
          if (s && s.readyState === WebSocket.OPEN) {
            s.send(
              JSON.stringify({
                type: "voice:signal",
                roomId: joinedVoiceChannelId,
                fromUserId: myId,
                toUserId: peerId,
                signalType: "offer",
                data: offer
              })
            );
          }
        } catch (err) {
          console.warn("Voice offer failed:", err);
          voiceOfferSentToRef.current.delete(peerId);
        }
      }
    };
    run();
  }, [joinedVoiceChannelId, voiceParticipants, currentUser?.id]);

  const handleSaveProfile = async (payload) => {
    if (!isAuthenticated) return;
    try {
      const userId = currentUser?.id ?? CURRENT_USER_ID;
      const res = await fetch(`${API_BASE}/api/profile/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: payload.displayName,
          bio: payload.bio,
          achievements: payload.achievements,
          avatarUrl: payload.avatarUrl,
          bannerUrl: payload.bannerUrl,
          theme
        })
      });
      if (!res.ok) return;
      const updated = await res.json();
      setProfiles((prev) => ({ ...prev, [updated.id]: updated }));
      if (payload.displayName !== currentUser?.displayName) {
        setCurrentUser((prev) => ({ ...prev, displayName: payload.displayName }));
      }
    } catch {
      // ignore
    }
  };

  const joinVoiceChannel = async (roomId) => {
    if (!isAuthenticated) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    // Play sound immediately while still in the user gesture (before any await)
    playConnectSound();
    joinedVoiceChannelIdRef.current = roomId;
    setJoinedVoiceChannelId(roomId);
    setVoiceParticipants([]);
    peerConnectionsRef.current = {};
    pendingIceCandidatesRef.current = {};
    voiceOfferSentToRef.current = new Set();
    remoteStreamsRef.current = {};
    setRemoteStreams({});
    voiceParticipantCountRef.current = 0;
    justJoinedVoiceRef.current = true;
    await ensureLocalStream();
    socket.send(JSON.stringify({ type: "voice:join", roomId, userId: currentUser?.id ?? CURRENT_USER_ID }));
    preloadNotificationSound();
  };

  const leaveVoiceChannel = () => {
    // Play sound immediately while still in the user gesture
    playUserLeftSound();
    const socket = socketRef.current;
    const roomIdToLeave = joinedVoiceChannelIdRef.current ?? joinedVoiceChannelId;
    if (roomIdToLeave && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "voice:leave", roomId: roomIdToLeave, userId: currentUser?.id ?? CURRENT_USER_ID }));
    }
    joinedVoiceChannelIdRef.current = null;
    setJoinedVoiceChannelId(null);
    setVoiceParticipants([]);
    voiceParticipantCountRef.current = 0;
    voiceOfferSentToRef.current = new Set();
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalScreenStream(null);
    setIsSharingScreen(false);
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setLocalCameraStream(null);
    setIsCameraEnabled(false);
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    pendingIceCandidatesRef.current = {};
    remoteStreamsRef.current = {};
    setRemoteStreams({});
  };

  const startScreenShare = async () => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } catch (audioErr) {
        if (audioErr?.name === "NotAllowedError") throw audioErr;
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      }
      if (!stream?.getVideoTracks()?.length) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      setIsSharingScreen(true);
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0] ?? null;
      const peersToRenegotiate = [];
      for (const [peerUserId, pc] of Object.entries(peerConnectionsRef.current)) {
        if (pc.connectionState !== "closed") {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) videoSender.replaceTrack(videoTrack);
          else {
            pc.addTrack(videoTrack, stream);
            peersToRenegotiate.push(Number(peerUserId));
          }
          if (audioTrack) {
            const hasScreenAudio = pc.getSenders().some((s) => s.track?.id === audioTrack.id);
            if (!hasScreenAudio) {
              pc.addTrack(audioTrack, stream);
              peersToRenegotiate.push(Number(peerUserId));
            }
          }
        }
      }
      for (const peerId of peersToRenegotiate) await sendOfferToPeer(peerId);
    } catch (err) {
      console.warn("Screen share failed:", err);
    }
  };

  const stopScreenShare = () => {
    const stream = screenStreamRef.current;
    const screenAudioTrack = stream?.getAudioTracks()[0] ?? null;
    if (stream) {
      for (const pc of Object.values(peerConnectionsRef.current)) {
        if (pc.connectionState !== "closed" && screenAudioTrack) {
          const audioSender = pc.getSenders().find((s) => s.track?.id === screenAudioTrack.id);
          if (audioSender) audioSender.replaceTrack(null);
        }
      }
      stream.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalScreenStream(null);
    setIsSharingScreen(false);
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0] ?? null;
    const peerIds = Object.keys(peerConnectionsRef.current).map(Number);
    for (const pc of Object.values(peerConnectionsRef.current)) {
      if (pc.connectionState !== "closed") {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      }
    }
    for (const peerId of peerIds) sendOfferToPeer(peerId);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      setLocalCameraStream(stream);
      setIsCameraEnabled(true);
      const track = stream.getVideoTracks()[0];
      const peersToRenegotiate = [];
      for (const [peerUserId, pc] of Object.entries(peerConnectionsRef.current)) {
        if (pc.connectionState !== "closed") {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(track);
          else {
            pc.addTrack(track, stream);
            peersToRenegotiate.push(Number(peerUserId));
          }
        }
      }
      for (const peerId of peersToRenegotiate) await sendOfferToPeer(peerId);
    } catch (err) {
      console.warn("Camera failed:", err);
    }
  };

  const stopCamera = () => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setLocalCameraStream(null);
    setIsCameraEnabled(false);
    if (!screenStreamRef.current?.getVideoTracks()?.length) {
      for (const pc of Object.values(peerConnectionsRef.current)) {
        if (pc.connectionState !== "closed") {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(null);
        }
      }
    }
  };

  // Single return so hook count is identical every render
  let content;
  if (!isAuthenticated) {
    content = <AuthModal onAuth={handleAuth} />;
  } else if (showProfileSetup) {
    content = (
      <ProfileSetupPage
        user={currentUser}
        onComplete={(updatedProfile) => {
          if (updatedProfile) {
            setProfiles((prev) => ({ ...prev, [updatedProfile.id]: updatedProfile }));
          }
          setShowProfileSetup(false);
        }}
      />
    );
  } else {
    content = (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <audio
        ref={(el) => {
          notificationAudioRef.current = el;
          if (el) setNotificationAudioElement(el);
        }}
        src={`${import.meta.env.BASE_URL || "/"}notification.mp3`}
        preload="auto"
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur min-w-0">
        <div className="flex items-center gap-2 min-w-0">
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

        <div className="flex items-center gap-2 flex-shrink-0">
          <nav className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-white text-indigo-600 shadow dark:bg-gray-700 dark:text-indigo-300"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("board")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "board"
                  ? "bg-white text-indigo-600 shadow dark:bg-gray-700 dark:text-indigo-300"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Board
            </button>
          </nav>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span className="text-xs" aria-hidden="true">
              {theme === "dark" ? "🌙" : "☀️"}
            </span>
            <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-200 dark:hover:bg-red-900"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-0 h-[calc(100vh-48px)] min-w-0">
        <aside className="flex min-h-0 w-72 min-w-[12rem] max-w-[80vw] flex-shrink-0 flex-col border-r border-gray-200 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="mb-3 flex-shrink-0">
            <UserProfile profile={currentUserProfile} onSave={handleSaveProfile} />
          </div>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
            <section>
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Text Channels
              </h2>
              <TextChannels
                channels={TEXT_CHANNELS}
                selectedChannelId={selectedChannelId}
                onSelectChannel={(id) => {
                  setSelectedChannelId(id);
                  if (activeTab === "board") setActiveTab("chat");
                }}
              />
            </section>

            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Voice
              </h2>
              <VoiceChannels
                channels={VOICE_CHANNELS}
                joinedChannelId={joinedVoiceChannelId}
                channelParticipants={voiceChannelParticipants}
                profiles={profiles}
                speakingUserIds={speakingUserIds}
                onOpenChannelView={(roomId) => {
                  if (activeTab === "board") setActiveTab("chat");
                  setVoiceChannelModalRoomId(roomId);
                }}
                onJoinChannel={joinVoiceChannel}
                onLeaveChannel={leaveVoiceChannel}
                onOpenSoundSettings={() => setIsVoiceSettingsOpen(true)}
              />
            </section>

            <section>
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Users
              </h2>
              <UserList
                users={presenceUsers}
                profiles={profiles}
                onUserClick={setSelectedUserForProfile}
              />
            </section>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50/60 dark:bg-gray-950/70 overflow-hidden">
          {activeTab === "board" ? (
            <Board currentUser={currentUser} apiBase={API_BASE} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2 sm:px-4 sm:py-3 dark:border-gray-800 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl font-semibold truncate">
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
                currentUserName={currentUser.displayName || DEFAULT_USER_NAME}
                currentUserId={currentUser?.id}
                profiles={profiles}
                senderNameToAvatar={senderNameToAvatar}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
              />

              <div className="flex-shrink-0 border-t border-gray-200 px-3 py-2 sm:px-4 sm:py-3 dark:border-gray-800 min-w-0">
                <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900 min-w-0">
                  <textarea
                    rows={1}
                    className="min-h-[32px] max-h-24 min-w-0 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                      className="inline-flex items-center rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsGifModalOpen(true)}
                      className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 whitespace-nowrap"
                    >
                      GIF
                    </button>
                  </div>
                </div>
                {/* hidden audio elements for remote peers */}
                <div className="sr-only">
                  {Object.entries(remoteStreams).map(([userId, stream]) => (
                    <audio
                      key={userId}
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el && stream && typeof stream.getTracks === "function") {
                          el.srcObject = stream;
                          el.volume = voiceSettings.volume;
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelectGif={handleSelectGif}
        apiBase={API_BASE}
      />
      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
        voiceSettings={voiceSettings}
        onSave={(next) => {
          setVoiceSettings((prev) => ({ ...prev, ...next }));
          setIsVoiceSettingsOpen(false);
        }}
      />
      <VoiceChannelModal
        isOpen={voiceChannelModalRoomId != null}
        onClose={() => setVoiceChannelModalRoomId(null)}
        channel={VOICE_CHANNELS.find((c) => c.id === voiceChannelModalRoomId) || null}
        participants={voiceChannelModalRoomId ? (voiceChannelParticipants[voiceChannelModalRoomId] || []) : []}
        profiles={profiles}
        isJoined={joinedVoiceChannelId === voiceChannelModalRoomId}
        speakingUserIds={speakingUserIds}
        voicePingMs={voicePingMs}
        isSharingScreen={isSharingScreen}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        localScreenStream={localScreenStream}
        isCameraEnabled={isCameraEnabled}
        onStartCamera={startCamera}
        onStopCamera={stopCamera}
        localCameraStream={localCameraStream}
        remoteStreams={remoteStreams}
        onOpenSoundSettings={() => setIsVoiceSettingsOpen(true)}
        onJoin={() => {
          if (voiceChannelModalRoomId) joinVoiceChannel(voiceChannelModalRoomId);
        }}
        onLeave={leaveVoiceChannel}
      />
      <UserProfileModal
        isOpen={selectedUserForProfile != null}
        onClose={() => setSelectedUserForProfile(null)}
        user={selectedUserForProfile}
        initialProfile={
          selectedUserForProfile?.id != null
            ? profiles[selectedUserForProfile.id]
            : null
        }
      />
    </div>
  );
  }
  return content;
}

export default App;
