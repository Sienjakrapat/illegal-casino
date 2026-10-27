const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { io: Client } = require('socket.io-client');
const { createCasinoServer } = require('../server');

function waitForEvent(client, event, filter = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, 5000);

    function handler(data) {
      if (filter(data)) {
        cleanup();
        resolve(data);
      }
    }

    function cleanup() {
      clearTimeout(timer);
      client.off(event, handler);
    }

    client.on(event, handler);
  });
}

test('Socket.IO server creates room, syncs bets, and hides opponent hole cards', async () => {
  const { httpServer } = createCasinoServer();
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  const client1 = Client(`http://localhost:${port}`);
  const client2 = Client(`http://localhost:${port}`);

  try {
    const createRes = await new Promise(resolve => {
      client1.emit('room:create', { hostName: 'AdminHost', playerId: 'p1', initialChips: 1000 }, resolve);
    });
    assert.equal(createRes.ok, true);
    const roomCode = createRes.roomCode;

    const joinRes = await new Promise(resolve => {
      client2.emit('room:join', { roomCode, playerName: 'Friend2', playerId: 'p2' }, resolve);
    });
    assert.equal(joinRes.ok, true);

    const statePromise = new Promise(resolve => {
      client2.on('room:state', state => {
        if (state.gameState && state.gameState.phase !== 'BETTING') resolve(state);
      });
    });

    await new Promise(r => client1.emit('game:startRound', { roomCode, playerId: 'p1' }, r));
    await new Promise(r => client1.emit('game:placeBet', { roomCode, playerId: 'p1', amount: 100 }, r));
    await new Promise(r => client2.emit('game:placeBet', { roomCode, playerId: 'p2', amount: 100 }, r));
    await new Promise(r => client1.emit('game:action', { roomCode, playerId: 'p1', action: 'deal' }, r));

    const stateForP2 = await statePromise;
    assert.equal(stateForP2.you.playerId, 'p2');
    // P2 sees their own cards, but P1's unrevealed cards are masked unless Pok
    const p1Hand = stateForP2.gameState.hands['p1'];
    if (!p1Hand.revealed) {
      assert.equal(p1Hand.cards[0].hidden, true);
      assert.equal(p1Hand.points, undefined);
      assert.equal(p1Hand.type, undefined);
      assert.equal(p1Hand.label, undefined);
      assert.equal(p1Hand.multiplier, undefined);
      assert.equal(p1Hand.rankWeight, undefined);
    }
  } finally {
    client1.close();
    client2.close();
    httpServer.close();
  }
});

