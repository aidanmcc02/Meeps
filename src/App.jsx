import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/tauri";
import TextChannels from "./components/TextChannels";
import VoiceChannels from "./components/VoiceChannels";
import UserList from "./components/UserList";
import UserProfile from "./components/UserProfile";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import GifPickerModal from "./components/GifPickerModal";
import AuthModal from "./components/AuthModal";
import ProfileSetupPage from "./components/ProfileSetupPage";
import VoiceSettingsModal from "./components/VoiceSettingsModal";
import SettingsModal from "./components/SettingsModal";
import VoiceChannelModal from "./components/VoiceChannelModal";
import Board from "./components/Board";
import Games from "./components/Games";
import SplashScreen from "./components/SplashScreen";
import {
  initSoundElements,
  setUserHasInteracted,
  unlockAudio,
  preloadNotificationSound,
  playConnectSound,
  playUserJoinedSound,
  playUserLeftSound,
  playMessageSentSound,
  playMessageReceivedSound
} from "./utils/voiceSounds";
import {
  messageMentionsMe,
  requestNotificationPermission,
  showMentionNotificationIfBackground,
  subscribePushSubscription
} from "./utils/mentionNotifications";

const THEME_KEY = "meeps-theme";
const KEYBINDS_KEY = "meeps-keybinds";
const SIDEBAR_WIDTH_KEY = "meeps-sidebar-width-px";
const USERS_PANEL_WIDTH_KEY = "meeps-users-panel-width-px";
const SIDEBAR_MIN_PX = 192;
const SIDEBAR_MAX_PX = 420;
const SIDEBAR_DEFAULT_PX = 288;
const USERS_PANEL_MIN_PX = 128;
const USERS_PANEL_MAX_PX = 360;
const USERS_PANEL_DEFAULT_PX = 160;
const DEFAULT_KEYBINDS = {
  mute: { key: "KeyM", mode: "toggle" },
  muteDeafen: { key: "KeyB", mode: "hold" }
};
const DEFAULT_USER_NAME = "Meeps User";
const CURRENT_USER_ID = 1;

const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";
const voiceDebug = isDev ? {
  log: (...args) => console.log("[VOICE]", ...args),
  warn: (...args) => console.warn("[VOICE]", ...args),
  error: (...args) => console.error("[VOICE]", ...args)
} : {
  log: () => {},
  warn: () => {},
  error: () => {}
};
const TEXT_CHANNELS = [
  { id: "general", name: "general" },
  { id: "dev", name: "dev-chat" },
  { id: "Builds", name: "Builds" },
  { id: "matches", name: "Matches" }
];
const VOICE_CHANNELS = [{ id: "voice", name: "Voice" }];

// Known window title substrings that indicate a game (for activity display). Only used for labeling, no anticheat impact.
const ACTIVITY_KNOWN_GAMES = [
  "Valorant", "League of Legends", "Counter-Strike", "Overwatch", "Minecraft", "Fortnite",
  "Roblox", "Among Us", "Rocket League", "Apex Legends", "Call of Duty", "Dota 2", "Genshin",
  "Elden Ring", "Steam", "RuneScape", "World of Warcraft", "Hearthstone", "Diablo", "Path of Exile",
  "Destiny 2", "FIFA", "Rocket League", "Fall Guys", "Sea of Thieves", "Halo", "Battlefield"
];

function buildActivityFromWindowTitle(title) {
  if (!title || typeof title !== "string") return null;
  const t = title.trim();
  if (!t || t === "Meeps") return null;
  const lower = t.toLowerCase();
  const isGame = ACTIVITY_KNOWN_GAMES.some((g) => lower.includes(g.toLowerCase()));
  return {
    type: isGame ? "game" : "app",
    name: t.length > 60 ? t.slice(0, 57) + "…" : t,
    details: t.length > 60 ? t : undefined
  };
}

const DEFAULT_HTTP =
  import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";
const DEFAULT_WS =
  import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:4000/ws";
const DEFAULT_DIANA_API =
  import.meta.env.VITE_DIANA_API_URL || "https://diana-bot-production.up.railway.app";

