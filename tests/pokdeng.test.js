const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluatePokDengHand, comparePokDengHands, PokDengEngine } = require('../src/games/pokdeng');
const { RoomManager } = require('../src/roomManager');

test('evaluatePokDengHand detects Pok 9 2-deng, Tong, Sian, Straight, and custom multipliers', () => {
  const custom = { normal: 1, deng2: 2, deng3: 4, straight: 3, sian: 3, tong: 7 };
  const pok9Deng = evaluatePokDengHand([
    { rank: 'A', suit: '♠', value: 1 },
    { rank: '8', suit: '♠', value: 8 }
  ], custom);
  assert.equal(pok9Deng.type, 'POK_9');
  assert.equal(pok9Deng.multiplier, 2);

  const tong = evaluatePokDengHand([
    { rank: '7', suit: '♠', value: 7 },
    { rank: '7', suit: '♥', value: 7 },
    { rank: '7', suit: '♦', value: 7 }
  ], custom);
  assert.equal(tong.type, 'TONG');
  assert.equal(tong.multiplier, 7);

  assert.equal(comparePokDengHands(pok9Deng, tong), 1); // Pok beats 3-card Tong
});

test('PokDengEngine runs full round with custom Admin payouts and settles chips', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Admin', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.updateSettings({ roomCode: room.code, adminPlayerId: 'p1', payouts: { pokdeng: { deng2: 3 } } });

  const engine = new PokDengEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 100);
  // Rig deck: p1 gets 4♠, 5♠ (Pok 9, 2-deng -> multiplier 3x), dealer gets 2♣, 3♦ (5 pts)
  engine.dealRound([
    { rank: '4', suit: '♠', value: 4 },
    { rank: '2', suit: '♣', value: 2 },
    { rank: '5', suit: '♠', value: 5 },
    { rank: '3', suit: '♦', value: 3 }
  ]);

  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.players['p1'].chips, 500 + 300); // Won 100 * 3x custom deng2 payout
});

test('evaluatePokDengHand comprehensive hand types and deng variations', () => {
  // Pok 8 with same rank (pair) -> 2-deng
  const pok8Pair = evaluatePokDengHand([
    { rank: '4', suit: '♠', value: 4 },
    { rank: '4', suit: '♥', value: 4 }
  ]);
  assert.equal(pok8Pair.type, 'POK_8');
  assert.equal(pok8Pair.multiplier, 2);
  assert.equal(pok8Pair.rankWeight, 800);

  // Pok 8 different suit & rank -> 1-deng
  const pok8Normal = evaluatePokDengHand([
    { rank: '5', suit: '♠', value: 5 },
    { rank: '3', suit: '♦', value: 3 }
  ]);
  assert.equal(pok8Normal.type, 'POK_8');
  assert.equal(pok8Normal.multiplier, 1);
  assert.equal(pok8Normal.rankWeight, 800);

  // Straight A-2-3
  const straightA23 = evaluatePokDengHand([
    { rank: 'A', suit: '♠', value: 1 },
    { rank: '2', suit: '♦', value: 2 },
    { rank: '3', suit: '♣', value: 3 }
  ]);
  assert.equal(straightA23.type, 'STRAIGHT');
  assert.equal(straightA23.multiplier, 3);
  assert.equal(straightA23.rankWeight, 603);

  // Straight Q-K-A (12-13-1)
  const straightQKA = evaluatePokDengHand([
    { rank: 'Q', suit: '♠', value: 12 },
    { rank: 'A', suit: '♥', value: 1 },
    { rank: 'K', suit: '♦', value: 13 }
  ]);
  assert.equal(straightQKA.type, 'STRAIGHT');
  assert.equal(straightQKA.multiplier, 3);
  assert.equal(straightQKA.rankWeight, 614);

  // Sian (J, Q, K non-straight, non-tong)
  const sian = evaluatePokDengHand([
    { rank: 'J', suit: '♠', value: 11 },
    { rank: 'J', suit: '♥', value: 11 },
    { rank: 'Q', suit: '♦', value: 12 }
  ]);
  assert.equal(sian.type, 'SIAN');
  assert.equal(sian.multiplier, 3);
  assert.equal(sian.rankWeight, 500);

  // Normal 3-card hand with 3 same suits -> 3-deng
  const deng3 = evaluatePokDengHand([
    { rank: '2', suit: '♠', value: 2 },
    { rank: '3', suit: '♠', value: 3 },
    { rank: '2', suit: '♠', value: 2 }
  ]);
  assert.equal(deng3.type, 'NORMAL');
  assert.equal(deng3.points, 7);
  assert.equal(deng3.multiplier, 3);
  assert.equal(deng3.rankWeight, 7);

  // Normal 2-card hand with pair -> 2-deng
  const pairNormal = evaluatePokDengHand([
    { rank: '3', suit: '♠', value: 3 },
    { rank: '3', suit: '♥', value: 3 }
  ]);
  assert.equal(pairNormal.type, 'NORMAL');
  assert.equal(pairNormal.points, 6);
  assert.equal(pairNormal.multiplier, 2);
});

