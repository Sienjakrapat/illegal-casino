# คาสิโนเถื่อน (Party Casino Web App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time mobile-first multiplayer party casino web app ("คาสิโนเถื่อน") supporting shared room chips, Admin Panel (chip minting, game switching, customizable payouts/blinds, punishment modes), Player/Auto Dealer modes with mandatory round counts and instant bankruptcy termination, and 3 playable casino games (Pok Deng, Blackjack 21, Texas Hold'em Poker).

**Architecture:** Node.js + Express + Socket.IO server maintaining authoritative room state, player wallets, dealer state, punishment state, and game engines in memory, serving a responsive Dark Neon Casino mobile UI (`public/casino.html`, `public/casino.css`, `public/casino.js`) while preserving the existing display utility at `/display.html`.

**Tech Stack:** Node.js (v18+ built-in `node:test`), Express, Socket.IO (`socket.io` + `socket.io-client` for integration tests), Vanilla HTML5/CSS3/ES6+ JavaScript, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-10-27-party-casino-design.md`

## Global Constraints

- Develop inside the isolated worktree `D:\web\.worktrees\casino-party` on branch `casino-party`.
- Room codes are 4-digit numeric strings (`1000`–`9999`), default initial chips `1000`.
- Only the room Admin (`isAdmin: true`) can mint/grant chips, switch games, change punishment settings, or modify game payout multipliers/blinds via the Admin Panel.
- Dealer mode (for Pok Deng & Blackjack) lets players choose `auto` (Bot Dealer) or volunteer as `player` dealer with mandatory round selection (`3`, `5`, or `10` rounds).
- If a Player Dealer's chips hit `0` at the end of a round, their dealer tenure terminates immediately (`dealerId = null`, `dealerRoundsLeft = 0`) regardless of remaining rounds, and they enter `BANKRUPT` punishment state.
- Payouts when a Player Dealer cannot cover total winnings are capped at the dealer's available chips (distributed proportionally, floored to integers, with any remainder chip going to the earliest winning seat) so chips never go negative.
- Bankruptcy punishment supports two room-configurable modes: `verbal` (full-screen alert banner across all phones) and `random` (interactive wheel/card draw from a customizable punishment list).

## Review Focus

- **Player Dealer Bankruptcy Cap (`settleDealerPayouts`):** When multiple players beat a human dealer whose chips are less than total owed winnings, payouts must cap at the dealer's remaining balance, reduce the dealer to exactly `0` chips, immediately revoke dealer status, and trigger bankruptcy for the dealer.
- **Reconnection Identity (`joinOrReconnectPlayer`):** Refreshing a mobile browser or waking from sleep with an existing `playerId` in `localStorage` must rebind the new `socketId` without duplicating the player, losing their chips, or resetting their current hand.
- **Non-Admin Authorization Guard:** Any socket or state call attempting to mint chips, change payouts/blinds, or switch games from a non-admin `playerId` must throw an error and leave state unchanged.
- **Custom Payout Multiplier Application:** Changing Pok Deng (`normal`, `deng2`, `deng3`, `straight`, `sian`, `tong`) or Blackjack (`normal`, `blackjack`) multipliers in the Admin Panel must immediately govern the next round's settlement calculations.
- **Private Hole Cards Serialization (`getSanitizedRoomState`):** Broadcasting room state to clients must never leak unrevealed opponent hole cards or face-down dealer cards over the network.

---

### Task 1: Project Scaffolding & Card Deck Engine

**Files:**
- Create: `package.json`
- Create: `src/deck.js`
- Test: `tests/deck.test.js`

**Interfaces:**
- Produces:
  - `SUITS = ['♠', '♥', '♦', '♣']`
  - `RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']`
  - `createDeck() -> Array<{ suit: string, rank: string, value: number }>` (52 cards)
  - `shuffleDeck(deck: Array, rng?: () => number) -> Array`
  - `drawCards(deck: Array, count: number) -> Array` (mutates/pops from top of deck)

- [ ] **Step 1: Initialize `package.json` and install `express`, `socket.io`, and `socket.io-client`**

Create `package.json` with `"scripts": { "start": "node server.js", "test": "node --test tests/*.test.js" }` and install dependencies (`express`, `socket.io`, `socket.io-client`).

- [ ] **Step 2: Write the failing test in `tests/deck.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeck, shuffleDeck, drawCards } = require('../src/deck');

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/deck'`

- [ ] **Step 4: Implement `src/deck.js`**

