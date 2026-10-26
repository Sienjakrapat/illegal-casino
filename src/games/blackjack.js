const { createDeck, shuffleDeck, drawCards } = require('../deck');

const DEFAULT_PAYOUTS = {
  normal: 1,
  blackjack: 1.5
};

/**
 * Returns point value of a single card for Blackjack.
 * 2..10 = face value, J/Q/K = 10, A = 11 (initially).
 * @param {Object} card
 * @returns {number}
 */
function getCardBlackjackValue(card) {
  if (!card) return 0;
  const rank = String(card.rank);
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  const num = Number(rank);
  return Number.isNaN(num) ? (card.value || 0) : num;
}

/**
 * Evaluates a Blackjack hand.
 * @param {Array<{ suit: string, rank: string, value?: number }>} cards
 * @returns {{ total: number, isBlackjack: boolean, isBust: boolean, isSoft: boolean, label: string }}
 */
function evaluateBlackjackHand(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return {
      total: 0,
      isBlackjack: false,
      isBust: false,
      isSoft: false,
      label: '0 แต้ม'
    };
  }

  let total = 0;
  let softAces = 0;

  for (const card of cards) {
    const val = getCardBlackjackValue(card);
    total += val;
    if (String(card.rank) === 'A') {
      softAces += 1;
    }
  }

  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  const isBlackjack = cards.length === 2 && total === 21;
  const isBust = total > 21;
  const isSoft = softAces > 0 && total <= 21;

  let label = `${total} แต้ม`;
  if (isBlackjack) {
    label = 'Blackjack 21!';
  } else if (isBust) {
    label = 'ทะลุ (Bust)';
  }

  return {
    total,
    isBlackjack,
    isBust,
    isSoft,
    label
  };
}

class BlackjackEngine {
  /**
   * @param {Object} room
   * @param {Object} roomManager
   */
  constructor(room, roomManager) {
    this.room = room;
    this.roomManager = roomManager;
  }

  /**
   * Starts the betting phase.
   */
  startBetting() {
    this.room.gameState = {
      game: 'blackjack',
      phase: 'BETTING',
      bets: {},
      hands: {},
      dealerHand: null,
      activePlayers: [],
      currentTurnPlayerId: null,
      results: null,
      deck: null
    };
    return this.room.gameState;
  }

  /**
   * Places a bet for an active player.
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
   * Deals 2 cards alternating to active players then dealer.
   * @param {Array} [customDeck=null]
   */
  dealRound(customDeck = null) {
    if (!this.room.gameState || this.room.gameState.phase !== 'BETTING') {
      throw new Error('ไม่สามารถแจกไพ่ในสถานะนี้ได้');
    }

    const isHumanDealer = (pid) => this.room.dealer.mode === 'player' && this.room.dealer.playerId === pid;

    // Active betting players
    let activePids = this.room.playerOrder.filter(pid => (this.room.gameState.bets[pid] || 0) > 0 && !isHumanDealer(pid));

    // If no bets placed yet, auto-bet min(100, chips) for eligible non-dealer players
    if (activePids.length === 0) {
      for (const pid of this.room.playerOrder) {
        if (isHumanDealer(pid)) continue;
        const player = this.room.players[pid];
        if (player && player.chips > 0) {
          this.room.gameState.bets[pid] = Math.min(100, player.chips);
        }
      }
      activePids = this.room.playerOrder.filter(pid => (this.room.gameState.bets[pid] || 0) > 0 && !isHumanDealer(pid));
    }

    if (activePids.length === 0) {
      throw new Error('ไม่มีผู้เล่นที่มีชิปสำหรับเริ่มตา');
    }

    const deck = customDeck ? [...customDeck] : shuffleDeck(createDeck());
    this.room.gameState.deck = deck;
    this.room.gameState.activePlayers = [...activePids];
    this.room.gameState.hands = {};

    // 1st card to each active player then dealer
    for (const pid of activePids) {
      this.room.gameState.hands[pid] = {
        cards: [deck.shift()]
      };
    }
    const dealerCards = [deck.shift()];

    // 2nd card to each active player then dealer
    for (const pid of activePids) {
      this.room.gameState.hands[pid].cards.push(deck.shift());
    }
    dealerCards.push(deck.shift());

    // Evaluate player hands
    for (const pid of activePids) {
      const hand = this.room.gameState.hands[pid];
      const ev = evaluateBlackjackHand(hand.cards);
      hand.total = ev.total;
      hand.isBlackjack = ev.isBlackjack;
      hand.isBust = ev.isBust;
      hand.isSoft = ev.isSoft;
      hand.label = ev.label;
      hand.done = ev.isBlackjack;
      hand.revealed = ev.isBlackjack;
      hand.stood = false;
    }

    // Evaluate dealer hand
    const dealerEv = evaluateBlackjackHand(dealerCards);
    this.room.gameState.dealerHand = {
      cards: [
        { ...dealerCards[0] },
        { ...dealerCards[1], hidden: !dealerEv.isBlackjack }
      ],
      total: dealerEv.total,
      isBlackjack: dealerEv.isBlackjack,
      isBust: dealerEv.isBust,
      isSoft: dealerEv.isSoft,
      label: dealerEv.label,
      revealed: dealerEv.isBlackjack,
      stood: false,
      done: dealerEv.isBlackjack
    };

    const allPlayersDone = activePids.every(pid => this.room.gameState.hands[pid].done);

    if (dealerEv.isBlackjack) {
      // Reveal dealer hand
      this.room.gameState.dealerHand.revealed = true;
      if (Array.isArray(this.room.gameState.dealerHand.cards)) {
        for (const c of this.room.gameState.dealerHand.cards) delete c.hidden;
      }
      this.settleRound();
    } else if (allPlayersDone) {
      // All active players have natural Blackjack
      this.room.gameState.dealerHand.revealed = true;
      if (Array.isArray(this.room.gameState.dealerHand.cards)) {
        for (const c of this.room.gameState.dealerHand.cards) delete c.hidden;
      }

      if (this.room.dealer.mode === 'auto') {
        while (this.room.gameState.dealerHand.total < 17) {
          const card = this.room.gameState.deck.shift();
          this.room.gameState.dealerHand.cards.push(card);
          const ev = evaluateBlackjackHand(this.room.gameState.dealerHand.cards);
          this.room.gameState.dealerHand.total = ev.total;
          this.room.gameState.dealerHand.isBlackjack = ev.isBlackjack;
          this.room.gameState.dealerHand.isBust = ev.isBust;
          this.room.gameState.dealerHand.isSoft = ev.isSoft;
          this.room.gameState.dealerHand.label = ev.label;
        }
        this.settleRound();
      } else {
        this.room.gameState.phase = 'DEALER_TURN';
      }
    } else {
      this.room.gameState.phase = 'PLAYER_TURN';
      this.room.gameState.currentTurnPlayerId = activePids.find(pid => !this.room.gameState.hands[pid].done) || null;
    }

    return this.room.gameState;
  }

