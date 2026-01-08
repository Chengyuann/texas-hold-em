import React from 'react';

interface ChipDisplayProps {
  amount: number;
  className?: string;
}

const ChipDisplay: React.FC<ChipDisplayProps> = ({ amount, className = '' }) => {
  return (
    <div className={`flex items-center space-x-1 bg-black/40 px-3 py-1 rounded-full border border-yellow-600/50 ${className}`}>
      <div className="w-5 h-5 rounded-full bg-yellow-500 border-2 border-yellow-300 shadow-inner flex items-center justify-center">
        <span className="text-[10px] font-bold text-yellow-900">$</span>
      </div>
      <span className="text-yellow-400 font-mono font-bold text-lg">{amount}</span>
    </div>
  );
};

export default ChipDisplay;