Export `SUITS`, `RANKS`, `createDeck()`, Fisher-Yates `shuffleDeck(deck, rng = Math.random)`, and `drawCards(deck, count)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests passing)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/deck.js tests/deck.test.js
git commit -m "feat: initialize project and add card deck utilities"
```

---

### Task 2: Room State, Admin Panel Controls, Dealer Lifecycle & Punishment Engine

**Files:**
- Create: `src/roomManager.js`
- Test: `tests/roomManager.test.js`

**Interfaces:**
- Produces:
  - `RoomManager` class:
    - `createRoom({ hostName, playerId, socketId, initialChips = 1000 }) -> Room`
    - `joinRoom({ roomCode, playerName, playerId, socketId }) -> Room`
    - `mintChips({ roomCode, adminPlayerId, targetPlayerId, amount }) -> Room`
    - `updateSettings({ roomCode, adminPlayerId, payouts, blinds, punishmentMode, punishments, activeGame }) -> Room`
    - `setDealerMode({ roomCode, playerId, mode, rounds }) -> Room` (`mode`: `'auto' | 'player'`, `rounds`: `3 | 5 | 10`)
    - `settleDealerPayouts(room, deltasByPlayerId) -> { settlements: Object, dealerBankrupt: boolean }`
    - `checkAndTriggerBankruptcies(room) -> Array<{ playerId, name, punishment }>`
    - `drawPunishment({ roomCode, playerId, rng }) -> { playerId, playerName, text }`
    - `getSanitizedRoomState(room, viewerPlayerId) -> Object`

- [ ] **Step 1: Write the failing test in `tests/roomManager.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../src/roomManager');

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/roomManager'`

- [ ] **Step 3: Implement `src/roomManager.js`**

Implement `RoomManager` with default payouts (`pokdeng: { normal: 1, deng2: 2, deng3: 3, straight: 3, sian: 3, tong: 5 }`, `blackjack: { normal: 1, blackjack: 1.5 }`), default poker blinds (`{ smallBlind: 10, bigBlind: 20 }`), default Thai party punishments (`['ดื่มเพียว 1 ช็อต 🥃', 'ดื่มหมดแก้ว! 🍺', 'คนทางซ้ายสั่งดื่มอะไรก็ได้ 👉', 'เล่าความลับ 1 เรื่อง หรือดื่ม 2 อึก 🤫', 'ห้ามพูดคำหยาบ 3 ตา (หลุดดื่มทันที) 🙊']`), dealer round tracking, proportional cap on dealer bankruptcy, and `drawPunishment`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/roomManager.js tests/roomManager.test.js
git commit -m "feat: add room manager, admin controls, dealer tenure, and bankruptcy engine"
```

---

### Task 3: Pok Deng (ป๊อกเด้ง) Game Engine

**Files:**
- Create: `src/games/pokdeng.js`
- Test: `tests/pokdeng.test.js`

**Interfaces:**
- Consumes: `createDeck`, `shuffleDeck`, `drawCards` from `src/deck.js`; `room.settings.payouts.pokdeng` and `settleDealerPayouts` from `src/roomManager.js`
- Produces:
  - `evaluatePokDengHand(cards: Array, customPayouts?: Object) -> { type: string, points: number, multiplier: number, rankWeight: number, label: string }`
  - `comparePokDengHands(playerEval, dealerEval) -> number` (`1` player wins, `-1` dealer wins, `0` tie)
  - `PokDengEngine` class handling phases: `'BETTING' -> 'PLAYER_TURN' -> 'DEALER_TURN' -> 'SETTLED'`

- [ ] **Step 1: Write the failing test in `tests/pokdeng.test.js`**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/games/pokdeng'`

- [ ] **Step 3: Implement `src/games/pokdeng.js`**

