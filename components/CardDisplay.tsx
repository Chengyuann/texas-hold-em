import React from 'react';
import { Card, Suit } from '../types';

interface CardProps {
  card?: Card;
  hidden?: boolean;
  className?: string;
  large?: boolean;
}

const CardDisplay: React.FC<CardProps> = ({ card, hidden, className = '', large = false }) => {
  if (hidden || !card) {
    return (
      <div 
        className={`
          relative bg-blue-800 border-2 border-white rounded-lg shadow-md flex items-center justify-center
          ${large ? 'w-20 h-28 sm:w-24 sm:h-36' : 'w-12 h-16 sm:w-14 sm:h-20'}
          ${className}
          bg-opacity-90 overflow-hidden
        `}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-30"></div>
        <div className="w-full h-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center">
            <span className="text-blue-300 text-3xl">❖</span>
        </div>
      </div>
    );
  }

  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  const textSize = large ? 'text-5xl sm:text-6xl' : 'text-2xl sm:text-3xl';
  const smallText = large ? 'text-xl' : 'text-sm';

  return (
    <div 
      className={`
        relative bg-white rounded-lg shadow-md flex flex-col items-center justify-between py-1
        ${large ? 'w-20 h-28 sm:w-24 sm:h-36' : 'w-12 h-16 sm:w-14 sm:h-20'}
        ${isRed ? 'text-red-600' : 'text-black'}
        ${className}
        transition-transform hover:-translate-y-1 duration-200
      `}
    >
      <div className={`absolute top-1 left-1 leading-none ${smallText} font-bold`}>
        {card.rank}
      </div>
      <div className={`${textSize}`}>
        {card.suit}
      </div>
      <div className={`absolute bottom-1 right-1 leading-none ${smallText} font-bold transform rotate-180`}>
        {card.rank}
      </div>
    </div>
  );
};

export default CardDisplay;