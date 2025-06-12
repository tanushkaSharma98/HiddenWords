import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../context/SocketContext';

// import PuzzleCard from '@/components/PuzzleCard';

// const defaultAvatars = [
//   'https://randomuser.me/api/portraits/women/44.jpg',
//   'https://randomuser.me/api/portraits/men/32.jpg',
// ];

export default function Match() {
  const router = useRouter();
  const { matchId, playerId } = router.query;
  const socket = useSocket();

  // Dynamic state
  const [timer, setTimer] = useState(10);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [guesses, setGuesses] = useState<{ player1: string[]; player2: string[] }>({ player1: [], player2: [] });
  const [word, setWord] = useState('');
  const [revealedTiles, setRevealedTiles] = useState<boolean[]>([]);
  const [players, setPlayers] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [guessInput, setGuessInput] = useState('');

  // WebSocket event handlers
  useEffect(() => {
    if (!matchId || !playerId || !socket) return;
    
    console.log('Joining match room with:', { matchId, playerId });
    
    // Join the match room
    socket.emit('joinMatch', { matchId, playerId });

    // Listen for game state updates
    socket.on('tickStart', (data) => {
      console.log('Tick start:', data);
      setTimer(Math.floor(data.timeRemaining / 1000));
    });
    socket.on('revealTile', ({ index }) => {
      console.log('Tile revealed:', index);
      setRevealedTiles((prev) => {
        const updated = [...prev];
        updated[index] = true;
        return updated;
      });
    });
    socket.on('gameState', (data) => {
      console.log('Game state:', data);
      setWord(data.word);
      setRevealedTiles(data.revealedTiles);
      setScore(data.scores);
      setRound(data.roundNumber);
      setMaxRounds(data.maxRounds || 5);
      setPlayers(data.players || []);
      setGuesses(data.guesses || { player1: [], player2: [] });
    });
    socket.on('guessUpdate', (data) => {
      console.log('Guess update:', data);
      setGuesses(data);
    });
    socket.on('roundEnd', (data) => {
      console.log('Round end:', data);
      setScore(data.scores);
      setRound((prev) => prev + 1);
      setTimer(10);
    });
    socket.on('gameEnd', (data) => {
      console.log('Game end:', data);
      // Optionally show winner, etc.
    });

    return () => {
      socket.off('tickStart');
      socket.off('revealTile');
      socket.off('gameState');
      socket.off('guessUpdate');
      socket.off('roundEnd');
      socket.off('gameEnd');
    };
  }, [matchId, playerId, socket]);

  // Timer countdown (client-side fallback)
  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  // Helper to render word tiles
  const renderTiles = () => {
    if (!word) return null;
    return (
      <div className="flex justify-center gap-2 mt-4">
        {word.split('').map((char, idx) => (
          <div
            key={idx}
            className="w-14 h-14 flex items-center justify-center text-3xl font-bold border-2 border-[#2D2A32] rounded-lg bg-[#F8F8F8]"
          >
            {revealedTiles[idx] ? char : '_'}
          </div>
        ))}
      </div>
    );
  };

  // Helper to determine if current player is player1 or player2
  const isPlayer1 = players.length > 0 && players[0].id === playerId;
  const isPlayer2 = players.length > 1 && players[1].id === playerId;

  const handleGuessSubmit = () => {
    if (!socket || guessInput.trim() === '') return;
    socket.emit('guess', { matchId, playerId, guess: guessInput.trim() });
    setGuessInput('');
  };

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
      <main className="flex-1 flex flex-row items-stretch justify-center px-4 py-8 gap-8">
        {/* Left: Score and Player 1 Guesses */}
        <div className="flex flex-col justify-between w-56">
          <div>
            <div className="text-xl font-bold text-[#FF4B4B] mb-2">Score:</div>
            <div className="mb-2 flex items-center gap-2">
              {/* <img src={defaultAvatars[0]} alt="Player 1" className="w-8 h-8 rounded-full border-2 border-[#FFD166]" /> */}
              <span className="font-semibold text-[#8B5CF6]">Player 1:</span>
              <span className="font-bold text-[#FF4B4B]">{score.player1}</span>
            </div>
            <div className="mb-4 flex items-center gap-2">
              {/* <img src={defaultAvatars[1]} alt="Player 2" className="w-8 h-8 rounded-full border-2 border-[#FFD166]" /> */}
              <span className="font-semibold text-[#8B5CF6]">Player 2:</span>
              <span className="font-bold text-[#FF4B4B]">{score.player2}</span>
            </div>
          </div>



          {/* <div className="min-h-screen bg-gradient-to-br from-green-200 to-lime-100 flex items-center justify-center">
      <PuzzleCard />
    </div> */}



          <div>
            <div className="text-lg font-bold text-[#FF4B4B] mb-2">Player 1 guesses:</div>
            {guesses.player1.length === 0 ? (
              <div className="text-[#8B5CF6]">No guesses yet</div>
            ) : (
              guesses.player1.map((g, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-2 mb-1 text-[#2D2A32]">{g}</div>
              ))
            )}
            {/* Guess input for Player 1 */}
            {isPlayer1 && (
              <div className="mt-4 flex items-center justify-start">
                <label className="font-bold text-xs text-black mr-2">GUESS:</label>
                <div className="relative w-40">
                  <input
                    type="text"
                    value={guessInput}
                    onChange={e => setGuessInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGuessSubmit()}
                    placeholder="Type your guess..."
                    className="w-full px-3 py-2 rounded-lg border-none outline-none bg-white text-black font-semibold text-sm shadow focus:ring-2 focus:ring-blue-400"
                    style={{ caretColor: '#2563eb' }}
                  />
                  {/* Blinking cursor effect is handled by the input caret */}
                </div>
                <button
                  onClick={handleGuessSubmit}
                  className="ml-2 px-3 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Center: Word Boxes */}
        <div className="flex flex-col items-center justify-center flex-1">
          {renderTiles()}
        </div>
        {/* Right: Timer, Round, Player 2 Guesses */}
        <div className="flex flex-col justify-between w-56 items-end">
          <div>
            <div className="text-xl font-bold text-[#FF4B4B] mb-2">Time:</div>
            <div className="text-3xl font-extrabold text-[#2D2A32] mb-4">{timer}s</div>
            <div className="text-lg font-bold text-[#FF4B4B] mb-2">Round:</div>
            <div className="text-xl font-semibold text-[#8B5CF6] mb-4">{`0${round}/${maxRounds}`}</div>
          </div>
          <div className="w-full">
            <div className="text-lg font-bold text-[#FF4B4B] mb-2 text-right">Player 2 guesses:</div>
            {guesses.player2.length === 0 ? (
              <div className="text-[#8B5CF6] text-right">No guesses yet</div>
            ) : (
              guesses.player2.map((g, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-2 mb-1 text-[#2D2A32] text-right">{g}</div>
              ))
            )}
            {/* Guess input for Player 2 */}
            {isPlayer2 && (
              <div className="mt-4 flex items-center justify-end">
                <label className="font-bold text-xs text-black mr-2">GUESS:</label>
                <div className="relative w-40">
                  <input
                    type="text"
                    value={guessInput}
                    onChange={e => setGuessInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGuessSubmit()}
                    placeholder="Type your guess..."
                    className="w-full px-3 py-2 rounded-lg border-none outline-none bg-white text-black font-semibold text-sm shadow focus:ring-2 focus:ring-blue-400"
                    style={{ caretColor: '#2563eb' }}
                  />
                </div>
                <button
                  onClick={handleGuessSubmit}
                  className="ml-2 px-3 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

