interface TileProps {
  letter: string;
  revealed: boolean;
}

const Tile = ({ letter, revealed }: TileProps) => {
  return (
    <div className="w-12 h-12 border border-gray-400 flex items-center justify-center text-xl font-bold">
      {revealed ? letter.toUpperCase() : '?'}
    </div>
  );
};

export default Tile;
