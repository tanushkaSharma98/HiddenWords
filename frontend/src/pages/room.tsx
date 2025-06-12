import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../context/SocketContext';

interface Player {
  id: string;
  socketId: string;
}

interface MatchData {
  matchId: string;
  player1: Player;
  player2: Player;
}

interface GameState {
  wordLength: number;
  revealedTiles: boolean[];
  scores: {
    player1: number;
    player2: number;
  };
}

export default function Room() {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGameStarting, setIsGameStarting] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { matchId } = router.query;
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPlayerId(localStorage.getItem('playerId'));
      // Load matchData from localStorage if available
      const storedMatchData = localStorage.getItem('matchData');
      if (storedMatchData) {
        setMatchData(JSON.parse(storedMatchData));
      }
    }
  }, []);


  useEffect(() => {
    if (!socket) return;
  
    const onGameStart = ({ gameId }: { gameId: string }) => {
      console.log("Redirecting to matchRoom with gameId:", gameId);
      router.push(`/matchRoom?gameId=${gameId}`);
    };
  
    socket.on('gameStart', onGameStart);
  
    return () => {
      socket.off('gameStart', onGameStart); // Now removing the exact same function
    };
  }, [socket, router]);
  

  // Get opponent ID
  const getOpponentId = () => {
    if (!matchData || !currentPlayerId) return null;
    return currentPlayerId === matchData.player1.id ? matchData.player2.id : matchData.player1.id;
  };

  useEffect(() => {
    if (!socket || !matchId || !currentPlayerId) {
      console.log('Socket setup skipped:', { 
        hasSocket: !!socket, 
        matchId, 
        currentPlayerId 
      });
      return;
    }

    console.log('Setting up socket listeners for room:', {
      matchId,
      playerId: currentPlayerId,
      socketId: socket.id
    });

    const onConnect = () => {
      console.log('Socket connected:', socket.id);
      setError(null);
    };
    const onConnectError = (err: any) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
    };
    const onWaitingRoomCreated = (data: MatchData) => {
      console.log('Waiting room created with data:', data);
      setMatchData(data);
      setConnectedPlayers(new Set([data.player1.id, data.player2.id]));
    };
    const onPlayerJoined = ({ playerId, isPlayer1, isPlayer2 }: any) => {
      console.log('Player joined:', { playerId, isPlayer1, isPlayer2 });
      setConnectedPlayers(prev => new Set([...prev, playerId]));
    };
    const onPlayerDisconnected = ({ playerId }: any) => {
      console.log('Player disconnected:', playerId);
      setConnectedPlayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerId);
        return newSet;
      });
      setError('Other player disconnected from the waiting room');
    };
    const onGameStarting = ({ matchId, startedBy }: any) => {
      console.log('Game starting event received:', { matchId, startedBy });
      setIsGameStarting(true);
    };
    const onGameState = (state: GameState) => {
      console.log('Game state updated:', state);
      setGameState(state);
    };
    const onRevealTile = ({ index, letter }: any) => {
      console.log('Tile revealed:', { index, letter });
      setGameState(prev => {
        if (!prev) return prev;
        const newRevealedTiles = [...prev.revealedTiles];
        newRevealedTiles[index] = true;
        return {
          ...prev,
          revealedTiles: newRevealedTiles
        };
      });
    };
    const onRoundEnd = ({ winner, revealedWord, scores }: any) => {
      console.log('Round ended:', { winner, revealedWord, scores });
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scores
        };
      });
    };
    const onGameStart = ({ gameId }: { gameId: string }) => {
      console.log('Game start event received:', { gameId });
      console.log('Redirecting to matchRoom with:', {
        matchId: gameId,
        playerId: currentPlayerId
      });
      router.push(`/matchRoom?matchId=${gameId}&playerId=${currentPlayerId}`);
    };
    const onError = (error: any) => {
      console.error('Socket error:', error);
      setError(error.message || 'An error occurred');
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('waitingRoomCreated', onWaitingRoomCreated);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerDisconnected', onPlayerDisconnected);
    socket.on('gameStarting', onGameStarting);
    socket.on('gameStart', onGameStart);
    socket.on('gameState', onGameState);
    socket.on('revealTile', onRevealTile);
    socket.on('roundEnd', onRoundEnd);
    socket.on('error', onError);

    // Join the match room
    console.log('Joining match room with:', { matchId, playerId: currentPlayerId });
    socket.emit('joinMatch', { matchId, playerId: currentPlayerId });

    return () => {
      console.log('Cleaning up socket listeners');
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('waitingRoomCreated', onWaitingRoomCreated);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerDisconnected', onPlayerDisconnected);
      socket.off('gameStarting', onGameStarting);
      socket.off('gameStart', onGameStart);
      socket.off('gameState', onGameState);
      socket.off('revealTile', onRevealTile);
      socket.off('roundEnd', onRoundEnd);
      socket.off('error', onError);
    };
  }, [socket, matchId, currentPlayerId]);

  

  // Debug useEffect to log state changes
  useEffect(() => {
    console.log('Current state:', {
      matchData,
      currentPlayerId,
      connectedPlayers: Array.from(connectedPlayers),
      isGameStarting,
      gameState
    });
  }, [matchData, currentPlayerId, connectedPlayers, isGameStarting, gameState]);

  const handleStartGame = () => {
    if (!socket || !matchId) {
      console.error('Cannot start game:', { socket: !!socket, matchId });
      return;
    }
    console.log('Starting game for match:', matchId);
    console.log('Current socket state:', {
      connected: socket.connected,
      id: socket.id,
      playerId: currentPlayerId
    });
    
    socket.emit('startGame', { matchId }, (response: unknown) => {
      console.log('Start game response:', response);
    });
  };

  const handleGuess = (guess: string) => {
    if (!socket || !matchId) return;
    socket.emit('submitGuess', {
      gameId: matchId,
      guess
    });
  };

  if (!matchId) {
    return <div>Loading...</div>;
  }

  // Show waiting room if game hasn't started
  if (!gameState && !isGameStarting) {
    return (
      <div className="min-h-screen bg-[#FFE6E6] p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-[#FF4B4B] mb-8">Waiting Room</h1>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Players in Waiting Room</h2>
              <div className="space-y-4">
                {/* Player 1 */}
                <div className={`flex items-center space-x-4 ${matchData && connectedPlayers.has(matchData.player1?.id) ? 'opacity-100' : 'opacity-50'}`}>
                  <div className="w-12 h-12 bg-[#FF4B4B] rounded-full flex items-center justify-center text-white font-bold">
                    P1
                  </div>
                  <div>
                    <p className="font-semibold">Player 1</p>
                    <p className="text-sm text-gray-600">
                      {matchData && matchData.player1?.id
                        ? <>
                            ID: {matchData.player1.id}
                            {currentPlayerId === matchData.player1.id && <span className="text-xs text-green-600 ml-2">(You)</span>}
                            {connectedPlayers.has(matchData.player1.id)
                              ? <span className="text-xs text-green-600 ml-2">(Connected)</span>
                              : <span className="text-xs text-yellow-600 ml-2">(Disconnected)</span>
                            }
                          </>
                        : <span className="text-xs text-yellow-600">Waiting for Player 1 to join...</span>
                      }
                    </p>
                  </div>
                </div>
                {/* Player 2 */}
                <div className={`flex items-center space-x-4 ${matchData && connectedPlayers.has(matchData.player2?.id) ? 'opacity-100' : 'opacity-50'}`}>
                  <div className="w-12 h-12 bg-[#8B5CF6] rounded-full flex items-center justify-center text-white font-bold">
                    P2
                  </div>
                  <div>
                    <p className="font-semibold">Player 2</p>
                    <p className="text-sm text-gray-600">
                      {matchData && matchData.player2?.id
                        ? <>
                            ID: {matchData.player2.id}
                            {currentPlayerId === matchData.player2.id && <span className="text-xs text-green-600 ml-2">(You)</span>}
                            {connectedPlayers.has(matchData.player2.id)
                              ? <span className="text-xs text-green-600 ml-2">(Connected)</span>
                              : <span className="text-xs text-yellow-600 ml-2">(Disconnected)</span>
                            }
                          </>
                        : <span className="text-xs text-yellow-600">Waiting for Player 2 to join...</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* <button
              onClick={handleStartGame}
              disabled={!matchData || connectedPlayers.size < 2}
              className={`w-full px-6 py-3 text-white rounded-lg text-xl font-bold transition-colors ${
                !matchData || connectedPlayers.size < 2 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-[#FF4B4B] hover:bg-[#FF9E9E]'
              }`}
            >
              {!matchData || connectedPlayers.size < 2 ? 'Start Game' : 'Start Game'}
            </button> */}

<button
  onClick={handleStartGame}
  className="w-full px-6 py-3 text-white rounded-lg text-xl font-bold bg-[#FF4B4B] hover:bg-[#FF9E9E] transition-colors"
>
  Start Game
</button>


          </div>
        </div>
      </div>
    );
  }

  // Show game starting message
  if (isGameStarting && !gameState) {
    return (
      <div className="min-h-screen bg-[#FFE6E6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#FF4B4B] mb-4">Game Starting...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4B4B] mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show game UI
  return (
    <div className="min-h-screen bg-[#FFE6E6] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-[#FF4B4B] mb-8">Game Room</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {gameState && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Scores</h2>
              <div className="flex justify-between">
                <div>Player 1: {gameState.scores.player1}</div>
                <div>Player 2: {gameState.scores.player2}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Word Progress</h2>
              <div className="flex justify-center space-x-4">
                {Array(gameState.wordLength).fill(0).map((_, index) => (
                  <div
                    key={index}
                    className="w-12 h-12 border-2 border-[#FF4B4B] rounded-lg flex items-center justify-center text-2xl font-bold"
                  >
                    {gameState.revealedTiles[index] ? '?' : '_'}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Make a Guess</h2>
              <div className="flex space-x-4">
                <input
                  type="text"
                  className="flex-1 px-4 py-2 border-2 border-[#FF4B4B] rounded-lg focus:outline-none focus:border-[#FF9E9E]"
                  placeholder="Enter your guess"
                  maxLength={gameState.wordLength}
                />
                <button
                  className="px-6 py-2 bg-[#FF4B4B] text-white rounded-lg hover:bg-[#FF9E9E] transition-colors"
                  onClick={() => {
                    const input = document.querySelector('input');
                    if (input) {
                      handleGuess(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

