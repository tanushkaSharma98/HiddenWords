import { useRouter } from 'next/router';
import Lobby from '../components/lobby';

export default function LobbyPage() {
  const router = useRouter();

  const handleGameStart = (gameId: string) => {
    router.push({
      pathname: '/game',
      query: { gameId }
    });
  };

  return (
    <div>
      <Lobby onGameStart={handleGameStart} />
    </div>
  );
} 