test('comparePokDengHands compares ranking categories correctly', () => {
  const p9 = { rankWeight: 900 };
  const p8 = { rankWeight: 800 };
  const tongK = { rankWeight: 713 };
  const tong7 = { rankWeight: 707 };
  const stQKA = { rankWeight: 614 };
  const sian = { rankWeight: 500 };
  const norm9 = { rankWeight: 9 };
  const norm7 = { rankWeight: 7 };

  assert.equal(comparePokDengHands(p9, p8), 1);
  assert.equal(comparePokDengHands(p8, tongK), 1);
  assert.equal(comparePokDengHands(tongK, tong7), 1);
  assert.equal(comparePokDengHands(tong7, stQKA), 1);
  assert.equal(comparePokDengHands(stQKA, sian), 1);
  assert.equal(comparePokDengHands(sian, norm9), 1);
  assert.equal(comparePokDengHands(norm9, norm7), 1);
  assert.equal(comparePokDengHands(norm7, norm7), 0); // Tie
  assert.equal(comparePokDengHands(norm7, norm9), -1);
});

test('PokDengEngine player turns and auto dealer draws when points < 5', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });

  const engine = new PokDengEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 100);
  engine.placeBet('p2', 50);

  // Rig deck:
  // p1 gets 2♠, 2♥ (4 pts, not Pok)
  // p2 gets 3♠, 4♦ (7 pts, not Pok)
  // dealer gets 1♣, 2♦ (3 pts, < 5 pts, not Pok)
  // p1 draws: 5♠ (4 + 5 = 9 pts)
  // dealer auto-draws: 4♣ (3 + 4 = 7 pts)
  const customDeck = [
    { rank: '2', suit: '♠', value: 2 }, // p1 c1
    { rank: '3', suit: '♠', value: 3 }, // p2 c1
    { rank: 'A', suit: '♣', value: 1 }, // dealer c1 (1 pt)
    { rank: '2', suit: '♥', value: 2 }, // p1 c2 (total 4 pts)
    { rank: '4', suit: '♦', value: 4 }, // p2 c2 (total 7 pts)
    { rank: '2', suit: '♦', value: 2 }, // dealer c2 (total 3 pts)
    { rank: '5', suit: '♠', value: 5 }, // drawn by p1 (4+5=9 pts, 1 deng)
    { rank: '4', suit: '♣', value: 4 }  // drawn by auto dealer (3+4=7 pts)
  ];

  engine.dealRound(customDeck);
  assert.equal(room.gameState.phase, 'PLAYER_TURN');

  // p1 draws 3rd card
  engine.playerAction('p1', 'draw');
  assert.equal(room.gameState.hands['p1'].cards.length, 3);
  assert.equal(room.gameState.hands['p1'].points, 9);
  assert.equal(room.gameState.phase, 'PLAYER_TURN'); // p2 still to act

  // p2 stands
  engine.playerAction('p2', 'stand');
  // All active players done -> transitions to DEALER_TURN -> auto dealer draws 4♣ (3 -> 7 pts) -> settles!
  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.cards.length, 3);
  assert.equal(room.gameState.dealerHand.points, 7);

  // p1 had 9 pts vs dealer 7 pts -> p1 wins 100 * 1 = +100
  assert.equal(room.players['p1'].chips, 500 + 100);
  // p2 had 7 pts vs dealer 7 pts -> tie (0)
  assert.equal(room.players['p2'].chips, 500);
});

