export enum Suit {
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
  SPADES = '♠',
}

export enum Rank {
  TWO = '2', THREE = '3', FOUR = '4', FIVE = '5',
  SIX = '6', SEVEN = '7', EIGHT = '8', NINE = '9',
  TEN = '10', JACK = 'J', QUEEN = 'Q', KING = 'K', ACE = 'A',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 2-14 for comparison
  id: string;
}

export enum PlayerStatus {
  ACTIVE = 'ACTIVE',
  FOLDED = 'FOLDED',
  ALL_IN = 'ALL_IN',
  BUSTED = 'BUSTED',
  SHOWDOWN = 'SHOWDOWN',
}

export enum GameStage {
  IDLE = 'IDLE',
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  hand: Card[];
  status: PlayerStatus;
  currentBet: number; // Bet in the current round
  isHuman: boolean;
  isDealer: boolean;
  avatar: string;
  lastAction?: string;
}

export interface GameState {
  stage: GameStage;
  pot: number;
  currentBet: number; // The target amount players must match (highest bet on table)
  minRaise: number;   // The minimum INCREMENT required to raise
  deck: Card[];
  communityCards: Card[];
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  winners: { playerId: string; handName: string; amount: number }[];
  logs: string[];
}

export interface AIAnalysis {
  advice: string;
  winProbability?: number;
}

export type ScreenView = 'LOBBY' | 'GAME_OFFLINE' | 'GAME_ONLINE';