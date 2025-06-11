import React from 'react';
import Image from 'next/image';

const PuzzleCard = () => {
  return (
    <div className="relative w-full max-w-md p-6 bg-lime-200 rounded-2xl text-center shadow-lg">
      <h2 className="text-xl font-bold text-purple-900 mb-2">FILL IN THE BLANK</h2>
      <p className="text-sm text-purple-800 font-semibold mb-6 uppercase">One of the small dog breeds</p>

      <div className="flex justify-center space-x-3 mb-4">
        <span className="text-lg font-bold text-purple-900">P</span>
        <span className="text-lg font-bold text-purple-900">_</span>
        <span className="text-lg font-bold text-purple-900">_</span>
        <span className="text-lg font-bold text-purple-900">E</span>
        <span className="text-lg font-bold text-purple-900">_</span>
        <span className="text-lg font-bold text-purple-900">A</span>
      </div>

      <div className="flex justify-center space-x-3 mb-4">
        <span className="text-lg font-bold text-purple-900">N</span>
        <span className="text-lg font-bold text-purple-900">_</span>
        <span className="text-lg font-bold text-purple-900">A</span>
        <span className="text-lg font-bold text-purple-900">N</span>
        <span className="text-lg font-bold text-purple-900">_</span>
      </div>

      <Image
        src="/dog-left.png"
        alt="Dog Left"
        width={60}
        height={60}
        className="absolute bottom-3 left-3"
      />
      <Image
        src="/dog-right.png"
        alt="Dog Right"
        width={60}
        height={60}
        className="absolute bottom-3 right-3"
      />
    </div>
  );
};

export default PuzzleCard;