function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_HTTP);
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const topMenuRef = useRef(null);
  const [sidebarWidthPx, setSidebarWidthPx] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10);
      if (Number.isFinite(v) && v >= SIDEBAR_MIN_PX && v <= SIDEBAR_MAX_PX) return v;
    } catch (_) {}
    return SIDEBAR_DEFAULT_PX;
  });
  const [usersPanelWidthPx, setUsersPanelWidthPx] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(USERS_PANEL_WIDTH_KEY), 10);
      if (Number.isFinite(v) && v >= USERS_PANEL_MIN_PX && v <= USERS_PANEL_MAX_PX) return v;
    } catch (_) {}
    return USERS_PANEL_DEFAULT_PX;
  });
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  const resizeStateRef = useRef({ active: null, startX: 0, startWidth: 0, lastSidebarPx: SIDEBAR_DEFAULT_PX, lastUsersPx: USERS_PANEL_DEFAULT_PX });

  const [showSplash, setShowSplash] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "board" | "games"
  const [selectedChannelId, setSelectedChannelId] = useState("general");
  const [unreadChannelIds, setUnreadChannelIds] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [dianaApiBase, setDianaApiBase] = useState(DEFAULT_DIANA_API);
  const [profiles, setProfiles] = useState({});
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const socketRef = useRef(null);
  const wsShouldReconnectRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const connectWsRef = useRef(null);
  const currentUserRef = useRef(currentUser);
  const wsUrlRef = useRef(wsUrl);
  const selectedChannelIdRef = useRef(selectedChannelId);
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
  const [voiceHostUserId, setVoiceHostUserId] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const screenStreamRef = useRef(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [localCameraStream, setLocalCameraStream] = useState(null);
  const cameraStreamRef = useRef(null);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [keybinds, setKeybinds] = useState(() => {
    try {
      const raw = localStorage.getItem(KEYBINDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          mute: { ...DEFAULT_KEYBINDS.mute, ...parsed.mute },
          muteDeafen: { ...DEFAULT_KEYBINDS.muteDeafen, ...parsed.muteDeafen }
        };
      }
    } catch (_) {}
    return DEFAULT_KEYBINDS;
  });
  const [selectedUserForProfile, setSelectedUserForProfile] = useState(null);
  const [profileModalAnchor, setProfileModalAnchor] = useState("center");
  const keybindHoldRef = useRef({ mute: false, muteDeafen: false });
  const keybindToggleReleasedRef = useRef({ mute: true, muteDeafen: true });
  const voiceParticipantCountRef = useRef(0);
  const justJoinedVoiceRef = useRef(false);
  const joinedVoiceChannelIdRef = useRef(null);
  const voiceRoomToRejoinRef = useRef(null);
  const joinVoiceChannelRef = useRef(null);
  const pendingIceCandidatesRef = useRef({}); // peerUserId -> RTCIceCandidate[]
  const [speakingUserIds, setSpeakingUserIds] = useState([]);
  const [participantMuted, setParticipantMuted] = useState({}); // userId -> true if muted
  const [isDeafened, setIsDeafened] = useState(false);
  const voiceAudioContextRef = useRef(null);
  const voiceAnalysersRef = useRef({}); // userId -> { source, analyser }
  const voiceSpeakingIntervalRef = useRef(null);
  const previousSpeakingRef = useRef(new Set());
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && "ontouchend" in window);
    setIsTauri(!!window.__TAURI__ && !isIOS);
  }, []);

  // In Tauri, open external links (http/https) in the system's default browser
  useEffect(() => {
    const handleClick = async (e) => {
      if (!window.__TAURI__) return;
      const anchor = e.target?.closest?.("a[href]");
      if (!anchor || !anchor.href) return;
      const href = anchor.getAttribute("href") || anchor.href;
      if (!/^https?:\/\//i.test(href)) return;
      e.preventDefault();
      try {
        const { open } = await import("@tauri-apps/api/shell");
        await open(href);
      } catch (err) {
        console.warn("Failed to open link in browser:", err);
        window.open(href, "_blank", "noopener,noreferrer");
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const blockMentionNav = (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("[data-mention]") || t.closest("a[href^='mention:']")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("mousedown", blockMentionNav, true);
    document.addEventListener("click", blockMentionNav, true);
    return () => {
      document.removeEventListener("mousedown", blockMentionNav, true);
      document.removeEventListener("click", blockMentionNav, true);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handle = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e) => {
      const r = resizeStateRef.current;
      const { active, startX, startWidth } = r;
      if (!active) return;
      const delta = active === "sidebar" ? e.clientX - startX : startX - e.clientX;
      const next = Math.round(Math.max(0, startWidth + delta));
      if (active === "sidebar") {
        const clamped = Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, next));
        r.lastSidebarPx = clamped;
        setSidebarWidthPx(clamped);
      } else {
        const clamped = Math.min(USERS_PANEL_MAX_PX, Math.max(USERS_PANEL_MIN_PX, next));
        r.lastUsersPx = clamped;
        setUsersPanelWidthPx(clamped);
      }
    };
    const onUp = () => {
      const r = resizeStateRef.current;
      if (r.active === "sidebar") {
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(r.lastSidebarPx));
        } catch (_) {}
      } else if (r.active === "users") {
        try {
          localStorage.setItem(USERS_PANEL_WIDTH_KEY, String(r.lastUsersPx));
        } catch (_) {}
      }
      r.active = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleTauriMinimize = () => {
    if (!isTauri) return;
    try {
      appWindow.minimize();
    } catch (err) {
      console.error("Failed to minimize Tauri window", err);
    }
  };
  const handleTauriClose = () => {
    if (!isTauri) return;
    try {
      appWindow.hide();
    } catch (err) {
      console.error("Failed to hide Tauri window", err);
    }
  };

  // Load runtime config (e.g. from /config.json written at build on Railway) so PWA uses correct backend URL
  useEffect(() => {
    fetch("/config.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.VITE_BACKEND_HTTP_URL) {
          setApiBase(data.VITE_BACKEND_HTTP_URL.replace(/\/$/, ""));
        }
        if (data?.VITE_BACKEND_WS_URL) {
          setWsUrl(data.VITE_BACKEND_WS_URL);
        }
        if (data?.VITE_DIANA_API_URL) {
          setDianaApiBase(data.VITE_DIANA_API_URL.replace(/\/$/, ""));
        }
      })
      .catch(() => {});
  }, []);

  // Keep refs in sync so WebSocket onmessage always sees current values (avoids stale closure).
  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);
  useEffect(() => {
    joinedVoiceChannelIdRef.current = joinedVoiceChannelId;
  }, [joinedVoiceChannelId]);

  // Merged in-call list: server list + peers we have active streams for (fixes UI when voice:participants is stale)
  const effectiveInCallParticipants = useMemo(() => {
    if (!joinedVoiceChannelId) return [];
    const myId = currentUser?.id ?? CURRENT_USER_ID;
    const seen = new Set();
    const list = [];
    const myProfile = profiles[myId];
    const myDisplayName = currentUser?.displayName ?? myProfile?.displayName ?? `User ${myId}`;
    let me = voiceParticipants.find((p) => String(p.id) === String(myId));
    if (!me) me = { id: myId, displayName: myDisplayName };
    else me = { ...me, displayName: me.displayName || myDisplayName };
    list.push(me);
    seen.add(String(me.id));
    voiceParticipants.forEach((p) => {
      if (!seen.has(String(p.id))) {
        list.push(p);
        seen.add(String(p.id));
      }
    });
    Object.keys(remoteStreams).forEach((peerId) => {
      if (seen.has(String(peerId))) return;
      const profile = profiles[peerId];
      list.push({ id: peerId, displayName: profile?.displayName ?? `User ${peerId}` });
      seen.add(String(peerId));
    });
    return list;
  }, [joinedVoiceChannelId, voiceParticipants, remoteStreams, profiles, currentUser?.id, currentUser?.displayName]);

  useEffect(() => {
    if (!joinedVoiceChannelId) return;
    
    const ensureAudioContextActive = () => {
      // Resume audio context if suspended (browser may suspend it when switching views)
      const ctx = voiceAudioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    
    // Check immediately when tab changes or when in a call
    ensureAudioContextActive();
    
    // Also check periodically to catch any suspensions while in board mode
    const interval = setInterval(ensureAudioContextActive, 2000);
    return () => clearInterval(interval);
  }, [activeTab, joinedVoiceChannelId]);

  // Detect who is speaking (local + remote) via Web Audio analyser; update speakingUserIds.
  const SPEAK_THRESHOLD = 0.028;
  const SILENCE_THRESHOLD = 0.018;
  useEffect(() => {
    if (!joinedVoiceChannelId) {
      setSpeakingUserIds([]);
      return;
    }
    
    // Reuse existing audio context if available (created during user gesture in joinVoiceChannel)
    // Otherwise create a new one
    let ctx = voiceAudioContextRef.current;
    voiceDebug.log("useEffect audio context setup", { hasExisting: !!ctx, state: ctx?.state });
    if (!ctx || ctx.state === "closed") {
      voiceDebug.log("Creating audio context in useEffect");
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      voiceAudioContextRef.current = ctx;
      voiceDebug.log("Audio context created in useEffect", { state: ctx.state });
      if (ctx.state === "suspended") {
        voiceDebug.log("Attempting to resume newly created context");
        ctx.resume().catch((err) => voiceDebug.warn("Failed to resume new context:", err));
      }
    } else {
      if (ctx.state === "suspended") {
        voiceDebug.log("Resuming existing suspended context in useEffect");
        ctx.resume().catch((err) => voiceDebug.warn("Failed to resume existing context:", err));
      } else {
        voiceDebug.log("Audio context already running in useEffect", { state: ctx.state });
      }
    }
    
    const analysers = voiceAnalysersRef.current;

    const addStream = (userId, stream) => {
      if (!stream || typeof stream.getAudioTracks !== "function") return;
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;
      
      if (ctx.state === "suspended") {
        ctx.resume().catch((err) => {
          voiceDebug.warn("Failed to resume audio context in addStream:", err);
        });
      }
      
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analysers[userId] = { source, analyser };
      } catch (err) {
        console.warn("Failed to create MediaStreamSource:", err);
      }
    };

    const myId = String(currentUser?.id ?? CURRENT_USER_ID);
    voiceDebug.log("Adding streams to audio context", { 
      hasLocalStream: !!localStreamRef.current,
      remoteStreamCount: Object.keys(remoteStreams).length,
      remoteStreamIds: Object.keys(remoteStreams)
    });
    if (localStreamRef.current) {
      voiceDebug.log("Adding local stream", { myId });
      addStream(myId, localStreamRef.current);
    }
    Object.entries(remoteStreams).forEach(([uid, stream]) => {
      voiceDebug.log("Adding remote stream", { userId: uid });
      addStream(uid, stream);
    });

    const resumeContext = () => {
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    resumeContext();
    // Also try after a brief delay in case the browser suspends it asynchronously
    setTimeout(resumeContext, 50);
    setTimeout(resumeContext, 200);

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
  }, [joinedVoiceChannelId, remoteStreams, currentUser?.id]);

  const tryPlayRemoteAudio = (el) => {
    if (!el || !el.srcObject || el.paused === false) return;
    el.play().then(() => {
      voiceDebug.log("Audio element playing successfully");
    }).catch((err) => {
      voiceDebug.error("Failed to play audio element:", err);
    });
  };

  useEffect(() => {
    if (!joinedVoiceChannelId || Object.keys(remoteStreams).length === 0) return;

    voiceDebug.log("Remote streams changed, checking audio elements", {
      remoteStreamCount: Object.keys(remoteStreams).length,
      remoteStreamIds: Object.keys(remoteStreams)
    });

    const audioElements = document.querySelectorAll("audio[srcObject]");
    voiceDebug.log("Found audio elements", { count: audioElements.length });
    audioElements.forEach((el, idx) => {
      voiceDebug.log("Audio element check", {
        index: idx,
        paused: el.paused,
        hasSrcObject: !!el.srcObject,
        volume: el.volume,
        readyState: el.readyState
      });
      tryPlayRemoteAudio(el);
    });
    // Delayed retries for late-ready or briefly stalled streams (reduces patchy audio)
    const t1 = setTimeout(() => {
      document.querySelectorAll("audio[srcObject]").forEach(tryPlayRemoteAudio);
    }, 400);
    const t2 = setTimeout(() => {
      document.querySelectorAll("audio[srcObject]").forEach(tryPlayRemoteAudio);
    }, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [remoteStreams, joinedVoiceChannelId]);

  // Poll participant mute state when in a voice call (track.enabled is not reactive)
  useEffect(() => {
    if (!joinedVoiceChannelId) {
      setParticipantMuted({});
      return;
    }
    const myId = currentUser?.id ?? CURRENT_USER_ID;
    const interval = setInterval(() => {
      const next = {};
      const localTrack = localStreamRef.current?.getAudioTracks?.()[0];
      next[myId] = localTrack ? !localTrack.enabled : false;
      Object.keys(remoteStreams).forEach((uid) => {
        const track = remoteStreams[uid]?.getAudioTracks?.()[0];
        next[uid] = track ? !track.enabled : false;
      });
      setParticipantMuted((prev) => {
        const same = Object.keys(next).length === Object.keys(prev).length &&
          Object.keys(next).every((k) => prev[k] === next[k]);
        return same ? prev : next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [joinedVoiceChannelId, currentUser?.id, remoteStreams]);

  // Do not request microphone on app load (e.g. iPhone asks every time and shows "audio" in status bar).
  // Mic is requested only when the user joins a voice channel (ensureLocalStream).

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

    // Check for existing authentication by validating the stored token with the backend.
    const token = localStorage.getItem("meeps_token");
    const user = localStorage.getItem("meeps_user");
    if (!token || !user || isAuthenticated) return;

    let parsedUser;
    try {
      parsedUser = JSON.parse(user);
    } catch {
      localStorage.removeItem("meeps_token");
      localStorage.removeItem("meeps_user");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/profile`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error("invalid token");
        }
        const profile = await res.json();
        const nextUser = { ...parsedUser, ...profile };
        setCurrentUser(nextUser);
        setIsAuthenticated(true);
        localStorage.setItem("meeps_user", JSON.stringify(nextUser));
      } catch {
        localStorage.removeItem("meeps_token");
        localStorage.removeItem("meeps_user");
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    })();
  }, [apiBase, isAuthenticated]);

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

  // Keep refs in sync so reconnection and visibility handler use latest user/wsUrl
  currentUserRef.current = currentUser;
  wsUrlRef.current = wsUrl;

  useEffect(() => {
    if (!isAuthenticated) return;

    wsShouldReconnectRef.current = true;

    const scheduleReconnect = () => {
      if (!wsShouldReconnectRef.current) return;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectAttemptRef.current = attempt + 1;
      console.log("WebSocket reconnecting in", delay, "ms (attempt", attempt + 1, ")");
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (socketRef.current?.readyState === WebSocket.OPEN) return;
        connect();
      }, delay);
    };

    const connect = () => {
      const u = wsUrlRef.current;
      if (!u) return;
      const uid = currentUserRef.current?.id ?? CURRENT_USER_ID;
      const dname = currentUserRef.current?.displayName ?? DEFAULT_USER_NAME;

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (_) {}
        socketRef.current = null;
      }

      console.log("Connecting to WebSocket at:", u);
      const socket = new WebSocket(u);
      socketRef.current = socket;
      setSocketStatus("connecting");

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        console.log("WebSocket connected successfully");
        setSocketStatus("connected");
        socket.send(
          JSON.stringify({ type: "presence:hello", userId: uid, displayName: dname })
        );
        socket.send(
          JSON.stringify({
            type: "voice:get_participants",
            roomIds: VOICE_CHANNELS.map((c) => c.id)
          })
        );
        const roomToRejoin = voiceRoomToRejoinRef.current;
        if (roomToRejoin != null) {
          voiceRoomToRejoinRef.current = null;
          setTimeout(() => joinVoiceChannelRef.current?.(roomToRejoin), 500);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed");
        setSocketStatus("disconnected");
        const roomToRejoin = joinedVoiceChannelIdRef.current ?? null;
        socketRef.current = null;
        joinedVoiceChannelIdRef.current = null;
        setJoinedVoiceChannelId(null);
        if (roomToRejoin != null) voiceRoomToRejoinRef.current = roomToRejoin;
        scheduleReconnect();
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setSocketStatus("error");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message" && data.payload) {
            const payload = data.payload;
            setMessages((prev) => [...prev, payload]);
            const myId = currentUserRef.current?.id ?? CURRENT_USER_ID;
            const isFromMe = Number(payload.senderId) === Number(myId);
            if (!isFromMe) {
              playMessageReceivedSound();
            }
            const msgChannel = payload.channel;
            const currentChannel = selectedChannelIdRef.current;
            if (msgChannel && msgChannel !== currentChannel && !isFromMe) {
              setUnreadChannelIds((prev) => new Set(prev).add(msgChannel));
            }
            if (!isFromMe) {
              showMentionNotificationIfBackground(
                payload.sender || "Someone",
                payload.content || (payload.attachments?.length ? "sent an attachment" : "New message"),
                payload.channel
              );
            }
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
            const { roomId, participants, hostUserId } = data.payload;
            const list = participants || [];
            voiceDebug.log("Received voice:participants", { roomId, participantCount: list.length, hostUserId, participants: list.map(p => ({ id: p.id, displayName: p.displayName })) });
            setVoiceChannelParticipants((prev) => ({ ...prev, [roomId]: list }));
            const joinedRoomId = joinedVoiceChannelIdRef.current;
            const isOurRoom = joinedRoomId != null && String(roomId) === String(joinedRoomId);
            voiceDebug.log("Processing participants for room", { roomId, joinedRoomId, isOurRoom });
            if (isOurRoom) {
              setVoiceHostUserId(hostUserId != null ? hostUserId : null);
              const newCount = list.length;
              const oldCount = voiceParticipantCountRef.current;
              const isOurOwnJoin = justJoinedVoiceRef.current || (oldCount === 0 && newCount >= 1);
              voiceDebug.log("Our room participants updated", { newCount, oldCount, isOurOwnJoin });
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
              voiceDebug.log("Voice participants state updated", { count: list.length });
            }
          } else if (data.type === "voice:signal" && data.payload) {
            voiceDebug.log("Received voice:signal", { signalType: data.payload.signalType, fromUserId: data.payload.fromUserId });
            handleIncomingVoiceSignal(data.payload);
          }
        } catch {
          // ignore malformed messages
        }
      };
    };

    connect();
    connectWsRef.current = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      connect();
    };

    return () => {
      wsShouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      connectWsRef.current = null;
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (_) {}
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, currentUser?.id, wsUrl]);

  // When app becomes visible again (e.g. after sleep or Windows lock), reconnect if socket is dead.
  // Only reconnect when socket is actually closed/closing so we don't abort an in-flight connection.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const socket = socketRef.current;
      const closed = !socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING;
      if (!closed) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      connectWsRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isAuthenticated]);

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

  // Initialize sound elements from public/sounds/
  useEffect(() => {
    const base = import.meta.env.BASE_URL || "/";
    initSoundElements(base);
  }, []);

  // Unlock notification audio on first user interaction so sounds can play later
  useEffect(() => {
    let done = false;
    function unlock() {
      if (done) return;
      done = true;
      setUserHasInteracted();
      unlockAudio();
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

  // Request notification permission and push subscription (PWA iPhone – notifications when app closed)
  const notificationPermissionRequestedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || showProfileSetup || notificationPermissionRequestedRef.current) return;
    notificationPermissionRequestedRef.current = true;
    const t = setTimeout(async () => {
      try {
        const granted = await requestNotificationPermission();
        if (granted && apiBase) {
          const token = localStorage.getItem("meeps_token");
          if (token) await subscribePushSubscription(apiBase, token);
        }
      } catch (_) {}
    }, 1500);
    return () => clearTimeout(t);
  }, [isAuthenticated, showProfileSetup, apiBase]);

  // Close top menu when clicking outside
  useEffect(() => {
    if (!topMenuOpen) return;
    function handleClick(e) {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target)) {
        setTopMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [topMenuOpen]);

  // Keybinds: mute and mute+deafen (only when in a call, and not typing in inputs)
  useEffect(() => {
    if (!joinedVoiceChannelId || !keybinds) return;
    const muteKey = keybinds.mute?.key;
    const muteMode = keybinds.mute?.mode ?? "toggle";
    const muteDeafenKey = keybinds.muteDeafen?.key;
    const muteDeafenMode = keybinds.muteDeafen?.mode ?? "hold";

    function isInputFocused() {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const tag = el.tagName?.toLowerCase();
      const role = (el.getAttribute?.("role") || "").toLowerCase();
      const editable = el.isContentEditable;
      return tag === "input" || tag === "textarea" || tag === "select" || role === "textbox" || editable;
    }

    function handleKeyDown(e) {
      if (e.repeat || isInputFocused()) return;
      const code = e.code || (e.key === " " ? "Space" : e.key);

      if (code === muteKey) {
        e.preventDefault();
        if (muteMode === "hold") {
          if (keybindHoldRef.current.mute) return;
          keybindHoldRef.current.mute = true;
          const track = localStreamRef.current?.getAudioTracks?.()[0];
          if (track) track.enabled = false;
        } else {
          if (!keybindToggleReleasedRef.current.mute) return;
          keybindToggleReleasedRef.current.mute = false;
          toggleMute();
        }
      } else if (code === muteDeafenKey) {
        e.preventDefault();
        if (muteDeafenMode === "hold") {
          if (keybindHoldRef.current.muteDeafen) return;
          keybindHoldRef.current.muteDeafen = true;
          const track = localStreamRef.current?.getAudioTracks?.()[0];
          if (track) track.enabled = false;
          setIsDeafened(true);
        } else {
          if (!keybindToggleReleasedRef.current.muteDeafen) return;
          keybindToggleReleasedRef.current.muteDeafen = false;
          toggleMute();
          setIsDeafened((d) => !d);
        }
      }
    }

    function handleKeyUp(e) {
      if (e.repeat || isInputFocused()) return;
      const code = e.code || (e.key === " " ? "Space" : e.key);

      if (code === muteKey) {
        e.preventDefault();
        if (muteMode === "hold") {
          keybindHoldRef.current.mute = false;
          const track = localStreamRef.current?.getAudioTracks?.()[0];
          if (track) track.enabled = true;
        } else {
          keybindToggleReleasedRef.current.mute = true;
        }
      } else if (code === muteDeafenKey) {
        e.preventDefault();
        if (muteDeafenMode === "hold") {
          keybindHoldRef.current.muteDeafen = false;
          const track = localStreamRef.current?.getAudioTracks?.()[0];
          if (track) track.enabled = true;
          setIsDeafened(false);
        } else {
          keybindToggleReleasedRef.current.muteDeafen = true;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      keybindHoldRef.current.mute = false;
      keybindHoldRef.current.muteDeafen = false;
      const track = localStreamRef.current?.getAudioTracks?.()[0];
      if (track) track.enabled = true;
      setIsDeafened(false);
    };
  }, [joinedVoiceChannelId, keybinds]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

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
  }, [isAuthenticated, currentUser]);

  // Activity tracker (Tauri only): poll foreground window title and send as presence activity. Uses only GetWindowText, no anticheat impact.
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !window.__TAURI__) return;
    const ACTIVITY_POLL_MS = 15 * 1000;
    let lastTitleRef = "";
    const poll = async () => {
      try {
        const title = await invoke("get_foreground_window_title");
        const t = title != null ? String(title).trim() : "";
        if (t === lastTitleRef) return;
        lastTitleRef = t;
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        const activity = t === "" || t === "Meeps" ? null : buildActivityFromWindowTitle(t);
        socket.send(JSON.stringify({
          type: "presence:activity",
          userId: currentUser.id || CURRENT_USER_ID,
          ...(activity != null ? { activity } : { activity: null })
        }));
      } catch (_) {
        // ignore (e.g. not in Tauri or API unavailable)
      }
    };
    poll();
    const interval = setInterval(poll, ACTIVITY_POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser]);

  const MESSAGES_PAGE_SIZE = 100; // per text channel

  useEffect(() => {
    if (!isAuthenticated) return;
    
    async function loadMessages() {
      try {
        const res = await fetch(
          `${apiBase}/api/messages?channel=${encodeURIComponent(
            selectedChannelId
          )}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          setHasMoreOlderMessages(data.messages.length >= MESSAGES_PAGE_SIZE);
        }
      } catch {
        // ignore for skeleton
      }
    }

    loadMessages();
  }, [selectedChannelId, isAuthenticated, apiBase]);

  const loadOlderMessages = useCallback(
    async (beforeId) => {
      if (!isAuthenticated || loadingOlderMessages || !hasMoreOlderMessages) return;
      setLoadingOlderMessages(true);
      try {
        const res = await fetch(
          `${apiBase}/api/messages?channel=${encodeURIComponent(
            selectedChannelId
          )}&before=${encodeURIComponent(beforeId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data.messages)) return;
        setMessages((prev) => {
          const other = prev.filter((m) => m.channel !== selectedChannelId);
          const current = prev.filter((m) => m.channel === selectedChannelId);
          const merged = [...data.messages, ...current];
          return [...other, ...merged];
        });
        setHasMoreOlderMessages(data.messages.length >= MESSAGES_PAGE_SIZE);
      } catch {
        // ignore
      } finally {
        setLoadingOlderMessages(false);
      }
    },
    [
      isAuthenticated,
      loadingOlderMessages,
      hasMoreOlderMessages,
      selectedChannelId,
      apiBase
    ]
  );

  // Preload profiles for message senders so avatars show in channel
  useEffect(() => {
    if (!isAuthenticated) return;
    const channelMessages = messages.filter((m) => m.channel === selectedChannelId);
    const senderIds = [...new Set(channelMessages.map((m) => m.senderId).filter(Boolean))];
    senderIds.forEach((userId) => {
      if (profiles[userId]) return;
      fetch(`${apiBase}/api/profile/${userId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setProfiles((prev) => ({ ...prev, [data.id]: data }));
          }
        })
        .catch(() => {});
    });
  }, [selectedChannelId, isAuthenticated, messages, profiles, apiBase]);

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
      fetch(`${apiBase}/api/profile/${userId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setProfiles((prev) => ({ ...prev, [data.id]: data }));
          }
        })
        .catch(() => {});
    });
  }, [isAuthenticated, voiceChannelParticipants, profiles, apiBase]);

  // Preload profiles for presence users so we can show only DB users in the users tab
  useEffect(() => {
    if (!isAuthenticated) return;
    (presenceUsers || []).forEach((u) => {
      if (u?.id == null || profiles[u.id]) return;
      fetch(`${apiBase}/api/profile/${u.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setProfiles((prev) => ({ ...prev, [data.id]: data }));
        })
        .catch(() => {});
    });
  }, [isAuthenticated, presenceUsers, profiles, apiBase]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    async function loadProfile() {
      try {
        const userId = currentUser.id || CURRENT_USER_ID;
        const res = await fetch(`${apiBase}/api/profile/${userId}`);
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
  }, [isAuthenticated, currentUser, apiBase]);

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
      await fetch(`${apiBase}/api/profile/${userId}`, {
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

  const handleSend = (contentOrTrimmed, attachmentIds = []) => {
    const trimmed = typeof contentOrTrimmed === "string" ? contentOrTrimmed : inputValue.trim();
    if (!trimmed && (!attachmentIds || attachmentIds.length === 0)) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log("Cannot send message - WebSocket not ready. State:", socket?.readyState);
      return;
    }

    const payload = {
      type: "message",
      channel: selectedChannelId,
      sender: currentUser?.displayName || DEFAULT_USER_NAME,
      senderId: currentUser?.id ?? undefined,
      content: trimmed || (attachmentIds?.length > 0 ? " " : ""),
      attachmentIds: Array.isArray(attachmentIds) ? attachmentIds : []
    };

    console.log("Sending message:", payload);
    socket.send(JSON.stringify(payload));
    // Only play sound if message mentions yourself or @everyone
    const content = trimmed || (attachmentIds?.length > 0 ? " " : "");
    if (content && typeof content === "string" && messageMentionsMe(content, currentUser?.displayName)) {
      playMessageSentSound();
    }
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
      sender: currentUser?.displayName || DEFAULT_USER_NAME,
      senderId: currentUser?.id ?? undefined,
      content
    };

    socket.send(JSON.stringify(payload));
    // Only play sound if message mentions yourself or @everyone
    if (content && typeof content === "string" && messageMentionsMe(content, currentUser?.displayName)) {
      playMessageSentSound();
    }
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

  // Slug (for @mentions) -> display name (e.g. "Person_One" -> "Person One", "everyone" -> "everyone")
  const mentionSlugToName = useMemo(() => {
    const m = { everyone: "everyone" };
    const add = (displayName) => {
      if (!displayName || typeof displayName !== "string") return;
      const slug = displayName.replace(/\s+/g, "_").trim();
      if (slug) m[slug] = displayName;
    };
    add(currentUser?.displayName);
    (presenceUsers || []).forEach((u) => add(u.displayName || u.name));
    Object.values(profiles).forEach((p) => add(p?.displayName));
    return m;
  }, [currentUser?.displayName, presenceUsers, profiles]);

  // Only show in users tab people who exist in the DB and have an allowed email
  const ALLOWED_USERS_EMAILS = new Set([
    "aidanmccarthy3@gmail.com",
    "fakeemail@gmail.com",
    "sullivanlouis0@gmail.com"
  ]);
  const usersInDb = useMemo(() => {
    return (presenceUsers || []).filter((u) => {
      if (u?.id == null || !profiles[u.id]) return false;
      const email = profiles[u.id]?.email;
      return email && ALLOWED_USERS_EMAILS.has(email);
    });
  }, [presenceUsers, profiles]);

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

  /** Prefer Opus for voice (lower latency, better for real-time). Call before createOffer/createAnswer. */
  const preferOpusForAudio = (pc) => {
    try {
      const caps = RTCRtpReceiver.getCapabilities?.("audio");
      if (!caps?.codecs?.length) return;
      const preferred = ["audio/opus", "audio/red", "audio/PCMU", "audio/PCMA"];
      const sorted = [...caps.codecs].sort((a, b) => {
        const i = preferred.indexOf(a.mimeType);
        const j = preferred.indexOf(b.mimeType);
        const orderA = i >= 0 ? i : preferred.length;
        const orderB = j >= 0 ? j : preferred.length;
        return orderA - orderB;
      });
      pc.getTransceivers?.().forEach((t) => {
        if (t.kind === "audio") {
          try {
            t.setCodecPreferences(sorted);
          } catch (_) {}
        }
      });
    } catch (_) {}
  };

  const createPeerConnection = async (peerUserId) => {
    voiceDebug.log("createPeerConnection", { peerUserId, hasExisting: !!peerConnectionsRef.current[peerUserId] });
    if (peerConnectionsRef.current[peerUserId]) {
      voiceDebug.log("Reusing existing peer connection", { peerUserId });
      return peerConnectionsRef.current[peerUserId];
    }

    const ctx = voiceAudioContextRef.current;
    voiceDebug.log("createPeerConnection audio context check", { state: ctx?.state });
    if (ctx && ctx.state === "suspended") {
      voiceDebug.log("Resuming audio context in createPeerConnection");
      try {
        await ctx.resume();
        voiceDebug.log("Audio context resumed in createPeerConnection", { state: ctx.state });
      } catch (err) {
        voiceDebug.error("Failed to resume audio context in createPeerConnection:", err);
      }
    }

    const turnServer = import.meta.env.VITE_TURN_SERVER;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
    let iceServers;
    if (turnServer && turnUsername && turnCredential) {
      // Metered-style: STUN + multiple TURN endpoints (UDP, TCP, TLS) for better connectivity
      iceServers = [
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: `turn:${turnServer}:80`, username: turnUsername, credential: turnCredential },
        { urls: `turn:${turnServer}:80?transport=tcp`, username: turnUsername, credential: turnCredential },
        { urls: `turn:${turnServer}:443`, username: turnUsername, credential: turnCredential },
        { urls: `turns:${turnServer}:443?transport=tcp`, username: turnUsername, credential: turnCredential }
      ];
    } else {
      iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
      const turnUrl = import.meta.env.VITE_TURN_URL;
      if (turnUrl) {
        iceServers.push({
          urls: turnUrl,
          username: import.meta.env.VITE_TURN_USERNAME || undefined,
          credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined
        });
      }
    }

    voiceDebug.log("Creating RTCPeerConnection", { peerUserId, hasTurn: !!turnServer });
    const pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: "max-bundle"
    });

    const localStream = await ensureLocalStream();
    voiceDebug.log("Got local stream for peer connection", { 
      hasStream: !!localStream,
      audioTracks: localStream?.getAudioTracks()?.length || 0
    });
    const useScreenAsVideo = screenStreamRef.current?.getVideoTracks()?.length > 0;
    const useCameraAsVideo = !useScreenAsVideo && cameraStreamRef.current?.getVideoTracks()?.length > 0;
    if (localStream) {
      const tracksAdded = [];
      localStream.getTracks().forEach((track) => {
        if (track.kind === "video" && (useScreenAsVideo || useCameraAsVideo)) return;
        voiceDebug.log("Adding track to peer connection", { peerUserId, kind: track.kind, id: track.id, enabled: track.enabled });
        pc.addTrack(track, localStream);
        tracksAdded.push({ kind: track.kind, id: track.id });
      });
      voiceDebug.log("Tracks added to peer connection", { peerUserId, count: tracksAdded.length, tracks: tracksAdded });
    } else {
      voiceDebug.warn("No local stream to add to peer connection", { peerUserId });
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
      voiceDebug.log("ontrack event", {
        peerUserId,
        kind: track?.kind,
        id: track?.id,
        readyState: track?.readyState,
        streamCount: event.streams?.length || 0,
        streamTrackInfo: event.streams?.map((s) => ({
          id: s.id,
          audioTrackIds: s.getAudioTracks().map((t) => t.id),
          videoTrackIds: s.getVideoTracks().map((t) => t.id)
        })) || []
      });
      if (!track || typeof track.kind !== "string") {
        voiceDebug.warn("Invalid track in ontrack", { track });
        return;
      }
      try {
        let peerStream = remoteStreamsRef.current[peerUserId];
        if (!peerStream) {
          voiceDebug.log("Creating new MediaStream for peer", { peerUserId });
          peerStream = new MediaStream();
          remoteStreamsRef.current[peerUserId] = peerStream;
        }
        voiceDebug.log("Adding track to peer stream", {
          peerUserId,
          kind: track.kind,
          id: track.id,
          before: {
            audioTrackIds: peerStream.getAudioTracks().map((t) => t.id),
            videoTrackIds: peerStream.getVideoTracks().map((t) => t.id)
          }
        });
        peerStream.addTrack(track);
        voiceDebug.log("Added track to peer stream", {
          peerUserId,
          after: {
            audioTrackIds: peerStream.getAudioTracks().map((t) => t.id),
            videoTrackIds: peerStream.getVideoTracks().map((t) => t.id)
          }
        });
        if (!remoteStreamsFlushScheduledRef.current) {
          remoteStreamsFlushScheduledRef.current = true;
          queueMicrotask(() => {
            voiceDebug.log("Flushing remote streams to state", { peerIds: Object.keys(remoteStreamsRef.current) });
            setRemoteStreams((prev) => ({ ...prev, ...remoteStreamsRef.current }));
            remoteStreamsFlushScheduledRef.current = false;
          });
        }
      } catch (err) {
        voiceDebug.error("ontrack error:", err);
      }
    };

    preferOpusForAudio(pc);
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
    voiceDebug.log("handleIncomingVoiceSignal", { roomId, fromUserId, signalType, currentRoom: joinedVoiceChannelIdRef.current });
    if (roomId !== joinedVoiceChannelIdRef.current) {
      voiceDebug.warn("Signal for wrong room, ignoring", { signalRoom: roomId, currentRoom: joinedVoiceChannelIdRef.current });
      return;
    }
    const pc = await createPeerConnection(fromUserId);
    voiceDebug.log("Peer connection obtained for signal", { fromUserId, signalingState: pc.signalingState, connectionState: pc.connectionState });

    if (signalType === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      preferOpusForAudio(pc);
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
      const sortedIds = voiceParticipants.map((p) => Number(p.id)).sort((a, b) => a - b);
      const effectiveHost = voiceHostUserId != null ? voiceHostUserId : (sortedIds[0] ?? myId);
      const iAmHost = Number(myId) === Number(effectiveHost);
      voiceDebug.log("Sending offers to peers", { myId, effectiveHost, iAmHost, participants: voiceParticipants.map(p => p.id), participantCount: voiceParticipants.length });
      for (const p of voiceParticipants) {
        const peerId = Number(p.id);
        if (peerId === myId) {
          voiceDebug.log("Skipping self", { peerId, myId });
          continue;
        }
        if (!iAmHost) {
          voiceDebug.log("Skipping (not host; host is first to join)", { peerId, myId, effectiveHost });
          continue;
        }
        if (voiceOfferSentToRef.current.has(peerId)) {
          voiceDebug.log("Offer already sent", { peerId });
          continue;
        }
        voiceDebug.log("Sending offer to peer", { peerId });
        voiceOfferSentToRef.current.add(peerId);
        try {
          const pc = await createPeerConnection(peerId);
          voiceDebug.log("Creating offer", { peerId, signalingState: pc.signalingState });
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          voiceDebug.log("Offer created and set as local description", { peerId });
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
            voiceDebug.log("Offer sent via WebSocket", { peerId });
          } else {
            voiceDebug.warn("Cannot send offer, socket not ready", { peerId, readyState: s?.readyState });
          }
        } catch (err) {
          voiceDebug.error("Voice offer failed:", err, { peerId });
          voiceOfferSentToRef.current.delete(peerId);
        }
      }
    };
    run();
  }, [joinedVoiceChannelId, voiceParticipants, currentUser?.id, voiceHostUserId]);

  const handleSaveProfile = async (payload) => {
    if (!isAuthenticated) return;
    const userId = currentUser?.id ?? CURRENT_USER_ID;
    await handleSaveProfileForUser(userId, payload);
  };

  const handleSaveProfileForUser = async (userId, payload) => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch(`${apiBase}/api/profile/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: payload.displayName,
          bio: payload.bio,
          achievements: payload.achievements,
          avatarUrl: payload.avatarUrl,
          bannerUrl: payload.bannerUrl,
          leagueUsername: payload.leagueUsername,
          theme,
          ...(payload.activityLoggingEnabled !== undefined && { activityLoggingEnabled: payload.activityLoggingEnabled })
        })
      });
      if (!res.ok) return;
      const updated = await res.json();
      setProfiles((prev) => ({ ...prev, [updated.id]: updated }));
      if (userId === (currentUser?.id ?? CURRENT_USER_ID) && payload.displayName !== currentUser?.displayName) {
        setCurrentUser((prev) => ({ ...prev, displayName: payload.displayName }));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!selectedUserForProfile) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        setSelectedUserForProfile(null);
        setProfileModalAnchor("center");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedUserForProfile]);

  // Fetch profile when opening for a user we don't have (e.g. Diana from chat)
  useEffect(() => {
    const id = selectedUserForProfile?.id;
    if (id == null) return;
    const numId = Number(id);
    if (Number.isNaN(numId) || profiles[numId] != null) return;
    let cancelled = false;
    fetch(`${apiBase}/api/profile/${numId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setProfiles((prev) => ({ ...prev, [data.id]: data }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedUserForProfile?.id, apiBase]);

  const joinVoiceChannel = async (roomId) => {
    voiceDebug.log("===== joinVoiceChannel START =====", { roomId, isAuthenticated, hasSocket: !!socketRef.current });
    if (!isAuthenticated) {
      voiceDebug.warn("Not authenticated, aborting join");
      return;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      voiceDebug.warn("Socket not ready", { hasSocket: !!socket, readyState: socket?.readyState });
      return;
    }
    playConnectSound();
    
    let ctx = voiceAudioContextRef.current;
    voiceDebug.log("Audio context check", { hasExistingCtx: !!ctx, state: ctx?.state });
    if (!ctx || ctx.state === "closed") {
      voiceDebug.log("Creating new audio context");
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      voiceAudioContextRef.current = ctx;
      voiceDebug.log("Audio context created", { state: ctx.state });
    }
    if (ctx.state === "suspended") {
      voiceDebug.log("Resuming suspended audio context");
      try {
        await ctx.resume();
        voiceDebug.log("Audio context resumed", { state: ctx.state });
      } catch (err) {
        voiceDebug.error("Failed to resume audio context:", err);
      }
    } else {
      voiceDebug.log("Audio context already running", { state: ctx.state });
    }
    
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
    
    voiceDebug.log("Requesting local stream");
    await ensureLocalStream();
    const localStream = localStreamRef.current;
    voiceDebug.log("Local stream obtained", { 
      hasStream: !!localStream, 
      audioTracks: localStream?.getAudioTracks()?.length || 0,
      videoTracks: localStream?.getVideoTracks()?.length || 0
    });
    
    const finalCtx = voiceAudioContextRef.current;
    voiceDebug.log("Final audio context check", { state: finalCtx?.state });
    if (finalCtx && finalCtx.state === "suspended") {
      voiceDebug.log("Audio context suspended again, resuming");
      try {
        await finalCtx.resume();
        voiceDebug.log("Audio context resumed again", { state: finalCtx.state });
      } catch (err) {
        voiceDebug.error("Failed to resume audio context after ensureLocalStream:", err);
      }
    }
    
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      voiceDebug.log("Local stream audio tracks", { 
        count: audioTracks.length,
        tracks: audioTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState, muted: t.muted }))
      });
      if (audioTracks.length === 0) {
        voiceDebug.warn("Local stream has no audio tracks");
      } else {
        audioTracks.forEach(track => {
          if (!track.enabled) {
            voiceDebug.log("Enabling disabled audio track", { trackId: track.id });
            track.enabled = true;
          }
        });
      }
      
      if (finalCtx && localStream.getAudioTracks().length > 0) {
        const analysers = voiceAnalysersRef.current;
        const myId = String(currentUser?.id ?? CURRENT_USER_ID);
        if (!analysers[myId]) {
          voiceDebug.log("Manually adding local stream to analyser");
          try {
            if (finalCtx.state === "suspended") {
              await finalCtx.resume();
            }
            const source = finalCtx.createMediaStreamSource(localStream);
            const analyser = finalCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.6;
            source.connect(analyser);
            analysers[myId] = { source, analyser };
            voiceDebug.log("Local stream added to analyser successfully");
          } catch (err) {
            voiceDebug.error("Failed to add local stream to analyser:", err);
          }
        } else {
          voiceDebug.log("Local stream already in analyser");
        }
      }
    } else {
      voiceDebug.warn("No local stream obtained");
    }
    
    voiceDebug.log("Sending voice:join message");
    socket.send(JSON.stringify({ type: "voice:join", roomId, userId: currentUser?.id ?? CURRENT_USER_ID }));
    preloadNotificationSound();
    voiceDebug.log("===== joinVoiceChannel END =====");
  };
  joinVoiceChannelRef.current = joinVoiceChannel;

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
    // Clear local participants cache for the room we just left so the UI
    // (e.g. the "In call" list and voice channel card) doesn't keep showing
    // us as in the call if the server doesn't broadcast an empty participants
    // list when the last user leaves.
    if (roomIdToLeave != null) {
      setVoiceChannelParticipants((prev) => {
        const next = { ...prev };
        delete next[roomIdToLeave];
        return next;
      });
    }
    setVoiceParticipants([]);
    setVoiceHostUserId(null);
    setIsDeafened(false);
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

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (track) track.enabled = !track.enabled;
  };

  const handleKeybindsChange = (next) => {
    setKeybinds(next);
    try {
      localStorage.setItem(KEYBINDS_KEY, JSON.stringify(next));
    } catch (_) {}
  };

  const startScreenShare = async () => {
    voiceDebug.log("startScreenShare: invoked", {
      existingScreenTracks: screenStreamRef.current?.getTracks()?.map((t) => ({
        id: t.id,
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })) || []
    });
    try {
      let stream;
      try {
        const constraints = {
          video: true,
          audio: true,
          systemAudio: "include"
        };
        voiceDebug.log("startScreenShare: calling getDisplayMedia", { constraints });
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        voiceDebug.log("startScreenShare: got stream from getDisplayMedia", {
          videoTrackCount: stream.getVideoTracks().length,
          audioTrackCount: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().map((t) => ({
            id: t.id,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          })),
          audioTracks: stream.getAudioTracks().map((t) => ({
            id: t.id,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          }))
        });
      } catch (audioErr) {
        voiceDebug.warn("startScreenShare: getDisplayMedia with system audio failed", {
          error: audioErr,
          name: audioErr?.name,
          message: audioErr?.message
        });
        // NotReadableError often happens on Windows when system audio capture fails.
        // Try tab/window audio only (systemAudio: "exclude") — e.g. share a Chrome tab with "Share tab audio".
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
            systemAudio: "exclude"
          });
          voiceDebug.log("startScreenShare: got stream with tab/window audio (systemAudio: exclude)", {
            videoTrackCount: stream.getVideoTracks().length,
            audioTrackCount: stream.getAudioTracks().length
          });
        } catch (tabAudioErr) {
          voiceDebug.warn("startScreenShare: tab/window audio also failed, falling back to video-only", {
            error: tabAudioErr,
            name: tabAudioErr?.name,
            message: tabAudioErr?.message
          });
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            voiceDebug.log("startScreenShare: got fallback video-only stream", {
              videoTrackCount: stream.getVideoTracks().length,
              audioTrackCount: stream.getAudioTracks().length
            });
          } catch {
            voiceDebug.error("startScreenShare: fallback getDisplayMedia without audio also failed", { error: audioErr });
            throw audioErr;
          }
        }
      }
      if (!stream?.getVideoTracks()?.length) {
        voiceDebug.warn("startScreenShare: no video tracks in stream, stopping tracks and aborting");
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => {
        voiceDebug.log("startScreenShare: video track onended fired, stopping screen share");
        stopScreenShare();
      };
      setIsSharingScreen(true);
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0] ?? null;
      voiceDebug.log("startScreenShare: prepared tracks for peers", {
        videoTrack: videoTrack ? {
          id: videoTrack.id,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted,
          readyState: videoTrack.readyState
        } : null,
        audioTrack: audioTrack ? {
          id: audioTrack.id,
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          readyState: audioTrack.readyState
        } : null
      });
      const peersToRenegotiate = [];
      for (const [peerUserId, pc] of Object.entries(peerConnectionsRef.current)) {
        voiceDebug.log("startScreenShare: iterating peer for screen share", {
          peerUserId,
          connectionState: pc.connectionState,
          signalingState: pc.signalingState,
          senderKinds: pc.getSenders().map((s) => ({
            trackId: s.track?.id,
            kind: s.track?.kind,
            readyState: s.track?.readyState
          }))
        });
        if (pc.connectionState !== "closed") {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            voiceDebug.log("startScreenShare: replacing existing video sender track with screen video", {
              peerUserId,
              senderTrackId: videoSender.track?.id,
              newTrackId: videoTrack?.id
            });
            videoSender.replaceTrack(videoTrack);
          } else {
            voiceDebug.log("startScreenShare: adding new video track for screen share", {
              peerUserId,
              trackId: videoTrack?.id
            });
            pc.addTrack(videoTrack, stream);
            peersToRenegotiate.push(Number(peerUserId));
          }
          if (audioTrack) {
            const hasScreenAudio = pc.getSenders().some((s) => s.track?.id === audioTrack.id);
            voiceDebug.log("startScreenShare: checking/adding screen audio sender", {
              peerUserId,
              hasScreenAudio,
              audioTrackId: audioTrack.id
            });
            if (!hasScreenAudio) {
              pc.addTrack(audioTrack, stream);
              peersToRenegotiate.push(Number(peerUserId));
            }
          } else {
            voiceDebug.log("startScreenShare: no audio track present on screen stream", { peerUserId });
          }
        }
      }
      voiceDebug.log("startScreenShare: renegotiating with peers", { peersToRenegotiate });
      for (const peerId of peersToRenegotiate) await sendOfferToPeer(peerId);
      voiceDebug.log("startScreenShare: completed");
    } catch (err) {
      voiceDebug.error("startScreenShare: failed", { error: err });
      console.warn("Screen share failed:", err);
    }
  };

  const stopScreenShare = () => {
    const stream = screenStreamRef.current;
    const screenAudioTrack = stream?.getAudioTracks()[0] ?? null;
    voiceDebug.log("stopScreenShare: invoked", {
      hasStream: !!stream,
      videoTrackCount: stream?.getVideoTracks().length || 0,
      audioTrackCount: stream?.getAudioTracks().length || 0,
      screenAudioTrack: screenAudioTrack ? {
        id: screenAudioTrack.id,
        enabled: screenAudioTrack.enabled,
        muted: screenAudioTrack.muted,
        readyState: screenAudioTrack.readyState
      } : null
    });
    if (stream) {
      for (const pc of Object.values(peerConnectionsRef.current)) {
        if (pc.connectionState !== "closed" && screenAudioTrack) {
          const audioSender = pc.getSenders().find((s) => s.track?.id === screenAudioTrack.id);
          voiceDebug.log("stopScreenShare: cleaning up screen audio sender", {
            connectionState: pc.connectionState,
            foundAudioSender: !!audioSender,
            audioTrackId: screenAudioTrack.id
          });
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
    voiceDebug.log("stopScreenShare: restoring camera video (if any)", {
      cameraTrack: cameraTrack ? {
        id: cameraTrack.id,
        enabled: cameraTrack.enabled,
        muted: cameraTrack.muted,
        readyState: cameraTrack.readyState
      } : null,
      peerIds
    });
    for (const pc of Object.values(peerConnectionsRef.current)) {
      if (pc.connectionState !== "closed") {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      }
    }
    for (const peerId of peerIds) sendOfferToPeer(peerId);
    voiceDebug.log("stopScreenShare: completed");
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
      <div
        className="app-open-animation flex h-screen w-screen flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          height: "100dvh",
          maxHeight: "100vh"
        }}
        onClickCapture={(e) => {
          const target = e.target;
          if (!target || typeof target.closest !== "function") return;
          if (target.closest("[data-mention]")) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          const anchor = target.closest("a[href]");
          if (!anchor) return;
          const href = (anchor.getAttribute("href") || "").trim();
          if (!href) return;
          const isHttp = href.startsWith("http://") || href.startsWith("https://");
          const isHash = href.startsWith("#");
          const isMailto = href.startsWith("mailto:");
          const isTel = href.startsWith("tel:");
          if (!isHttp && !isHash && !isMailto && !isTel) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
      <header className="relative z-50 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 sm:px-4 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur min-w-0 shrink-0 h-12 min-h-12 md:h-auto md:min-h-0" data-tauri-drag-region>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="md:hidden inline-flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-700"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-semibold truncate">Meeps</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" data-tauri-drag-region="false">
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
            <button
              type="button"
              onClick={() => setActiveTab("games")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "games"
                  ? "bg-white text-indigo-600 shadow dark:bg-gray-700 dark:text-indigo-300"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Games
            </button>
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setUsersPanelOpen((o) => !o)}
              className={`inline-flex h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg border transition-colors ${
                usersPanelOpen
                  ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:active:bg-gray-700"
              }`}
              aria-label={usersPanelOpen ? "Close users list" : "Open users list"}
              aria-expanded={usersPanelOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <div className="relative" ref={topMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTopMenuOpen((o) => !o);
              }}
              className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:active:bg-gray-700"
              aria-label="Menu"
              aria-expanded={topMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {topMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-0.5 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    toggleTheme();
                    setTopMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {theme === "dark" ? (
                    <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setTopMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Settings</span>
                </button>
                <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleLogout();
                    setTopMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            )}
            </div>
            {isTauri && (
              <>
                <button
                  type="button"
                  onClick={handleTauriMinimize}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  aria-label="Minimize"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleTauriClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile sidebar backdrop */}
      <div
        role="presentation"
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ top: "calc(48px + env(safe-area-inset-top))" }}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      {/* Mobile users panel backdrop */}
      <div
        role="presentation"
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${usersPanelOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ top: "calc(48px + env(safe-area-inset-top))" }}
        onClick={() => setUsersPanelOpen(false)}
        aria-hidden="true"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-row">
        {/* On mobile this wrapper takes 0 flex space so main content fills the screen; sidebar overlays via fixed */}
        <div
          className="flex-shrink-0 md:min-w-0 w-0 min-w-0 max-w-0 overflow-visible md:w-auto md:min-w-0 md:max-w-none"
          aria-hidden={!sidebarOpen && !isDesktop}
        >
          <aside
            className={`flex min-h-0 flex-col border-r border-gray-200 bg-white/95 p-3 dark:border-gray-800 dark:bg-gray-900/95 relative
              fixed left-0 z-40 w-72 max-w-[20rem] top-[calc(3rem+env(safe-area-inset-top))] h-[calc(100vh-3rem-env(safe-area-inset-top))] transform transition-transform duration-200 ease-out
              md:relative md:top-0 md:h-full md:min-h-0 md:flex-shrink-0 md:transform-none
              pt-2 md:pt-3
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
            style={{
              ...(isDesktop
                ? {
                    width: sidebarWidthPx,
                    minWidth: SIDEBAR_MIN_PX,
                    maxWidth: SIDEBAR_MAX_PX,
                    fontSize: `clamp(0.8125rem, 0.75rem + (${sidebarWidthPx - SIDEBAR_MIN_PX} / ${SIDEBAR_MAX_PX - SIDEBAR_MIN_PX}) * 0.125rem, 0.9375rem)`
                  }
                : { paddingLeft: "max(0.75rem, env(safe-area-inset-left))" })
            }}
          >
          <div className="flex flex-shrink-0 justify-end md:hidden absolute right-3 top-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 -m-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pr-1 mt-0 md:mt-0">
            <section>
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Text Channels
              </h2>
              <TextChannels
                channels={TEXT_CHANNELS}
                selectedChannelId={selectedChannelId}
                unreadChannelIds={unreadChannelIds}
                onSelectChannel={(id) => {
                  setSelectedChannelId(id);
                  setUnreadChannelIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                  if (activeTab === "board" || activeTab === "games") setActiveTab("chat");
                  setSidebarOpen(false);
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
                  if (activeTab === "board" || activeTab === "games") setActiveTab("chat");
                  setVoiceChannelModalRoomId(roomId);
                  setSidebarOpen(false);
                }}
                onJoinChannel={joinVoiceChannel}
                onLeaveChannel={leaveVoiceChannel}
              />
              <div className="mt-2">
                <h3 className="mb-1.5 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  In call
                </h3>
                <div className="flex flex-col gap-0.5">
                  {(() => {
                    const voiceChannelId = VOICE_CHANNELS[0]?.id;
                    const myId = currentUser?.id ?? CURRENT_USER_ID;
                    let inCallList;
                    if (joinedVoiceChannelId) {
                      inCallList = effectiveInCallParticipants;
                    } else {
                      inCallList = voiceChannelParticipants[voiceChannelId] || [];
                    }
                    const showMuteSpeaking = !!joinedVoiceChannelId;
                    return inCallList.map((p) => {
                      const profile = profiles[p.id];
                      const avatarUrl = profile?.avatarUrl || null;
                      const bannerUrl = profile?.bannerUrl || null;
                      const name = p.displayName || profile?.displayName || `User ${p.id}`;
                      const initials = (name || "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "?";
                      const isSpeaking = showMuteSpeaking && speakingUserIds.includes(String(p.id));
                      const isMuted = showMuteSpeaking && participantMuted[String(p.id)] === true;
                      return (
                        <div
                          key={p.id}
                          className="group/call relative overflow-hidden rounded-lg"
                        >
                          {bannerUrl && (
                            <div className="pointer-events-none absolute inset-0">
                              <img
                                src={bannerUrl}
                                alt=""
                                className="h-full w-full object-cover opacity-70 transition-transform duration-300 ease-out group-hover/call:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
                            </div>
                          )}
                          <div
                            className={`relative flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                              bannerUrl
                                ? "text-white hover:bg-white/5"
                                : isSpeaking
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-gray-700 dark:text-gray-300"
                                  : ""
                            }`}
                          >
                            <div
                              className={`relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-medium ring-2 ${
                                isSpeaking ? "ring-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 voice-speaking-glow" : "ring-gray-200 dark:ring-gray-600 bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white"
                              }`}
                            >
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">{initials}</span>
                              )}
                              {isSpeaking && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500 dark:border-gray-900" title="Speaking" />
                              )}
                            </div>
                            <span
                              className={`min-w-0 flex-1 truncate text-sm ${bannerUrl ? "text-white" : "text-gray-700 dark:text-gray-300"}`}
                              title={name}
                            >
                              {name}
                            </span>
                            {showMuteSpeaking && isMuted && (
                              <span className="flex-shrink-0 text-red-400 dark:text-red-300" title="Muted">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                              </span>
                            )}
                            {showMuteSpeaking && String(p.id) === String(myId) && isDeafened && (
                              <span className="flex-shrink-0 text-red-400 dark:text-red-300" title="Deafened">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V4a8 8 0 00-8 8h2c0-3.314 2.686-6 6-6s6 2.686 6 6h2a8 8 0 00-8-8v.001a8 8 0 00-8 8v8a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H8a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V12z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </section>
          </div>

          {!joinedVoiceChannelId && (
            <div className="mt-auto flex flex-shrink-0 flex-col border-t border-gray-200 dark:border-gray-700 pt-3">
              <UserProfile
                profile={currentUserProfile}
                onSave={handleSaveProfile}
                activity={presenceUsers?.find((u) => String(u.id) === String(currentUser?.id ?? CURRENT_USER_ID))?.activity}
              />
            </div>
          )}
          {isDesktop && (
            <div
              role="separator"
              aria-label="Resize sidebar"
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize shrink-0 hover:bg-indigo-300/50 dark:hover:bg-indigo-500/30 active:bg-indigo-400/50 md:block"
              style={{ touchAction: "none" }}
              onMouseDown={(e) => {
                e.preventDefault();
                const r = resizeStateRef.current;
                r.active = "sidebar";
                r.startX = e.clientX;
                r.startWidth = sidebarWidthPx;
                r.lastSidebarPx = sidebarWidthPx;
                r.lastUsersPx = usersPanelWidthPx;
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />
          )}
          </aside>
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50/60 dark:bg-gray-950/70 overflow-hidden w-full min-w-0">
          {activeTab === "board" ? (
            <Board currentUser={currentUser} apiBase={apiBase} />
          ) : activeTab === "games" ? (
            <Games
              dianaApiBase={dianaApiBase}
              apiBase={apiBase}
              token={localStorage.getItem("meeps_token")}
              currentUser={currentUser}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className={`flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-3 py-0.5 sm:px-4 sm:py-3 dark:border-gray-800 min-w-0 -mt-1 sm:mt-0 ${
                sidebarOpen && !isDesktop ? "hidden" : ""
              }`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl font-semibold truncate">
                      # {selectedChannelId}
                    </span>

                  </div>

                </div>
              </div>

              <MessageList
                messages={channelMessages}
                channelId={selectedChannelId}
                currentUserName={currentUser.displayName || DEFAULT_USER_NAME}
                currentUserId={currentUser?.id}
                profiles={profiles}
                senderNameToAvatar={senderNameToAvatar}
                mentionSlugToName={mentionSlugToName}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onLoadOlder={loadOlderMessages}
                hasMoreOlder={hasMoreOlderMessages}
                loadingOlder={loadingOlderMessages}
                onSenderClick={(user) => {
                  setProfileModalAnchor("center");
                  setSelectedUserForProfile({ id: user.id, displayName: user.displayName || user.name });
                }}
              />

              <div
                className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 min-w-0"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <MessageInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  onGifClick={() => setIsGifModalOpen(true)}
                  placeholder={`Message #${selectedChannelId} (Markdown supported, @ to mention)…`}
                  presenceUsers={presenceUsers}
                  currentUser={currentUser}
                  profiles={profiles}
                />
              </div>
            </div>
          )}
        </main>

        {/* hidden audio elements for remote peers – must always be mounted while in a call */}
        <div className="sr-only">
          {Object.entries(remoteStreams).map(([userId, stream]) => (
            <audio
              key={userId}
              autoPlay
              playsInline
              ref={(el) => {
                if (el && stream && typeof stream.getTracks === "function") {
                  voiceDebug.log("Setting up audio element", {
                    userId,
                    hasStream: !!stream,
                    audioTracks: stream.getAudioTracks().length,
                    videoTracks: stream.getVideoTracks().length,
                    audioTrackIds: stream.getAudioTracks().map((t) => t.id),
                    videoTrackIds: stream.getVideoTracks().map((t) => t.id)
                  });
                  el.srcObject = stream;
                  el.volume = isDeafened ? 0 : voiceSettings.volume;
                  voiceDebug.log("Audio element configured", {
                    userId,
                    volume: el.volume,
                    paused: el.paused,
                    deafened: isDeafened
                  });
                  if (el.paused) {
                    voiceDebug.log("Audio element paused, attempting to play", { userId });
                    tryPlayRemoteAudio(el);
                  } else {
                    voiceDebug.log("Audio element already playing", { userId });
                  }
                }
              }}
              onCanPlay={(e) => tryPlayRemoteAudio(e.currentTarget)}
            />
          ))}
        </div>

        {usersPanelOpen && (
          <aside
            className="flex min-h-0 flex-col border-l border-gray-200 bg-white/95 p-2 dark:border-gray-800 dark:bg-gray-900/95 relative
              fixed right-0 top-[calc(3rem+env(safe-area-inset-top))] bottom-0 z-40 w-64 max-w-[85vw] shadow-lg
              md:relative md:top-0 md:bottom-auto md:z-auto md:shadow-none md:flex-shrink-0 md:w-40 md:min-w-[8rem] md:max-w-[10rem]"
            style={isDesktop ? {
              width: usersPanelWidthPx,
              minWidth: USERS_PANEL_MIN_PX,
              maxWidth: USERS_PANEL_MAX_PX,
              fontSize: `clamp(0.8125rem, 0.75rem + (${usersPanelWidthPx - USERS_PANEL_MIN_PX} / ${USERS_PANEL_MAX_PX - USERS_PANEL_MIN_PX}) * 0.125rem, 0.9375rem)`
            } : {
              paddingRight: "max(0.5rem, env(safe-area-inset-right))"
            }}
          >
            {isDesktop && (
              <div
                role="separator"
                aria-label="Resize users panel"
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize shrink-0 hover:bg-indigo-300/50 dark:hover:bg-indigo-500/30 active:bg-indigo-400/50 z-10"
                style={{ touchAction: "none" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const r = resizeStateRef.current;
                  r.active = "users";
                  r.startX = e.clientX;
                  r.startWidth = usersPanelWidthPx;
                  r.lastUsersPx = usersPanelWidthPx;
                  r.lastSidebarPx = sidebarWidthPx;
                  document.body.style.cursor = "col-resize";
                  document.body.style.userSelect = "none";
                }}
              />
            )}
            <section className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="mb-1 flex items-center justify-between gap-1">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">
                  Users
                </h2>
                <button
                  type="button"
                  onClick={() => setUsersPanelOpen(false)}
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label="Close users list"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden pr-0.5">
                <UserList
                  users={usersInDb}
                  profiles={profiles}
                  onUserClick={(user) => {
                    setProfileModalAnchor("center");
                    setSelectedUserForProfile(user);
                  }}
                />
              </div>
            </section>
          </aside>
        )}
      </div>

      {/* Voice control bar when in a call - bottom left, flexes with sidebar width */}
      {joinedVoiceChannelId && (
        <div
          className="fixed bottom-6 z-50 flex justify-center transition-[width] duration-150 ease-out"
          style={{
            left: 0,
            width: sidebarWidthPx,
            minWidth: isDesktop ? SIDEBAR_MIN_PX : undefined,
            maxWidth: isDesktop ? SIDEBAR_MAX_PX : undefined,
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
            paddingRight: "max(0.5rem, env(safe-area-inset-right))"
          }}
        >
          <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
          <button
            type="button"
            onClick={toggleMute}
            className={`rounded-xl p-3 transition-colors ${
              participantMuted[currentUser?.id ?? CURRENT_USER_ID]
                ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={participantMuted[currentUser?.id ?? CURRENT_USER_ID] ? "Unmute" : "Mute"}
          >
            {participantMuted[currentUser?.id ?? CURRENT_USER_ID] ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsDeafened((d) => !d)}
            className={`rounded-xl p-3 transition-colors ${
              isDeafened
                ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={isDeafened ? "Undeafen" : "Deafen"}
          >
            {isDeafened ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V4a8 8 0 00-8 8h2c0-3.314 2.686-6 6-6s6 2.686 6 6h2a8 8 0 00-8-8v.001a8 8 0 00-8 8v8a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H8a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V12z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V4a8 8 0 00-8 8h2c0-3.314 2.686-6 6-6s6 2.686 6 6h2a8 8 0 00-8-8v.001a8 8 0 00-8 8v8a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H8a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V12z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              leaveVoiceChannel();
              setVoiceChannelModalRoomId(null);
            }}
            className="rounded-xl bg-red-100 p-3 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
            aria-label="Leave call"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 3l-2 2m0 0l-2 2m2-2l2-2m-2 2l-2-2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              setProfileModalAnchor("bottom-left");
              setSelectedUserForProfile(currentUser ? { id: currentUser.id ?? CURRENT_USER_ID, displayName: currentUser.displayName } : { id: CURRENT_USER_ID, displayName: "Meeps User" });
            }}
            className="rounded-xl p-3 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Profile"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-xl p-3 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Settings"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          </div>
        </div>
      )}

      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelectGif={handleSelectGif}
        apiBase={apiBase}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenVoiceSettings={() => {
          setIsSettingsOpen(false);
          setIsVoiceSettingsOpen(true);
        }}
        keybinds={keybinds}
        onKeybindsChange={handleKeybindsChange}
        isTauri={isTauri}
        activityLoggingEnabled={currentUserProfile ? (currentUserProfile.activityLoggingEnabled !== false) : undefined}
        onActivityLoggingChange={async (enabled) => {
          const userId = currentUser?.id ?? CURRENT_USER_ID;
          await handleSaveProfileForUser(userId, { activityLoggingEnabled: enabled });
        }}
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
        participants={voiceChannelModalRoomId ? (joinedVoiceChannelId === voiceChannelModalRoomId ? effectiveInCallParticipants : (voiceChannelParticipants[voiceChannelModalRoomId] || [])) : []}
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
        onJoin={() => {
          if (voiceChannelModalRoomId) joinVoiceChannel(voiceChannelModalRoomId);
        }}
        onLeave={leaveVoiceChannel}
      />
      {selectedUserForProfile != null && (() => {
        const profileUserId = selectedUserForProfile?.id;
        const numId = Number(profileUserId);
        const isSelf = profileUserId != null && String(profileUserId) === String(currentUser?.id ?? CURRENT_USER_ID);
        const profileForSelected = Number.isNaN(numId) ? null : profiles[numId];
        const isBot = profileForSelected?.userType === "bot";
        const editable = isSelf || isBot;
        const closeProfile = () => {
          setSelectedUserForProfile(null);
          setProfileModalAnchor("center");
        };
        const profile = isSelf ? (profiles[currentUser?.id ?? CURRENT_USER_ID] || null) : profileForSelected;

        const isBottomLeft = profileModalAnchor === "bottom-left";
        const wrapperClass = isBottomLeft
          ? "fixed inset-0 z-50 flex items-end justify-start bg-black/50 p-4 pb-24 pl-6"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";
        return (
          <div className={wrapperClass} onClick={closeProfile}>
            <div
              className="w-full max-w-sm rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end pr-2 pt-2">
                <button
                  type="button"
                  onClick={closeProfile}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <UserProfile
                profile={profile}
                onSave={editable ? async (payload) => {
                  const targetId = isSelf ? (currentUser?.id ?? CURRENT_USER_ID) : numId;
                  await handleSaveProfileForUser(targetId, payload);
                  closeProfile();
                } : undefined}
                activity={presenceUsers?.find((u) => String(u.id) === String(profileUserId))?.activity}
                editable={editable}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
  }
  return (
    <>
      {content}
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </>
  );
}

export default App;
