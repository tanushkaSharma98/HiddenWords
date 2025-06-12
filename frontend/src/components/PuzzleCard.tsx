import React from 'react';

interface PuzzleCardProps {
  word: string;
  revealedTiles: boolean[];
}

const PuzzleCard: React.FC<PuzzleCardProps> = ({ word, revealedTiles }) => {
  if (!word) return null;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-xl font-bold text-[#222] mb-1">Word Guess</div>
      <div className="text-xs text-[#444] mb-4 tracking-wide">FILL IN THE MISSING LETTER</div>
      <div className="flex gap-2">
        {word.split('').map((char, idx) => (
          <div
            key={idx}
            className="w-14 h-14 flex items-center justify-center text-3xl font-bold border-2 border-[#2D2A32] rounded-lg bg-[#F8F8F8]"
          >
            {revealedTiles[idx] ? char : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PuzzleCard;
