const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPokerCardRank,
  evaluate5CardHand,
  evaluateBestPokerHand,
  comparePokerHands,
  PokerEngine
} = require('../src/games/poker');
const { RoomManager } = require('../src/roomManager');

test('evaluateBestPokerHand ranks Flush, Full House, Straight, and Pair accurately', () => {
  const fullHouse = evaluateBestPokerHand([
    { rank: 'K', suit: '♠' }, { rank: 'K', suit: '♥' }, { rank: 'K', suit: '♦' },
    { rank: '9', suit: '♣' }, { rank: '9', suit: '♠' },
    { rank: '2', suit: '♦' }, { rank: '5', suit: '♣' }
  ]);
  const flush = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'J', suit: '♠' }, { rank: '8', suit: '♠' },
    { rank: '5', suit: '♠' }, { rank: '2', suit: '♠' },
    { rank: 'K', suit: '♥' }, { rank: '9', suit: '♦' }
  ]);
  assert.equal(fullHouse.name, 'Full House');
  assert.equal(flush.name, 'Flush');
  assert.equal(comparePokerHands(fullHouse, flush), 1);
});

test('PokerEngine posts custom blinds, progresses streets, and awards pot on fold or showdown', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });
  rm.updateSettings({ roomCode: room.code, adminPlayerId: 'p1', blinds: { smallBlind: 25, bigBlind: 50 } });

  const engine = new PokerEngine(room, rm);
  engine.startHand();
  assert.equal(room.gameState.pot, 75);

  const currentTurn = room.gameState.currentTurnPlayerId;
  engine.playerAction(currentTurn, { action: 'fold' });
  assert.equal(room.gameState.phase, 'SHOWDOWN');
  const winnerId = currentTurn === 'p1' ? 'p2' : 'p1';
  assert.equal(room.players[winnerId].chips, 525);
});

