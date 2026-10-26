const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager, DEFAULT_PAYOUTS, DEFAULT_BLINDS, DEFAULT_PUNISHMENTS } = require('../src/roomManager');

test('Admin can create room, players can join and reconnect without losing chips', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1', initialChips: 1000 });
  assert.match(room.code, /^\d{4}$/);
  assert.equal(room.players['p-admin'].isAdmin, true);
  assert.equal(room.players['p-admin'].chips, 1000);

  rm.joinRoom({ roomCode: room.code, playerName: 'Best', playerId: 'p-2', socketId: 's2' });
  rm.mintChips({ roomCode: room.code, adminPlayerId: 'p-admin', targetPlayerId: 'p-2', amount: 500 });
  assert.equal(room.players['p-2'].chips, 1500);

  // Reconnect with new socketId preserves chips
  rm.joinRoom({ roomCode: room.code, playerName: 'Best', playerId: 'p-2', socketId: 's2-new' });
  assert.equal(room.players['p-2'].chips, 1500);
  assert.equal(room.players['p-2'].socketId, 's2-new');
});

test('Non-admin cannot mint chips or update payouts/settings', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1' });
  rm.joinRoom({ roomCode: room.code, playerName: 'Best', playerId: 'p-2', socketId: 's2' });

  assert.throws(() => {
    rm.mintChips({ roomCode: room.code, adminPlayerId: 'p-2', targetPlayerId: 'p-2', amount: 1000 });
  }, /เฉพาะ Admin/);

  assert.throws(() => {
    rm.updateSettings({ roomCode: room.code, adminPlayerId: 'p-2', payouts: { pokdeng: { tong: 10 } } });
  }, /เฉพาะ Admin/);
});

test('Player dealer must pick rounds (3, 5, 10) and loses dealer immediately on bankruptcy', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'PlayerA', playerId: 'p-a', socketId: 's2' });
  rm.joinRoom({ roomCode: room.code, playerName: 'PlayerB', playerId: 'p-b', socketId: 's3' });

  assert.throws(() => {
    rm.setDealerMode({ roomCode: room.code, playerId: 'p-admin', mode: 'player', rounds: 0 });
  }, /ต้องเลือกจำนวนตา/);

  rm.setDealerMode({ roomCode: room.code, playerId: 'p-admin', mode: 'player', rounds: 5 });
  assert.equal(room.dealer.mode, 'player');
  assert.equal(room.dealer.playerId, 'p-admin');
  assert.equal(room.dealer.roundsLeft, 5);

  // PlayerA and PlayerB each win 400 from dealer (total 800 > dealer's 500 chips)
  const result = rm.settleDealerPayouts(room, { 'p-a': 400, 'p-b': 400 });
  assert.equal(room.players['p-admin'].chips, 0);
  assert.equal(room.players['p-a'].chips, 500 + 250);
  assert.equal(room.players['p-b'].chips, 500 + 250);
  assert.equal(result.dealerBankrupt, true);
  // Dealer tenure forcibly terminated despite 4 rounds remaining
  assert.equal(room.dealer.playerId, null);
  assert.equal(room.dealer.roundsLeft, 0);
  assert.equal(room.players['p-admin'].isBankrupt, true);
});

test('Admin can mint chips to ALL and bankruptcies are cleared', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1', initialChips: 100 });
  rm.joinRoom({ roomCode: room.code, playerName: 'PlayerA', playerId: 'p-a', socketId: 's2' });
  
  // Force bankrupt PlayerA
  room.players['p-a'].chips = 0;
  rm.checkAndTriggerBankruptcies(room);
  assert.equal(room.players['p-a'].isBankrupt, true);
  assert.equal(room.activeBankruptcies.length, 1);

  // Mint ALL
  rm.mintChips({ roomCode: room.code, adminPlayerId: 'p-admin', targetPlayerId: 'ALL', amount: 500 });
  assert.equal(room.players['p-a'].chips, 500);
  assert.equal(room.players['p-a'].isBankrupt, false);
  assert.equal(room.activeBankruptcies.length, 0);
});

