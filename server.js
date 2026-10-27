const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const { RoomManager } = require('./src/roomManager');
const { PokDengEngine } = require('./src/games/pokdeng');
const { BlackjackEngine } = require('./src/games/blackjack');
const { PokerEngine } = require('./src/games/poker');
const { RealCardsEngine } = require('./src/games/realcards');

function normalizeArgs(payload, callback) {
  if (typeof payload === 'function') {
    return [{}, payload];
  }
  return [payload || {}, typeof callback === 'function' ? callback : null];
}

function getAuthenticatedPlayer(room, socketId, playerId) {
  if (!room) throw new Error('ไม่พบห้องที่ระบุ');
  const player = room.players[playerId];
  if (!player || player.socketId !== socketId) {
    throw new Error('การยืนยันตัวตนไม่ถูกต้อง (Socket identity mismatch)');
  }
  return player;
}

function isRoundActivelyInProgress(room, allowEmptyBetting = false) {
  if (!room || !room.gameState) return false;
  const phase = room.gameState.phase;
  if (['SETTLED', 'SHOWDOWN'].includes(phase)) return false;
  if (allowEmptyBetting && phase === 'BETTING' && Object.keys(room.gameState.bets || {}).length === 0) {
    return false;
  }
  return true;
}

/**
 * Creates and configures the Express and Socket.IO server.
 * @returns {{ app: express.Express, httpServer: http.Server, io: Server, roomManager: RoomManager }}
 */