test('Socket.IO admin mint, settings update, dealer mode, and error handling', async () => {
  const { httpServer } = createCasinoServer();
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  const clientAdmin = Client(`http://localhost:${port}`);
  const clientPlayer = Client(`http://localhost:${port}`);

  try {
    // 1. Create room
    const createRes = await new Promise(res => {
      clientAdmin.emit('room:create', { hostName: 'HostAdmin', initialChips: 500 }, res);
    });
    assert.equal(createRes.ok, true);
    const roomCode = createRes.roomCode;
    const adminId = createRes.playerId;

    // 2. Join room with default ID (socket.id fallback)
    const joinRes = await new Promise(res => {
      clientPlayer.emit('room:join', { roomCode, playerName: 'NormalPlayer' }, res);
    });
    assert.equal(joinRes.ok, true);
    const playerId = joinRes.playerId;

    // 3. Error on joining non-existent room
    const badJoinRes = await new Promise(res => {
      clientPlayer.emit('room:join', { roomCode: '999999', playerName: 'Fail' }, res);
    });
    assert.equal(badJoinRes.ok, false);
    assert.match(badJoinRes.error, /ไม่พบห้อง/);

    // 4. Admin mint chips
    const mintRes = await new Promise(res => {
      clientAdmin.emit('admin:mint', { roomCode, playerId: adminId, targetPlayerId: playerId, amount: 250 }, res);
    });
    assert.equal(mintRes.ok, true);

    // Non-admin mint attempt fails
    const badMintRes = await new Promise(res => {
      clientPlayer.emit('admin:mint', { roomCode, playerId, targetPlayerId: adminId, amount: 100 }, res);
    });
    assert.equal(badMintRes.ok, false);

    // 5. Admin updates settings and dealer mode
    const settingsRes = await new Promise(res => {
      clientAdmin.emit('admin:updateSettings', {
        roomCode,
        playerId: adminId,
        payouts: { pokdeng: { normal: 2 } },
        blinds: { smallBlind: 25, bigBlind: 50 },
        punishments: ['วิ่งรอบบ้าน', 'ดื่ม 1 แก้ว'],
        activeGame: 'pokdeng'
      }, res);
    });
    assert.equal(settingsRes.ok, true);

    const dealerRes = await new Promise(res => {
      clientAdmin.emit('dealer:set', { roomCode, playerId: adminId, mode: 'player', rounds: 5 }, res);
    });
    assert.equal(dealerRes.ok, true);

    // 6. Draw punishment and acknowledge bankruptcy
    const drawPromise = waitForEvent(clientPlayer, 'punishment:drawn');
    const drawAckPromise = new Promise(res => {
      clientAdmin.emit('punishment:draw', { roomCode, playerId }, res);
    });
    const [drawnEvent, drawAck] = await Promise.all([drawPromise, drawAckPromise]);
    assert.equal(drawAck.ok, true);
    assert.equal(drawnEvent.playerId, playerId);
    assert.ok(drawnEvent.text);

    const ackRes = await new Promise(res => {
      clientPlayer.emit('punishment:ack', { roomCode, playerId }, res);
    });
    assert.equal(ackRes.ok, true);
  } finally {
    clientAdmin.close();
    clientPlayer.close();
    httpServer.close();
  }
});

test('Blackjack gameplay through Socket.IO with card sanitization', async () => {
  const { httpServer } = createCasinoServer();
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  const client1 = Client(`http://localhost:${port}`);
  const client2 = Client(`http://localhost:${port}`);

  try {
    const createRes = await new Promise(r => client1.emit('room:create', { hostName: 'P1', playerId: 'p1', initialChips: 1000 }, r));
    const roomCode = createRes.roomCode;
    await new Promise(r => client2.emit('room:join', { roomCode, playerName: 'P2', playerId: 'p2' }, r));

    // Switch active game to blackjack
    const switchRes = await new Promise(r => client1.emit('admin:updateSettings', {
      roomCode,
      playerId: 'p1',
      activeGame: 'blackjack'
    }, r));
    assert.equal(switchRes.ok, true);

    // Start round and place bets
    await new Promise(r => client1.emit('game:startRound', { roomCode, playerId: 'p1' }, r));
    await new Promise(r => client1.emit('game:placeBet', { roomCode, playerId: 'p1', amount: 50 }, r));
    await new Promise(r => client2.emit('game:placeBet', { roomCode, playerId: 'p2', amount: 50 }, r));

    const dealPromise = waitForEvent(client2, 'room:state', s => s.gameState && s.gameState.phase !== 'BETTING');
    await new Promise(r => client1.emit('game:action', { roomCode, playerId: 'p1', action: 'deal' }, r));
    const dealState = await dealPromise;

    // Check dealer hole card sanitization
    const dh = dealState.gameState.dealerHand;
    if (!dh.revealed) {
      assert.equal(dh.cards[1].hidden, true);
      assert.equal(dh.total, undefined);
      assert.equal(dh.isBlackjack, undefined);
      assert.equal(dh.isSoft, undefined);
      assert.equal(dh.isBust, undefined);
      assert.equal(dh.label, undefined);
    }

    // P1 opponent hand sanitization for P2
    const p1Hand = dealState.gameState.hands['p1'];
    if (!p1Hand.revealed) {
      assert.equal(p1Hand.cards[0].hidden, true);
      assert.equal(p1Hand.total, undefined);
      assert.equal(p1Hand.label, undefined);
    }

    // Action test: Stand
    const currentPid = dealState.gameState.currentTurnPlayerId;
    if (currentPid) {
      const activeClient = currentPid === 'p1' ? client1 : client2;
      const actRes = await new Promise(r => activeClient.emit('game:action', {
        roomCode,
        playerId: currentPid,
        action: 'stand'
      }, r));
      assert.equal(actRes.ok, true);
    }
  } finally {
    client1.close();
    client2.close();
    httpServer.close();
  }
});

