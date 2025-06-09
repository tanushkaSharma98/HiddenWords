import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import socket from '../lib/socket';

const defaultAvatars = [
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/32.jpg',
];

const Room = () => {
  const router = useRouter();
  const { matchId, playerId } = router.query;
  const [players, setPlayers] = useState([
    { name: 'Player 1', status: 'Waiting for Player 1 to join', avatar: defaultAvatars[0], joined: false },
    { name: 'Player 2', status: 'Waiting for Player 2 to join', avatar: defaultAvatars[1], joined: false },
  ]);
  const [canStart, setCanStart] = useState(false);

  useEffect(() => {
    if (!matchId || !playerId) return;
    socket.emit('joinMatch', { matchId, playerId });

    socket.on('playerJoined', (data) => {
      // You may want to update this logic based on your backend's player info
      setPlayers((prev) => {
        const updated = [...prev];
        if (!updated[0].joined) {
          updated[0] = { ...updated[0], status: 'Joined', joined: true };
        } else if (!updated[1].joined) {
          updated[1] = { ...updated[1], status: 'Joined', joined: true };
        }
        return updated;
      });
    });

    return () => {
      socket.off('playerJoined');
    };
  }, [matchId, playerId]);

  useEffect(() => {
    setCanStart(players.every((p) => p.joined));
  }, [players]);

  const handleStartMatch = () => {
    // You may want to emit a socket event to start the match
    // socket.emit('startMatch', { matchId });
    // For now, just redirect or show a message
    // router.push(`/game?matchId=${matchId}&playerId=${playerId}`);
  };

  return (
    <div className="min-h-screen bg-[#FFE6E6] relative overflow-hidden">
      {/* Top wave shape */}
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-[#FF9E9E] rounded-b-[100px]"></div>
      {/* Bottom wave shape */}
      <div className="absolute bottom-0 left-0 w-full h-[40vh] bg-[#FF9E9E] rounded-t-[100px]"></div>
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-3xl mx-auto mt-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#FF4B4B] text-center mb-4">Ready to Play?</h1>
          <p className="text-lg md:text-xl text-[#8B5CF6] text-center mb-8">Two players are needed to start a match. Once both players are ready, the 'Start Match' button will activate.</p>
          <div className="flex flex-col md:flex-row justify-center items-center gap-12 mb-10">
            {/* Player 1 */}
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-[#FF4B4B] mb-2">Player 1</span>
              <img src={players[0].avatar} alt="Player 1" className="w-16 h-16 rounded-full border-4 border-[#FFD166] mb-2" />
              <span className="text-[#8B5CF6] font-semibold">{players[0].joined ? 'Player 1 joined' : players[0].status}</span>
            </div>
            {/* Player 2 */}
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-[#FF4B4B] mb-2">Player 2</span>
              <img src={players[1].avatar} alt="Player 2" className="w-16 h-16 rounded-full border-4 border-[#FFD166] mb-2" />
              <span className="text-[#8B5CF6] font-semibold">{players[1].joined ? 'Player 2 joined' : players[1].status}</span>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              className={`px-8 py-3 text-lg font-bold rounded-full border-4 border-[#FFD166] shadow-lg transition-all duration-300 ${canStart ? 'bg-[#FF4B4B] text-white hover:bg-[#FF9E9E] cursor-pointer' : 'bg-[#FFE4A3] text-[#FF4B4B] cursor-not-allowed'}`}
              disabled={!canStart}
              onClick={handleStartMatch}
            >
              Start Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
