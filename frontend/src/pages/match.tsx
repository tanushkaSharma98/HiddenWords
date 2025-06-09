import dynamic from 'next/dynamic';
const Match = dynamic(() => import('../components/Match'), { ssr: false });
export default Match;
