/**
 * Dynamic Banker AI model for calculating offers
 */
export function calculateBankerOffer(
  remainingValues: number[],
  roundIndex: number,
  isMillionaireMode: boolean = false
): number {
  if (remainingValues.length === 0) return 0;

  const expectedValue = remainingValues.reduce((a, b) => a + b, 0) / remainingValues.length;
  
  // Offer progression:
  // Early rounds: 20–60% of expected value
  // Mid game: 50–90%
  // Late game: 80–110%
  
  let percentage = 0.2;
  
  if (roundIndex === 0) percentage = 0.2 + Math.random() * 0.1;
  else if (roundIndex === 1) percentage = 0.3 + Math.random() * 0.1;
  else if (roundIndex === 2) percentage = 0.45 + Math.random() * 0.15;
  else if (roundIndex === 3) percentage = 0.6 + Math.random() * 0.2;
  else if (roundIndex === 4) percentage = 0.75 + Math.random() * 0.2;
  else percentage = 0.85 + Math.random() * 0.25;

  if (isMillionaireMode) {
    percentage += 0.1; // More aggressive offers
  }

  // Cap at 110% usually, unless it's a "generous" offer
  percentage = Math.min(percentage, 1.15);

  let offer = expectedValue * percentage;

  // Rounding for game-show aesthetic
  if (offer > 1000) {
    offer = Math.round(offer / 100) * 100;
  } else if (offer > 100) {
    offer = Math.round(offer / 10) * 10;
  } else {
    offer = Math.round(offer);
  }

  return offer;
}

export function getBankerMessage(offer: number, expectedValue: number): string {
  const ratio = offer / expectedValue;
  if (ratio > 0.9) return "The banker is feeling unusually generous today... Or perhaps he values your safety.";
  if (ratio < 0.4) return "The banker senses your fear. This low-ball offer reflects his confidence.";
  if (offer > 100000) return "A life-changing sum. Are you brave enough to walk away?";
  return "The phone rings. The banker has an offer for you.";
}
