const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../src/roomManager');
const { IrishPokerEngine } = require('../src/games/irishpoker');
const { PokerEngine } = require('../src/games/poker');

test('RoomManager initializes and updates custom payouts for all 5 games', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'HostAdmin', playerId: 'admin1', initialChips: 1000 });

  // Verify all 5 games have default payouts
  assert.ok(room.settings.payouts.pokdeng);
  assert.ok(room.settings.payouts.blackjack);
  assert.ok(room.settings.payouts.poker);
  assert.ok(room.settings.payouts.irishpoker);
  assert.ok(room.settings.payouts.realcards);

  // Update payouts for all 5 games
  rm.updateSettings({
    roomCode: room.code,
    adminPlayerId: 'admin1',
    payouts: {
      pokdeng: { tong: 10 },
      blackjack: { blackjack: 2.5, charlie5: 3 },
      poker: { rakePercent: 5 },
      irishpoker: { correct: 2, wrong: 1.5, allCorrectBonus: 5 },
      realcards: { banker: 1.0, tie: 10 }
    },
    blinds: { smallBlind: 25, bigBlind: 50 }
  });

  assert.equal(room.settings.payouts.pokdeng.tong, 10);
  assert.equal(room.settings.payouts.blackjack.blackjack, 2.5);
  assert.equal(room.settings.payouts.blackjack.charlie5, 3);
  assert.equal(room.settings.payouts.poker.rakePercent, 5);
  assert.equal(room.settings.payouts.irishpoker.correct, 2);
  assert.equal(room.settings.payouts.irishpoker.wrong, 1.5);
  assert.equal(room.settings.payouts.irishpoker.allCorrectBonus, 5);
  assert.equal(room.settings.payouts.realcards.banker, 1.0);
  assert.equal(room.settings.payouts.realcards.tie, 10);
  assert.equal(room.settings.blinds.smallBlind, 25);
  assert.equal(room.settings.blinds.bigBlind, 50);
});

test('IrishPokerEngine settles with custom payouts and allCorrectBonus', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Dealer', playerId: 'dealer', initialChips: 5000 });
  rm.joinRoom({ roomCode: room.code, playerName: 'Player1', playerId: 'p1', socketId: 's1' });
  room.players['p1'].chips = 1000;

  rm.updateSettings({
    roomCode: room.code,
    adminPlayerId: 'dealer',
    payouts: {
      irishpoker: { correct: 2, wrong: 1, allCorrectBonus: 4 }
    }
  });

  const engine = new IrishPokerEngine(room, rm);
  engine.startBetting();
  engine.placeBet('p1', 100);
  engine.dealRound();

  // Simulate 4 correct guesses for p1
  room.gameState.correct['p1'] = 4;
  room.gameState.wrong['p1'] = 0;

  // Settle round: net multiplier = (4 * 2) - (0 * 1) + 4 (bonus) = 12x
  const results = engine.settleRound();
  assert.equal(results.deltas['p1'], 100 * 12);
  assert.equal(room.players['p1'].chips, 1000 + 1200);
});

test('PokerEngine calculates custom house rake in pot payouts', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', initialChips: 1000 });
  rm.joinRoom({ roomCode: room.code, playerName: 'Player2', playerId: 'p2', socketId: 's2' });
  room.players['p2'].chips = 1000;

  rm.updateSettings({
    roomCode: room.code,
    adminPlayerId: 'p1',
    payouts: {
      poker: { rakePercent: 10 }
    }
  });

  const engine = new PokerEngine(room, rm);
  engine.startHand();
  // Blind total pot is 10 + 20 = 30
  const turnPlayer = room.gameState.currentTurnPlayerId;
  const otherPlayer = turnPlayer === 'p1' ? 'p2' : 'p1';
  engine.playerAction(turnPlayer, { action: 'fold' });
  // Total pot = 30, 10% rake = 3 chips, net payout = 27 chips
  assert.equal(room.gameState.results.rake, 3);
  assert.equal(room.gameState.results.payouts[otherPlayer], 27);
});
