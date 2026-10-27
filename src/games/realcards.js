class RealCardsEngine {
  /**
   * @param {Object} room
   * @param {import('../roomManager').RoomManager} roomManager
   */
  constructor(room, roomManager) {
    this.room = room;
    this.roomManager = roomManager;
  }

  /**
   * Starts the betting phase for Real Cards mode.
   * @param {string} [subGame='pokdeng'] - 'pokdeng' | 'blackjack' | 'custom'
   */
  startBetting(subGame) {
    const prevSubGame = this.room.gameState?.subGame || this.room.settings?.realCardsSubGame || 'pokdeng';
    const chosenSubGame = subGame || prevSubGame;
    this.room.gameState = {
      game: 'realcards',
      subGame: chosenSubGame,
      phase: 'BETTING',
      bets: {},
      outcomes: {},
      activePlayers: [],
      results: null
    };
    return this.room.gameState;
  }

  /**
   * Sets the sub-game preset ('pokdeng' | 'blackjack' | 'custom') in Real Cards mode.
   * @param {string} subGame
   */
  setSubGame(subGame) {
    if (this.room.settings) {
      this.room.settings.realCardsSubGame = subGame;
    }
    if (this.room.gameState && this.room.gameState.game === 'realcards') {
      this.room.gameState.subGame = subGame;
    }
    return subGame;
  }

  /**
   * Places a chip bet for a player.
   * @param {string} playerId
   * @param {number} amount
   */
  placeBet(playerId, amount) {
    if (!this.room.gameState || this.room.gameState.phase !== 'BETTING') {
      throw new Error('ไม่อยู่ในรอบวางเดิมพัน');
    }
    const player = this.room.players[playerId];
    if (!player) {
      throw new Error('ไม่พบผู้เล่น');
    }
    if (this.room.dealer.mode === 'player' && this.room.dealer.playerId === playerId) {
      throw new Error('เจ้ามือไม่ต้องวางเดิมพัน');
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0 || amt > player.chips) {
      throw new Error('จำนวนเดิมพันไม่ถูกต้อง');
    }
    this.room.gameState.bets[playerId] = amt;
    return amt;
  }

  /**
   * Skips betting for this round (player sits out this hand).
   * @param {string} playerId
   */
  skipBet(playerId) {
    if (!this.room.gameState || this.room.gameState.phase !== 'BETTING') {
      throw new Error('ไม่อยู่ในรอบวางเดิมพัน');
    }
    const player = this.room.players[playerId];
    if (!player) {
      throw new Error('ไม่พบผู้เล่น');
    }
    if (this.room.dealer.mode === 'player' && this.room.dealer.playerId === playerId) {
      throw new Error('เจ้ามือไม่ต้องวางเดิมพัน');
    }
    this.room.gameState.bets[playerId] = 0;
    return 0;
  }

  /**
   * Transitions from BETTING to PLAYING (real physical cards are dealt on the table,
   * and players select their outcome & payout multiplier in the web app).
   */
  dealRound() {
    if (!this.room.gameState || this.room.gameState.phase !== 'BETTING') {
      throw new Error('ไม่สามารถเริ่มรอบไพ่จริงในสถานะนี้ได้');
    }

    const isHumanDealer = (pid) => this.room.dealer.mode === 'player' && this.room.dealer.playerId === pid;
    let activePids = this.room.playerOrder.filter(
      pid => (this.room.gameState.bets[pid] || 0) > 0 && !isHumanDealer(pid)
    );

    if (activePids.length === 0) {
      for (const pid of this.room.playerOrder) {
        if (isHumanDealer(pid)) continue;
        const player = this.room.players[pid];
        if (player && player.chips > 0 && this.room.gameState.bets[pid] !== 0) {
          this.room.gameState.bets[pid] = Math.min(100, player.chips);
        }
      }
      activePids = this.room.playerOrder.filter(
        pid => (this.room.gameState.bets[pid] || 0) > 0 && !isHumanDealer(pid)
      );
    }

    if (activePids.length === 0) {
      throw new Error('ไม่มีผู้เล่นที่ลงเดิมพันในตานี้');
    }

    this.room.gameState.activePlayers = [...activePids];
    this.room.gameState.outcomes = {};
    for (const pid of activePids) {
      this.room.gameState.outcomes[pid] = {
        outcome: null,
        multiplier: 1,
        delta: 0,
        label: 'รอเลือกผลไพ่จริง...',
        done: false
      };
    }

    this.room.gameState.phase = 'PLAYING';
    return this.room.gameState;
  }

  /**
   * Player records their real-card outcome and payout multiplier.
   * @param {string} playerId
   * @param {{ action?: string, outcome?: 'win' | 'lose' | 'tie', multiplier?: number, subGame?: string }} payload
   */
  playerAction(playerId, payload = {}) {
    if (payload && payload.action === 'setSubGame' && payload.subGame) {
      return this.setSubGame(payload.subGame);
    }

    if (!this.room.gameState || this.room.gameState.phase !== 'PLAYING') {
      throw new Error('ไม่อยู่ในรอบบันทึกผลไพ่จริง');
    }

    const entry = this.room.gameState.outcomes[playerId];
    if (!entry) {
      throw new Error('ผู้เล่นไม่ได้ร่วมลงเดิมพันในตานี้');
    }

    const outcome = payload.outcome || payload.action;
    if (!['win', 'lose', 'tie'].includes(outcome)) {
      throw new Error('ผลลัพธ์ไม่ถูกต้อง (ต้องเป็น win, lose หรือ tie)');
    }

    const rawMult = Number(payload.multiplier);
    const multiplier = (!Number.isNaN(rawMult) && rawMult > 0) ? rawMult : 1;
    const bet = this.room.gameState.bets[playerId] || 0;

    let delta = 0;
    let label = '🤝 เสมอ (0)';
    if (outcome === 'win') {
      delta = Math.ceil(bet * multiplier);
      label = `🏆 ชนะ (${multiplier}x)`;
    } else if (outcome === 'lose') {
      delta = -Math.ceil(bet * multiplier);
      label = `💸 แพ้ (${multiplier}x)`;
    }

    this.room.gameState.outcomes[playerId] = {
      outcome,
      multiplier,
      delta,
      label,
      done: true
    };

    const allDone = this.room.gameState.activePlayers.every(
      pid => this.room.gameState.outcomes[pid]?.done
    );
    if (allDone) {
      this.settleRound();
    }

    return this.room.gameState;
  }

  /**
   * Settles chips across all players and dealer based on recorded real-card outcomes.
   */
  settleRound() {
    if (!this.room.gameState) return null;

    const deltas = {};
    for (const pid of this.room.gameState.activePlayers || []) {
      const entry = this.room.gameState.outcomes?.[pid];
      deltas[pid] = entry && entry.done ? entry.delta : 0;
    }

    const settlementResult = this.roomManager.settleDealerPayouts(this.room, deltas);
    this.room.gameState.phase = 'SETTLED';
    this.room.gameState.results = {
      deltas,
      settlements: settlementResult.settlements,
      dealerBankrupt: settlementResult.dealerBankrupt
    };

    return this.room.gameState.results;
  }
}

module.exports = {
  RealCardsEngine
};