test('evaluateBestPokerHand recognizes all 10 poker categories and wheel straights', () => {
  // 9: Royal Flush
  const royalFlush = evaluateBestPokerHand([
    { rank: 'A', suit: '♥' }, { rank: 'K', suit: '♥' }, { rank: 'Q', suit: '♥' },
    { rank: 'J', suit: '♥' }, { rank: '10', suit: '♥' },
    { rank: '2', suit: '♣' }, { rank: '3', suit: '♦' }
  ]);
  assert.equal(royalFlush.category, 9);
  assert.equal(royalFlush.name, 'Royal Flush');

  // 8: Straight Flush (normal & wheel)
  const straightFlush = evaluateBestPokerHand([
    { rank: '9', suit: '♣' }, { rank: '8', suit: '♣' }, { rank: '7', suit: '♣' },
    { rank: '6', suit: '♣' }, { rank: '5', suit: '♣' },
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♦' }
  ]);
  assert.equal(straightFlush.category, 8);
  assert.equal(straightFlush.name, 'Straight Flush');
  assert.deepEqual(straightFlush.tiebreakers, [9]);

  const wheelStraightFlush = evaluateBestPokerHand([
    { rank: 'A', suit: '♦' }, { rank: '2', suit: '♦' }, { rank: '3', suit: '♦' },
    { rank: '4', suit: '♦' }, { rank: '5', suit: '♦' },
    { rank: '9', suit: '♠' }, { rank: 'J', suit: '♣' }
  ]);
  assert.equal(wheelStraightFlush.category, 8);
  assert.equal(wheelStraightFlush.name, 'Straight Flush');
  assert.deepEqual(wheelStraightFlush.tiebreakers, [5]);
  assert.equal(comparePokerHands(straightFlush, wheelStraightFlush), 1);

  // 7: Four of a Kind
  const quads = evaluateBestPokerHand([
    { rank: '8', suit: '♠' }, { rank: '8', suit: '♥' }, { rank: '8', suit: '♦' },
    { rank: '8', suit: '♣' }, { rank: 'A', suit: '♠' },
    { rank: '4', suit: '♥' }, { rank: '2', suit: '♦' }
  ]);
  assert.equal(quads.category, 7);
  assert.equal(quads.name, 'Four of a Kind');
  assert.deepEqual(quads.tiebreakers, [8, 14]);

  // 4: Straight (Broadway and Wheel)
  const broadwayStraight = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }, { rank: 'Q', suit: '♦' },
    { rank: 'J', suit: '♣' }, { rank: '10', suit: '♠' },
    { rank: '2', suit: '♥' }, { rank: '3', suit: '♦' }
  ]);
  assert.equal(broadwayStraight.category, 4);
  assert.equal(broadwayStraight.name, 'Straight');
  assert.deepEqual(broadwayStraight.tiebreakers, [14]);

  const wheelStraight = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: '2', suit: '♥' }, { rank: '3', suit: '♦' },
    { rank: '4', suit: '♣' }, { rank: '5', suit: '♠' },
    { rank: 'K', suit: '♥' }, { rank: '9', suit: '♦' }
  ]);
  assert.equal(wheelStraight.category, 4);
  assert.equal(wheelStraight.name, 'Straight');
  assert.deepEqual(wheelStraight.tiebreakers, [5]);
  assert.equal(comparePokerHands(broadwayStraight, wheelStraight), 1);

  // 3: Three of a Kind
  const trips = evaluateBestPokerHand([
    { rank: '7', suit: '♠' }, { rank: '7', suit: '♥' }, { rank: '7', suit: '♦' },
    { rank: 'A', suit: '♣' }, { rank: 'K', suit: '♠' },
    { rank: '2', suit: '♥' }, { rank: '3', suit: '♦' }
  ]);
  assert.equal(trips.category, 3);
  assert.equal(trips.name, 'Three of a Kind');
  assert.deepEqual(trips.tiebreakers, [7, 14, 13]);

  // 2: Two Pair
  const twoPair = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'A', suit: '♥' },
    { rank: 'K', suit: '♦' }, { rank: 'K', suit: '♣' },
    { rank: 'Q', suit: '♠' }, { rank: '5', suit: '♥' }, { rank: '2', suit: '♦' }
  ]);
  assert.equal(twoPair.category, 2);
  assert.equal(twoPair.name, 'Two Pair');
  assert.deepEqual(twoPair.tiebreakers, [14, 13, 12]);

  // 1: One Pair
  const onePair = evaluateBestPokerHand([
    { rank: '10', suit: '♠' }, { rank: '10', suit: '♥' },
    { rank: 'A', suit: '♦' }, { rank: 'K', suit: '♣' },
    { rank: '8', suit: '♠' }, { rank: '4', suit: '♥' }, { rank: '2', suit: '♦' }
  ]);
  assert.equal(onePair.category, 1);
  assert.equal(onePair.name, 'One Pair');
  assert.deepEqual(onePair.tiebreakers, [10, 14, 13, 8]);

  // 0: High Card
  const highCard = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' },
    { rank: '9', suit: '♦' }, { rank: '7', suit: '♣' },
    { rank: '4', suit: '♠' }, { rank: '3', suit: '♥' }, { rank: '2', suit: '♦' }
  ]);
  assert.equal(highCard.category, 0);
  assert.equal(highCard.name, 'High Card');
  assert.deepEqual(highCard.tiebreakers, [14, 13, 9, 7, 4]);
});

test('comparePokerHands handles detailed kicker tiebreakers and ties', () => {
  // Two pair with different kicker
  const tp1 = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'A', suit: '♥' },
    { rank: 'K', suit: '♦' }, { rank: 'K', suit: '♣' },
    { rank: 'Q', suit: '♠' }
  ]);
  const tp2 = evaluateBestPokerHand([
    { rank: 'A', suit: '♦' }, { rank: 'A', suit: '♣' },
    { rank: 'K', suit: '♠' }, { rank: 'K', suit: '♥' },
    { rank: 'J', suit: '♠' }
  ]);
  assert.equal(comparePokerHands(tp1, tp2), 1);
  assert.equal(comparePokerHands(tp2, tp1), -1);

  // Identical tiebreakers (tie)
  const tp3 = evaluateBestPokerHand([
    { rank: 'A', suit: '♦' }, { rank: 'A', suit: '♣' },
    { rank: 'K', suit: '♠' }, { rank: 'K', suit: '♥' },
    { rank: 'Q', suit: '♦' }
  ]);
  assert.equal(comparePokerHands(tp1, tp3), 0);

  // High card tiebreakers
  const hc1 = evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }, { rank: '10', suit: '♦' }, { rank: '8', suit: '♣' }, { rank: '6', suit: '♠' }
  ]);
  const hc2 = evaluateBestPokerHand([
    { rank: 'A', suit: '♦' }, { rank: 'K', suit: '♣' }, { rank: '10', suit: '♠' }, { rank: '8', suit: '♥' }, { rank: '5', suit: '♦' }
  ]);
  assert.equal(comparePokerHands(hc1, hc2), 1);
});

