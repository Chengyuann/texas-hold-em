import React from 'react';
import { Player, PlayerStatus, Card } from '../types';
import CardDisplay from './CardDisplay';
import ChipDisplay from './ChipDisplay';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isWinner?: boolean;
  style?: React.CSSProperties; // Changed from positionClass to style object
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isActive, isWinner, style }) => {
  const isFolded = player.status === PlayerStatus.FOLDED;
  const isBusted = player.status === PlayerStatus.BUSTED;

  return (
    <div 
      className={`absolute flex flex-col items-center transition-all duration-500 transform -translate-x-1/2 -translate-y-1/2 ${isFolded ? 'opacity-50 grayscale' : ''}`}
      style={style}
    >
      
      {/* Cards */}
      <div className="relative mb-[-15px] z-10 flex space-x-[-25px] transition-transform duration-300">
        {player.hand.map((card, idx) => (
          <CardDisplay 
            key={idx} 
            card={card} 
            hidden={!player.isHuman && player.status !== PlayerStatus.SHOWDOWN && !isWinner} 
            className={`transform ${idx === 0 ? '-rotate-6' : 'rotate-6'} origin-bottom`}
          />
        ))}
        {player.hand.length === 0 && !isBusted && (
            // Placeholder for empty hand area to keep layout stable
             <div className="w-12 h-16 bg-transparent"></div>
        )}
      </div>

      {/* Avatar Container */}
      <div className={`
        relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 shadow-lg bg-gray-800 transition-all duration-300
        ${isActive ? 'border-yellow-400 scale-110 shadow-yellow-500/50' : isWinner ? 'border-green-400 shadow-green-500/50' : 'border-gray-600'}
      `}>
        <img 
          src={player.avatar} 
          alt={player.name} 
          className="w-full h-full rounded-full object-cover" 
        />
        
        {/* Dealer Button */}
        {player.isDealer && (
          <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full border-2 border-black flex items-center justify-center shadow-md z-20">
            <span className="text-black text-xs md:text-sm font-bold">D</span>
          </div>
        )}

        {/* Action Badge (Bubble) */}
        {player.lastAction && (
          <div className="absolute -top-6 md:-top-8 left-1/2 transform -translate-x-1/2 bg-white/95 px-2 py-0.5 md:px-3 md:py-1 rounded-full z-30 shadow-lg animate-bounce border border-gray-300">
            <span className="text-xs md:text-sm font-black text-black uppercase whitespace-nowrap">{player.lastAction}</span>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-2 bg-gray-900/90 backdrop-blur-sm px-2 py-1 md:px-4 md:py-2 rounded-xl text-center border border-gray-600 min-w-[100px] md:min-w-[120px] shadow-xl z-20">
        <div className="text-xs md:text-sm text-gray-200 font-bold truncate max-w-[90px] md:max-w-[100px] mx-auto mb-1">{player.name}</div>
        <ChipDisplay amount={player.chips} className="justify-center scale-90 md:scale-100 origin-center" />
        {player.currentBet > 0 && (
             <div className="text-xs text-yellow-300 font-semibold mt-1">Bet: {player.currentBet}</div>
        )}
      </div>
    </div>
  );
};

export default PlayerSeat;