function createCasinoServer() {
  const app = express();
  app.use(express.static(__dirname));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const roomManager = new RoomManager();
  const engines = new Map();

  function getOrCreateEngine(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      throw new Error('ไม่พบห้องที่ระบุ');
    }
    const activeGame = room.settings?.activeGame || 'pokdeng';

    const entry = engines.get(roomCode);
    if (entry && entry.game === activeGame) {
      return entry.engine;
    }

    let engine;
    if (activeGame === 'pokdeng') {
      engine = new PokDengEngine(room, roomManager);
    } else if (activeGame === 'blackjack') {
      engine = new BlackjackEngine(room, roomManager);
    } else if (activeGame === 'poker') {
      engine = new PokerEngine(room, roomManager);
    } else if (activeGame === 'realcards') {
      engine = new RealCardsEngine(room, roomManager);
    } else {
      throw new Error(`ไม่รองรับเกม: ${activeGame}`);
    }

    Object.defineProperty(room, 'engine', {
      value: engine,
      writable: true,
      configurable: true,
      enumerable: false
    });

    engines.set(roomCode, { game: activeGame, engine });
    return engine;
  }

  function broadcastRoomState(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    for (const player of Object.values(room.players)) {
      if (player.socketId) {
        const sanitized = roomManager.getSanitizedRoomState(room, player.playerId);
        io.to(player.socketId).emit('room:state', sanitized);
      }
    }

    const socketsInRoom = io.sockets.adapter?.rooms?.get(roomCode);
    if (socketsInRoom) {
      const playerSocketIds = new Set(Object.values(room.players).map(p => p.socketId));
      for (const socketId of socketsInRoom) {
        if (!playerSocketIds.has(socketId)) {
          io.to(socketId).emit('room:state', roomManager.getSanitizedRoomState(room, null));
        }
      }
    }
  }

  io.on('connection', socket => {
    socket.on('room:create', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { hostName, playerId, initialChips } = payload;
        const finalPlayerId = playerId || socket.id;
        const room = roomManager.createRoom({
          hostName,
          playerId: finalPlayerId,
          socketId: socket.id,
          initialChips
        });
        socket.join(room.code);
        broadcastRoomState(room.code);
        callback?.({ ok: true, roomCode: room.code, playerId: finalPlayerId });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('room:join', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerName, playerId } = payload;
        const finalPlayerId = playerId || socket.id;
        const room = roomManager.joinRoom({
          roomCode,
          playerName,
          playerId: finalPlayerId,
          socketId: socket.id
        });
        socket.join(room.code);
        broadcastRoomState(room.code);
        callback?.({ ok: true, roomCode: room.code, playerId: finalPlayerId });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('admin:mint', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, targetPlayerId, amount } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        roomManager.mintChips({
          roomCode,
          adminPlayerId: playerId,
          targetPlayerId,
          amount
        });
        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('admin:updateSettings', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, payouts, blinds, punishmentMode, punishments, activeGame } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        const prevGame = room?.settings?.activeGame;

        roomManager.updateSettings({
          roomCode,
          adminPlayerId: playerId,
          payouts,
          blinds,
          punishmentMode,
          punishments,
          activeGame
        });

        if (activeGame && activeGame !== prevGame) {
          engines.delete(roomCode);
        }

        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('dealer:set', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, mode, rounds } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        roomManager.setDealerMode({ roomCode, playerId, mode, rounds });
        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('game:switchMode', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, activeGame, subGame } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);

        if (activeGame && activeGame !== room.settings.activeGame) {
          if (!['pokdeng', 'blackjack', 'poker', 'realcards'].includes(activeGame)) {
            throw new Error(`ไม่รองรับเกม: ${activeGame}`);
          }
          if (isRoundActivelyInProgress(room, true)) {
            throw new Error('ไม่สามารถสลับเกมระหว่างที่กำลังเล่นอยู่ได้');
          }
          room.settings.activeGame = activeGame;
          room.gameState = null;
          engines.delete(roomCode);
        }

        if (subGame) {
          room.settings.realCardsSubGame = subGame;
          if (room.gameState && room.gameState.game === 'realcards') {
            room.gameState.subGame = subGame;
          }
        }

        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('game:startRound', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, subGame } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        if (isRoundActivelyInProgress(room, true)) {
          throw new Error('ไม่สามารถเริ่มตาใหม่หรือสลับเกมระหว่างที่กำลังเล่นอยู่ได้');
        }

        const engine = getOrCreateEngine(roomCode);
        const game = room.settings?.activeGame || 'pokdeng';

        if (game === 'pokdeng' || game === 'blackjack') {
          engine.startBetting();
        } else if (game === 'realcards') {
          engine.startBetting(subGame);
        } else if (game === 'poker') {
          engine.startHand();
        } else {
          throw new Error(`ไม่รองรับเกม: ${game}`);
        }

        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('game:placeBet', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, amount, skip } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        const engine = getOrCreateEngine(roomCode);

        const isHumanDealer = (pid) => room.dealer?.mode === 'player' && room.dealer?.playerId === pid;
        const eligiblePids = (room.playerOrder || Object.keys(room.players || {})).filter(pid => {
          const p = room.players[pid];
          return p && p.chips > 0 && p.connected !== false && !isHumanDealer(pid);
        });

        if (skip || Number(amount) === 0) {
          const othersAllSkipped = eligiblePids.length > 0 && eligiblePids.every(
            pid => pid === playerId || room.gameState?.bets?.[pid] === 0
          );
          if (othersAllSkipped) {
            throw new Error('ต้องมีผู้เล่นลงเดิมพันอย่างน้อย 1 คนในตานี้');
          }
          engine.skipBet(playerId);
        } else {
          engine.placeBet(playerId, amount);
        }

        const allConfirmed = eligiblePids.length > 0 && eligiblePids.every(
          pid => typeof room.gameState?.bets?.[pid] === 'number'
        );
        const hasAtLeastOneBettor = eligiblePids.some(
          pid => (room.gameState?.bets?.[pid] || 0) > 0
        );
        if (allConfirmed && hasAtLeastOneBettor && room.gameState?.phase === 'BETTING') {
          engine.dealRound();
        }

        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('game:action', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, action, amount } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);

        const engine = getOrCreateEngine(roomCode);
        const game = room.settings?.activeGame || 'pokdeng';

        if (action === 'deal' && (game === 'pokdeng' || game === 'blackjack' || game === 'realcards')) {
          if (room.dealer?.mode === 'player' && room.dealer?.playerId !== playerId) {
            throw new Error('เฉพาะเจ้ามือเท่านั้นที่สามารถกดแจกไพ่ได้');
          }
          if (room.gameState?.phase === 'BETTING') {
            engine.dealRound();
          }
        } else if (game === 'realcards') {
          if (action === 'settle') {
            const isDealer = room.dealer?.mode === 'player' && room.dealer?.playerId === playerId;
            const isAdmin = Boolean(room.players[playerId]?.isAdmin);
            if (!isDealer && !isAdmin && room.dealer?.mode === 'player') {
              throw new Error('เฉพาะเจ้ามือหรือ Admin เท่านั้นที่กดสรุปผลทันทีได้');
            }
            engine.settleRound();
          } else if (action === 'setSubGame') {
            engine.setSubGame(payload.subGame);
          } else {
            engine.playerAction(playerId, payload);
          }
        } else if (game === 'pokdeng' || game === 'blackjack') {
          if (
            room.gameState?.phase === 'DEALER_TURN' &&
            room.dealer?.mode === 'player' &&
            room.dealer?.playerId === playerId
          ) {
            engine.dealerAction(action);
          } else {
            engine.playerAction(playerId, action);
          }
        } else if (game === 'poker') {
          engine.playerAction(playerId, { action, amount });
        } else {
          throw new Error(`ไม่รองรับเกม: ${game}`);
        }

        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('punishment:draw', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        const draw = roomManager.drawPunishment({ roomCode, playerId });
        io.to(roomCode).emit('punishment:drawn', draw);
        broadcastRoomState(roomCode);
        callback?.({ ok: true, draw });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('punishment:ack', (rawPayload, rawCb) => {
      const [payload, callback] = normalizeArgs(rawPayload, rawCb);
      try {
        const { roomCode, playerId, targetPlayerId } = payload;
        const room = roomManager.getRoom(roomCode);
        getAuthenticatedPlayer(room, socket.id, playerId);
        const ackTarget = targetPlayerId !== undefined ? targetPlayerId : playerId;
        roomManager.acknowledgeBankruptcy({ roomCode, playerId: ackTarget });
        broadcastRoomState(roomCode);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      const result = roomManager.disconnectPlayer(socket.id);
      if (result && result.room) {
        broadcastRoomState(result.room.code);
      }
    });
  });

  return { app, httpServer, io, roomManager };
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const { httpServer } = createCasinoServer();
  httpServer.listen(PORT, () => {
    console.log(`Casino server running on port ${PORT}`);
  });
}

module.exports = {
  createCasinoServer
};
