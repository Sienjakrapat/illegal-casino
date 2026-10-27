const { createDeck, shuffleDeck, drawCards } = require('../deck');

const ROUND_COUNT = 4;
const SUIT_SET = ['♠', '♥', '♦', '♣'];

/** Ace high for Irish Poker comparisons (A = 14). */
function rankOf(card) {
  return card.rank === 'A' ? 14 : card.value;
}

function isRed(card) {
  return card.suit === '♥' || card.suit === '♦';
}

const ROUND_META = [
  { round: 1, key: 'color', options: ['red', 'black'], title: 'ทายสีไพ่ใบที่ 1 (แดง / ดำ)' },
  { round: 2, key: 'highlow', options: ['higher', 'lower'], title: 'ทายไพ่ใบที่ 2 สูงกว่า / ต่ำกว่า ใบแรก' },
  { round: 3, key: 'inout', options: ['inside', 'outside'], title: 'ทายไพ่ใบที่ 3 อยู่ใน / นอก ระหว่างสองใบแรก' },
  { round: 4, key: 'suit', options: SUIT_SET, title: 'ทายดอกของไพ่ใบที่ 4' }
];

/**
 * Evaluates whether a guess is correct for the given round.
 * @param {number} round 1..4
 * @param {string} guess
 * @param {Array} cards All 4 cards of the player (index 0..3)
 */
