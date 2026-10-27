const { createDeck, shuffleDeck, drawCards } = require('../deck');

/**
 * Returns numeric rank of card for Poker:
 * A = 14, K = 13, Q = 12, J = 11, 10..2 = face value.
 * @param {Object} card
 * @returns {number}
 */
function getPokerCardRank(card) {
  if (!card) return 0;
  const rank = String(card.rank).toUpperCase();
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  const n = parseInt(rank, 10);
  if (!Number.isNaN(n)) return n;
  if (card.value === 1) return 14;
  return card.value || 0;
}

/**
 * Generates all 5-card combinations from an array of cards.
 * @param {Array} cards
 * @returns {Array<Array>}
 */
function get5CardCombinations(cards) {
  const n = cards.length;
  if (n === 5) return [cards];
  const combinations = [];

  function combine(start, chosen) {
    if (chosen.length === 5) {
      combinations.push([...chosen]);
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(cards[i]);
      combine(i + 1, chosen);
      chosen.pop();
    }
  }

  combine(0, []);
  return combinations;
}

/**
 * Evaluates a single 5-card Poker hand.
 * @param {Array} fiveCards
 * @returns {{ category: number, name: string, tiebreakers: Array<number>, bestCards: Array }}
 */
function evaluate5CardHand(fiveCards) {
  const ranks = fiveCards.map(getPokerCardRank).sort((a, b) => b - a);
  const isFlush = fiveCards.every(c => c.suit === fiveCards[0].suit);

  // Check straight
  const distinctRanks = [...new Set(ranks)];
  let isStraight = false;
  let straightHighCard = 0;

  if (distinctRanks.length === 5) {
    // Standard straight
    if (
      ranks[0] - 1 === ranks[1] &&
      ranks[1] - 1 === ranks[2] &&
      ranks[2] - 1 === ranks[3] &&
      ranks[3] - 1 === ranks[4]
    ) {
      isStraight = true;
      straightHighCard = ranks[0];
    }
    // Ace-low wheel straight (A-2-3-4-5)
    else if (
      ranks[0] === 14 &&
      ranks[1] === 5 &&
      ranks[2] === 4 &&
      ranks[3] === 3 &&
      ranks[4] === 2
    ) {
      isStraight = true;
      straightHighCard = 5;
    }
  }

  // 9: Royal Flush & 8: Straight Flush
  if (isFlush && isStraight) {
    if (straightHighCard === 14 && ranks[4] === 10) {
      return {
        category: 9,
        name: 'Royal Flush',
        tiebreakers: [14],
        bestCards: fiveCards
      };
    }
    return {
      category: 8,
      name: 'Straight Flush',
      tiebreakers: [straightHighCard],
      bestCards: fiveCards
    };
  }

  // Count occurrences of each rank
  const counts = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const byCount = {};
  for (const [rStr, cnt] of Object.entries(counts)) {
    const r = Number(rStr);
    if (!byCount[cnt]) byCount[cnt] = [];
    byCount[cnt].push(r);
  }
  for (const cnt of Object.keys(byCount)) {
    byCount[cnt].sort((a, b) => b - a);
  }

  // 7: Four of a Kind
  if (byCount[4]) {
    const quadRank = byCount[4][0];
    const kicker = byCount[1][0];
    return {
      category: 7,
      name: 'Four of a Kind',
      tiebreakers: [quadRank, kicker],
      bestCards: fiveCards
    };
  }

  // 6: Full House
  if (byCount[3] && byCount[2]) {
    const tripsRank = byCount[3][0];
    const pairRank = byCount[2][0];
    return {
      category: 6,
      name: 'Full House',
      tiebreakers: [tripsRank, pairRank],
      bestCards: fiveCards
    };
  }

  // 5: Flush
  if (isFlush) {
    return {
      category: 5,
      name: 'Flush',
      tiebreakers: ranks,
      bestCards: fiveCards
    };
  }

  // 4: Straight
  if (isStraight) {
    return {
      category: 4,
      name: 'Straight',
      tiebreakers: [straightHighCard],
      bestCards: fiveCards
    };
  }

  // 3: Three of a Kind
  if (byCount[3]) {
    const tripsRank = byCount[3][0];
    const kickers = byCount[1];
    return {
      category: 3,
      name: 'Three of a Kind',
      tiebreakers: [tripsRank, ...kickers],
      bestCards: fiveCards
    };
  }

  // 2: Two Pair
  if (byCount[2] && byCount[2].length === 2) {
    const highPair = byCount[2][0];
    const lowPair = byCount[2][1];
    const kicker = byCount[1][0];
    return {
      category: 2,
      name: 'Two Pair',
      tiebreakers: [highPair, lowPair, kicker],
      bestCards: fiveCards
    };
  }

  // 1: One Pair
  if (byCount[2] && byCount[2].length === 1) {
    const pairRank = byCount[2][0];
    const kickers = byCount[1];
    return {
      category: 1,
      name: 'One Pair',
      tiebreakers: [pairRank, ...kickers],
      bestCards: fiveCards
    };
  }

  // 0: High Card
  return {
    category: 0,
    name: 'High Card',
    tiebreakers: ranks,
    bestCards: fiveCards
  };
}