Implement `evaluatePokDengHand`, `comparePokDengHands`, and `PokDengEngine` (`startBetting`, `placeBet`, `dealRound`, `playerAction(playerId, 'draw' | 'stand')`, `dealerAction('draw' | 'stand')`, `settleRound`). Auto-settle immediately if dealer has Pok 8/9 or all non-dealer players have Pok 8/9.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/pokdeng.js tests/pokdeng.test.js
git commit -m "feat: add Pok Deng game engine with customizable payouts"
```

---

### Task 4: Blackjack 21 (แบล็คแจ็ค) Game Engine

**Files:**
- Create: `src/games/blackjack.js`
- Test: `tests/blackjack.test.js`

**Interfaces:**
- Consumes: `createDeck`, `shuffleDeck`, `drawCards` from `src/deck.js`; `room.settings.payouts.blackjack` and `settleDealerPayouts` from `src/roomManager.js`
- Produces:
  - `evaluateBlackjackHand(cards: Array) -> { total: number, isBlackjack: boolean, isBust: boolean, isSoft: boolean }`
  - `BlackjackEngine` class handling phases: `'BETTING' -> 'PLAYER_TURN' -> 'DEALER_TURN' -> 'SETTLED'`

- [ ] **Step 1: Write the failing test in `tests/blackjack.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateBlackjackHand, BlackjackEngine } = require('../src/games/blackjack');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/games/blackjack'`

- [ ] **Step 3: Implement `src/games/blackjack.js`**

Implement `evaluateBlackjackHand` and `BlackjackEngine` (`startBetting`, `placeBet`, `dealRound`, `playerAction(playerId, 'hit' | 'stand' | 'double')`, `dealerAction('hit' | 'stand')`, `settleRound`). When `room.dealer.mode === 'auto'`, dealer hits automatically until `total >= 17`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/blackjack.js tests/blackjack.test.js
git commit -m "feat: add Blackjack 21 game engine with double down and custom payouts"
```

---

### Task 5: Texas Hold'em Poker (โป๊กเกอร์) Game Engine

**Files:**
- Create: `src/games/poker.js`
- Test: `tests/poker.test.js`

**Interfaces:**
- Consumes: `createDeck`, `shuffleDeck`, `drawCards` from `src/deck.js`; `room.settings.blinds` and `checkAndTriggerBankruptcies` from `src/roomManager.js`
- Produces:
  - `evaluateBestPokerHand(sevenCards: Array) -> { category: number, name: string, tiebreakers: Array<number> }`
  - `comparePokerHands(evalA, evalB) -> number`
  - `PokerEngine` class handling phases: `'PRE_FLOP' -> 'FLOP' -> 'TURN' -> 'RIVER' -> 'SHOWDOWN'`

- [ ] **Step 1: Write the failing test in `tests/poker.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateBestPokerHand, comparePokerHands, PokerEngine } = require('../src/games/poker');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../src/games/poker'`

- [ ] **Step 3: Implement `src/games/poker.js`**

Implement 7-card best-5 evaluator (`Royal Flush` down to `High Card` including `A-2-3-4-5` wheel straight) and `PokerEngine` supporting blinds, `fold`, `check`, `call`, `raise`, `allin`, street progression (`PRE_FLOP`, `FLOP`, `TURN`, `RIVER`, `SHOWDOWN`), pot distribution, and bankruptcy trigger at hand completion.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/games/poker.js tests/poker.test.js
git commit -m "feat: add Texas Hold'em Poker engine and 7-card evaluator"
```

---

### Task 6: Express + Socket.IO Real-Time Server & Card Sanitization

**Files:**
- Create: `server.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Consumes: `RoomManager`, `PokDengEngine`, `BlackjackEngine`, `PokerEngine`
- Produces:
  - `createCasinoServer()` returning `{ app, httpServer, io, roomManager }`
  - Socket events handled: `room:create`, `room:join`, `admin:mint`, `admin:updateSettings`, `dealer:set`, `game:startRound`, `game:placeBet`, `game:action`, `punishment:draw`, `punishment:ack`
  - Broadcast event: `room:state` (personalized per connected player so secret hole cards of other players are masked as `{ hidden: true }`)

- [ ] **Step 1: Write the failing test in `tests/server.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { io: Client } = require('socket.io-client');
const { createCasinoServer } = require('../server');

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
    }
  } finally {
    client1.close();
    client2.close();
    httpServer.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../server'`

- [ ] **Step 3: Implement `server.js`**

