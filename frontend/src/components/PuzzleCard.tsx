import React from 'react';

const PuzzleCard = () => (
  <div className="flex flex-col items-center justify-center bg-[#FFE4A3] rounded-xl shadow-lg p-8">
    <div className="text-xl font-bold text-[#222] mb-1">Word Guess</div>
    <div className="text-xs text-[#444] mb-4 tracking-wide">FILL IN THE MISSING LETTER</div>
    <div className="flex gap-2">
      {[...Array(6)].map((_, idx) => (
        <div
          key={idx}
          className="w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center text-3xl font-bold border-2 border-gray-300 rounded-md bg-[#f5f3ee] shadow-sm"
        >
          {/* Empty for now */}
        </div>
      ))}
    </div>
  </div>
);

export default PuzzleCard;