  /**
   * Action for an active player during PLAYER_TURN.
   * @param {string} playerId
   * @param {'hit' | 'stand' | 'double'} action
   */
  playerAction(playerId, action) {
    if (!this.room.gameState || this.room.gameState.phase !== 'PLAYER_TURN') {
      throw new Error('ไม่อยู่ในเทิร์นของผู้เล่น');
    }
    const hand = this.room.gameState.hands[playerId];
    if (!hand) {
      throw new Error('ไม่พบมือของผู้เล่น');
    }
    if (hand.done) {
      throw new Error('ผู้เล่นดำเนินการในตานี้ไปแล้ว');
    }
    if (this.room.gameState.currentTurnPlayerId && this.room.gameState.currentTurnPlayerId !== playerId) {
      throw new Error('ยังไม่ถึงตาของผู้เล่นนี้');
    }

    if (action === 'hit') {
      const card = this.room.gameState.deck.shift();
      hand.cards.push(card);
      const ev = evaluateBlackjackHand(hand.cards);
      hand.total = ev.total;
      hand.isBlackjack = ev.isBlackjack;
      hand.isBust = ev.isBust;
      hand.isSoft = ev.isSoft;
      hand.label = ev.label;
      if (hand.total >= 21) {
        hand.done = true;
      }
    } else if (action === 'stand') {
      hand.stood = true;
      hand.done = true;
    } else if (action === 'double') {
      if (hand.cards.length !== 2) {
        throw new Error('สามารถ Double Down ได้เฉพาะเมื่อมีไพ่ 2 ใบเท่านั้น');
      }
      const currentBet = this.room.gameState.bets[playerId] || 0;
      const player = this.room.players[playerId];
      if (!player || player.chips < currentBet * 2) {
        throw new Error('ชิปไม่เพียงพอสำหรับ Double Down');
      }
      this.room.gameState.bets[playerId] = currentBet * 2;
      hand.doubled = true;

      const card = this.room.gameState.deck.shift();
      hand.cards.push(card);
      const ev = evaluateBlackjackHand(hand.cards);
      hand.total = ev.total;
      hand.isBlackjack = ev.isBlackjack;
      hand.isBust = ev.isBust;
      hand.isSoft = ev.isSoft;
      hand.label = ev.label;
      hand.done = true;
    } else {
      throw new Error('คำสั่งไม่ถูกต้อง (ต้องเป็น hit, stand หรือ double)');
    }

    // Check next active player turn
    const activePids = this.room.gameState.activePlayers || Object.keys(this.room.gameState.hands);
    const nextPid = activePids.find(pid => !this.room.gameState.hands[pid].done);

    if (nextPid) {
      this.room.gameState.currentTurnPlayerId = nextPid;
    } else {
      this.room.gameState.currentTurnPlayerId = null;
      const allBust = activePids.every(pid => this.room.gameState.hands[pid].isBust);

      if (allBust) {
        if (this.room.gameState.dealerHand) {
          this.room.gameState.dealerHand.revealed = true;
          if (Array.isArray(this.room.gameState.dealerHand.cards)) {
            for (const c of this.room.gameState.dealerHand.cards) delete c.hidden;
          }
        }
        this.settleRound();
      } else {
        this.room.gameState.phase = 'DEALER_TURN';
        if (this.room.gameState.dealerHand) {
          this.room.gameState.dealerHand.revealed = true;
          if (Array.isArray(this.room.gameState.dealerHand.cards)) {
            for (const c of this.room.gameState.dealerHand.cards) delete c.hidden;
          }
        }

        if (this.room.dealer.mode === 'auto') {
          while (this.room.gameState.dealerHand.total < 17) {
            const card = this.room.gameState.deck.shift();
            this.room.gameState.dealerHand.cards.push(card);
            const ev = evaluateBlackjackHand(this.room.gameState.dealerHand.cards);
            this.room.gameState.dealerHand.total = ev.total;
            this.room.gameState.dealerHand.isBlackjack = ev.isBlackjack;
            this.room.gameState.dealerHand.isBust = ev.isBust;
            this.room.gameState.dealerHand.isSoft = ev.isSoft;
            this.room.gameState.dealerHand.label = ev.label;
          }
          this.settleRound();
        }
      }
    }

    return this.room.gameState;
  }

