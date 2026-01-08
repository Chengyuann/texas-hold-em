import { Card, GameStage, Player } from '../types';
import { evaluateHand } from './pokerLogic';

export interface BotDecision {
  action: 'FOLD' | 'CALL' | 'CHECK' | 'RAISE';
  amount?: number; // Total amount to bet (including currentBet)
  reasoning: string;
  thinkingTime: number; // Simulated delay in ms
}

const getHandStrength = (hand: Card[], communityCards: Card[]): number => {
    const { score } = evaluateHand(hand, communityCards);
    
    // Normalize score to 0-1 range approx
    if (score < 10000) return (score / 15) * 0.25; 
    if (score < 20000) return 0.25 + ((score - 10000) / 15) * 0.2;
    if (score < 30000) return 0.45 + ((score - 20000) / 15) * 0.2;
    if (score < 40000) return 0.65 + ((score - 30000) / 15) * 0.15;
    return 0.85; // Strong hands (Straight and above)
};

const evaluatePreflop = (hand: Card[]): number => {
    const v1 = hand[0].value;
    const v2 = hand[1].value;
    const isPair = v1 === v2;
    const isSuited = hand[0].suit === hand[1].suit;
    const highCard = Math.max(v1, v2);

    // Premium Pairs (1010+)
    if (isPair && v1 >= 10) return 0.95;
    // Strong High Cards (AK, AQ, AJ)
    if (highCard >= 14 && Math.min(v1, v2) >= 10) return 0.85;
    
    // Medium Pairs (66-99)
    if (isPair && v1 >= 6) return 0.7;
    
    // Suited Connectors / High Suited
    if (isSuited && highCard >= 12) return 0.6;
    
    // Small Pairs
    if (isPair) return 0.5;
    
    // Speculative
    if (isSuited && Math.abs(v1 - v2) <= 2) return 0.35;
    
    // High card unsuited
    if (highCard >= 13) return 0.3;
    
    return 0.1; // Trash
};

export const getBotDecision = async (
  bot: Player,
  communityCards: Card[],
  pot: number,
  currentBet: number,
  minRaise: number,
  stage: GameStage,
  activePlayerCount: number
): Promise<BotDecision> => {
  
  const toCall = currentBet - bot.currentBet;
  let strength = 0;

  // 1. Evaluate Strength
  if (stage === GameStage.PREFLOP) {
      strength = evaluatePreflop(bot.hand);
  } else {
      strength = getHandStrength(bot.hand, communityCards);
  }

  // 2. Contextual Adjustments
  const randomFactor = Math.random() * 0.15 - 0.075; 
  let adjustedStrength = strength + randomFactor;
  
  // Pot Odds Calculation
  // Cost to call / (Total Pot after call)
  let potOddsThreshold = 0.5; // Default neutral
  if (toCall > 0) {
      const totalPotAfterCall = pot + toCall;
      const potOdds = toCall / totalPotAfterCall;
      // If pot odds are low (e.g. 10%), we only need 10% equity to call.
      // We adjust our threshold: if Pot Odds are cheap, we are looser.
      // Adjusted Strength needs to be higher than Pot Odds roughly.
      potOddsThreshold = potOdds;
  }

  const isBluffing = Math.random() < 0.12; 
  const isShortStacked = bot.chips < (currentBet * 5) || bot.chips < 200;

  // 3. Logic Execution
  
  // -- A. Check/Fold Logic --
  if (toCall > 0) {
      // If we are short stacked, we loosen up significantly to try and double up
      if (isShortStacked && adjustedStrength > 0.4) adjustedStrength += 0.3;

      // If strength is significantly below required odds, fold.
      // e.g., Strength 0.2, Pot Odds 0.5 -> Fold
      // e.g., Strength 0.3, Pot Odds 0.1 (Cheap) -> Call
      if (adjustedStrength < potOddsThreshold && !isBluffing) {
           return { 
               action: 'FOLD', 
               reasoning: "牌力不足，赔率不佳", 
               thinkingTime: 800 + Math.random() * 800 // Fast fold
            };
      }
  }

  // -- B. Raise/All-In Logic --
  // Raise if strength is very high OR bluffing
  if (adjustedStrength > 0.75 || (isBluffing && toCall === 0)) {
      const minLegalRaise = currentBet + minRaise;
      
      // Determine bet size
      let betPercentage = 0.5; // Half pot
      if (adjustedStrength > 0.9) betPercentage = 0.8; // Value bet heavy
      if (isBluffing) betPercentage = 0.6; 
      
      let desiredRaise = currentBet + (pot * betPercentage);
      if (desiredRaise < minLegalRaise) desiredRaise = minLegalRaise;

      // Check for All-In logic
      const maxChips = bot.chips + bot.currentBet;
      
      // If raise is huge portion of stack, just shove
      if (desiredRaise > bot.chips * 0.7 || isShortStacked) {
           return { 
               action: 'RAISE', 
               amount: maxChips, 
               reasoning: "全压 (All-In)！",
               thinkingTime: 2000 + Math.random() * 1500 // Think long for all-in
            };
      }

      return { 
          action: 'RAISE', 
          amount: Math.floor(desiredRaise), 
          reasoning: isBluffing ? "试图偷鸡 (Bluff)" : "强牌加注 (Value Bet)",
          thinkingTime: 1500 + Math.random() * 1000
      };
  }

  // -- C. Call/Check Logic --
  if (toCall > 0) {
      return { 
          action: 'CALL', 
          reasoning: "跟注 (Call)",
          thinkingTime: 1000 + Math.random() * 800
      };
  } else {
      // If we have nothing but can check, check.
      // Occasionally perform a "Probe Bet" (Small bluff) if in late position
      if (Math.random() < 0.2 && stage !== GameStage.PREFLOP) {
          const minLegal = minRaise; // Bet 1BB if current is 0
          if (bot.chips > minLegal * 2) {
              return { 
                action: 'RAISE', 
                amount: minLegal, 
                reasoning: "试探性下注", 
                thinkingTime: 1200 
            };
          }
      }
      
      return { 
          action: 'CHECK', 
          reasoning: "过牌 (Check)",
          thinkingTime: 600 + Math.random() * 500 // Fast check
      };
  }
};

export const getHandAnalysis = async (
    hand: Card[], 
    communityCards: Card[], 
    pot: number
): Promise<string> => {
    if (hand.length < 2) return "等待发牌...";
    
    if (communityCards.length === 0) {
        const score = evaluatePreflop(hand);
        if (score > 0.8) return "起手牌强劲 (Premium)，建议加注入局。";
        if (score > 0.6) return "不错的牌型 (Good)，可以跟注或小幅加注。";
        if (score > 0.4) return "普通牌型 (Marginal)，位置好可玩。";
        return "垃圾牌 (Trash)，建议弃牌。";
    }

    const { name, score } = evaluateHand(hand, communityCards);
    
    if (score >= 40000) return `成牌 ${name}！胜率极高，请做大底池。`;
    if (score >= 20000) return `成牌 ${name}，牌力不错。注意牌面同花或顺子可能。`;
    if (score >= 10000) return `目前有一对 (${name})。如果对方示强，请谨慎。`;
    
    return `目前仅为 ${name}。除非想诈唬，否则建议控池。`;
}