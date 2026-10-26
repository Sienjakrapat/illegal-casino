const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const RANK_VALUES = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13
};

/**
 * Creates a standard 52-card deck.
 * @returns {Array<{ suit: string, rank: string, value: number }>}
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        value: RANK_VALUES[rank]
      });
    }
  }
  return deck;
}

/**
 * Shuffles a card deck in-place using Fisher-Yates algorithm.
 * @param {Array} deck 
 * @param {Function} [rng=Math.random] 
 * @returns {Array} The shuffled deck
 */
function shuffleDeck(deck, rng = Math.random) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Draws and removes `count` cards from the top of the deck.
 * @param {Array} deck 
 * @param {number} count 
 * @returns {Array} Array of drawn cards
 */
function drawCards(deck, count) {
  const drawn = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    drawn.push(deck.pop());
  }
  return drawn;
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffleDeck,
  drawCards
};