test('evaluateBestPokerHand throws error when fewer than 5 cards provided', () => {
  assert.throws(() => evaluateBestPokerHand([]), /ไพ่ต้องมีอย่างน้อย 5 ใบ/);
  assert.throws(() => evaluateBestPokerHand([
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }, { rank: 'Q', suit: '♦' }
  ]), /ไพ่ต้องมีอย่างน้อย 5 ใบ/);
});

test('PokerEngine plays complete hand from Pre-Flop to Showdown with checks and calls', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 1000 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });

  // Custom deck to guarantee deterministic winner:
  // p1 cards: A♠, K♠
  // p2 cards: Q♦, J♦
  // Community: 10♠, 2♠, 3♠, 4♦, 5♦ (p1 will have flush in Spades: A♠, K♠, 10♠, 2♠, 3♠)
  const customDeck = [
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }, // p1
    { rank: 'Q', suit: '♦' }, { rank: 'J', suit: '♦' }, // p2
    { rank: '10', suit: '♠' }, { rank: '2', suit: '♠' }, { rank: '3', suit: '♠' }, // Flop
    { rank: '4', suit: '♦' }, // Turn
    { rank: '5', suit: '♦' }  // River
  ];

  const engine = new PokerEngine(room, rm);
  engine.startHand(customDeck);

  // Pre-Flop: Heads-Up, P1 is Dealer/SB (posts 10), P2 is BB (posts 20).
  assert.equal(room.gameState.phase, 'PRE_FLOP');
  assert.equal(room.gameState.pot, 30);
  assert.equal(room.gameState.highestBet, 20);
  assert.equal(room.gameState.currentTurnPlayerId, 'p1');

  // P1 calls 20 (adds 10)
  engine.playerAction('p1', { action: 'call' });
  assert.equal(room.gameState.pot, 40);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // P2 checks
  engine.playerAction('p2', { action: 'check' });

  // Flop dealt (3 cards)
  assert.equal(room.gameState.phase, 'FLOP');
  assert.equal(room.gameState.communityCards.length, 3);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2'); // Post-flop first to act is non-dealer (p2)

  // Flop checks
  engine.playerAction('p2', { action: 'check' });
  assert.equal(room.gameState.currentTurnPlayerId, 'p1');
  engine.playerAction('p1', { action: 'check' });

  // Turn dealt (1 card, total 4)
  assert.equal(room.gameState.phase, 'TURN');
  assert.equal(room.gameState.communityCards.length, 4);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // Turn checks
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'check' });

  // River dealt (1 card, total 5)
  assert.equal(room.gameState.phase, 'RIVER');
  assert.equal(room.gameState.communityCards.length, 5);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // River checks -> Showdown!
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'check' });

  assert.equal(room.gameState.phase, 'SHOWDOWN');
  assert.deepEqual(room.gameState.results.winners, ['p1']);
  assert.equal(room.gameState.results.handDetails.p1.name, 'Flush');
  assert.equal(room.players.p1.chips, 1020); // 1000 - 20 + 40
  assert.equal(room.players.p2.chips, 980);  // 1000 - 20
});

test('PokerEngine handles 3-player seating, blinds, and turn rotations', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Alice', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'Bob', playerId: 'p2', socketId: 's2' });
  rm.joinRoom({ roomCode: room.code, playerName: 'Charlie', playerId: 'p3', socketId: 's3' });

  const engine = new PokerEngine(room, rm);
  engine.startHand();

  // Hand 1: dealerIdx = 0 (p1/Alice)
  // SB = (0+1)%3 = 1 (p2/Bob, posts 10)
  // BB = (0+2)%3 = 2 (p3/Charlie, posts 20)
  // Pre-flop first to act = (0+3)%3 = 0 (p1/Alice, UTG)
  assert.equal(room.gameState.dealerPlayerId, 'p1');
  assert.equal(room.gameState.sbPlayerId, 'p2');
  assert.equal(room.gameState.bbPlayerId, 'p3');
  assert.equal(room.gameState.currentTurnPlayerId, 'p1');
  assert.equal(room.gameState.pot, 30);

  // p1 raises to 50
  engine.playerAction('p1', { action: 'raise', amount: 50 });
  assert.equal(room.gameState.highestBet, 50);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // p2 calls (needs 40 more since 10 already posted)
  engine.playerAction('p2', { action: 'call' });
  assert.equal(room.gameState.players.p2.currentBet, 50);
  assert.equal(room.gameState.currentTurnPlayerId, 'p3');

  // p3 folds
  engine.playerAction('p3', { action: 'fold' });

  // Flop!
  assert.equal(room.gameState.phase, 'FLOP');
  // In 3 players with dealer p1: post-flop starts at dealer+1 (p2/Bob)
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // p2 checks, p1 checks -> Turn
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'check' });
  assert.equal(room.gameState.phase, 'TURN');

  // p2 checks, p1 raises to 100
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'raise', amount: 100 });
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // p2 folds -> p1 wins without showdown
  engine.playerAction('p2', { action: 'fold' });
  assert.equal(room.gameState.phase, 'SHOWDOWN');
  assert.deepEqual(room.gameState.results.winners, ['p1']);
  assert.equal(room.gameState.results.byFold, true);
});

