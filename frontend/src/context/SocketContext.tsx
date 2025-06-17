import React, { createContext, useContext, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ReactNode } from 'react';

const SocketContext = createContext<Socket | null>(null);

// Create a single socket instance outside the component
const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  autoConnect: true,
  query: {
    playerId: typeof window !== 'undefined' ? localStorage.getItem('playerId') : undefined,
  },
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  // Use a ref to avoid re-renders
  const socketRef = useRef<Socket>(socket);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
// Optionally export socket for debugging
export { socket };