test('PokDengEngine human dealer turn and player loss with dealer multiplier', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'DealerBoss', playerId: 'p-dealer', socketId: 's1', initialChips: 1000 });
  rm.joinRoom({ roomCode: room.code, playerName: 'Player1', playerId: 'p1', socketId: 's2' });
  rm.setDealerMode({ roomCode: room.code, playerId: 'p-dealer', mode: 'player', rounds: 3 });

  const engine = new PokDengEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 200);

  // Rig deck:
  // p1 gets 2♠, 2♥ (4 pts)
  // dealer gets 4♠, 4♦ (8 pts -> wait, let's make it 3♠, 3♦ = 6 pts 2-deng so not Pok)
  const customDeck = [
    { rank: '2', suit: '♠', value: 2 }, // p1 c1
    { rank: '3', suit: '♠', value: 3 }, // dealer c1
    { rank: '2', suit: '♥', value: 2 }, // p1 c2 (4 pts)
    { rank: '3', suit: '♦', value: 3 }, // dealer c2 (6 pts, 2-deng)
  ];

  engine.dealRound(customDeck);
  assert.equal(room.gameState.phase, 'PLAYER_TURN');

  engine.playerAction('p1', 'stand'); // p1 stands on 4 pts
  // Now phase should be DEALER_TURN waiting for human dealer
  assert.equal(room.gameState.phase, 'DEALER_TURN');

  // Human dealer chooses to stand on 6 pts 2-deng
  engine.dealerAction('stand');
  assert.equal(room.gameState.phase, 'SETTLED');

  // Dealer 6 pts (2-deng -> multiplier 2x) vs p1 4 pts -> Dealer wins!
  // p1 loses 200 * 2 = 400 chips, given to dealer
  assert.equal(room.players['p1'].chips, 1000 - 400);
  assert.equal(room.players['p-dealer'].chips, 1000 + 400);
  assert.equal(room.dealer.roundsLeft, 2); // Decremented 1 round
});

test('PokDengEngine auto-bets for players who have chips if no bets placed', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 50 });
  const engine = new PokDengEngine(room, rm);
  engine.startBetting();

  // No bets placed manually. p1 has 50 chips -> auto-bet should be min(100, 50) = 50
  // Rig deck so p1 gets Pok 9, dealer gets 2 pts
  engine.dealRound([
    { rank: '4', suit: '♠', value: 4 },
    { rank: '2', suit: '♣', value: 2 },
    { rank: '5', suit: '♦', value: 5 },
    { rank: 'K', suit: '♦', value: 13 }
  ]);

  assert.equal(room.gameState.bets['p1'], 50);
  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.players['p1'].chips, 50 + 50);
});

test('PokDengEngine dealer Pok immediately settles round and dealer auto-stands when >= 5 pts', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new PokDengEngine(room, rm);

  // Case 1: Dealer Pok 9 immediately settles, player with 5 pts cannot draw
  engine.startBetting();
  engine.placeBet('p1', 100);
  engine.dealRound([
    { rank: '2', suit: '♠', value: 2 }, // p1 c1
    { rank: '5', suit: '♠', value: 5 }, // dealer c1
    { rank: '3', suit: '♦', value: 3 }, // p1 c2 (5 pts)
    { rank: '4', suit: '♠', value: 4 }  // dealer c2 (9 pts -> Pok 9 2-deng)
  ]);
  assert.equal(room.gameState.phase, 'SETTLED');
  // Player lost 100 * dealer 2-deng = 200 chips
  assert.equal(room.players['p1'].chips, 500 - 200);

  // Case 2: Dealer has >= 5 pts and auto-stands without drawing
  engine.startBetting();
  engine.placeBet('p1', 100);
  engine.dealRound([
    { rank: '2', suit: '♠', value: 2 }, // p1 c1
    { rank: '3', suit: '♠', value: 3 }, // dealer c1
    { rank: '4', suit: '♦', value: 4 }, // p1 c2 (6 pts)
    { rank: '3', suit: '♦', value: 3 }  // dealer c2 (6 pts >= 5)
  ]);
  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  engine.playerAction('p1', 'stand');
  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.cards.length, 2); // Did not draw 3rd card
});

