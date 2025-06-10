import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';

const defaultAvatars = [
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/32.jpg',
];
const socket = io('http://localhost:5000', { transports: ['websocket'] }); ////

export default function Room() {
  const router = useRouter();
  const { matchId, playerId } = router.query;
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([]);   ////

  useEffect(() => {   ////
    if (matchId && playerId) {
      socket.emit('joinMatch', { matchId, playerId });
    }
  }, [matchId, playerId]);

  useEffect(() => { /////
    socket.on('playerJoined', ({ playerId }) => {
      setJoinedPlayers((prev) =>
        prev.includes(playerId) ? prev : [...prev, playerId]
      );
    });
    return () => {
      socket.off('playerJoined');
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFE6E6] flex flex-col">
      {/* Header */}
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-[#2D2A32]">
        <div className="text-white font-extrabold text-2xl tracking-wide">Word Duel</div>
        <div className="flex items-center gap-6">
          <a href="#" className="text-white hover:text-[#FFD166] font-semibold">How to Play</a>
          <a href="#" className="text-white hover:text-[#FFD166] font-semibold">About</a>
          <button className="bg-white text-[#2D2A32] font-bold px-5 py-2 rounded-full hover:bg-[#FFD166] transition">Log In</button>
        </div>
      </nav>
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#FF4B4B] text-center mb-2 mt-8">Ready to Play?</h1>
        <p className="text-base md:text-lg text-[#8B5CF6] text-center mb-8 max-w-xl">
          Two players are needed to start a match. Once both players are ready, the 'Start Match' button will activate.
        </p>
        <div className="flex flex-col md:flex-row gap-12 mb-10 w-full max-w-2xl justify-center">
          {/* Player 1 */}
          <div className="flex flex-col items-center w-full">
            <span className="text-lg font-bold text-[#FF4B4B] mb-2">Player 1</span>
            <img src={defaultAvatars[0]} alt="Player 1" className="w-16 h-16 rounded-full border-4 border-[#FFD166] mb-2" />
            <span className="text-[#8B5CF6] font-semibold">Waiting for Player 1 to join</span>
          </div>
          {/* Player 2 */}
          <div className="flex flex-col items-center w-full">
            <span className="text-lg font-bold text-[#FF4B4B] mb-2">Player 2</span>
            <img src={defaultAvatars[1]} alt="Player 2" className="w-16 h-16 rounded-full border-4 border-[#FFD166] mb-2" />
            <span className="text-[#8B5CF6] font-semibold">Waiting for Player 2 to join</span>
          </div>
        </div>
        <div className="flex justify-center">
          <button
            className="px-8 py-3 text-lg font-bold rounded-full border-4 border-[#FFD166] shadow-lg transition-all duration-300 bg-[#FF4B4B] text-white hover:bg-[#FF9E9E] cursor-pointer"
            disabled
          >
            Start Match
          </button>
        </div>
      </main>
    </div>
  );
}
