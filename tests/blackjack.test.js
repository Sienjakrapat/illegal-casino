const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateBlackjackHand, BlackjackEngine, DEFAULT_PAYOUTS } = require('../src/games/blackjack');
const { RoomManager } = require('../src/roomManager');

test('evaluateBlackjackHand handles soft/hard Aces and natural Blackjack', () => {
  const bj = evaluateBlackjackHand([{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }]);
  assert.equal(bj.total, 21);
  assert.equal(bj.isBlackjack, true);

  const hard = evaluateBlackjackHand([
    { rank: 'A', suit: '♠' },
    { rank: '9', suit: '♥' },
    { rank: '5', suit: '♦' }
  ]);
  assert.equal(hard.total, 15);
  assert.equal(hard.isBust, false);
});

test('BlackjackEngine supports Hit, Stand, Double Down and custom Admin Blackjack multiplier', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Admin', playerId: 'p1', socketId: 's1', initialChips: 1000 });
  rm.updateSettings({ roomCode: room.code, adminPlayerId: 'p1', payouts: { blackjack: { normal: 1, blackjack: 2 } } });

  const engine = new BlackjackEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 100);
  // p1 gets A♠, K♠ (Blackjack 21), dealer gets 9♣, 8♦ (17)
  engine.dealRound([
    { rank: 'A', suit: '♠' },
    { rank: '9', suit: '♣' },
    { rank: 'K', suit: '♠' },
    { rank: '8', suit: '♦' }
  ]);

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.players['p1'].chips, 1000 + 200); // 2x custom blackjack payout
});

test('evaluateBlackjackHand comprehensive evaluation of card values, soft hands, and bust', () => {
  // Face cards J, Q, K
  const faceCards = evaluateBlackjackHand([{ rank: 'J', suit: '♠' }, { rank: 'Q', suit: '♥' }]);
  assert.equal(faceCards.total, 20);
  assert.equal(faceCards.isBlackjack, false);
  assert.equal(faceCards.isSoft, false);
  assert.equal(faceCards.isBust, false);

  // Soft Ace (A + 6 = 17)
  const soft17 = evaluateBlackjackHand([{ rank: 'A', suit: '♦' }, { rank: '6', suit: '♣' }]);
  assert.equal(soft17.total, 17);
  assert.equal(soft17.isSoft, true);
  assert.equal(soft17.isBlackjack, false);

  // Two Aces (A + A = 12 soft)
  const twoAces = evaluateBlackjackHand([{ rank: 'A', suit: '♠' }, { rank: 'A', suit: '♥' }]);
  assert.equal(twoAces.total, 12);
  assert.equal(twoAces.isSoft, true);

  // Three Aces (A + A + A = 13 soft)
  const threeAces = evaluateBlackjackHand([
    { rank: 'A', suit: '♠' },
    { rank: 'A', suit: '♥' },
    { rank: 'A', suit: '♦' }
  ]);
  assert.equal(threeAces.total, 13);
  assert.equal(threeAces.isSoft, true);

  // Three-card 21 (7 + 7 + 7 = 21, not blackjack)
  const nonNatural21 = evaluateBlackjackHand([
    { rank: '7', suit: '♠' },
    { rank: '7', suit: '♥' },
    { rank: '7', suit: '♦' }
  ]);
  assert.equal(nonNatural21.total, 21);
  assert.equal(nonNatural21.isBlackjack, false);
  assert.equal(nonNatural21.isBust, false);

  // Bust hand
  const bust = evaluateBlackjackHand([
    { rank: '10', suit: '♠' },
    { rank: '8', suit: '♥' },
    { rank: '5', suit: '♦' }
  ]);
  assert.equal(bust.total, 23);
  assert.equal(bust.isBust, true);
  assert.equal(bust.label, 'ทะลุ (Bust)');
});

test('BlackjackEngine player Hit until 21 or Bust', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // Rig deck:
  // p1: 10♠, 6♥ (16)
  // dealer: 7♣, 9♦ (16)
  // remaining deck top: 5♠ (hits to 21)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '7', suit: '♣' },
    { rank: '6', suit: '♥' },
    { rank: '9', suit: '♦' },
    { rank: '5', suit: '♠' },
    { rank: '2', suit: '♦' } // dealer draw if needed
  ]);

  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  assert.equal(room.gameState.currentTurnPlayerId, 'p1');

  // Player hits and gets 5♠ -> 21!
  engine.playerAction('p1', 'hit');
  // Reaching 21 marks done = true, transitions to dealer turn.
  // Dealer has 16, auto dealer hits and draws 2♦ -> 18, stands.
  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.hands['p1'].total, 21);
  assert.equal(room.gameState.dealerHand.total, 18);
  // Player wins 1x normal payout (100)
  assert.equal(room.players['p1'].chips, 500 + 100);
});