test('Texas Holdem Poker gameplay through Socket.IO with street betting and hole card masking', async () => {
  const { httpServer } = createCasinoServer();
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  const client1 = Client(`http://localhost:${port}`);
  const client2 = Client(`http://localhost:${port}`);

  try {
    const createRes = await new Promise(r => client1.emit('room:create', { hostName: 'P1', playerId: 'p1', initialChips: 1000 }, r));
    const roomCode = createRes.roomCode;
    await new Promise(r => client2.emit('room:join', { roomCode, playerName: 'P2', playerId: 'p2' }, r));

    // Switch game to poker
    await new Promise(r => client1.emit('admin:updateSettings', {
      roomCode,
      playerId: 'p1',
      activeGame: 'poker',
      blinds: { smallBlind: 10, bigBlind: 20 }
    }, r));

    const statePromise = waitForEvent(client2, 'room:state', s => s.gameState && s.gameState.phase === 'PRE_FLOP');
    await new Promise(r => client1.emit('game:startRound', { roomCode, playerId: 'p1' }, r));
    const pokerState = await statePromise;

    // Verify deck is not leaked and opponent hole cards are masked
    assert.equal(pokerState.gameState.deck, undefined);
    assert.equal(typeof pokerState.gameState.deckCount, 'number');

    const p1Poker = pokerState.gameState.players['p1'];
    assert.equal(p1Poker.holeCards[0].hidden, true);
    assert.equal(p1Poker.holeCards[1].hidden, true);
    assert.equal(p1Poker.hand, undefined);

    // P2 sees their own hole cards
    const p2Poker = pokerState.gameState.players['p2'];
    assert.ok(p2Poker.holeCards[0].rank);

    // Call / Fold action
    const turnPlayerId = pokerState.gameState.currentTurnPlayerId;
    assert.ok(turnPlayerId);
    const turnClient = turnPlayerId === 'p1' ? client1 : client2;

    const actionRes = await new Promise(r => turnClient.emit('game:action', {
      roomCode,
      playerId: turnPlayerId,
      action: 'call'
    }, r));
    assert.equal(actionRes.ok, true);
  } finally {
    client1.close();
    client2.close();
    httpServer.close();
  }
});