test('Auto dealer mode settles wins and clamped losses without dealer bankruptcy', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1', initialChips: 500 });
  rm.joinRoom({ roomCode: room.code, playerName: 'PlayerA', playerId: 'p-a', socketId: 's2' });
  
  // p-admin loses 600 (only has 500), p-a wins 200
  const result = rm.settleDealerPayouts(room, { 'p-admin': -600, 'p-a': 200 });
  assert.equal(room.players['p-admin'].chips, 0);
  assert.equal(room.players['p-admin'].isBankrupt, true);
  assert.equal(room.players['p-a'].chips, 700);
  assert.equal(result.dealerBankrupt, false);
});

test('Player dealer normal round completion and collecting losses before paying winners', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1', initialChips: 100 });
  rm.joinRoom({ roomCode: room.code, playerName: 'PlayerA', playerId: 'p-a', socketId: 's2' });
  rm.joinRoom({ roomCode: room.code, playerName: 'PlayerB', playerId: 'p-b', socketId: 's3' });

  rm.setDealerMode({ roomCode: room.code, playerId: 'p-admin', mode: 'player', rounds: 3 });

  // PlayerA loses 100, PlayerB wins 150
  // Dealer starts with 100, collects 100 from PlayerA -> 200 chips. Dealer can easily pay 150 to PlayerB!
  const res = rm.settleDealerPayouts(room, { 'p-a': -100, 'p-b': 150 });
  assert.equal(res.dealerBankrupt, false);
  assert.equal(room.players['p-a'].chips, 0);
  assert.equal(room.players['p-b'].chips, 250);
  assert.equal(room.players['p-admin'].chips, 50); // 100 + 100 - 150 = 50
  assert.equal(room.dealer.roundsLeft, 2);
  assert.equal(room.dealer.mode, 'player');
});

test('drawPunishment uses custom rng, records lastPunishmentDraw, and acknowledgeBankruptcy works', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1' });
  
  const punishment = rm.drawPunishment({
    roomCode: room.code,
    playerId: 'p-admin',
    rng: () => 0.0 // picks index 0
  });
  assert.equal(punishment.text, room.settings.punishments[0]);
  assert.equal(punishment.playerName, 'Boss');
  assert.equal(room.lastPunishmentDraw.text, punishment.text);

  // Bankrupt player and ack
  room.players['p-admin'].chips = 0;
  rm.checkAndTriggerBankruptcies(room);
  assert.equal(room.activeBankruptcies.length, 1);
  rm.acknowledgeBankruptcy({ roomCode: room.code, playerId: 'p-admin' });
  assert.equal(room.activeBankruptcies.length, 0);
});

test('getSanitizedRoomState hides opponent unrevealed cards and attaches you info', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Boss', playerId: 'p-admin', socketId: 's1' });
  rm.joinRoom({ roomCode: room.code, playerName: 'Best', playerId: 'p-2', socketId: 's2' });

  room.gameState = {
    phase: 'PLAYER_TURN',
    deck: [{ rank: 'K', suit: '♠' }],
    hands: {
      'p-admin': {
        revealed: false,
        cards: [{ rank: '9', suit: '♥', value: 9 }, { rank: '8', suit: '♦', value: 8 }]
      },
      'p-2': {
        revealed: false,
        cards: [{ rank: 'A', suit: '♠', value: 1 }, { rank: '2', suit: '♣', value: 2 }]
      }
    }
  };

  const stateForP2 = rm.getSanitizedRoomState(room, 'p-2');
  assert.equal(stateForP2.you.playerId, 'p-2');
  // P2 can see their own cards
  assert.equal(stateForP2.gameState.hands['p-2'].cards[0].rank, 'A');
  // P2 cannot see p-admin unrevealed cards
  assert.equal(stateForP2.gameState.hands['p-admin'].cards[0].hidden, true);
  assert.equal(stateForP2.gameState.hands['p-admin'].cards[0].rank, undefined);
  // Deck should not be leaked to client
  assert.equal(stateForP2.gameState.deck, undefined);
});

