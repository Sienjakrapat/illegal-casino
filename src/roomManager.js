const DEFAULT_PAYOUTS = {
  pokdeng: {
    normal: 1,
    deng2: 2,
    deng3: 3,
    straight: 3,
    sian: 3,
    tong: 5
  },
  blackjack: {
    normal: 1,
    blackjack: 1.5
  }
};

const DEFAULT_BLINDS = {
  smallBlind: 10,
  bigBlind: 20
};

const DEFAULT_PUNISHMENTS = [
  'ดื่มเพียว 1 ช็อต 🥃',
  'ดื่มหมดแก้ว! 🍺',
  'คนทางซ้ายสั่งดื่มอะไรก็ได้ 👉',
  'เล่าความลับ 1 เรื่อง หรือดื่ม 2 อึก 🤫',
  'ห้ามพูดคำหยาบ 3 ตา (หลุดดื่มทันที) 🙊'
];

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomCode() {
    let code;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
    } while (this.rooms.has(code));
    return code;
  }

  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(String(roomCode)) || null;
  }

  createRoom({ hostName, playerId, socketId, initialChips = 1000 }) {
    const code = this.generateRoomCode();
    const chips = Number(initialChips) || 1000;
    const room = {
      code,
      initialChips: chips,
      players: {
        [playerId]: {
          playerId,
          name: hostName,
          socketId,
          chips,
          isAdmin: true,
          isBankrupt: false,
          connected: true
        }
      },
      playerOrder: [playerId],
      dealer: {
        mode: 'auto',
        playerId: null,
        roundsLeft: 0
      },
      settings: {
        payouts: {
          pokdeng: { ...DEFAULT_PAYOUTS.pokdeng },
          blackjack: { ...DEFAULT_PAYOUTS.blackjack }
        },
        blinds: { ...DEFAULT_BLINDS },
        punishmentMode: 'verbal',
        punishments: [...DEFAULT_PUNISHMENTS],
        activeGame: 'pokdeng'
      },
      gameState: null,
      activeBankruptcies: [],
      lastPunishmentDraw: null
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom({ roomCode, playerName, playerId, socketId }) {
    const room = this.getRoom(roomCode);
    if (!room) {
      throw new Error('ไม่พบห้องที่ระบุ');
    }
    if (room.players[playerId]) {
      const existing = room.players[playerId];
      existing.socketId = socketId;
      if (playerName) existing.name = playerName;
      existing.connected = true;
      if (!room.playerOrder.includes(playerId)) {
        room.playerOrder.push(playerId);
      }
    } else {
      room.players[playerId] = {
        playerId,
        name: playerName,
        socketId,
        chips: room.initialChips,
        isAdmin: false,
        isBankrupt: false,
        connected: true
      };
      room.playerOrder.push(playerId);
    }
    return room;
  }

  mintChips({ roomCode, adminPlayerId, targetPlayerId, amount }) {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');
    const admin = room.players[adminPlayerId];
    if (!admin || !admin.isAdmin) {
      throw new Error('เฉพาะ Admin เท่านั้นที่สามารถแจกชิปได้');
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      throw new Error('จำนวนชิปไม่ถูกต้อง');
    }

    if (targetPlayerId === 'ALL') {
      for (const pid of Object.keys(room.players)) {
        const p = room.players[pid];
        p.chips += amt;
        if (p.chips > 0) {
          p.isBankrupt = false;
          room.activeBankruptcies = room.activeBankruptcies.filter(b => b.playerId !== pid);
        }
      }
    } else {
      const target = room.players[targetPlayerId];
      if (!target) throw new Error('ไม่พบผู้เล่นเป้าหมาย');
      target.chips += amt;
      if (target.chips > 0) {
        target.isBankrupt = false;
        room.activeBankruptcies = room.activeBankruptcies.filter(b => b.playerId !== targetPlayerId);
      }
    }
    return room;
  }

  updateSettings({ roomCode, adminPlayerId, payouts, blinds, punishmentMode, punishments, activeGame }) {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');
    const admin = room.players[adminPlayerId];
    if (!admin || !admin.isAdmin) {
      throw new Error('เฉพาะ Admin เท่านั้นที่สามารถเปลี่ยนการตั้งค่าได้');
    }
    if (payouts) {
      if (payouts.pokdeng) {
        room.settings.payouts.pokdeng = {
          ...room.settings.payouts.pokdeng,
          ...payouts.pokdeng
        };
      }
      if (payouts.blackjack) {
        room.settings.payouts.blackjack = {
          ...room.settings.payouts.blackjack,
          ...payouts.blackjack
        };
      }
    }
    if (blinds) {
      room.settings.blinds = {
        ...room.settings.blinds,
        ...blinds
      };
    }
    if (punishmentMode) {
      room.settings.punishmentMode = punishmentMode;
    }
    if (Array.isArray(punishments)) {
      room.settings.punishments = [...punishments];
    }
    if (activeGame) {
      if (room.settings.activeGame !== activeGame) {
        room.settings.activeGame = activeGame;
        room.gameState = null;
      }
    }
    return room;
  }

  setDealerMode({ roomCode, playerId, mode, rounds }) {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');

    if (mode === 'auto') {
      room.dealer = {
        mode: 'auto',
        playerId: null,
        roundsLeft: 0
      };
      return room;
    }

    if (mode === 'player') {
      const r = Number(rounds);
      if (![3, 5, 10].includes(r)) {
        throw new Error('ต้องเลือกจำนวนตา (3, 5 หรือ 10 ตา)');
      }
      const player = room.players[playerId];
      if (!player) {
        throw new Error('ไม่พบผู้เล่น');
      }
      if (player.chips <= 0) {
        throw new Error('ชิปไม่เพียงพอที่จะเป็นเจ้ามือ');
      }
      room.dealer = {
        mode: 'player',
        playerId,
        roundsLeft: r
      };
      return room;
    }

    throw new Error('โหมดเจ้ามือไม่ถูกต้อง');
  }

  settleDealerPayouts(roomOrCode, deltasByPlayerId = {}) {
    const room = typeof roomOrCode === 'string' ? this.getRoom(roomOrCode) : roomOrCode;
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');

    const settlements = {};
    const isPlayerDealer = room.dealer.mode === 'player' && Boolean(room.dealer.playerId);
    const dealerPlayer = isPlayerDealer ? room.players[room.dealer.playerId] : null;

    // 1. First, collect losses (delta < 0) from losing players
    for (const [pid, delta] of Object.entries(deltasByPlayerId)) {
      if (isPlayerDealer && pid === room.dealer.playerId) continue;
      const player = room.players[pid];
      if (!player) continue;

      if (delta < 0) {
        const loss = Math.abs(delta);
        const actualLoss = Math.min(player.chips, loss);
        player.chips -= actualLoss;
        settlements[pid] = -actualLoss;
        if (isPlayerDealer && dealerPlayer) {
          dealerPlayer.chips += actualLoss;
        }
      } else if (delta === 0) {
        settlements[pid] = 0;
      }
    }

    // 2. Next, pay winners (delta > 0)
    const winners = Object.entries(deltasByPlayerId).filter(([pid, delta]) => {
      if (isPlayerDealer && pid === room.dealer.playerId) return false;
      return delta > 0 && Boolean(room.players[pid]);
    });

    let dealerBankrupt = false;

    if (!isPlayerDealer || !dealerPlayer) {
      // Auto dealer: pay each winner in full
      for (const [pid, delta] of winners) {
        const player = room.players[pid];
        player.chips += delta;
        settlements[pid] = delta;
      }
    } else {
      // Player dealer
      const totalOwed = winners.reduce((sum, [, delta]) => sum + delta, 0);

      if (totalOwed === 0) {
        // Nothing owed
      } else if (dealerPlayer.chips >= totalOwed) {
        // Full payout from dealer
        for (const [pid, delta] of winners) {
          const player = room.players[pid];
          player.chips += delta;
          settlements[pid] = delta;
        }
        dealerPlayer.chips -= totalOwed;
      } else {
        // Dealer has less than totalOwed: proportional capped distribution
        const available = Math.max(0, dealerPlayer.chips);
        let allocatedTotal = 0;
        const payouts = {};

        for (const [pid, delta] of winners) {
          const proportional = Math.floor(available * (delta / totalOwed));
          payouts[pid] = proportional;
          allocatedTotal += proportional;
        }

        let remainder = available - allocatedTotal;
        const orderedWinnerPids = room.playerOrder.filter(pid => payouts[pid] !== undefined);
        for (const pid of Object.keys(payouts)) {
          if (!orderedWinnerPids.includes(pid)) orderedWinnerPids.push(pid);
        }

        let idx = 0;
        while (remainder > 0 && orderedWinnerPids.length > 0) {
          const pid = orderedWinnerPids[idx % orderedWinnerPids.length];
          payouts[pid] += 1;
          remainder -= 1;
          idx++;
        }

        for (const [pid] of winners) {
          const player = room.players[pid];
          const payout = payouts[pid] || 0;
          player.chips += payout;
          settlements[pid] = payout;
        }

        dealerPlayer.chips = 0;
      }

      // Decrement dealer rounds
      room.dealer.roundsLeft -= 1;

      if (dealerPlayer.chips === 0) {
        dealerBankrupt = true;
        dealerPlayer.isBankrupt = true;
        // Forcibly end dealer tenure immediately
        room.dealer.playerId = null;
        room.dealer.roundsLeft = 0;
        room.dealer.mode = 'auto';
      } else if (room.dealer.roundsLeft <= 0) {
        // Dealer tenure finished normally
        room.dealer.playerId = null;
        room.dealer.roundsLeft = 0;
        room.dealer.mode = 'auto';
      }
    }

    // 3. Scan and trigger bankruptcies
    this.checkAndTriggerBankruptcies(room);

    return { settlements, dealerBankrupt };
  }

  checkAndTriggerBankruptcies(roomOrCode) {
    const room = typeof roomOrCode === 'string' ? this.getRoom(roomOrCode) : roomOrCode;
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');

    if (!room.activeBankruptcies) {
      room.activeBankruptcies = [];
    }

    for (const player of Object.values(room.players)) {
      if (player.chips <= 0) {
        player.chips = 0;
        player.isBankrupt = true;
        const alreadyListed = room.activeBankruptcies.some(b => b.playerId === player.playerId);
        if (!alreadyListed) {
          const punishments = room.settings?.punishments || DEFAULT_PUNISHMENTS;
          const punishment = punishments[Math.floor(Math.random() * punishments.length)] || 'หมดตูด! ดื่ม 1 ช็อต 🥃';
          room.activeBankruptcies.push({
            playerId: player.playerId,
            name: player.name,
            punishment
          });
        }
      }
    }
    return room.activeBankruptcies;
  }

  drawPunishment({ roomCode, playerId, rng = Math.random }) {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');
    const player = room.players[playerId];
    const playerName = player?.name || 'ผู้เล่น';
    const list = room.settings?.punishments || DEFAULT_PUNISHMENTS;
    const idx = Math.floor(rng() * list.length);
    const text = list[idx] || list[0];
    const result = {
      playerId,
      playerName,
      text,
      timestamp: Date.now()
    };
    room.lastPunishmentDraw = result;
    return result;
  }

  acknowledgeBankruptcy({ roomCode, playerId }) {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');
    if (playerId) {
      room.activeBankruptcies = room.activeBankruptcies.filter(b => b.playerId !== playerId);
    } else {
      room.activeBankruptcies = [];
    }
    return room;
  }

  getSanitizedRoomState(roomOrCode, viewerPlayerId) {
    const room = typeof roomOrCode === 'string' ? this.getRoom(roomOrCode) : roomOrCode;
    if (!room) throw new Error('ไม่พบห้องที่ระบุ');

    const cloned = JSON.parse(JSON.stringify(room));
    cloned.you = cloned.players[viewerPlayerId] || null;

    if (cloned.gameState) {
      // Remove raw remaining deck array to prevent cheating
      if (cloned.gameState.deck) {
        cloned.gameState.deckCount = cloned.gameState.deck.length;
        delete cloned.gameState.deck;
      }

      // Mask hands for other players if not revealed
      if (cloned.gameState.hands) {
        for (const [pid, hand] of Object.entries(cloned.gameState.hands)) {
          if (pid !== viewerPlayerId && !hand.revealed) {
            if (Array.isArray(hand.cards)) {
              hand.cards = hand.cards.map(() => ({ hidden: true }));
            }
          }
        }
      }

      // Mask dealer hole card if not revealed
      if (cloned.gameState.dealerHand) {
        const isViewerDealer = room.dealer.mode === 'player' && room.dealer.playerId === viewerPlayerId;
        const dh = cloned.gameState.dealerHand;
        if (!isViewerDealer && !dh.revealed) {
          if (Array.isArray(dh.cards)) {
            dh.cards = dh.cards.map(c => (c.hidden ? { hidden: true } : c));
          }
        }
      }

      // Mask poker hole cards for opponents
      if (cloned.gameState.players) {
        for (const [pid, p] of Object.entries(cloned.gameState.players)) {
          if (pid !== viewerPlayerId && !p.revealed) {
            if (Array.isArray(p.holeCards)) {
              p.holeCards = p.holeCards.map(() => ({ hidden: true }));
            }
            if (Array.isArray(p.cards)) {
              p.cards = p.cards.map(() => ({ hidden: true }));
            }
          }
        }
      }
    }

    return cloned;
  }

  disconnectPlayer(socketId) {
    for (const room of this.rooms.values()) {
      for (const player of Object.values(room.players)) {
        if (player.socketId === socketId) {
          player.connected = false;
          return { room, player };
        }
      }
    }
    return null;
  }
}

module.exports = {
  RoomManager,
  DEFAULT_PAYOUTS,
  DEFAULT_BLINDS,
  DEFAULT_PUNISHMENTS
};
