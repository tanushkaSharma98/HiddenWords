import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../context/SocketContext';
import PuzzleCard from '../components/PuzzleCard';

// import PuzzleCard from '@/components/PuzzleCard';

// const defaultAvatars = [
//   'https://randomuser.me/api/portraits/women/44.jpg',
//   'https://randomuser.me/api/portraits/men/32.jpg',
// ];

export default function Match() {
  const router = useRouter();
  const { matchId } = router.query;
  // Get playerId from query or localStorage
  const [playerId, setPlayerId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (router.query.playerId) setPlayerId(router.query.playerId as string);
    else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('playerId');
      if (stored) setPlayerId(stored);
    }
  }, [router.query.playerId]);

  const socket = useSocket();

  // Dynamic state
  const [timer, setTimer] = useState(10);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [guesses, setGuesses] = useState<{ player1: string[]; player2: string[] }>({ player1: [], player2: [] });
  const [word, setWord] = useState('');
  const [revealedTiles, setRevealedTiles] = useState<boolean[]>([]);
  const [players, setPlayers] = useState<{ id: string; name?: string; avatar?: string }[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const [winner, setWinner] = useState<string | null>(null);

  // Helper to get opponent ID
  const opponentId = players.find(p => p.id !== playerId)?.id;

  // WebSocket event handlers
  useEffect(() => {
    if (!matchId || !playerId || !socket) return;
    
    console.log('Joining match room with:', { matchId, playerId });
    
    // Join the match room
    socket.emit('joinMatch', { matchId, playerId });

    // Listen for game events
    socket.on('gameStart', (data) => {
      setWord('');
      setRevealedTiles(new Array(data.wordLength).fill(false));
      setRound(data.roundNumber || 1);
      setMaxRounds(data.maxRounds || 5);
      setPlayers(data.players || []);
      setGuesses({ player1: [], player2: [] });
      setScore(data.scores || { player1: 0, player2: 0 });
      setWinner(null);
    });
    socket.on('tickStart', (data) => {
      console.log('Tick start:', data);
      setTimer(Math.floor(data.timeRemaining / 1000));
      setRevealedTiles(data.revealedTiles);
      if (data.players) setPlayers(data.players);
      if (data.scores) setScore(data.scores);
      if (data.roundNumber) setRound(data.roundNumber);
    });
    socket.on('revealTile', (data) => {
      console.log('Tile revealed:', data);
      setRevealedTiles(data.revealedTiles);
      if (data.players) setPlayers(data.players);
      if (data.scores) setScore(data.scores);
      if (data.roundNumber) setRound(data.roundNumber);
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
      setWinner(null);
    });
    socket.on('guessUpdate', (data) => {
      console.log('Guess update:', data);
      if (data.players) setPlayers(data.players);
      if (data.guesses) setGuesses(data.guesses);
    });
    socket.on('roundEnd', (data) => {
      console.log('Round end:', data);
      setScore(data.scores);
      setRound(data.roundNumber || (prev => prev + 1));
      setTimer(10);
      if (data.players) setPlayers(data.players);
      if (data.guesses) setGuesses(data.guesses);
      if (data.winner) setWinner(data.winner);
    });
    socket.on('gameEnd', (data) => {
      console.log('Game end:', data);
      setWinner(data.winner);
      setScore(data.finalScores || score);
      if (data.players) setPlayers(data.players);
      if (data.roundNumber) setRound(data.roundNumber);
    });

    return () => {
      socket.off('gameStart');
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
            {revealedTiles[idx] ? char : ''}
          </div>
        ))}
      </div>
    );
  };

  // Helper to determine if current player is player1 or player2
  const isPlayer1 = players.length > 0 && players[0]?.id === playerId;
  const isPlayer2 = players.length > 1 && players[1]?.id === playerId;

  // Guess submission with timestamp
  const handleGuessSubmit = () => {
    if (!socket || guessInput.trim() === '') return;
    socket.emit('submitGuess', {
      gameId: matchId,
      guess: guessInput.trim(),
      timestamp: Date.now()
    });
    setGuessInput('');
  };

  // Add PuzzleBox component
  const PuzzleBox = () => (
    <div className="flex flex-col items-center justify-center">
      <div className="text-xl font-bold text-[#222] mb-1">Word Guess</div>
      <div className="text-xs text-[#444] mb-4 tracking-wide">FILL IN THE MISSING LETTER</div>
      <div className="flex gap-2">
        {word.split('').map((char, idx) => (
          <div
            key={idx}
            className="w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center text-3xl font-bold border-2 border-gray-300 rounded-md bg-[#f5f3ee] shadow-sm"
          >
            {revealedTiles[idx] ? char : ''}
          </div>
        ))}
      </div>
    </div>
  );

  useEffect(() => {
    console.log('Players array:', players, 'Current playerId:', playerId);
  }, [players, playerId]);

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
      {/* Player IDs */}
      <div className="flex justify-center gap-8 mt-2">
        <div className="text-xs text-gray-700 bg-white rounded px-3 py-1 shadow">Your ID: {playerId}</div>
        {opponentId && <div className="text-xs text-gray-700 bg-white rounded px-3 py-1 shadow">Opponent ID: {opponentId}</div>}
      </div>
      {/* Winner display */}
      {winner && (
        <div className="flex justify-center mt-4">
          <div className="bg-green-200 text-green-800 font-bold px-6 py-2 rounded-lg shadow">
            {winner === playerId ? 'You win!' : winner === 'player1' || winner === 'player2' ? `${winner} wins!` : 'Draw!'}
          </div>
        </div>
      )}
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
            {/* Show input only if current player is Player 1 */}
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
          <PuzzleCard />
        </div>
        {/* Right: Timer, Round, Player 2 Guesses */}
        <div className="flex flex-col justify-between w-56 items-end">
          <div>
            <div className="text-xl font-bold text-[#FF4B4B] mb-2">Time:</div>
            <div className="text-3xl font-extrabold text-[#2D2A32] mb-4">{timer}s</div>
            <div className="text-lg font-bold text-[#FF4B4B] mb-2">Round:</div>
            <div className="text-xl font-semibold text-[#8B5CF6] mb-4">{`${round.toString().padStart(2, '0')}/${maxRounds}`}</div>
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
            {/* Show input only if current player is Player 2 */}
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
