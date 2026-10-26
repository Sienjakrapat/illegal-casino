const test = require('node:test');
const assert = require('node:assert/strict');
const { SUITS, RANKS, createDeck, shuffleDeck, drawCards } = require('../src/deck');

test('createDeck creates 52 unique standard playing cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  const uniqueKeys = new Set(deck.map(c => `${c.rank}${c.suit}`));
  assert.equal(uniqueKeys.size, 52);
});

test('drawCards removes and returns exact count from deck', () => {
  const deck = shuffleDeck(createDeck());
  const drawn = drawCards(deck, 3);
  assert.equal(drawn.length, 3);
  assert.equal(deck.length, 49);
});

test('cards have expected suit, rank, and numeric values (A=1, J=11, Q=12, K=13)', () => {
  const deck = createDeck();
  assert.equal(SUITS.length, 4);
  assert.equal(RANKS.length, 13);
  
  const aceOfSpades = deck.find(c => c.rank === 'A' && c.suit === '♠');
  assert.deepEqual(aceOfSpades, { suit: '♠', rank: 'A', value: 1 });

  const tenOfHearts = deck.find(c => c.rank === '10' && c.suit === '♥');
  assert.deepEqual(tenOfHearts, { suit: '♥', rank: '10', value: 10 });

  const kingOfDiamonds = deck.find(c => c.rank === 'K' && c.suit === '♦');
  assert.deepEqual(kingOfDiamonds, { suit: '♦', rank: 'K', value: 13 });
});

test('shuffleDeck shuffles deterministically with custom rng', () => {
  const deck1 = createDeck();
  const deck2 = createDeck();
  // Using deterministic rng sequence
  let seed = 42;
  const mockRng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  shuffleDeck(deck1, mockRng);
  assert.notDeepEqual(deck1, deck2);
  assert.equal(deck1.length, 52);
});

test('drawCards returns available cards if count exceeds deck size', () => {
  const deck = createDeck();
  const drawn = drawCards(deck, 60);
  assert.equal(drawn.length, 52);
  assert.equal(deck.length, 0);
});
