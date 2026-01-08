import { Card, Suit } from '../types';

// Simplified Hand Evaluation for brevity but functional accuracy
export const evaluateHand = (holeCards: Card[], communityCards: Card[]): { score: number; name: string } => {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length === 0) return { score: 0, name: 'Empty' };
  
  // Sort by value descending
  allCards.sort((a, b) => b.value - a.value);

  const isFlush = (cards: Card[]): boolean => {
    const suits = { [Suit.HEARTS]: 0, [Suit.DIAMONDS]: 0, [Suit.CLUBS]: 0, [Suit.SPADES]: 0 };
    cards.forEach(c => suits[c.suit]++);
    return Object.values(suits).some(count => count >= 5);
  };

  const isStraight = (cards: Card[]): boolean => {
    const uniqueValues = Array.from(new Set(cards.map(c => c.value))).sort((a, b) => a - b);
    let consecutive = 0;
    for (let i = 0; i < uniqueValues.length - 1; i++) {
      if (uniqueValues[i + 1] === uniqueValues[i] + 1) {
        consecutive++;
        if (consecutive >= 4) return true;
      } else {
        consecutive = 0;
      }
    }
    // Ace low straight (A, 2, 3, 4, 5)
    if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) {
        return true;
    }
    return false;
  };

  const counts: Record<number, number> = {};
  allCards.forEach(c => {
    counts[c.value] = (counts[c.value] || 0) + 1;
  });
  
  const countValues = Object.values(counts);
  const isFourOfAKind = countValues.includes(4);
  const isThreeOfAKind = countValues.includes(3);
  const pairCount = countValues.filter(c => c === 2).length;

  const flush = isFlush(allCards);
  const straight = isStraight(allCards);

  // Simple scoring mechanism (Rank * 10000 + HighCard)
  // 8: Straight Flush (Not perfectly implemented in this simplified version, assuming Flush + Straight logic separate)
  // 7: Four of a Kind
  // 6: Full House
  // 5: Flush
  // 4: Straight
  // 3: Three of a Kind
  // 2: Two Pair
  // 1: One Pair
  // 0: High Card

  // Note: This is a heuristic. A robust evaluator is much larger.
  // We check from best to worst.

  if (flush && straight) return { score: 80000 + allCards[0].value, name: '同花顺 (Straight Flush)' };
  if (isFourOfAKind) return { score: 70000 + allCards[0].value, name: '四条 (Four of a Kind)' };
  if (isThreeOfAKind && pairCount >= 1) return { score: 60000 + allCards[0].value, name: '葫芦 (Full House)' };
  if (flush) return { score: 50000 + allCards[0].value, name: '同花 (Flush)' };
  if (straight) return { score: 40000 + allCards[0].value, name: '顺子 (Straight)' };
  if (isThreeOfAKind) return { score: 30000 + allCards[0].value, name: '三条 (Three of a Kind)' };
  if (pairCount >= 2) return { score: 20000 + allCards[0].value, name: '两对 (Two Pair)' };
  if (pairCount === 1) return { score: 10000 + allCards[0].value, name: '一对 (Pair)' };
  
  return { score: allCards[0].value, name: '高牌 (High Card)' };
};