test('Socket disconnect updates player status and Express serves static files', async () => {
  const { httpServer } = createCasinoServer();
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  const client1 = Client(`http://localhost:${port}`);
  const client2 = Client(`http://localhost:${port}`);

  try {
    const createRes = await new Promise(r => client1.emit('room:create', { hostName: 'P1', playerId: 'p1' }, r));
    const roomCode = createRes.roomCode;
    await new Promise(r => client2.emit('room:join', { roomCode, playerName: 'P2', playerId: 'p2' }, r));

    const disconnectStatePromise = waitForEvent(client1, 'room:state', s => {
      return s.players && s.players['p2'] && s.players['p2'].connected === false;
    });

    client2.disconnect();
    const updatedState = await disconnectStatePromise;
    assert.equal(updatedState.players['p2'].connected, false);

    // Verify Express static file serving
    const html = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/index.html`, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }).on('error', reject);
    });

    assert.equal(html.statusCode, 200);
    assert.ok(html.body.length > 0);
  } finally {
    client1.close();
    client2.close();
    httpServer.close();
  }
});

test('getSanitizedRoomState strips all evaluation metadata from unrevealed opponent and dealer hands', () => {
  const { roomManager } = createCasinoServer();
  const room = roomManager.createRoom({ hostName: 'Host', playerId: 'p1' });
  roomManager.joinRoom({ roomCode: room.code, playerName: 'P2', playerId: 'p2' });

  // Simulate Pokdeng unrevealed hands
  room.gameState = {
    game: 'pokdeng',
    phase: 'PLAYER_TURN',
    hands: {
      p1: {
        cards: [{ rank: '9', suit: '♥' }, { rank: '8', suit: '♦' }],
        points: 7,
        type: 'NORMAL',
        label: '7 แต้ม',
        multiplier: 1,
        rankWeight: 7,
        revealed: false
      },
      p2: {
        cards: [{ rank: 'A', suit: '♠' }, { rank: '3', suit: '♣' }],
        points: 4,
        type: 'NORMAL',
        label: '4 แต้ม',
        multiplier: 1,
        rankWeight: 4,
        revealed: false
      }
    },
    dealerHand: {
      cards: [{ rank: 'K', suit: '♠', hidden: true }, { rank: '5', suit: '♥', hidden: true }],
      points: 5,
      type: 'NORMAL',
      label: '5 แต้ม',
      multiplier: 1,
      rankWeight: 5,
      revealed: false
    }
  };

  const p2View = roomManager.getSanitizedRoomState(room, 'p2');
  // P2 sees own hand evaluation
  assert.equal(p2View.gameState.hands.p2.points, 4);
  assert.equal(p2View.gameState.hands.p2.type, 'NORMAL');
  assert.equal(p2View.gameState.hands.p2.cards[0].rank, 'A');

  // P2 cannot see p1 evaluation metadata
  const p1Sanitized = p2View.gameState.hands.p1;
  assert.equal(p1Sanitized.cards[0].hidden, true);
  assert.equal(p1Sanitized.cards[0].rank, undefined);
  assert.equal(p1Sanitized.points, undefined);
  assert.equal(p1Sanitized.type, undefined);
  assert.equal(p1Sanitized.label, undefined);
  assert.equal(p1Sanitized.multiplier, undefined);
  assert.equal(p1Sanitized.rankWeight, undefined);

  // P2 cannot see dealer evaluation metadata
  const dhSanitized = p2View.gameState.dealerHand;
  assert.equal(dhSanitized.cards[0].hidden, true);
  assert.equal(dhSanitized.cards[0].rank, undefined);
  assert.equal(dhSanitized.points, undefined);
  assert.equal(dhSanitized.type, undefined);
  assert.equal(dhSanitized.label, undefined);
  assert.equal(dhSanitized.multiplier, undefined);
  assert.equal(dhSanitized.rankWeight, undefined);

  // Now test Blackjack metadata stripping
  room.gameState = {
    game: 'blackjack',
    phase: 'PLAYER_TURN',
    hands: {
      p1: {
        cards: [{ rank: '10', suit: '♥' }, { rank: '6', suit: '♦' }],
        total: 16,
        isBlackjack: false,
        isSoft: false,
        isBust: false,
        label: '16',
        revealed: false
      }
    },
    dealerHand: {
      cards: [{ rank: '10', suit: '♠' }, { rank: '7', suit: '♥', hidden: true }],
      total: 17,
      isBlackjack: false,
      isSoft: false,
      isBust: false,
      label: '17',
      revealed: false
    }
  };

  const p2BlackjackView = roomManager.getSanitizedRoomState(room, 'p2');
  const p1Bj = p2BlackjackView.gameState.hands.p1;
  assert.equal(p1Bj.cards[0].hidden, true);
  assert.equal(p1Bj.total, undefined);
  assert.equal(p1Bj.isBlackjack, undefined);
  assert.equal(p1Bj.isSoft, undefined);
  assert.equal(p1Bj.isBust, undefined);
  assert.equal(p1Bj.label, undefined);

  const dhBj = p2BlackjackView.gameState.dealerHand;
  assert.equal(dhBj.cards[0].rank, '10'); // upcard is visible
  assert.equal(dhBj.cards[1].hidden, true); // hole card hidden
  assert.equal(dhBj.cards[1].rank, undefined);
  assert.equal(dhBj.total, undefined);
  assert.equal(dhBj.isBlackjack, undefined);
  assert.equal(dhBj.isSoft, undefined);
  assert.equal(dhBj.isBust, undefined);
  assert.equal(dhBj.label, undefined);
});

