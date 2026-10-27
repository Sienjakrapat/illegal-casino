const { createDeck, shuffleDeck } = require('../deck');

const DEFAULT_PAYOUTS = {
  normal: 1,
  deng2: 2,
  deng3: 3,
  straight: 3,
  sian: 3,
  tong: 5
};

const RANK_VALUES = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13
};

/**
 * Returns point value of a single card for Pok / Normal point calculation.
 * A = 1, 2..9 = 2..9, 10/J/Q/K = 0.
 */
function getCardPoint(card) {
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
  if (card.rank === 'A') return 1;
  const num = Number(card.rank);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Evaluates a 2-card or 3-card Pok Deng hand.
 * @param {Array<{ suit: string, rank: string, value?: number }>} cards
 * @param {Object} [customPayouts={}]
 * @returns {{ type: string, points: number, multiplier: number, rankWeight: number, label: string }}
 */
function evaluatePokDengHand(cards, customPayouts = {}) {
  const payouts = { ...DEFAULT_PAYOUTS, ...customPayouts };
  if (!Array.isArray(cards) || cards.length < 2) {
    throw new Error('ไพ่ต้องมีอย่างน้อย 2 ใบ');
  }

  const points = cards.reduce((sum, c) => sum + getCardPoint(c), 0) % 10;

  // 1. Two-card hand: Pok 9, Pok 8, or Normal (1-deng / 2-deng)
  if (cards.length === 2) {
    const isPair = cards[0].rank === cards[1].rank;
    const isSameSuit = cards[0].suit === cards[1].suit;
    const isDeng2 = isPair || isSameSuit;

    if (points === 9) {
      return {
        type: 'POK_9',
        points: 9,
        multiplier: isDeng2 ? payouts.deng2 : payouts.normal,
        rankWeight: 900,
        label: isDeng2 ? 'ป๊อก 9 (2 เด้ง)' : 'ป๊อก 9'
      };
    }

    if (points === 8) {
      return {
        type: 'POK_8',
        points: 8,
        multiplier: isDeng2 ? payouts.deng2 : payouts.normal,
        rankWeight: 800,
        label: isDeng2 ? 'ป๊อก 8 (2 เด้ง)' : 'ป๊อก 8'
      };
    }

    return {
      type: 'NORMAL',
      points,
      multiplier: isDeng2 ? payouts.deng2 : payouts.normal,
      rankWeight: points,
      label: isDeng2 ? `${points} แต้ม (2 เด้ง)` : `${points} แต้ม`
    };
  }

  // 2. Three-card hand: Tong, Straight, Sian, or Normal (1-deng / 3-deng)
  if (cards.length === 3) {
    // 2.1 TONG (3 cards of identical rank)
    if (cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank) {
      const cardRankValue = cards[0].value || RANK_VALUES[cards[0].rank] || 0;
      return {
        type: 'TONG',
        points,
        multiplier: payouts.tong,
        rankWeight: 700 + cardRankValue,
        label: `ตอง ${cards[0].rank}`
      };
    }

    // 2.2 STRAIGHT (3 cards in sequential rank order: A-2-3 up to Q-K-A)
    const cardValues = cards.map(c => c.value || RANK_VALUES[c.rank]).sort((a, b) => a - b);
    let isStraight = false;
    let highestRank = 0;

    if (cardValues[1] === cardValues[0] + 1 && cardValues[2] === cardValues[1] + 1) {
      isStraight = true;
      highestRank = cardValues[2];
    } else if (cardValues[0] === 1 && cardValues[1] === 12 && cardValues[2] === 13) {
      // Q-K-A where A acts as 14
      isStraight = true;
      highestRank = 14;
    }

    if (isStraight) {
      return {
        type: 'STRAIGHT',
        points,
        multiplier: payouts.straight,
        rankWeight: 600 + highestRank,
        label: 'เรียง'
      };
    }

    // 2.3 SIAN (3 cards all in J, Q, K - non-tong, non-straight)
    const isSian = cards.every(c => ['J', 'Q', 'K'].includes(c.rank));
    if (isSian) {
      return {
        type: 'SIAN',
        points,
        multiplier: payouts.sian,
        rankWeight: 500,
        label: 'เซียน'
      };
    }

    // 2.4 NORMAL 3-card hand
    const isDeng3 = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
    return {
      type: 'NORMAL',
      points,
      multiplier: isDeng3 ? payouts.deng3 : payouts.normal,
      rankWeight: points,
      label: isDeng3 ? `${points} แต้ม (3 เด้ง)` : `${points} แต้ม`
    };
  }

  // Fallback
  return {
    type: 'NORMAL',
    points,
    multiplier: payouts.normal,
    rankWeight: points,
    label: `${points} แต้ม`
  };
}

/**
 * Compares player's hand against dealer's hand.
 * @param {{ rankWeight: number }} playerEval
 * @param {{ rankWeight: number }} dealerEval
 * @returns {number} 1 if player wins, -1 if dealer wins, 0 on tie
 */
function comparePokDengHands(playerEval, dealerEval) {
  if (playerEval.rankWeight > dealerEval.rankWeight) return 1;
  if (playerEval.rankWeight < dealerEval.rankWeight) return -1;
  return 0;
}

class PokDengEngine {
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
      game: 'pokdeng',
      phase: 'BETTING',
      bets: {},
      hands: {},
      dealerHand: null,
      results: null,
      deck: null
    };
    return this.room.gameState;
  }

  /**
   * Places a bet for a player.
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

    const payouts = this.room.settings?.payouts?.pokdeng || DEFAULT_PAYOUTS;

    // Evaluate active players
    for (const pid of activePids) {
      const hand = this.room.gameState.hands[pid];
      const ev = evaluatePokDengHand(hand.cards, payouts);
      const isPok = ev.type === 'POK_8' || ev.type === 'POK_9';
      hand.points = ev.points;
      hand.type = ev.type;
      hand.multiplier = ev.multiplier;
      hand.rankWeight = ev.rankWeight;
      hand.label = ev.label;
      hand.revealed = isPok;
      hand.stood = isPok;
      hand.done = isPok;
    }

    // Evaluate dealer
    const dealerEv = evaluatePokDengHand(dealerCards, payouts);
    const isDealerPok = dealerEv.type === 'POK_8' || dealerEv.type === 'POK_9';
    this.room.gameState.dealerHand = {
      cards: dealerCards.map(c => ({ ...c, hidden: !isDealerPok })),
      points: dealerEv.points,
      type: dealerEv.type,
      multiplier: dealerEv.multiplier,
      rankWeight: dealerEv.rankWeight,
      label: dealerEv.label,
      revealed: isDealerPok,
      stood: isDealerPok,
      done: isDealerPok
    };

    const allPlayersPok = activePids.length > 0 && activePids.every(pid => {
      const t = this.room.gameState.hands[pid].type;
      return t === 'POK_8' || t === 'POK_9';
    });

    if (isDealerPok || allPlayersPok) {
      this.settleRound();
    } else {
      this.room.gameState.phase = 'PLAYER_TURN';
    }

    return this.room.gameState;
  }

  /**
   * Action for an active player during PLAYER_TURN.
   * @param {string} playerId
   * @param {'draw' | 'stand'} action
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

    const payouts = this.room.settings?.payouts?.pokdeng || DEFAULT_PAYOUTS;

    if (action === 'draw') {
      if (hand.cards.length >= 3) {
        throw new Error('ไม่สามารถจั่วเพิ่มได้อีก');
      }
      const newCard = this.room.gameState.deck?.shift();
      if (!newCard) {
        hand.stood = true;
        hand.done = true;
      } else {
        hand.cards.push(newCard);
        const ev = evaluatePokDengHand(hand.cards, payouts);
        hand.points = ev.points;
        hand.type = ev.type;
        hand.multiplier = ev.multiplier;
        hand.rankWeight = ev.rankWeight;
        hand.label = ev.label;
        hand.done = true;
      }
    } else if (action === 'stand') {
      if (hand.points < 4 && (this.room.gameState.deck?.length || 0) > 0) {
        throw new Error('แต้มน้อยกว่า 4 บังคับจั่วไพ่เพิ่ม!');
      }
      hand.stood = true;
      hand.done = true;
    } else {
      throw new Error('คำสั่งไม่ถูกต้อง (ต้องเป็น draw หรือ stand)');
    }

    // Check if all active players are done
    const activePids = Object.keys(this.room.gameState.hands);
    const allDone = activePids.every(pid => this.room.gameState.hands[pid].done);

    if (allDone) {
      this.room.gameState.phase = 'DEALER_TURN';
      if (this.room.dealer.mode === 'auto') {
        if (this.room.gameState.dealerHand.points < 5 && this.room.gameState.dealerHand.cards.length === 2) {
          const newCard = this.room.gameState.deck?.shift();
          if (newCard) {
            this.room.gameState.dealerHand.cards.push(newCard);
            const ev = evaluatePokDengHand(this.room.gameState.dealerHand.cards, payouts);
            this.room.gameState.dealerHand.points = ev.points;
            this.room.gameState.dealerHand.type = ev.type;
            this.room.gameState.dealerHand.multiplier = ev.multiplier;
            this.room.gameState.dealerHand.rankWeight = ev.rankWeight;
            this.room.gameState.dealerHand.label = ev.label;
          } else {
            this.room.gameState.dealerHand.stood = true;
            this.room.gameState.dealerHand.done = true;
          }
        }
        this.settleRound();
      } else if (this.room.gameState.dealerHand && Array.isArray(this.room.gameState.dealerHand.cards)) {
        for (const card of this.room.gameState.dealerHand.cards) {
          delete card.hidden;
        }
      }
    }

    return this.room.gameState;
  }

  /**
   * Action for human dealer during DEALER_TURN.
   * @param {'draw' | 'stand'} action
   */
  dealerAction(action) {
    if (!this.room.gameState || this.room.gameState.phase !== 'DEALER_TURN') {
      throw new Error('ไม่อยู่ในเทิร์นของเจ้ามือ');
    }
    if (this.room.dealer.mode === 'auto') {
      throw new Error('เจ้ามืออัตโนมัติดำเนินการไปแล้ว');
    }

    const payouts = this.room.settings?.payouts?.pokdeng || DEFAULT_PAYOUTS;

    if (action === 'draw') {
      if (this.room.gameState.dealerHand.cards.length === 2) {
        const newCard = this.room.gameState.deck?.shift();
        if (newCard) {
          this.room.gameState.dealerHand.cards.push(newCard);
          const ev = evaluatePokDengHand(this.room.gameState.dealerHand.cards, payouts);
          this.room.gameState.dealerHand.points = ev.points;
          this.room.gameState.dealerHand.type = ev.type;
          this.room.gameState.dealerHand.multiplier = ev.multiplier;
          this.room.gameState.dealerHand.rankWeight = ev.rankWeight;
          this.room.gameState.dealerHand.label = ev.label;
        } else {
          this.room.gameState.dealerHand.stood = true;
          this.room.gameState.dealerHand.done = true;
        }
      }
    } else if (action === 'stand') {
      this.room.gameState.dealerHand.stood = true;
    } else {
      throw new Error('คำสั่งไม่ถูกต้อง (ต้องเป็น draw หรือ stand)');
    }

    this.settleRound();
    return this.room.gameState;
  }

  /**
   * Settles round by revealing cards, calculating deltas, and calling RoomManager settleDealerPayouts.
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

    // Reveal player hands
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

    const deltas = {};
    const dealerEval = this.room.gameState.dealerHand;

    for (const [pid, hand] of Object.entries(this.room.gameState.hands)) {
      const bet = this.room.gameState.bets[pid] || 0;
      const cmp = comparePokDengHands(hand, dealerEval);
      if (cmp > 0) {
        deltas[pid] = Math.round(bet * hand.multiplier);
      } else if (cmp < 0) {
        deltas[pid] = -Math.round(bet * dealerEval.multiplier);
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
  RANK_VALUES,
  evaluatePokDengHand,
  comparePokDengHands,
  PokDengEngine
};
