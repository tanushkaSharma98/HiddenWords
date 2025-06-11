import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';

// import PuzzleCard from '@/components/PuzzleCard';

// const defaultAvatars = [
//   'https://randomuser.me/api/portraits/women/44.jpg',
//   'https://randomuser.me/api/portraits/men/32.jpg',
// ];
const socket = io('http://localhost:5000', { transports: ['websocket'] });

export default function Match() {
  const router = useRouter();
  const { matchId, playerId } = router.query;

  // Dynamic state
  const [timer, setTimer] = useState(10);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [guesses, setGuesses] = useState<{ player1: string[]; player2: string[] }>({ player1: [], player2: [] });
  const [word, setWord] = useState('');
  const [revealedTiles, setRevealedTiles] = useState<boolean[]>([]);
  const [players, setPlayers] = useState<{ id: string; name: string; avatar: string }[]>([]);

  // WebSocket event handlers
  useEffect(() => {
    if (!matchId || !playerId) return;
    // Join the match room
    socket.emit('joinMatch', { matchId, playerId });

    // Listen for game state updates
    socket.on('tickStart', (data) => {
      setTimer(Math.floor(data.timeRemaining / 1000));
    });
    socket.on('revealTile', ({ index }) => {
      setRevealedTiles((prev) => {
        const updated = [...prev];
        updated[index] = true;
        return updated;
      });
    });
    socket.on('gameState', (data) => {
      setWord(data.word);
      setRevealedTiles(data.revealedTiles);
      setScore(data.scores);
      setRound(data.roundNumber);
      setMaxRounds(data.maxRounds || 5);
      setPlayers(data.players || []);
      setGuesses(data.guesses || { player1: [], player2: [] });
    });
    socket.on('guessUpdate', (data) => {
      setGuesses(data);
    });
    socket.on('roundEnd', (data) => {
      setScore(data.scores);
      setRound((prev) => prev + 1);
      setTimer(10);
    });
    socket.on('gameEnd', (data) => {
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
  }, [matchId, playerId]);

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
          </div>
        </div>
      </main>
    </div>
  );
}


// import React, { useEffect, useState } from 'react';
// import { useRouter } from 'next/router';
// import { useSocket } from '../context/SocketContext';

// interface GameState {
//   wordLength: number;
//   revealedTiles: boolean[];
//   scores: {
//     player1: number;
//     player2: number;
//   };
// }

// export default function MatchRoom() {
//   const socket = useSocket();
//   const router = useRouter();
//   const { gameId } = router.query;

//   const [gameState, setGameState] = useState<GameState | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     if (!socket || !gameId) return;

//     const onGameState = (state: GameState) => {
//       console.log('Game state received:', state);
//       setGameState(state);
//     };

//     const onRevealTile = ({ index }: any) => {
//       setGameState(prev => {
//         if (!prev) return prev;
//         const newTiles = [...prev.revealedTiles];
//         newTiles[index] = true;
//         return { ...prev, revealedTiles: newTiles };
//       });
//     };

//     const onRoundEnd = ({ winner, revealedWord, scores }: any) => {
//       alert(`Round Over! Winner: ${winner}. Word was: ${revealedWord}`);
//       setGameState(prev => prev ? { ...prev, scores } : prev);
//     };

//     socket.on('gameState', onGameState);
//     socket.on('revealTile', onRevealTile);
//     socket.on('roundEnd', onRoundEnd);

//     return () => {
//       socket.off('gameState', onGameState);
//       socket.off('revealTile', onRevealTile);
//       socket.off('roundEnd', onRoundEnd);
//     };
//   }, [socket, gameId]);

//   const handleGuess = (guess: string) => {
//     if (!socket || !gameId) return;
//     socket.emit('submitGuess', {
//       gameId,
//       guess
//     });
//   };

//   return (
//     <div className="min-h-screen bg-[#FFE6E6] p-8">
//       <div className="max-w-4xl mx-auto">
//         <h1 className="text-4xl font-bold text-[#FF4B4B] mb-8">Match Room</h1>

//         {error && (
//           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//             {error}
//           </div>
//         )}

//         {gameState ? (
//           <>
//             <div className="bg-white rounded-lg p-6 shadow-lg mb-6">
//               <h2 className="text-2xl font-semibold mb-4">Scores</h2>
//               <div className="flex justify-between">
//                 <p>Player 1: {gameState.scores.player1}</p>
//                 <p>Player 2: {gameState.scores.player2}</p>
//               </div>
//             </div>

//             <div className="bg-white rounded-lg p-6 shadow-lg mb-6">
//               <h2 className="text-2xl font-semibold mb-4">Word</h2>
//               <div className="flex justify-center space-x-4">
//                 {gameState.revealedTiles.map((revealed, i) => (
//                   <div key={i} className="w-12 h-12 border-2 border-[#FF4B4B] rounded-lg flex items-center justify-center text-2xl font-bold">
//                     {revealed ? '?' : '_'}
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div className="bg-white rounded-lg p-6 shadow-lg">
//               <h2 className="text-2xl font-semibold mb-4">Submit a Guess</h2>
//               <div className="flex space-x-4">
//                 <input
//                   type="text"
//                   className="flex-1 px-4 py-2 border-2 border-[#FF4B4B] rounded-lg focus:outline-none focus:border-[#FF9E9E]"
//                   placeholder="Guess the word"
//                   maxLength={gameState.wordLength}
//                 />
//                 <button
//                   onClick={() => {
//                     const input = document.querySelector('input');
//                     if (input) {
//                       handleGuess((input as HTMLInputElement).value);
//                       (input as HTMLInputElement).value = '';
//                     }
//                   }}
//                   className="px-6 py-2 bg-[#FF4B4B] text-white rounded-lg hover:bg-[#FF9E9E] transition-colors"
//                 >
//                   Submit
//                 </button>
//               </div>
//             </div>
//           </>
//         ) : (
//           <p className="text-gray-600">Waiting for game state...</p>
//         )}
//       </div>
//     </div>
//   );
// }
