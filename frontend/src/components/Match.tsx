import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import socket from '../lib/socket';
import Tile from './tile';

const Match = () => {
  const router = useRouter();
  const { matchId, roundId, playerId } = router.query;

  const [guess, setGuess] = useState('');
  const [tiles, setTiles] = useState<string[]>([]);
  const [revealedTiles, setRevealedTiles] = useState<boolean[]>([]);
  const [guesses, setGuesses] = useState<any[]>([]);

  useEffect(() => {
    if (!matchId || !roundId || !playerId) return;
    socket.emit('joinMatch', { matchId, playerId });

    socket.on('tickStart', (data) => {
      setRevealedTiles(data.revealedTiles);
    });

    socket.on('revealTile', ({ index, letter }) => {
      setTiles((prev) => {
        const newTiles = [...prev];
        newTiles[index] = letter;
        return newTiles;
      });
    });

    socket.on('newGuessBroadcast', (data) => {
      setGuesses((prev) => [...prev, data]);
    });

    socket.on('roundEnded', (data) => {
      alert(data.winnerId ? `🎉 Winner: ${data.winnerId}` : 'No winner.');
    });

    socket.on('nextRoundStarted', (data) => {
      router.replace({
        pathname: '/match',
        query: {
          matchId,
          roundId: data.roundId,
          playerId,
        },
      });
    });

    return () => {
      socket.off('tickStart');
      socket.off('revealTile');
      socket.off('roundEnded');
      socket.off('nextRoundStarted');
      socket.off('newGuessBroadcast');
    };
  }, [matchId, roundId, playerId]);

  const submitGuess = () => {
    socket.emit('newGuess', { roundId, playerId, guess });
    setGuess('');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🧠 Match ID: {matchId}</h2>
      <div className="grid grid-cols-6 gap-2 mb-6">
        {tiles.map((letter, idx) => (
          <Tile key={idx} letter={letter || '?'} revealed={revealedTiles[idx]} />
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          className="border border-gray-300 px-4 py-2 rounded"
        />
        <button
          onClick={submitGuess}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Submit Guess
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold">Previous Guesses:</h3>
        <ul className="list-disc pl-6">
          {guesses.map((g, idx) => (
            <li key={idx}>{g.playerId}: {g.guess} {g.isCorrect ? '✅' : '❌'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Match;