test('Additional edge cases: dealer tenure ends at 0 rounds, odd remainder distribution, and invalid operations', () => {
  const rm = new RoomManager();
  const room = rm.createRoom({ hostName: 'Host', playerId: 'p1', socketId: 's1', initialChips: 101 });
  rm.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2', socketId: 's2' });
  rm.joinRoom({ roomCode: room.code, playerName: 'P3', playerId: 'p3', socketId: 's3' });

  // Cannot join invalid room
  assert.throws(() => {
    rm.joinRoom({ roomCode: '999999', playerName: 'Ghost', playerId: 'px', socketId: 'sx' });
  }, /ไม่พบห้อง/);

  // Bankrupt player cannot become dealer
  room.players['p1'].chips = 0;
  assert.throws(() => {
    rm.setDealerMode({ roomCode: room.code, playerId: 'p1', mode: 'player', rounds: 3 });
  }, /ชิปไม่เพียงพอ/);

  // Mint chips back
  rm.mintChips({ roomCode: room.code, adminPlayerId: 'p1', targetPlayerId: 'p1', amount: 101 });
  assert.equal(room.players['p1'].chips, 101);

  // Test dealer mode with 3 rounds
  rm.setDealerMode({ roomCode: room.code, playerId: 'p1', mode: 'player', rounds: 3 });
  assert.equal(room.dealer.roundsLeft, 3);

  // Odd remainder distribution test:
  // p1 has 101 chips, p2 and p3 both win 100 chips (total 200 > 101).
  // 101 * (100 / 200) = floor(50.5) = 50 each. Remainder = 1 chip.
  // Seat order is ['p1', 'p2', 'p3']. Between winners 'p2' and 'p3', 'p2' comes first in playerOrder!
  // So 'p2' gets 50 + 1 = 51 chips. 'p3' gets 50 chips.
  // p2 started with 101 chips -> 101 + 51 = 152
  // p3 started with 101 chips -> 101 + 50 = 151
  const settleRes = rm.settleDealerPayouts(room, { 'p2': 100, 'p3': 100 });
  assert.equal(settleRes.dealerBankrupt, true);
  assert.equal(room.players['p1'].chips, 0);
  assert.equal(room.players['p2'].chips, 101 + 51);
  assert.equal(room.players['p3'].chips, 101 + 50);

  // Switching activeGame resets gameState
  room.gameState = { round: 1 };
  rm.mintChips({ roomCode: room.code, adminPlayerId: 'p1', targetPlayerId: 'p1', amount: 500 });
  rm.updateSettings({ roomCode: room.code, adminPlayerId: 'p1', activeGame: 'blackjack' });
  assert.equal(room.settings.activeGame, 'blackjack');
  assert.equal(room.gameState, null);

  // Normal dealer rounds decrement to 0
  rm.setDealerMode({ roomCode: room.code, playerId: 'p1', mode: 'player', rounds: 3 });
  rm.settleDealerPayouts(room, { 'p2': 0 }); // round 1
  assert.equal(room.dealer.roundsLeft, 2);
  rm.settleDealerPayouts(room, { 'p2': 0 }); // round 2
  assert.equal(room.dealer.roundsLeft, 1);
  rm.settleDealerPayouts(room, { 'p2': 0 }); // round 3
  assert.equal(room.dealer.roundsLeft, 0);
  assert.equal(room.dealer.playerId, null);
  assert.equal(room.dealer.mode, 'auto');

  // disconnectPlayer
  const disconnected = rm.disconnectPlayer('s2');
  assert.equal(disconnected.player.playerId, 'p2');
  assert.equal(room.players['p2'].connected, false);
});