test('PokDengEngine error handling and edge cases', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 500 });
  const engine = new PokDengEngine(room, rm);

  assert.throws(() => evaluatePokDengHand([]), /ไพ่ต้องมีอย่างน้อย 2 ใบ/);
  assert.throws(() => evaluatePokDengHand(null), /ไพ่ต้องมีอย่างน้อย 2 ใบ/);

  // Betting errors
  assert.throws(() => engine.placeBet('p1', 100), /ไม่อยู่ในรอบวางเดิมพัน/);
  engine.startBetting();
  assert.throws(() => engine.placeBet('unknown', 100), /ไม่พบผู้เล่น/);
  assert.throws(() => engine.placeBet('p1', 0), /จำนวนเดิมพันไม่ถูกต้อง/);
  assert.throws(() => engine.placeBet('p1', -50), /จำนวนเดิมพันไม่ถูกต้อง/);
  assert.throws(() => engine.placeBet('p1', 1000), /จำนวนเดิมพันไม่ถูกต้อง/);

  // Human dealer cannot bet
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });
  rm.setDealerMode({ roomCode: room.code, playerId: 'p1', mode: 'player', rounds: 3 });
  assert.throws(() => engine.placeBet('p1', 50), /เจ้ามือไม่ต้องวางเดิมพัน/);

  // Human dealer action draw 3rd card
  rm.joinRoom({ roomCode: room.code, playerName: 'P3', playerId: 'p3', socketId: 's3' });
  engine.placeBet('p2', 100);
  engine.placeBet('p3', 100);
  engine.dealRound([
    { rank: '2', suit: '♠', value: 2 }, // p2 c1
    { rank: '3', suit: '♠', value: 3 }, // p3 c1
    { rank: '2', suit: '♣', value: 2 }, // dealer c1
    { rank: '4', suit: '♦', value: 4 }, // p2 c2 (6 pts)
    { rank: '2', suit: '♥', value: 2 }, // p3 c2 (5 pts)
    { rank: '2', suit: '♥', value: 2 }, // dealer c2 (4 pts)
    { rank: '2', suit: '♦', value: 2 }  // drawn card
  ]);
  assert.equal(room.gameState.phase, 'PLAYER_TURN');
  assert.throws(() => engine.playerAction('p2', 'invalid'), /คำสั่งไม่ถูกต้อง/);
  engine.playerAction('p2', 'stand');
  // p3 hasn't acted yet, so phase is still PLAYER_TURN: p2 acting again throws duplicate action error
  assert.throws(() => engine.playerAction('p2', 'stand'), /ผู้เล่นดำเนินการในตานี้ไปแล้ว/);
  engine.playerAction('p3', 'stand');

  assert.equal(room.gameState.phase, 'DEALER_TURN');
  assert.throws(() => engine.dealerAction('invalid'), /คำสั่งไม่ถูกต้อง/);
  engine.dealerAction('draw'); // Dealer draws 2♦ -> 2+2+2 = 6 pts (ตอง 2!)
  assert.equal(room.gameState.phase, 'SETTLED');
  assert.equal(room.gameState.dealerHand.type, 'TONG');

  // Mandatory draw on < 4 points and empty deck guard
  rm.mintChips({ roomCode: room.code, adminPlayerId: 'p1', targetPlayerId: 'p2', amount: 500 });
  engine.startBetting();
  engine.placeBet('p2', 100);
  engine.dealRound([
    { rank: 'A', suit: '♠', value: 1 }, // p2 c1
    { rank: '2', suit: '♣', value: 2 }, // dealer c1
    { rank: '2', suit: '♦', value: 2 }, // p2 c2 (3 pts < 4)
    { rank: '3', suit: '♥', value: 3 }, // dealer c2 (5 pts)
    { rank: '4', suit: '♠', value: 4 }  // 1 card left in deck
  ]);
  assert.throws(() => engine.playerAction('p2', 'stand'), /แต้มน้อยกว่า 4 บังคับจั่วไพ่เพิ่ม/);
  engine.playerAction('p2', 'draw');
  assert.equal(room.gameState.phase, 'DEALER_TURN');
  // Deck is now empty; human dealer attempting to draw safely stands and settles
  engine.dealerAction('draw');
  assert.equal(room.gameState.phase, 'SETTLED');
});