function evaluateGuess(round, guess, cards) {
  const card = cards[round - 1];
  if (round === 1) {
    return (guess === 'red') === isRed(card) && (guess === 'red' || guess === 'black');
  }
  if (round === 2) {
    const prev = rankOf(cards[0]);
    const cur = rankOf(card);
    if (cur === prev) return false;
    return guess === 'higher' ? cur > prev : guess === 'lower' ? cur < prev : false;
  }
  if (round === 3) {
    const a = rankOf(cards[0]);
    const b = rankOf(cards[1]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const cur = rankOf(card);
    if (cur === lo || cur === hi) return false;
    const inside = cur > lo && cur < hi;
    return guess === 'inside' ? inside : guess === 'outside' ? !inside : false;
  }
  return guess === card.suit;
}

class IrishPokerEngine {
  /**
   * @param {Object} room
   * @param {import('../roomManager').RoomManager} roomManager
   */
  constructor(room, roomManager) {
    this.room = room;
    this.roomManager = roomManager;
    this.secretHands = {};
    this.secretGuesses = {};
  }

  startBetting() {
    this.secretHands = {};
    this.secretGuesses = {};
    this.room.gameState = {
      game: 'irishpoker',
      phase: 'BETTING',
      bets: {},
      round: 0,
      roundMeta: null,
      activePlayers: [],
      hands: {},
      guessed: {},
      history: [],
      correct: {},
      wrong: {},
      results: null
    };
    return this.room.gameState;
  }

  _isHumanDealer(pid) {
    return this.room.dealer.mode === 'player' && this.room.dealer.playerId === pid;
  }

  placeBet(playerId, amount) {
    const gs = this.room.gameState;
    if (!gs || gs.phase !== 'BETTING') throw new Error('ไม่อยู่ในรอบวางเดิมพัน');
    const player = this.room.players[playerId];
    if (!player) throw new Error('ไม่พบผู้เล่น');
    if (this._isHumanDealer(playerId)) throw new Error('เจ้ามือไม่ต้องวางเดิมพัน');
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0 || amt > player.chips) {
      throw new Error('จำนวนเดิมพันไม่ถูกต้อง');
    }
    gs.bets[playerId] = amt;
    return amt;
  }

  skipBet(playerId) {
    const gs = this.room.gameState;
    if (!gs || gs.phase !== 'BETTING') throw new Error('ไม่อยู่ในรอบวางเดิมพัน');
    if (!this.room.players[playerId]) throw new Error('ไม่พบผู้เล่น');
    if (this._isHumanDealer(playerId)) throw new Error('เจ้ามือไม่ต้องวางเดิมพัน');
    gs.bets[playerId] = 0;
    return 0;
  }

  /** Deals 4 face-down cards to every betting player and opens round 1. */
  dealRound() {
    const gs = this.room.gameState;
    if (!gs || gs.phase !== 'BETTING') {
      throw new Error('ไม่สามารถแจกไพ่ในสถานะนี้ได้');
    }

    const activePids = this.room.playerOrder.filter(
      pid => (gs.bets[pid] || 0) > 0 && !this._isHumanDealer(pid)
    );
    if (activePids.length === 0) throw new Error('ไม่มีผู้เล่นที่ลงเดิมพันในตานี้');
    if (activePids.length * ROUND_COUNT > 52) {
      throw new Error('ผู้เล่นมากเกินไปสำหรับ Irish Poker (สูงสุด 13 คน)');
    }

    const deck = shuffleDeck(createDeck());
    gs.activePlayers = [...activePids];
    for (const pid of activePids) {
      this.secretHands[pid] = drawCards(deck, ROUND_COUNT);
      this.secretGuesses[pid] = null;
      gs.hands[pid] = {
        cards: Array.from({ length: ROUND_COUNT }, () => ({ hidden: true })),
        revealed: true
      };
      gs.guessed[pid] = false;
      gs.correct[pid] = 0;
      gs.wrong[pid] = 0;
    }

    gs.round = 1;
    gs.roundMeta = ROUND_META[0];
    gs.phase = 'GUESSING';
    return gs;
  }

  /**
   * Records a player's guess for the current round.
   * @param {string} playerId
   * @param {{ guess?: string, action?: string }} payload
   */
  playerAction(playerId, payload = {}) {
    const gs = this.room.gameState;
    if (!gs || gs.phase !== 'GUESSING') throw new Error('ไม่อยู่ในรอบทายไพ่');
    if (!gs.activePlayers.includes(playerId)) {
      throw new Error('ผู้เล่นไม่ได้ร่วมลงเดิมพันในตานี้');
    }
    if (gs.guessed[playerId]) throw new Error('คุณทายรอบนี้ไปแล้ว');

    const guess = typeof payload === 'string' ? payload : payload.guess;
    const meta = ROUND_META[gs.round - 1];
    if (!meta.options.includes(guess)) throw new Error('คำตอบไม่ถูกต้อง');

    this.secretGuesses[playerId] = guess;
    gs.guessed[playerId] = true;

    if (gs.activePlayers.every(pid => gs.guessed[pid])) {
      this._revealRound();
    }
    return gs;
  }

  /** Reveals the current round now; unanswered players count as wrong. */
  forceReveal() {
    const gs = this.room.gameState;
    if (!gs || gs.phase !== 'GUESSING') throw new Error('ไม่อยู่ในรอบทายไพ่');
    this._revealRound();
    return gs;
  }

  _revealRound() {
    const gs = this.room.gameState;
    const round = gs.round;
    const entry = { round, results: {} };

    for (const pid of gs.activePlayers) {
      const cards = this.secretHands[pid];
      const guess = this.secretGuesses[pid];
      const ok = guess ? evaluateGuess(round, guess, cards) : false;
      gs.hands[pid].cards[round - 1] = cards[round - 1];
      if (ok) gs.correct[pid] += 1;
      else gs.wrong[pid] += 1;
      entry.results[pid] = { guess: guess || null, correct: ok };
      this.secretGuesses[pid] = null;
      gs.guessed[pid] = false;
    }
    gs.history.push(entry);

    if (round >= ROUND_COUNT) {
      this.settleRound();
    } else {
      gs.round = round + 1;
      gs.roundMeta = ROUND_META[round];
    }
  }

  /** Each correct guess wins the bet, each wrong guess loses it (banked by dealer). */
  settleRound() {
    const gs = this.room.gameState;
    if (!gs) return null;

    const deltas = {};
    for (const pid of gs.activePlayers || []) {
      const bet = gs.bets[pid] || 0;
      deltas[pid] = bet * ((gs.correct[pid] || 0) - (gs.wrong[pid] || 0));
    }

    const settlementResult = this.roomManager.settleDealerPayouts(this.room, deltas);
    gs.phase = 'SETTLED';
    gs.roundMeta = null;
    gs.results = {
      deltas,
      settlements: settlementResult.settlements,
      dealerBankrupt: settlementResult.dealerBankrupt
    };
    this.secretHands = {};
    this.secretGuesses = {};
    return gs.results;
  }
}

module.exports = {
  IrishPokerEngine,
  evaluateGuess,
  ROUND_META,
  ROUND_COUNT
};
