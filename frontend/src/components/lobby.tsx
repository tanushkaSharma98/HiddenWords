import React, { useEffect, useState } from 'react';
import socket from '../lib/socket';
import { useRouter } from 'next/router';

const Lobby = () => {
  const [playerId] = useState(() => crypto.randomUUID());
  const [joined, setJoined] = useState(false);
  const router = useRouter();

  const handleJoin = () => {
    socket.emit('joinLobby', { playerId });
    setJoined(true);
  };

  useEffect(() => {
    socket.on('waitingForOpponent', () => {
      console.log('Waiting for opponent...');
    });

    socket.on('matchStarted', (data) => {
      console.log('Match Started:', data);
      router.push({
        pathname: '/room',
        query: {
          matchId: data.matchId,
          roundId: data.firstRound.roundId,
          playerId,
        },
      });
    });

    return () => {
      socket.off('waitingForOpponent');
      socket.off('matchStarted');
    };
  }, [playerId]);

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

          {!joined ? (
            <button
              onClick={handleJoin}
              className="relative px-16 py-6 text-3xl font-bold text-[#FF4B4B] bg-[#FFE4A3] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-4 border-[#FFD166]"
            >
              JOIN LOBBY
            </button>
          ) : (
            <div className="flex items-center justify-center space-x-3 text-2xl text-[#8B5CF6] animate-pulse">
              <div className="w-3 h-3 bg-[#8B5CF6] rounded-full"></div>
              <p>Waiting for opponent...</p>
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
};

export default Lobby;