/**
 * Compares two evaluated Poker hands.
 * @param {Object} evalA
 * @param {Object} evalB
 * @returns {number} 1 if A > B, -1 if A < B, 0 if equal
 */
function comparePokerHands(evalA, evalB) {
  if (evalA.category > evalB.category) return 1;
  if (evalA.category < evalB.category) return -1;

  const maxLen = Math.max(evalA.tiebreakers.length, evalB.tiebreakers.length);
  for (let i = 0; i < maxLen; i++) {
    const a = evalA.tiebreakers[i] ?? 0;
    const b = evalB.tiebreakers[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Evaluates the best 5-card Poker hand from 5 to 7 cards.
 * @param {Array<{ rank: string, suit: string, value?: number }>} cards
 * @returns {{ category: number, name: string, tiebreakers: Array<number>, bestCards: Array }}
 */
function evaluateBestPokerHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5) {
    throw new Error('ไพ่ต้องมีอย่างน้อย 5 ใบ');
  }

  const combos = get5CardCombinations(cards);
  let bestHand = null;

  for (const combo of combos) {
    const evaluated = evaluate5CardHand(combo);
    if (!bestHand || comparePokerHands(evaluated, bestHand) > 0) {
      bestHand = evaluated;
    }
  }

  return bestHand;
}

class PokerEngine {
  /**
   * @param {Object} room
   * @param {Object} roomManager
   */
  constructor(room, roomManager) {
    this.room = room;
    this.roomManager = roomManager;
  }

  /**
   * Starts a new poker hand.
   * @param {Array} [customDeck=null]
   * @returns {Object} gameState
   */
  startHand(customDeck = null) {
    const activePlayerIds = this.room.playerOrder.filter(
      pid => this.room.players[pid] && this.room.players[pid].chips > 0
    );

    if (activePlayerIds.length < 2) {
      throw new Error('ต้องการผู้เล่นอย่างน้อย 2 คนที่มีชิปเพื่อเริ่มเล่น');
    }

    const N = activePlayerIds.length;
    this.room.pokerDealerIdx = ((this.room.pokerDealerIdx ?? -1) + 1) % N;
    const dealerIdx = this.room.pokerDealerIdx;
    const dealerPlayerId = activePlayerIds[dealerIdx];

    let sbIdx;
    let bbIdx;
    let preFlopStartIdx;

    if (N === 2) {
      // In 2-player Heads-Up: dealer is Small Blind (acts first pre-flop), other is Big Blind
      sbIdx = dealerIdx;
      bbIdx = (dealerIdx + 1) % 2;
      preFlopStartIdx = dealerIdx;
    } else {
      // In 3+ players: dealer+1 is Small Blind, dealer+2 is Big Blind, dealer+3 acts first pre-flop
      sbIdx = (dealerIdx + 1) % N;
      bbIdx = (dealerIdx + 2) % N;
      preFlopStartIdx = (dealerIdx + 3) % N;
    }

    const sbPlayerId = activePlayerIds[sbIdx];
    const bbPlayerId = activePlayerIds[bbIdx];

    // Reverse customDeck so that drawCards (which uses pop) draws in array definition order
    const deck = customDeck ? [...customDeck].reverse() : shuffleDeck(createDeck());

    const sbAmount = this.room.settings?.blinds?.smallBlind ?? 10;
    const bbAmount = this.room.settings?.blinds?.bigBlind ?? 20;

    const players = {};
    for (const pid of activePlayerIds) {
      const holeCards = drawCards(deck, 2);
      players[pid] = {
        playerId: pid,
        holeCards,
        cards: holeCards,
        currentBet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        revealed: false,
        hasActed: false
      };
    }

    // Deduct Small Blind
    const sbPay = Math.min(this.room.players[sbPlayerId].chips, sbAmount);
    this.room.players[sbPlayerId].chips -= sbPay;
    players[sbPlayerId].currentBet = sbPay;
    players[sbPlayerId].totalBet = sbPay;
    if (this.room.players[sbPlayerId].chips === 0) {
      players[sbPlayerId].allIn = true;
    }

    // Deduct Big Blind
    const bbPay = Math.min(this.room.players[bbPlayerId].chips, bbAmount);
    this.room.players[bbPlayerId].chips -= bbPay;
    players[bbPlayerId].currentBet = bbPay;
    players[bbPlayerId].totalBet = bbPay;
    if (this.room.players[bbPlayerId].chips === 0) {
      players[bbPlayerId].allIn = true;
    }

    const pot = sbPay + bbPay;
    const highestBet = Math.max(sbPay, bbPay);

    this.room.gameState = {
      game: 'poker',
      phase: 'PRE_FLOP',
      pot,
      highestBet,
      dealerPlayerId,
      sbPlayerId,
      bbPlayerId,
      activePlayers: [...activePlayerIds],
      communityCards: [],
      deck,
      players,
      currentTurnPlayerId: null,
      results: null
    };

    // Check if betting round is already complete (e.g. all players all-in)
    if (this._checkBettingRoundComplete()) {
      return this._advanceStreet();
    }

    // Find pre-flop first turn
    for (let i = 0; i < N; i++) {
      const pid = activePlayerIds[(preFlopStartIdx + i) % N];
      const p = players[pid];
      if (!p.folded && !p.allIn) {
        this.room.gameState.currentTurnPlayerId = pid;
        break;
      }
    }

    return this.room.gameState;
  }

  /**
   * Performs a player action in the current betting round.
   * @param {string} playerId
   * @param {{ action: string, amount?: number }} actionData
   * @returns {Object} gameState
   */
  playerAction(playerId, { action, amount = 0 }) {
    if (!this.room.gameState || this.room.gameState.phase === 'SHOWDOWN') {
      throw new Error('ตานี้จบลงแล้ว');
    }

    if (playerId !== this.room.gameState.currentTurnPlayerId) {
      throw new Error('ไม่ใช่ตาของผู้เล่นนี้');
    }

    const p = this.room.gameState.players[playerId];
    const roomPlayer = this.room.players[playerId];

    if (!p || p.folded) {
      throw new Error('ผู้เล่นหมอบไปแล้วหรือไม่สามารถเล่นได้');
    }

    const act = String(action || '').toLowerCase();

    if (act === 'fold') {
      p.folded = true;
      p.hasActed = true;

      const remainingNonFolded = this.room.gameState.activePlayers.filter(
        pid => !this.room.gameState.players[pid].folded
      );

      if (remainingNonFolded.length === 1) {
        const winnerId = remainingNonFolded[0];
        this.room.players[winnerId].chips += this.room.gameState.pot;
        this.room.gameState.phase = 'SHOWDOWN';
        this.room.gameState.currentTurnPlayerId = null;
        this.room.gameState.results = {
          winners: [winnerId],
          payouts: { [winnerId]: this.room.gameState.pot },
          pot: this.room.gameState.pot,
          byFold: true,
          handDetails: {}
        };
        this.roomManager.checkAndTriggerBankruptcies(this.room);
        return this.room.gameState;
      }
    } else if (act === 'check') {
      if (p.currentBet < this.room.gameState.highestBet) {
        throw new Error('ไม่สามารถ Check ได้เนื่องจากมีเดิมพันสูงกว่า');
      }
      p.hasActed = true;
    } else if (act === 'call') {
      const needed = this.room.gameState.highestBet - p.currentBet;
      if (needed > 0) {
        const callAmount = Math.min(roomPlayer.chips, needed);
        roomPlayer.chips -= callAmount;
        p.currentBet += callAmount;
        p.totalBet += callAmount;
        this.room.gameState.pot += callAmount;
        if (roomPlayer.chips === 0) {
          p.allIn = true;
        }
      }
      p.hasActed = true;
    } else if (act === 'raise') {
      const numAmount = Number(amount);
      if (Number.isNaN(numAmount) || numAmount <= 0) {
        throw new Error('จำนวนเงิน Raise ต้องมากกว่า 0');
      }

      let targetBet;
      if (numAmount <= this.room.gameState.highestBet) {
        targetBet = this.room.gameState.highestBet + numAmount;
      } else {
        targetBet = numAmount;
      }

      const maxPossibleBet = p.currentBet + roomPlayer.chips;
      targetBet = Math.min(targetBet, maxPossibleBet);

      const addChips = targetBet - p.currentBet;
      if (addChips <= 0) {
        throw new Error('จำนวนเงิน Raise ต้องมากกว่าเดิมพันปัจจุบัน');
      }

      roomPlayer.chips -= addChips;
      p.currentBet += addChips;
      p.totalBet += addChips;
      this.room.gameState.pot += addChips;
      if (roomPlayer.chips === 0) {
        p.allIn = true;
      }
      p.hasActed = true;

      if (p.currentBet > this.room.gameState.highestBet) {
        this.room.gameState.highestBet = p.currentBet;
        // Reset hasActed for all other active non-folded, non-all-in players
        for (const otherPid of this.room.gameState.activePlayers) {
          if (otherPid !== playerId) {
            const op = this.room.gameState.players[otherPid];
            if (op && !op.folded && !op.allIn) {
              op.hasActed = false;
            }
          }
        }
      }
    } else if (act === 'allin') {
      const addChips = roomPlayer.chips;
      if (addChips <= 0) {
        throw new Error('ไม่มีชิปเหลือสำหรับ All-in');
      }

      roomPlayer.chips = 0;
      p.currentBet += addChips;
      p.totalBet += addChips;
      this.room.gameState.pot += addChips;
      p.allIn = true;
      p.hasActed = true;

      if (p.currentBet > this.room.gameState.highestBet) {
        this.room.gameState.highestBet = p.currentBet;
        for (const otherPid of this.room.gameState.activePlayers) {
          if (otherPid !== playerId) {
            const op = this.room.gameState.players[otherPid];
            if (op && !op.folded && !op.allIn) {
              op.hasActed = false;
            }
          }
        }
      }
    } else {
      throw new Error(`การกระทำไม่ถูกต้อง: ${action}`);
    }

    if (this._checkBettingRoundComplete()) {
      return this._advanceStreet();
    } else {
      this._advanceTurn();
      return this.room.gameState;
    }
  }

  /**
   * Checks whether the current street's betting round is complete.
   * @returns {boolean}
   */
  _checkBettingRoundComplete() {
    const nonFolded = this.room.gameState.activePlayers
      .map(pid => this.room.gameState.players[pid])
      .filter(p => !p.folded);

    if (nonFolded.length <= 1) return true;

    const nonAllIn = nonFolded.filter(p => !p.allIn);
    if (nonAllIn.length === 0) return true;

    if (nonAllIn.length === 1) {
      return nonAllIn[0].hasActed || nonAllIn[0].currentBet >= this.room.gameState.highestBet;
    }

    return nonAllIn.every(p => p.hasActed && p.currentBet === this.room.gameState.highestBet);
  }

  /**
   * Advances the turn to the next active player.
   */
  _advanceTurn() {
    const active = this.room.gameState.activePlayers;
    const currIdx = active.indexOf(this.room.gameState.currentTurnPlayerId);

    for (let i = 1; i <= active.length; i++) {
      const nextPid = active[(currIdx + i) % active.length];
      const p = this.room.gameState.players[nextPid];
      if (!p.folded && !p.allIn) {
        this.room.gameState.currentTurnPlayerId = nextPid;
        return;
      }
    }

    this._advanceStreet();
  }

  /**
   * Advances to the next street or showdown.
   * @returns {Object} gameState
   */
  _advanceStreet() {
    const nonFolded = this.room.gameState.activePlayers
      .map(pid => this.room.gameState.players[pid])
      .filter(p => !p.folded);

    const nonAllIn = nonFolded.filter(p => !p.allIn);

    // If at most 1 non-folded player is not all-in, run out remaining community cards to 5 and showdown
    if (nonAllIn.length <= 1) {
      while (this.room.gameState.communityCards.length < 5) {
        const [card] = drawCards(this.room.gameState.deck, 1);
        if (!card) break;
        this.room.gameState.communityCards.push(card);
      }
      return this._resolveShowdown();
    }

    const currentPhase = this.room.gameState.phase;
    if (currentPhase === 'PRE_FLOP') {
      this.room.gameState.phase = 'FLOP';
      this.room.gameState.communityCards.push(...drawCards(this.room.gameState.deck, 3));
    } else if (currentPhase === 'FLOP') {
      this.room.gameState.phase = 'TURN';
      this.room.gameState.communityCards.push(...drawCards(this.room.gameState.deck, 1));
    } else if (currentPhase === 'TURN') {
      this.room.gameState.phase = 'RIVER';
      this.room.gameState.communityCards.push(...drawCards(this.room.gameState.deck, 1));
    } else if (currentPhase === 'RIVER') {
      return this._resolveShowdown();
    }

    // Reset street bets
    this.room.gameState.highestBet = 0;
    for (const pid of this.room.gameState.activePlayers) {
      const p = this.room.gameState.players[pid];
      p.currentBet = 0;
      p.hasActed = false;
    }

    // Turn order post-flop: starts from the first active seat after the dealer button
    const N = this.room.gameState.activePlayers.length;
    const dealerIdx = this.room.pokerDealerIdx;
    let foundTurn = false;

    for (let i = 1; i <= N; i++) {
      const pid = this.room.gameState.activePlayers[(dealerIdx + i) % N];
      const p = this.room.gameState.players[pid];
      if (!p.folded && !p.allIn) {
        this.room.gameState.currentTurnPlayerId = pid;
        foundTurn = true;
        break;
      }
    }

    if (!foundTurn) {
      return this._advanceStreet();
    }

    return this.room.gameState;
  }

  /**
   * Resolves the showdown, revealing cards, comparing hands, and awarding pot.
   * @returns {Object} gameState
   */
  _resolveShowdown() {
    this.room.gameState.phase = 'SHOWDOWN';
    this.room.gameState.currentTurnPlayerId = null;

    const nonFoldedPlayerIds = this.room.gameState.activePlayers.filter(
      pid => !this.room.gameState.players[pid].folded
    );

    const handDetails = {};
    for (const pid of nonFoldedPlayerIds) {
      const p = this.room.gameState.players[pid];
      p.revealed = true;
      const allCards = [...p.holeCards, ...this.room.gameState.communityCards];
      handDetails[pid] = evaluateBestPokerHand(allCards);
    }

    let bestEval = null;
    let winners = [];

    for (const pid of nonFoldedPlayerIds) {
      const ev = handDetails[pid];
      if (!bestEval) {
        bestEval = ev;
        winners = [pid];
      } else {
        const cmp = comparePokerHands(ev, bestEval);
        if (cmp > 0) {
          bestEval = ev;
          winners = [pid];
        } else if (cmp === 0) {
          winners.push(pid);
        }
      }
    }

    const pot = this.room.gameState.pot;
    // Earliest seat in room.playerOrder gets remainder
    const sortedWinners = [...winners].sort((a, b) => {
      return this.room.playerOrder.indexOf(a) - this.room.playerOrder.indexOf(b);
    });

    const share = Math.floor(pot / sortedWinners.length);
    let remainder = pot % sortedWinners.length;
    const payouts = {};

    for (const pid of sortedWinners) {
      let winAmount = share;
      if (remainder > 0) {
        winAmount += 1;
        remainder -= 1;
      }
      payouts[pid] = winAmount;
      this.room.players[pid].chips += winAmount;
    }

    this.room.gameState.results = {
      winners,
      payouts,
      handDetails,
      pot
    };

    this.roomManager.checkAndTriggerBankruptcies(this.room);

    return this.room.gameState;
  }
}

module.exports = {
  getPokerCardRank,
  evaluate5CardHand,
  evaluateBestPokerHand,
  comparePokerHands,
  PokerEngine
};