test('BlackjackEngine player Stand and auto dealer hits until >= 17', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1: 10♠, 8♥ (18)
  // dealer: 6♣, 8♦ (14)
  // next cards: 2♠ (dealer hits to 16), 3♦ (dealer hits to 19)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '6', suit: '♣' },
    { rank: '8', suit: '♥' },
    { rank: '8', suit: '♦' },
    { rank: '2', suit: '♠' },
    { rank: '3', suit: '♦' }
  ]);

  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  engine.playerAction('p1', 'stand');

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.total, 19);
  // Dealer 19 beats player 18 -> player loses 100
  assert.equal(room.players['p1'].chips, 500 - 100);
});

test('BlackjackEngine player Double Down doubles bet and draws exactly one card', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1: 5♠, 6♥ (11)
  // dealer: 10♣, 7♦ (17)
  // next card for p1 double: 9♠ (total 20)
  engine.dealRound([
    { rank: '5', suit: '♠' },
    { rank: '10', suit: '♣' },
    { rank: '6', suit: '♥' },
    { rank: '7', suit: '♦' },
    { rank: '9', suit: '♠' }
  ]);

  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  engine.playerAction('p1', 'double');

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.bets['p1'], 200);
  assert.equal(room.gameState.hands['p1'].cards.length, 3);
  assert.equal(room.gameState.hands['p1'].total, 20);
  assert.equal(room.gameState.dealerHand.total, 17);
  // Won double bet: 200 * 1 = 200 chips gained
  assert.equal(room.players['p1'].chips, 500 + 200);
});

test('BlackjackEngine dealer busts: surviving player wins, busted player loses', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'Player 2', playerId: 'p2', socketId: 's2' });

  const engine = new BlackjackEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 50);
  engine.placeBet('p2', 50);

  // Dealing:
  // p1: 10♠, 5♥ (15)
  // p2: 10♦, 8♦ (18)
  // dealer: 6♣, 9♦ (15)
  // p1 hits with 10♣ -> 25 (bust)
  // dealer hits with 10♥ -> 25 (bust)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '10', suit: '♦' },
    { rank: '6', suit: '♣' },
    { rank: '5', suit: '♥' },
    { rank: '8', suit: '♦' },
    { rank: '9', suit: '♦' },
    { rank: '10', suit: '♣' }, // p1 draw -> bust
    { rank: '10', suit: '♥' }  // dealer draw -> bust
  ]);

  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  assert.equal(room.gameState.currentTurnPlayerId, 'p1');

  // p1 hits and busts
  engine.playerAction('p1', 'hit');
  assert.equal(room.gameState.hands['p1'].isBust, true);
  assert.equal(room.gameState.currentTurnPlayerId, 'p2');

  // p2 stands on 18
  engine.playerAction('p2', 'stand');

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.isBust, true);

  // p1 busted: loses 50
  assert.equal(room.players['p1'].chips, 500 - 50);
  // p2 survived dealer bust: wins 50
  assert.equal(room.players['p2'].chips, 500 + 50);
});

test('BlackjackEngine all players bust -> round settles immediately without dealer hit', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1: 10♠, 6♥ (16)
  // dealer: 5♣, 6♦ (11)
  // p1 hits: 10♦ (bust with 26)
  // next card in deck is 10♥ (if dealer hits, but shouldn't)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '5', suit: '♣' },
    { rank: '6', suit: '♥' },
    { rank: '6', suit: '♦' },
    { rank: '10', suit: '♦' },
    { rank: '10', suit: '♥' }
  ]);

  engine.playerAction('p1', 'hit');

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.hands['p1'].isBust, true);
  // Dealer cards remained 2 cards (dealer didn't hit on 11)
  assert.equal(room.gameState.dealerHand.cards.length, 2);
  assert.equal(room.gameState.dealerHand.revealed, true);
  assert.equal(room.players['p1'].chips, 500 - 100);
});

test('BlackjackEngine natural Blackjack push when both player and dealer have Blackjack', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1: A♠, K♠ (BJ)
  // dealer: A♦, Q♦ (BJ)
  engine.dealRound([
    { rank: 'A', suit: '♠' },
    { rank: 'A', suit: '♦' },
    { rank: 'K', suit: '♠' },
    { rank: 'Q', suit: '♦' }
  ]);

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.results.deltas['p1'], 0);
  assert.equal(room.players['p1'].chips, 500); // No chip change
});