  /**
   * Action for human dealer during DEALER_TURN.
   * @param {'hit' | 'stand'} action
   */
  dealerAction(action) {
    if (!this.room.gameState || this.room.gameState.phase !== 'DEALER_TURN') {
      throw new Error('ไม่อยู่ในเทิร์นของเจ้ามือ');
    }
    if (this.room.dealer.mode === 'auto') {
      throw new Error('เจ้ามืออัตโนมัติดำเนินการไปแล้ว');
    }

    if (this.room.gameState.dealerHand) {
      this.room.gameState.dealerHand.revealed = true;
      if (Array.isArray(this.room.gameState.dealerHand.cards)) {
        for (const c of this.room.gameState.dealerHand.cards) delete c.hidden;
      }
    }

    if (action === 'hit') {
      const card = this.room.gameState.deck.shift();
      this.room.gameState.dealerHand.cards.push(card);
      const ev = evaluateBlackjackHand(this.room.gameState.dealerHand.cards);
      this.room.gameState.dealerHand.total = ev.total;
      this.room.gameState.dealerHand.isBlackjack = ev.isBlackjack;
      this.room.gameState.dealerHand.isBust = ev.isBust;
      this.room.gameState.dealerHand.isSoft = ev.isSoft;
      this.room.gameState.dealerHand.label = ev.label;

      if (this.room.gameState.dealerHand.total >= 21) {
        this.settleRound();
      }
    } else if (action === 'stand') {
      this.room.gameState.dealerHand.stood = true;
      this.settleRound();
    } else {
      throw new Error('คำสั่งไม่ถูกต้อง (ต้องเป็น hit หรือ stand)');
    }

    return this.room.gameState;
  }

  /**
   * Settles round payouts via roomManager.
   */
  settleRound() {
    if (!this.room.gameState) return null;
    if (this.room.gameState.phase === 'SETTLED') {
      return this.room.gameState.results;
    }

    // Reveal dealer hand
    if (this.room.gameState.dealerHand) {
      this.room.gameState.dealerHand.revealed = true;
      if (Array.isArray(this.room.gameState.dealerHand.cards)) {
        for (const card of this.room.gameState.dealerHand.cards) {
          delete card.hidden;
        }
      }
    }

    // Reveal all player hands
    if (this.room.gameState.hands) {
      for (const hand of Object.values(this.room.gameState.hands)) {
        hand.revealed = true;
        if (Array.isArray(hand.cards)) {
          for (const card of hand.cards) {
            delete card.hidden;
          }
        }
      }
    }

    const payouts = this.room.settings?.payouts?.blackjack || DEFAULT_PAYOUTS;
    const deltas = {};
    const dealerHand = this.room.gameState.dealerHand;

    for (const [pid, hand] of Object.entries(this.room.gameState.hands)) {
      const bet = this.room.gameState.bets[pid] || 0;

      if (hand.isBust) {
        deltas[pid] = -bet;
      } else if (hand.isBlackjack && dealerHand.isBlackjack) {
        deltas[pid] = 0;
      } else if (hand.isBlackjack) {
        deltas[pid] = Math.ceil(bet * payouts.blackjack);
      } else if (dealerHand.isBlackjack) {
        deltas[pid] = -bet;
      } else if (dealerHand.isBust) {
        deltas[pid] = Math.ceil(bet * payouts.normal);
      } else if (hand.total > dealerHand.total) {
        deltas[pid] = Math.ceil(bet * payouts.normal);
      } else if (hand.total < dealerHand.total) {
        deltas[pid] = -bet;
      } else {
        deltas[pid] = 0;
      }
    }

    const res = this.roomManager.settleDealerPayouts(this.room, deltas);
    this.room.gameState.results = {
      deltas,
      settlements: res.settlements,
      dealerBankrupt: res.dealerBankrupt
    };
    this.room.gameState.phase = 'SETTLED';

    return this.room.gameState.results;
  }
}

module.exports = {
  DEFAULT_PAYOUTS,
  evaluateBlackjackHand,
  BlackjackEngine
};