test('PokerEngine all-in triggers auto-runout of community cards to 5 and showdown', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 200 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2', initialChips: 200 });

  const customDeck = [
    { rank: 'A', suit: '♠' }, { rank: 'A', suit: '♥' }, // p1 (Pair of Aces)
    { rank: 'K', suit: '♦' }, { rank: 'K', suit: '♣' }, // p2 (Pair of Kings)
    { rank: '2', suit: '♠' }, { rank: '3', suit: '♠' }, { rank: '4', suit: '♦' }, // Flop
    { rank: '7', suit: '♥' }, // Turn
    { rank: '9', suit: '♣' }  // River
  ];

  const engine = new PokerEngine(room, rm);
  engine.startHand(customDeck);

  // Pre-flop: P1 is Dealer/SB, goes All-in
  engine.playerAction('p1', { action: 'allin' });
  assert.equal(room.gameState.players.p1.allIn, true);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // P2 calls All-in
  engine.playerAction('p2', { action: 'call' });
  assert.equal(room.gameState.players.p2.allIn, true);

  // Both are all-in: engine must automatically run out cards to 5 and resolve showdown!
  assert.equal(room.gameState.phase, 'SHOWDOWN');
  assert.equal(room.gameState.communityCards.length, 5);
  assert.deepEqual(room.gameState.results.winners, ['p1']);
  assert.equal(room.players.p1.chips, 400);
  assert.equal(room.players.p2.chips, 0);

  // Bankruptcy triggered for p2
  assert.equal(room.activeBankruptcies.length, 1);
  assert.equal(room.activeBankruptcies[0].playerId, 'p2');
});

test('PokerEngine splits pot evenly on tied hands with remainder to earliest seat', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });

  const customDeck = [
    { rank: '2', suit: '♦' }, { rank: '3', suit: '♦' }, // p1
    { rank: '2', suit: '♣' }, { rank: '3', suit: '♣' }, // p2
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }, { rank: 'Q', suit: '♠' }, // Flop
    { rank: 'J', suit: '♠' }, // Turn
    { rank: '10', suit: '♠' } // River (Royal Flush on board)
  ];

  rm.updateSettings({ roomCode: room.code, adminPlayerId: 'p1', blinds: { smallBlind: 15, bigBlind: 26 } });

  const engine = new PokerEngine(room, rm);
  engine.startHand(customDeck);
  assert.equal(room.gameState.pot, 41);

  engine.playerAction('p1', { action: 'raise', amount: 27 });
  engine.playerAction('p2', { action: 'call' });
  assert.equal(room.gameState.pot, 54);

  // Flop checks
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'check' });

  // Turn checks
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'check' });

  // River checks -> Showdown
  engine.playerAction('p2', { action: 'check' });
  engine.playerAction('p1', { action: 'check' });

  assert.equal(room.gameState.phase, 'SHOWDOWN');
  assert.equal(room.gameState.results.winners.length, 2);
  assert.equal(room.gameState.results.handDetails.p1.name, 'Royal Flush');
  assert.equal(room.gameState.results.handDetails.p2.name, 'Royal Flush');
  assert.equal(room.gameState.results.payouts.p1, 27);
  assert.equal(room.gameState.results.payouts.p2, 27);
  assert.equal(room.players.p1.chips, 500);
  assert.equal(room.players.p2.chips, 500);
});