test('BlackjackEngine dealer natural Blackjack beats non-blackjack player', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1: 10♠, 10♥ (20)
  // dealer: A♣, K♦ (BJ 21)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: 'A', suit: '♣' },
    { rank: '10', suit: '♥' },
    { rank: 'K', suit: '♦' }
  ]);

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.results.deltas['p1'], -100);
  assert.equal(room.players['p1'].chips, 500 - 100);
});

test('BlackjackEngine human dealer mode with hit and stand', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 1000 });
  rm.joinRoom({ roomCode: room.code, playerName: 'DealerPlayer', playerId: 'dealer1', socketId: 's2' });
  rm.setDealerMode({ roomCode: room.code, playerId: 'dealer1', mode: 'player', rounds: 3 });

  const engine = new BlackjackEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1: 10♠, 9♥ (19)
  // dealer: 8♣, 7♦ (15)
  // dealer hit card: 4♠ (19 -> push)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '8', suit: '♣' },
    { rank: '9', suit: '♥' },
    { rank: '7', suit: '♦' },
    { rank: '4', suit: '♠' }
  ]);

  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  engine.playerAction('p1', 'stand');

  // Now in DEALER_TURN
  assert.equal(room.gameState.phase, 'DEALER_TURN');
  // Human dealer hits
  engine.dealerAction('hit');
  assert.equal(room.gameState.dealerHand.total, 19);
  // Human dealer stands
  engine.dealerAction('stand');

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.results.deltas['p1'], 0);
});

test('BlackjackEngine auto-bets for players with chips when no bets placed', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 50 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  // Don't place bet manually
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '10', suit: '♣' },
    { rank: '9', suit: '♥' },
    { rank: '8', suit: '♦' }
  ]);

  // Auto bet 50 (min(100, 50))
  assert.equal(room.gameState.bets['p1'], 50);
});

test('BlackjackEngine validation errors and edge cases', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  // Cannot place bet before betting started
  assert.throws(() => engine.placeBet('p1', 100), /ไม่อยู่ในรอบวางเดิมพัน/);

  engine.startBetting();
  // Invalid bet amounts
  assert.throws(() => engine.placeBet('p1', 0), /จำนวนเดิมพันไม่ถูกต้อง/);
  assert.throws(() => engine.placeBet('p1', 600), /จำนวนเดิมพันไม่ถูกต้อง/);
  assert.throws(() => engine.placeBet('nonexistent', 100), /ไม่พบผู้เล่น/);

  engine.placeBet('p1', 300); // 300 bet, leaves 200 chips -> cannot double!

  // Deal round
  engine.dealRound([
    { rank: '5', suit: '♠' },
    { rank: '7', suit: '♣' },
    { rank: '6', suit: '♥' },
    { rank: '8', suit: '♦' }
  ]);

  // Double down requires player.chips >= bet * 2
  assert.throws(() => engine.playerAction('p1', 'double'), /ชิปไม่เพียงพอสำหรับ Double Down/);

  // Wrong turn order
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });
  assert.throws(() => engine.playerAction('p2', 'hit'), /ไม่พบมือของผู้เล่น|ยังไม่ถึงตาของผู้เล่นนี้/);

  // Invalid player action
  assert.throws(() => engine.playerAction('p1', 'surrender'), /คำสั่งไม่ถูกต้อง/);
});

test('BlackjackEngine auto dealer draw loop does not hang when deck is exhausted', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // Short custom deck with exactly 4 cards:
  // p1: 10♠, 8♥ (18)
  // dealer: 6♣, 7♦ (13 < 17, dealer needs to hit, but 0 cards remain in deck)
  engine.dealRound([
    { rank: '10', suit: '♠' },
    { rank: '6', suit: '♣' },
    { rank: '8', suit: '♥' },
    { rank: '7', suit: '♦' }
  ]);

  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  // p1 stands, triggers auto dealer turn
  engine.playerAction('p1', 'stand');

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.total, 13);
  assert.equal(room.gameState.dealerHand.cards.length, 2);
  // Player 18 beats dealer 13
  assert.equal(room.players['p1'].chips, 500 + 100);
});

test('BlackjackEngine auto dealer draw loop in dealRound does not hang with natural blackjack and exhausted deck', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new BlackjackEngine(room, rm);

  engine.startBetting();
  engine.placeBet('p1', 100);

  // p1 gets A♠, K♠ (BJ), dealer gets 5♣, 8♦ (13 < 17, 0 cards remain)
  engine.dealRound([
    { rank: 'A', suit: '♠' },
    { rank: '5', suit: '♣' },
    { rank: 'K', suit: '♠' },
    { rank: '8', suit: '♦' }
  ]);

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.total, 13);
  assert.equal(room.gameState.dealerHand.cards.length, 2);
  assert.equal(room.players['p1'].chips, 500 + 150);
});
