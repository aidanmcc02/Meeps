const ws = require("ws");
const socket = new ws("wss://meeps-production.up.railway.app/ws");
socket.on("open", () => console.log("WebSocket connected"));
socket.on("error", (err) => console.log("WebSocket error:", err.message));
socket.on("close", () => console.log("WebSocket closed"));
setTimeout(() => socket.close(), 5000);
