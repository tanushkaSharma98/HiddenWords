import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SocketProvider } from '../context/SocketContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SocketProvider>
      <Component {...pageProps} />
    </SocketProvider>
  );
} 