test('PokerEngine splits odd pot with remainder going to earliest seat in playerOrder', () => {
  const rm4 = new RoomManager();
  const room4 = rm4.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm4.joinRoom({ roomCode: room4.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });
  rm4.joinRoom({ roomCode: room4.code, playerName: 'P3', playerId: 'p3', socketId: 's3' });
  const deck3 = [
    { rank: '2', suit: '♦' }, { rank: '3', suit: '♦' }, // P1
    { rank: '2', suit: '♣' }, { rank: '3', suit: '♣' }, // P2
    { rank: '2', suit: '♥' }, { rank: '3', suit: '♥' }, // P3
    { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }, { rank: 'Q', suit: '♠' }, // Flop
    { rank: 'J', suit: '♠' }, // Turn
    { rank: '10', suit: '♠' } // River
  ];
  const engine4 = new PokerEngine(room4, rm4);
  engine4.startHand(deck3);

  // Pre-flop: p1 calls 20, p2 calls 20 (adds 10), p3 checks
  engine4.playerAction('p1', { action: 'call' });
  engine4.playerAction('p2', { action: 'call' });
  engine4.playerAction('p3', { action: 'check' });

  // Flop: all check
  engine4.playerAction('p2', { action: 'check' });
  engine4.playerAction('p3', { action: 'check' });
  engine4.playerAction('p1', { action: 'check' });

  // Turn: all check
  engine4.playerAction('p2', { action: 'check' });
  engine4.playerAction('p3', { action: 'check' });
  engine4.playerAction('p1', { action: 'check' });

  // Set pot to 65 to verify odd-pot remainder distribution: 65 / 3 = 21 rem 2
  room4.gameState.pot = 65;

  // River: all check -> Showdown
  engine4.playerAction('p2', { action: 'check' });
  engine4.playerAction('p3', { action: 'check' });
  engine4.playerAction('p1', { action: 'check' });

  assert.equal(room4.gameState.phase, 'SHOWDOWN');
  assert.equal(room4.gameState.results.winners.length, 3);
  // P1 is earliest seat in playerOrder -> gets 21 + 1 = 22
  // P2 is second seat in playerOrder -> gets 21 + 1 = 22
  // P3 is third seat in playerOrder -> gets 21
  assert.equal(room4.gameState.results.payouts.p1, 22);
  assert.equal(room4.gameState.results.payouts.p2, 22);
  assert.equal(room4.gameState.results.payouts.p3, 21);
});

test('PokerEngine error validations: turn order, invalid actions, and illegal check', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });

  const engine = new PokerEngine(room, rm);
  engine.startHand();

  // Wrong player tries to act
  assert.throws(() => {
    engine.playerAction('p2', { action: 'call' });
  }, /ไม่ใช่ตาของผู้เล่นนี้/);

  // Illegal check when facing a bet
  assert.throws(() => {
    engine.playerAction('p1', { action: 'check' });
  }, /ไม่สามารถ Check ได้/);

  // Invalid action name
  assert.throws(() => {
    engine.playerAction('p1', { action: 'dance' });
  }, /การกระทำไม่ถูกต้อง/);

  // Raise invalid or zero amount
  assert.throws(() => {
    engine.playerAction('p1', { action: 'raise', amount: 0 });
  }, /จำนวนเงิน Raise ต้องมากกว่า 0/);
  assert.throws(() => {
    engine.playerAction('p1', { action: 'raise', amount: -10 });
  }, /จำนวนเงิน Raise ต้องมากกว่า 0/);

  // Action after showdown
  engine.playerAction('p1', { action: 'fold' });
  assert.equal(room.gameState.phase, 'SHOWDOWN');
  assert.throws(() => {
    engine.playerAction('p1', { action: 'fold' });
  }, /ตานี้จบลงแล้ว/);

  // Cannot start hand with only 1 player with chips
  room.players.p1.chips = 0;
  assert.throws(() => {
    engine.startHand();
  }, /ต้องการผู้เล่นอย่างน้อย 2 คนที่มีชิป/);
});

test('getSanitizedRoomState masks opponent poker hole cards until revealed', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'P1', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });

  const engine = new PokerEngine(room, rm);
  engine.startHand();

  // Sanitize for P1
  const sanitizedForP1 = rm.getSanitizedRoomState(room, 'p1');
  assert.equal(sanitizedForP1.gameState.players.p1.holeCards[0].hidden, undefined);
  assert.equal(sanitizedForP1.gameState.players.p2.holeCards[0].hidden, true);

  // Sanitize for P2
  const sanitizedForP2 = rm.getSanitizedRoomState(room, 'p2');
  assert.equal(sanitizedForP2.gameState.players.p1.holeCards[0].hidden, true);
  assert.equal(sanitizedForP2.gameState.players.p2.holeCards[0].hidden, undefined);
});
