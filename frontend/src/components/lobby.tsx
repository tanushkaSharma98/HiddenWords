import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../context/SocketContext';

interface LobbyProps {
  onGameStart: (gameId: string) => void;
}

interface Player {
  id: string;
  socketId: string;
}

interface MatchData {
  matchId: string;
  player1: Player;
  player2: Player;
}

export default function Lobby({ onGameStart }: LobbyProps) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'matched'>('idle');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onPlayerId = ({ playerId }: { playerId: string }) => {
      localStorage.setItem('playerId', playerId);
    };
    const onWaitingRoomCreated = (data: MatchData) => {
      localStorage.setItem('matchData', JSON.stringify(data));
      localStorage.setItem('matchId', data.matchId);
      localStorage.setItem('player1Id', data.player1.id);
      localStorage.setItem('player2Id', data.player2.id);
      setStatus('matched');
      router.push(`/room?matchId=${data.matchId}`);
    };
    const onGameStarting = (data: any) => {
      onGameStart(data.matchId);
    };
    const onConnect = () => setError(null);
    const onConnectError = (err: any) => setError('Failed to connect to server');

    socket.on('playerId', onPlayerId);
    socket.on('waitingRoomCreated', onWaitingRoomCreated);
    socket.on('gameStarting', onGameStarting);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('playerId', onPlayerId);
      socket.off('waitingRoomCreated', onWaitingRoomCreated);
      socket.off('gameStarting', onGameStarting);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket, onGameStart, router]);

  const handleJoinLobby = () => {
    if (!socket) {
      setError('Not connected to server');
      return;
    }
    setStatus('waiting');
    socket.emit('joinLobby');
  };

  return (
    <div className="min-h-screen bg-[#FFE6E6] relative overflow-hidden">
      {/* Top wave shape */}
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-[#FF9E9E] rounded-b-[100px]"></div>
      
      {/* Bottom wave shape */}
      <div className="absolute bottom-0 left-0 w-full h-[40vh] bg-[#FF9E9E] rounded-t-[100px]"></div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-8">
          <h1 className="text-7xl font-black text-[#FF4B4B] mb-4 drop-shadow-lg">
            Let's Play A Game
          </h1>
          <p className="text-3xl font-bold text-[#8B5CF6] mb-8">
            Are You Ready?
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {status === 'idle' && (
            <button
              onClick={handleJoinLobby}
              className="relative px-16 py-6 text-3xl font-bold text-[#FF4B4B] bg-[#FFE4A3] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-4 border-[#FFD166]"
            >
              JOIN LOBBY
            </button>
          )}

          {status === 'waiting' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Waiting for opponent...</p>
            </div>
          )}

          {status === 'matched' && (
            <div className="text-center">
              <p className="text-green-600 font-semibold">Game starting!</p>
            </div>
          )}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute right-10 bottom-10">
        <div className="relative w-40 h-40">
          {/* Large circle */}
          <div className="absolute w-32 h-32 bg-[#FFE4A3] rounded-full transform rotate-12 shadow-lg"></div>
          
          {/* Inner circles */}
          <div className="absolute top-4 left-4 w-24 h-24 bg-white rounded-full shadow-inner">
            <div className="absolute top-3 left-6 w-3 h-3 bg-[#FF4B4B] rounded-full"></div>
            <div className="absolute top-8 right-6 w-3 h-3 bg-[#8B5CF6] rounded-full"></div>
            <div className="absolute bottom-4 left-8 w-3 h-3 bg-[#FFD166] rounded-full"></div>
          </div>
        </div>
      </div>

      <p className="absolute top-4 right-6 text-sm text-[#8B5CF6] font-semibold"></p>
    </div>
  );
}