Implement Express static serving, Socket.IO event handlers, per-socket personalized `room:state` broadcasting (masking unrevealed cards of other players and face-down dealer cards), and start listening when `require.main === module`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js tests/server.test.js
git commit -m "feat: add Express and Socket.IO multiplayer server with card masking"
```

---

### Task 7: Mobile-First Underground Neon Casino UI, Admin Panel & Punishment Wheel

**Files:**
- Modify: `index.html` (replace with Underground Party Casino UI; move original solid display utility to `display.html` so nothing is lost)
- Create: `display.html` (preserve original `index.html` content)
- Create: `casino.css`
- Create: `casino.js`

**Interfaces:**
- Consumes: Socket.IO events (`room:create`, `room:join`, `admin:mint`, `admin:updateSettings`, `dealer:set`, `game:startRound`, `game:placeBet`, `game:action`, `punishment:draw`, `punishment:ack`) and `room:state` payload from `server.js`
- Produces:
  - Full mobile-first UI in `index.html` + `casino.css` + `casino.js`:
    - **Lobby View:** Create Room (set initial chips) or Join Room via 4-digit code / `?room=XXXX` URL link + QR Share modal.
    - **Top HUD:** Room Code badge, Active Game selector badge, Player's own Chip Balance, Dealer status badge (`Auto Dealer` or `เจ้ามือ: [Name] (เหลือ X ตา)`), and `⚙️ Admin Panel` button (visible only when `you.isAdmin === true`).
    - **Game Table Area:**
      - Dealer zone + Community Cards zone (for Poker) / Pot indicator.
      - Opponent seats around the table showing chip counts, bet badges, status (`ป๊อก 9`, `2 เด้ง`, `Bust`, `All-in`, `💀 ถังแตก`), and masked/revealed cards.
      - Player's own hand and contextual action dock:
        - Dealer selection modal (`บอทเป็นเจ้ามือ` vs `ฉันเป็นเจ้ามือ` with mandatory `3 ตา` / `5 ตา` / `10 ตา` buttons).
        - Betting chip buttons (`+50`, `+100`, `+500`, `เทหน้าตัก All-in`, `ล้าง`) + `ยืนยันเดิมพัน`.
        - Game-specific buttons: Pok Deng (`จั่วไพ่`, `อยู่`), Blackjack (`จั่ว (Hit)`, `อยู่ (Stand)`, `คูณสอง (Double)`), Poker (`หมอบ Fold`, `เช็ค/ตาม`, `เกทับ Raise`, `All-in`).
    - **Admin Panel Modal (Admin Only):**
      - **เสกชิป & ชุบชีวิต:** Select any player (or all players), quick buttons `+100`, `+500`, `+1000`, custom amount input, and `⚡ ชุบชีวิตคนถังแตก`.
      - **สลับเกม:** `ป๊อกเด้ง` | `แบล็คแจ็ค 21` | `โป๊กเกอร์ Texas Hold'em`.
      - **ปรับอัตราจ่าย & ค่าต๋ง (Custom Payouts & Blinds):** Inputs for Pok Deng (`ชนะปกติ`, `2 เด้ง`, `3 เด้ง`, `เรียง`, `เซียน`, `ตอง`), Blackjack (`ชนะปกติ`, `Blackjack 21`), and Poker (`Small Blind`, `Big Blind`).
      - **ตั้งค่าบทลงโทษ:** Toggle between `โหมดประกาศปากเปล่า (Verbal Alert)` and `โหมดสุ่มการ์ด/วงล้อ (Random Draw)` + add/remove custom punishment items.
    - **Bankruptcy Punishment Overlay:**
      - Full-screen flashing neon alert when any player hits `0` chips (including when a Player Dealer goes broke mid-tenure).
      - In `verbal` mode: giant siren alert banner naming the bankrupt player(s).
      - In `random` mode: interactive spinning/flipping punishment card drawer that reveals the randomized drinking punishment across everyone's phone simultaneously, plus an Admin quick-revive button (`เสกชิปให้เล่นต่อ`).
    - **Web Audio Synthesizer:** Built-in zero-dependency sound effects for card deal, chip bet, win fanfare, and bankruptcy siren.

- [ ] **Step 1: Move original `index.html` to `display.html` and create the new `index.html`, `casino.css`, and `casino.js`**

Implement the complete Thai-language Underground Neon Casino UI (`คาสิโนเถื่อน`), connecting all Socket.IO events, localStorage `playerId` persistence, URL `?room=` auto-fill, Admin Panel modal, Dealer round picker, and Bankruptcy Punishment modal.

- [ ] **Step 2: Write an automated smoke test in `tests/server.test.js` verifying `GET /` serves the Casino UI**

Add a test asserting `fetch('http://localhost:' + port + '/')` returns HTTP 200 and contains `คาสิโนเถื่อน` and `admin-panel-modal`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (all unit and server integration tests passing)

- [ ] **Step 4: Commit**

```bash
git add display.html index.html casino.css casino.js tests/server.test.js
git commit -m "feat: build mobile party casino UI, admin panel, and punishment modal"
```
