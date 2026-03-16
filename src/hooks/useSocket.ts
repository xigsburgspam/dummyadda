import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!socketInstance) {
      // Connect to the same host that serves the page
      socketInstance = io(window.location.origin, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
      });
    }
    setSocket(socketInstance);

    return () => {
      // We don't disconnect on unmount to keep connection alive across route changes
    };
  }, []);

  return socket;
};
