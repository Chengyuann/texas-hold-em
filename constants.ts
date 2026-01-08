import { Rank, Suit, Card } from './types';

export const INITIAL_CHIPS = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

const RANKS = [
  { r: Rank.TWO, v: 2 }, { r: Rank.THREE, v: 3 }, { r: Rank.FOUR, v: 4 }, { r: Rank.FIVE, v: 5 },
  { r: Rank.SIX, v: 6 }, { r: Rank.SEVEN, v: 7 }, { r: Rank.EIGHT, v: 8 }, { r: Rank.NINE, v: 9 },
  { r: Rank.TEN, v: 10 }, { r: Rank.JACK, v: 11 }, { r: Rank.QUEEN, v: 12 }, { r: Rank.KING, v: 13 }, { r: Rank.ACE, v: 14 }
];

const SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({
        suit,
        rank: rank.r,
        value: rank.v,
        id: `${rank.r}${suit}`
      });
    });
  });
  return shuffle(deck);
};

export const shuffle = (array: Card[]): Card[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka", 
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Calvin",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Django",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Eliza",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Finn",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Gale"
];

export const BOT_NAMES = [
  "Tom Dwan", "Phil Ivey", "Daniel N.", "Fedor Holz", 
  "Brunson", "Hellmuth", "Cates", "Haxton"
];