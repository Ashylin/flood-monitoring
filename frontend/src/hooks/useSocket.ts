import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export type ConnectionState = "live" | "reconnecting" | "offline";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("offline");

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnectionState("live"));
    socket.on("disconnect", () => setConnectionState("reconnecting"));
    socket.on("connect_error", () => setConnectionState("reconnecting"));

    // Reconnection lifecycle events live on the Manager (socket.io), not the
    // socket itself — this is the only way to distinguish "still retrying"
    // from "gave up", which a plain connected/disconnected boolean can't.
    const manager = socket.io;
    const onReconnectAttempt = () => setConnectionState("reconnecting");
    const onReconnectFailed = () => setConnectionState("offline");
    manager.on("reconnect_attempt", onReconnectAttempt);
    manager.on("reconnect_failed", onReconnectFailed);

    return () => {
      manager.off("reconnect_attempt", onReconnectAttempt);
      manager.off("reconnect_failed", onReconnectFailed);
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connectionState, connected: connectionState === "live" };
}
