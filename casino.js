/**
 * คาสิโนเถื่อน (Underground Party Casino) — Client Controller
 * Mobile-first Socket.IO client, Web Audio Synthesizer, Admin Panel & Punishment Wheel
 */

(function () {
  'use strict';

  // ================= WEB AUDIO SYNTHESIZER, HAPTICS & GAME JUICE =================
  function triggerHaptic(pattern = 12) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  class SoundSynth {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    _ensureContext() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    // Crisp card slide & 3D flip whoosh
    playCardDeal() {
      triggerHaptic(10);
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.085);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.095);
      } catch (_) {}
    }

    // Authentic porcelain/metallic casino chip clink
    playChipBet() {
      triggerHaptic(14);
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const tones = [1850, 2760];
        tones.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.018);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.18, now + idx * 0.018 + 0.065);
          gain.gain.setValueAtTime(0.13, now + idx * 0.018);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.018 + 0.095);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.018);
          osc.stop(now + idx * 0.018 + 0.1);
        });
      } catch (_) {}
    }

    // Celebratory VIP Lounge payout chime
    playWinFanfare() {
      triggerHaptic([20, 45, 30]);
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((freq, idx) => {
          const now = ctx.currentTime + idx * 0.075;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.17, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.27);
        });
      } catch (_) {}
    }

    playBankruptcySiren() {
      triggerHaptic([60, 40, 80]);
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.linearRampToValueAtTime(680, now + 0.25);
        osc.frequency.linearRampToValueAtTime(320, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.56);
      } catch (_) {}
    }
  }

  const sfx = new SoundSynth();

  // Floating Golden Chip Confetti on Wins
  function spawnWinConfetti() {
    const container = document.getElementById('confetti-layer');
    if (!container) return;
    const count = 22;
    for (let i = 0; i < count; i++) {
      const chip = document.createElement('div');
      chip.className = 'vip-confetti-chip';
      const startX = 12 + Math.random() * 76;
      const driftX = (Math.random() - 0.5) * 160;
      const dur = 1250 + Math.random() * 750;
      const spin = 360 + Math.floor(Math.random() * 720);
      chip.style.left = startX + 'vw';
      chip.style.setProperty('--drift-x', driftX.toFixed(0) + 'px');
      chip.style.setProperty('--fall-dur', dur.toFixed(0) + 'ms');
      chip.style.setProperty('--spin-deg', spin + 'deg');
      chip.style.animationDelay = (Math.random() * 220).toFixed(0) + 'ms';
      container.appendChild(chip);
      setTimeout(() => chip.remove(), dur + 300);
    }
  }

  // Dynamic Roll-Up Chip Counter Animation
  let chipRollRaf = null;
  function animateChipCounter(targetEl, fromVal, toVal) {
    if (!targetEl) return;
    if (fromVal === toVal || typeof requestAnimationFrame !== 'function') {
      targetEl.textContent = formatChips(toVal);
      return;
    }
    if (chipRollRaf) cancelAnimationFrame(chipRollRaf);
    const badge = document.getElementById('hud-my-chips-badge');
    if (badge) {
      badge.classList.remove('chip-bump');
      void badge.offsetWidth;
      badge.classList.add('chip-bump');
    }
    const startTime = performance.now();
    const duration = 420;
    const diff = toVal - fromVal;

    function step(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(fromVal + diff * eased);
      targetEl.textContent = formatChips(current);
      if (progress < 1) {
        chipRollRaf = requestAnimationFrame(step);
      } else {
        targetEl.textContent = formatChips(toVal);
        chipRollRaf = null;
      }
    }
    chipRollRaf = requestAnimationFrame(step);
  }

  // ================= CLIENT STATE & PERSISTENCE =================
  const STORAGE_PLAYER_ID = 'casino_player_id';
  const STORAGE_PLAYER_NAME = 'casino_player_name';

  function safeGetStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSetStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function getOrCreatePlayerId() {
    let id = safeGetStorage(STORAGE_PLAYER_ID);
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      safeSetStorage(STORAGE_PLAYER_ID, id);
    }
    return id;
  }

  const clientState = {
    playerId: getOrCreatePlayerId(),
    playerName: safeGetStorage(STORAGE_PLAYER_NAME) || '',
    roomCode: null,
    roomState: null,
    draftBet: 100,
    draftMultiplier: 1,
    prevPhase: null,
    prevMyChips: null,
    prevBankruptCount: 0,
    adminDraftPunishments: [],
    adminDraftPunishmentMode: 'verbal',
    adminDraftActiveGame: 'pokdeng'
  };

  // ================= DOM ELEMENTS =================
  const el = {
    toastContainer: document.getElementById('toast-container'),
    lobbyView: document.getElementById('lobby-view'),
    tableView: document.getElementById('table-view'),

    // Lobby inputs
    inputPlayerName: document.getElementById('input-player-name'),
    tabJoin: document.getElementById('tab-join'),
    tabCreate: document.getElementById('tab-create'),
    panelJoin: document.getElementById('panel-join'),
    panelCreate: document.getElementById('panel-create'),
    inputRoomCode: document.getElementById('input-room-code'),
    inputInitialChips: document.getElementById('input-initial-chips'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnCreateRoom: document.getElementById('btn-create-room'),

    // Top HUD
    btnShareRoom: document.getElementById('btn-share-room'),
    hudRoomCode: document.getElementById('hud-room-code'),
    hudGameIcon: document.getElementById('hud-game-icon'),
    hudGameName: document.getElementById('hud-game-name'),
    btnDealerModal: document.getElementById('btn-dealer-modal'),
    hudDealerText: document.getElementById('hud-dealer-text'),
    hudMyChips: document.getElementById('hud-my-chips'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    btnOpenAdmin: document.getElementById('btn-open-admin'),

    // Table Area
    dealerCommunityZone: document.getElementById('dealer-community-zone'),
    tableStatusBanner: document.getElementById('table-status-banner'),
    opponentSeats: document.getElementById('opponent-seats'),

    // Own Dock
    ownPlayerName: document.getElementById('own-player-name'),
    ownRoleBadge: document.getElementById('own-role-badge'),
    ownStatusBadge: document.getElementById('own-status-badge'),
    ownBetBadge: document.getElementById('own-bet-badge'),
    ownDeltaBadge: document.getElementById('own-delta-badge'),
    ownCardsContainer: document.getElementById('own-cards-container'),
    actionControlsDock: document.getElementById('action-controls-dock'),

    // Modals
    dealerModal: document.getElementById('dealer-modal'),
    btnSetAutoDealer: document.getElementById('btn-set-auto-dealer'),
    shareRoomModal: document.getElementById('share-room-modal'),
    shareRoomCodeBig: document.getElementById('share-room-code-big'),
    shareQrImg: document.getElementById('share-qr-img'),
    shareRoomUrl: document.getElementById('share-room-url'),
    btnCopyRoomLink: document.getElementById('btn-copy-room-link'),

    // Admin Modal
    adminPanelModal: document.getElementById('admin-panel-modal'),
    adminMintTarget: document.getElementById('admin-mint-target'),
    adminMintAmount: document.getElementById('admin-mint-amount'),
    btnAdminMintCustom: document.getElementById('btn-admin-mint-custom'),
    btnAdminReviveAll: document.getElementById('btn-admin-revive-all'),
    payPdNormal: document.getElementById('pay-pd-normal'),
    payPdDeng2: document.getElementById('pay-pd-deng2'),
    payPdDeng3: document.getElementById('pay-pd-deng3'),
    payPdStraight: document.getElementById('pay-pd-straight'),
    payPdSian: document.getElementById('pay-pd-sian'),
    payPdTong: document.getElementById('pay-pd-tong'),
    payBjNormal: document.getElementById('pay-bj-normal'),
    payBjBlackjack: document.getElementById('pay-bj-blackjack'),
    blindSb: document.getElementById('blind-sb'),
    blindBb: document.getElementById('blind-bb'),
    btnPunishVerbal: document.getElementById('btn-punish-verbal'),
    btnPunishRandom: document.getElementById('btn-punish-random'),
    adminPunishmentList: document.getElementById('admin-punishment-list'),
    inputNewPunishment: document.getElementById('input-new-punishment'),
    btnAddPunishment: document.getElementById('btn-add-punishment'),
    btnSaveAdminSettings: document.getElementById('btn-save-admin-settings'),

    // Bankruptcy Overlay
    bankruptcyOverlay: document.getElementById('bankruptcy-overlay'),
    bankruptcyVictims: document.getElementById('bankruptcy-victims'),
    punishmentVerbalBox: document.getElementById('punishment-verbal-box'),
    punishmentRandomBox: document.getElementById('punishment-random-box'),
    punishmentDrawResult: document.getElementById('punishment-draw-result'),
    btnDrawPunishment: document.getElementById('btn-draw-punishment'),
    btnAdminQuickRevive: document.getElementById('btn-admin-quick-revive'),
    btnAckBankruptcy: document.getElementById('btn-ack-bankruptcy')
  };

  // ================= SOCKET.IO INITIALIZATION =================
  const socket = typeof io === 'function' ? io() : null;

  function showToast(msg, isError = false) {
    if (!el.toastContainer) return;
    const item = document.createElement('div');
    item.className = 'toast-item' + (isError ? ' toast-error' : '');
    item.textContent = msg;
    el.toastContainer.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, 3200);
  }

  function formatChips(num) {
    return Number(num || 0).toLocaleString('en-US');
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ================= CARD HTML RENDERER =================
  function renderCardHtml(card, isLarge = false) {
    const sizeClass = isLarge ? ' card-lg' : '';
    if (!card || card.hidden) {
      return `<div class="playing-card card-hidden${sizeClass}" aria-label="ไพ่คว่ำ"></div>`;
    }
    const isRed = card.suit === '♥' || card.suit === '♦';
    const suitClass = isRed ? 'suit-red' : 'suit-black';
    const rank = escapeHtml(card.rank);
    const suit = escapeHtml(card.suit);
    return `
      <div class="playing-card ${suitClass}${sizeClass}">
        <div class="card-corner-top">${rank}${suit}</div>
        <div class="card-center-suit">${suit}</div>
        <div class="card-corner-bottom">${rank}</div>
      </div>
    `;
  }

  function renderCardsRowHtml(cards, isLarge = false) {
    if (!Array.isArray(cards) || cards.length === 0) {
      return `<div class="cards-row"><span style="color:var(--text-muted);font-size:0.8rem;">ยังไม่มีไพ่</span></div>`;
    }
    return `<div class="cards-row">${cards.map(c => renderCardHtml(c, isLarge)).join('')}</div>`;
  }

  // ================= LOBBY LOGIC & URL AUTO-FILL =================
  function initLobby() {
    if (clientState.playerName) {
      el.inputPlayerName.value = clientState.playerName;
    }

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      el.inputRoomCode.value = roomParam.trim().slice(0, 4);
      switchLobbyTab('join');
    }

    el.tabJoin.addEventListener('click', () => switchLobbyTab('join'));
    el.tabCreate.addEventListener('click', () => switchLobbyTab('create'));

    document.querySelectorAll('.chip-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        el.inputInitialChips.value = btn.dataset.chips;
      });
    });

    el.btnCreateRoom.addEventListener('click', handleCreateRoom);
    el.btnJoinRoom.addEventListener('click', handleJoinRoom);
  }

  function switchLobbyTab(tab) {
    if (tab === 'create') {
      el.tabCreate.classList.add('active');
      el.tabJoin.classList.remove('active');
      el.panelCreate.classList.remove('hidden');
      el.panelJoin.classList.add('hidden');
    } else {
      el.tabJoin.classList.add('active');
      el.tabCreate.classList.remove('active');
      el.panelJoin.classList.remove('hidden');
      el.panelCreate.classList.add('hidden');
    }
  }

  function savePlayerName() {
    const name = el.inputPlayerName.value.trim() || 'เสี่ยนิรนาม';
    clientState.playerName = name;
    safeSetStorage(STORAGE_PLAYER_NAME, name);
    return name;
  }

  function handleCreateRoom() {
    if (!socket) return;
    const hostName = savePlayerName();
    const initialChips = Number(el.inputInitialChips.value) || 1000;

    socket.emit(
      'room:create',
      { hostName, playerId: clientState.playerId, initialChips },
      res => {
        if (!res || !res.ok) {
          showToast(res?.error || 'ไม่สามารถสร้างห้องได้', true);
          return;
        }
        clientState.roomCode = res.roomCode;
        enterTableView(res.roomCode);
        sfx.playChipBet();
      }
    );
  }

  function handleJoinRoom() {
    if (!socket) return;
    const playerName = savePlayerName();
    const roomCode = el.inputRoomCode.value.trim();
    if (!roomCode || roomCode.length < 4) {
      showToast('กรุณากรอกรหัสห้อง 4 หลัก', true);
      return;
    }

    socket.emit(
      'room:join',
      { roomCode, playerName, playerId: clientState.playerId },
      res => {
        if (!res || !res.ok) {
          showToast(res?.error || 'ไม่พบห้องที่ระบุ', true);
          return;
        }
        clientState.roomCode = res.roomCode;
        enterTableView(res.roomCode);
        sfx.playChipBet();
      }
    );
  }

  function enterTableView(roomCode) {
    el.lobbyView.classList.add('hidden');
    el.tableView.classList.remove('hidden');
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    window.history.replaceState({}, '', url.toString());
  }

  // ================= MAIN ROOM STATE RENDERING =================
  function handleRoomState(state) {
    if (!state) return;

    // Trigger sound effects on transitions
    const newPhase = state.gameState?.phase || 'IDLE';
    if (newPhase !== clientState.prevPhase) {
      if (['PLAYER_TURN', 'PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(newPhase)) {
        sfx.playCardDeal();
      } else if (newPhase === 'SETTLED' || newPhase === 'SHOWDOWN') {
        sfx.playWinFanfare();
      }
      clientState.prevPhase = newPhase;
    }

    const bankruptCount = Array.isArray(state.activeBankruptcies) ? state.activeBankruptcies.length : 0;
    if (bankruptCount > clientState.prevBankruptCount) {
      sfx.playBankruptcySiren();
    }
    clientState.prevBankruptCount = bankruptCount;

    clientState.roomState = state;
    clientState.roomCode = state.code;

    renderTopHud(state);
    renderDealerAndCommunityZone(state);
    renderStatusBanner(state);
    renderOpponents(state);
    renderOwnHandAndActions(state);
    renderBankruptcyOverlay(state);
  }

  function renderTopHud(state) {
    el.hudRoomCode.textContent = state.code || '----';

    const activeGame = state.settings?.activeGame || 'pokdeng';
    const gameMeta = {
      pokdeng: { icon: '🎴', name: 'ป๊อกเด้ง' },
      blackjack: { icon: '🃏', name: 'แบล็คแจ็ค 21' },
      poker: { icon: '♠️', name: "Texas Hold'em" },
      realcards: { icon: '🖐️', name: 'โหมดไพ่ของจริง' }
    }[activeGame] || { icon: '🎴', name: 'ป๊อกเด้ง' };

    el.hudGameIcon.textContent = gameMeta.icon;
    el.hudGameName.textContent = gameMeta.name;

    if (activeGame === 'realcards') {
      const isPlayerDealer = state.dealer?.mode === 'player' && state.dealer.playerId;
      const dealerName = isPlayerDealer
        ? `👑 เจ้ามือ: ${escapeHtml(state.players[state.dealer.playerId]?.name || 'ผู้เล่น')} (${state.dealer.roundsLeft} ตา)`
        : '🤖 กองกลาง / เจ้ามือกลาง (Auto Dealer)';
      const subGame = gs?.subGame || state.settings?.realCardsSubGame || 'pokdeng';
      const subGameLabels = {
        pokdeng: '🎴 ป๊อกเด้ง (1x-5x)',
        blackjack: '🃏 แบล็คแจ็ค (1x/1.5x/2x)',
        custom: '⚡ กำหนดเกม/อัตราจ่ายอิสระ'
      };
      el.dealerCommunityZone.innerHTML = `
        <div class="zone-header">
          <span>🖐️ โหมดไพ่ของจริง • ${dealerName}</span>
          <span class="pot-pill">${subGameLabels[subGame] || '🎴 ป๊อกเด้ง'}</span>
        </div>
        <div class="chip-bet-bar" style="margin-top:0.35rem;justify-content:center;">
          <button type="button" class="chip-btn ${subGame === 'pokdeng' ? 'chip-allin' : ''}" data-rc-subgame="pokdeng">🎴 ป๊อกเด้ง</button>
          <button type="button" class="chip-btn ${subGame === 'blackjack' ? 'chip-allin' : ''}" data-rc-subgame="blackjack">🃏 แบล็คแจ็ค</button>
          <button type="button" class="chip-btn ${subGame === 'custom' ? 'chip-allin' : ''}" data-rc-subgame="custom">⚡ เก้าเก / กำหนดเอง</button>
        </div>
      `;
      el.dealerCommunityZone.querySelectorAll('[data-rc-subgame]').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen = btn.dataset.rcSubgame;
          socket.emit('game:switchMode', {
            roomCode: clientState.roomCode,
            playerId: clientState.playerId,
            subGame: chosen
          });
        });
      });
      return;
    }

    if (activeGame === 'poker') {
      const dPid = state.gameState?.dealerPlayerId;
      const dName = dPid && state.players[dPid] ? state.players[dPid].name : 'สลับตามเข็ม';
      el.hudDealerText.textContent = `🔘 ปุ่ม Dealer: ${dName}`;
    } else if (state.dealer?.mode === 'player' && state.dealer.playerId) {
      const dealerPlayer = state.players[state.dealer.playerId];
      const dName = dealerPlayer ? dealerPlayer.name : 'ผู้เล่น';
      el.hudDealerText.textContent = `👑 เจ้ามือ: ${dName} (เหลือ ${state.dealer.roundsLeft} ตา)`;
    } else {
      el.hudDealerText.textContent = '🤖 Auto Dealer';
    }

    const you = state.you || state.players?.[clientState.playerId];
    if (you) {
      if (typeof clientState.prevMyChips === 'number' && clientState.prevMyChips !== you.chips) {
        animateChipCounter(el.hudMyChips, clientState.prevMyChips, you.chips);
      } else {
        el.hudMyChips.textContent = formatChips(you.chips);
      }
      clientState.prevMyChips = you.chips;
      if (you.isAdmin) {
        el.btnOpenAdmin.classList.remove('hidden');
      } else {
        el.btnOpenAdmin.classList.add('hidden');
      }
    }
  }

  function renderDealerAndCommunityZone(state) {
    const activeGame = state.settings?.activeGame || 'pokdeng';
    const gs = state.gameState;

    if (activeGame === 'poker') {
      const sb = state.settings?.blinds?.smallBlind ?? 10;
      const bb = state.settings?.blinds?.bigBlind ?? 20;
      const pot = gs?.pot ?? 0;
      const commCards = gs?.communityCards || [];

      el.dealerCommunityZone.innerHTML = `
        <div class="zone-header">
          <span>♠️ กองกลาง (Community Cards)</span>
          <span class="pot-pill">💰 POT: ${formatChips(pot)}</span>
          <span class="mini-pill">Blinds: ${sb}/${bb}</span>
        </div>
        ${renderCardsRowHtml(commCards, false)}
      `;
      return;
    }

    // Pok Deng or Blackjack Dealer Zone
    const isPlayerDealer = state.dealer?.mode === 'player' && state.dealer.playerId;
    const dealerName = isPlayerDealer
      ? `👑 เจ้ามือ: ${escapeHtml(state.players[state.dealer.playerId]?.name || 'ผู้เล่น')} (${state.dealer.roundsLeft} ตา)`
      : '🤖 เจ้ามือบอท (Auto Dealer)';

    const dh = gs?.dealerHand;
    let dealerEvalBadge = '';
    if (dh && dh.label) {
      dealerEvalBadge = `<span class="pot-pill">${escapeHtml(dh.label)}</span>`;
    }

    el.dealerCommunityZone.innerHTML = `
      <div class="zone-header">
        <span>${dealerName}</span>
        ${dealerEvalBadge}
      </div>
      ${dh && Array.isArray(dh.cards) ? renderCardsRowHtml(dh.cards, false) : `<div class="cards-row"><span style="color:var(--text-muted);font-size:0.8rem;">รอแจกไพ่เจ้ามือ</span></div>`}
    `;
  }

  function renderStatusBanner(state) {
    const activeGame = state.settings?.activeGame || 'pokdeng';
    const gs = state.gameState;

    if (!gs) {
      el.tableStatusBanner.textContent = '✨ รอเริ่มตาใหม่ — กด "เริ่มตาใหม่" หรือกด "เป็นเจ้ามือ" ได้เลย!';
      return;
    }

    if (activeGame === 'pokdeng') {
      const map = {
        BETTING: '🪙 รอบวางเดิมพัน — เมื่อทุกคนกดยืนยันเดิมพันครบ ระบบจะแจกไพ่อัตโนมัติ!',
        PLAYER_TURN: '🎴 รอบผู้เล่นตัดสินใจ — เลือก "จั่วไพ่" หรือ "อยู่"',
        DEALER_TURN: '👑 รอบเจ้ามือตัดสินใจ — เจ้ามือเลือก "จั่วไพ่" หรือ "อยู่"',
        SETTLED: '🏁 สรุปผลตานี้เรียบร้อย!'
      };
      el.tableStatusBanner.textContent = map[gs.phase] || gs.phase;
    } else if (activeGame === 'blackjack') {
      if (gs.phase === 'PLAYER_TURN' && gs.currentTurnPlayerId) {
        const turnName = state.players[gs.currentTurnPlayerId]?.name || 'ผู้เล่น';
        el.tableStatusBanner.textContent = `👉 ถึงตาของ: ${turnName} (Hit / Stand / Double)`;
      } else {
        const map = {
          BETTING: '🪙 รอบวางเดิมพัน แบล็คแจ็ค 21',
          DEALER_TURN: '👑 รอบเจ้ามือจั่วไพ่ (Dealer Turn)',
          SETTLED: '🏁 สรุปผลแบล็คแจ็คเรียบร้อย!'
        };
        el.tableStatusBanner.textContent = map[gs.phase] || gs.phase;
      }
    } else if (activeGame === 'realcards') {
      const map = {
        BETTING: '🪙 โหมดไพ่ของจริง (รอบวางเดิมพัน) — กดยืนยันเดิมพันหรือข้ามให้ครบทุกคนเพื่อเริ่มแจกไพ่จริง!',
        PLAYING: '🖐️ แจกไพ่ของจริงหน้าวงได้เลย! ดูไพ่ในมือแล้วเลือก "อัตราจ่าย" และกด "ชนะ / เสมอ / แพ้" ด้านล่าง',
        SETTLED: '🏁 สรุปผลชิปโหมดไพ่ของจริงเรียบร้อย!'
      };
      el.tableStatusBanner.textContent = map[gs.phase] || gs.phase;
    } else if (activeGame === 'poker') {
      if (gs.phase === 'SHOWDOWN') {
        const winners = (gs.results?.winners || []).map(pid => state.players[pid]?.name || pid).join(', ');
        el.tableStatusBanner.textContent = `🏆 จบตา (Showdown)! ผู้ชนะ: ${winners || '-'}`;
      } else {
        const turnName = gs.currentTurnPlayerId ? (state.players[gs.currentTurnPlayerId]?.name || '') : '';
        el.tableStatusBanner.textContent = `♠️ รอบ ${gs.phase} — ตาของ: ${turnName}`;
      }
    }
  }

  function renderOpponents(state) {
    const myId = clientState.playerId;
    const activeGame = state.settings?.activeGame || 'pokdeng';
    const gs = state.gameState;
    const order = state.playerOrder || Object.keys(state.players || {});
    const opponents = order.filter(pid => pid !== myId && state.players[pid]);

    if (opponents.length === 0) {
      el.opponentSeats.innerHTML = `
        <div class="seat-card" style="text-align:center;color:var(--text-muted);padding:0.9rem;">
          ยังไม่มีเพื่อนร่วมโต๊ะ — กดปุ่ม <strong>ห้อง ${escapeHtml(state.code)} 📲</strong> ด้านบนเพื่อส่งลิงก์หรือ QR ชวนเพื่อน!
        </div>
      `;
      return;
    }

    el.opponentSeats.innerHTML = opponents.map(pid => {
      const p = state.players[pid];
      const isTurn = gs?.currentTurnPlayerId === pid;
      const isPlayerDealer = state.dealer?.mode === 'player' && state.dealer.playerId === pid;
      const badges = [];

      if (!p.connected) badges.push(`<span class="mini-pill">ออฟไลน์</span>`);
      if (isPlayerDealer && activeGame !== 'poker') badges.push(`<span class="mini-pill eval">👑 เจ้ามือ</span>`);
      if (p.isBankrupt || p.chips <= 0) badges.push(`<span class="mini-pill bankrupt">💀 ถังแตก</span>`);

      let cardsHtml = '';

      if (activeGame === 'realcards') {
        const bet = gs?.bets?.[pid];
        if (bet > 0) badges.push(`<span class="mini-pill bet"><span class="chip-stack-3d" aria-hidden="true"></span>เดิมพัน: ${formatChips(bet)}</span>`);
        else if (bet === 0) badges.push(`<span class="mini-pill">⏭️ ไม่ลงเดิมพัน</span>`);
        const out = gs?.outcomes?.[pid];
        if (out && out.label) {
          badges.push(`<span class="mini-pill ${out.done ? 'eval' : ''}">${escapeHtml(out.label)}</span>`);
        }
        const delta = gs?.results?.settlements?.[pid];
        if (typeof delta === 'number') {
          const cls = delta >= 0 ? 'win' : 'lose';
          const sign = delta > 0 ? '+' : '';
          badges.push(`<span class="mini-pill ${cls}">${sign}${formatChips(delta)}</span>`);
        }
      } else if (activeGame === 'pokdeng' || activeGame === 'blackjack') {
        const bet = gs?.bets?.[pid];
        if (bet > 0) badges.push(`<span class="mini-pill bet"><span class="chip-stack-3d" aria-hidden="true"></span>เดิมพัน: ${formatChips(bet)}</span>`);
        else if (bet === 0) badges.push(`<span class="mini-pill">⏭️ ไม่ลงเดิมพัน</span>`);
        const hand = gs?.hands?.[pid];
        if (hand) {
          if (hand.label) badges.push(`<span class="mini-pill eval">${escapeHtml(hand.label)}</span>`);
          if (hand.done && !hand.revealed) badges.push(`<span class="mini-pill">หมอบ/พร้อม</span>`);
          cardsHtml = renderCardsRowHtml(hand.cards, false);
        }
        const delta = gs?.results?.settlements?.[pid];
        if (typeof delta === 'number') {
          const cls = delta >= 0 ? 'win' : 'lose';
          const sign = delta > 0 ? '+' : '';
          badges.push(`<span class="mini-pill ${cls}">${sign}${formatChips(delta)}</span>`);
        }
      } else if (activeGame === 'poker') {
        if (gs?.dealerPlayerId === pid) badges.push(`<span class="mini-pill eval">D</span>`);
        if (gs?.sbPlayerId === pid) badges.push(`<span class="mini-pill">SB</span>`);
        if (gs?.bbPlayerId === pid) badges.push(`<span class="mini-pill">BB</span>`);

        const pk = gs?.players?.[pid];
        if (pk) {
          if (pk.currentBet > 0) badges.push(`<span class="mini-pill bet"><span class="chip-stack-3d" aria-hidden="true"></span>ลง: ${formatChips(pk.currentBet)}</span>`);
          if (pk.folded) badges.push(`<span class="mini-pill lose">หมอบ (Fold)</span>`);
          if (pk.allIn) badges.push(`<span class="mini-pill bankrupt">🔥 All-in</span>`);
          const evalName = gs?.results?.handDetails?.[pid]?.name;
          if (evalName) badges.push(`<span class="mini-pill eval">${escapeHtml(evalName)}</span>`);
          cardsHtml = renderCardsRowHtml(pk.holeCards, false);
        }
        const winAmt = gs?.results?.payouts?.[pid];
        if (winAmt > 0) {
          badges.push(`<span class="mini-pill win">+${formatChips(winAmt)}</span>`);
        }
      }

      const seatClasses = [
        'seat-card',
        isTurn ? 'active-turn' : '',
        p.isBankrupt || p.chips <= 0 ? 'bankrupt-seat' : ''
      ].filter(Boolean).join(' ');

      return `
        <div class="${seatClasses}">
          <div class="seat-top">
            <span class="seat-name">${escapeHtml(p.name)}</span>
            <span class="seat-chips">🪙 ${formatChips(p.chips)}</span>
          </div>
          <div class="seat-badges">${badges.join('')}</div>
          ${cardsHtml}
        </div>
      `;
    }).join('');
  }

  // ================= OWN HAND & CONTEXTUAL ACTION DOCK =================
  function renderOwnHandAndActions(state) {
    const myId = clientState.playerId;
    const you = state.you || state.players?.[myId];
    if (!you) return;

    const activeGame = state.settings?.activeGame || 'pokdeng';
    const gs = state.gameState;
    const isHumanDealer = activeGame !== 'poker' && state.dealer?.mode === 'player' && state.dealer.playerId === myId;

    el.ownPlayerName.textContent = `${you.name} (คุณ)`;

    if (isHumanDealer) {
      el.ownRoleBadge.textContent = `👑 เจ้ามือ (${state.dealer.roundsLeft} ตา)`;
      el.ownRoleBadge.classList.remove('hidden');
    } else if (activeGame === 'poker' && gs?.dealerPlayerId === myId) {
      el.ownRoleBadge.textContent = '🔘 Dealer';
      el.ownRoleBadge.classList.remove('hidden');
    } else {
      el.ownRoleBadge.classList.add('hidden');
    }

    // Reset badges
    el.ownStatusBadge.classList.add('hidden');
    el.ownBetBadge.classList.add('hidden');
    el.ownDeltaBadge.classList.add('hidden');

    // Render Own Cards
    let ownCards = [];
    if (activeGame === 'realcards') {
      const myBet = gs?.bets?.[myId];
      if (myBet > 0) {
        el.ownBetBadge.innerHTML = `<span class="chip-stack-3d" aria-hidden="true"></span>เดิมพัน: ${formatChips(myBet)}`;
        el.ownBetBadge.classList.remove('hidden');
      } else if (myBet === 0) {
        el.ownBetBadge.textContent = '⏭️ ไม่ลงเดิมพันตานี้';
        el.ownBetBadge.classList.remove('hidden');
      }
      const myOut = gs?.outcomes?.[myId];
      if (myOut?.label) {
        el.ownStatusBadge.textContent = myOut.label;
        el.ownStatusBadge.classList.remove('hidden');
      }
      const delta = gs?.results?.settlements?.[myId];
      if (typeof delta === 'number') {
        el.ownDeltaBadge.textContent = `${delta > 0 ? '+' : ''}${formatChips(delta)}`;
        el.ownDeltaBadge.className = `delta-pill ${delta >= 0 ? 'win' : 'lose'}`;
      }
    } else if (activeGame === 'pokdeng' || activeGame === 'blackjack') {
      const myHand = isHumanDealer ? gs?.dealerHand : gs?.hands?.[myId];
      if (myHand && Array.isArray(myHand.cards)) {
        ownCards = myHand.cards;
      }
      if (myHand?.label) {
        el.ownStatusBadge.textContent = myHand.label;
        el.ownStatusBadge.classList.remove('hidden');
      }
      const myBet = gs?.bets?.[myId];
      if (myBet > 0) {
        el.ownBetBadge.innerHTML = `<span class="chip-stack-3d" aria-hidden="true"></span>เดิมพัน: ${formatChips(myBet)}`;
        el.ownBetBadge.classList.remove('hidden');
      } else if (myBet === 0) {
        el.ownBetBadge.textContent = '⏭️ ไม่ลงเดิมพันตานี้';
        el.ownBetBadge.classList.remove('hidden');
      }
      const delta = gs?.results?.settlements?.[myId];
      if (typeof delta === 'number') {
        el.ownDeltaBadge.textContent = `${delta > 0 ? '+' : ''}${formatChips(delta)}`;
        el.ownDeltaBadge.className = `delta-pill ${delta >= 0 ? 'win' : 'lose'}`;
      }
    } else if (activeGame === 'poker') {
      const pk = gs?.players?.[myId];
      if (pk && Array.isArray(pk.holeCards)) {
        ownCards = pk.holeCards;
      }
      const evalName = gs?.results?.handDetails?.[myId]?.name;
      if (evalName) {
        el.ownStatusBadge.textContent = evalName;
        el.ownStatusBadge.classList.remove('hidden');
      } else if (pk?.folded) {
        el.ownStatusBadge.textContent = 'หมอบแล้ว (Folded)';
        el.ownStatusBadge.classList.remove('hidden');
      } else if (pk?.allIn) {
        el.ownStatusBadge.textContent = '🔥 All-in!';
        el.ownStatusBadge.classList.remove('hidden');
      }
      if (pk?.totalBet > 0) {
        el.ownBetBadge.innerHTML = `<span class="chip-stack-3d" aria-hidden="true"></span>ลงรวม: ${formatChips(pk.totalBet)}`;
        el.ownBetBadge.classList.remove('hidden');
      }
      const winAmt = gs?.results?.payouts?.[myId];
      if (winAmt > 0) {
        el.ownDeltaBadge.textContent = `+${formatChips(winAmt)}`;
        el.ownDeltaBadge.className = 'delta-pill win';
      }
    }

    if (activeGame === 'realcards') {
      el.ownCardsContainer.innerHTML = `<span style="color:var(--neon-gold-bright);font-size:0.86rem;">🖐️ ใช้ไพ่ของจริงหน้าวง — เลือกเกม อัตราจ่าย และกดผลลัพธ์ด้านล่างได้เลย</span>`;
    } else {
      el.ownCardsContainer.innerHTML = ownCards.length > 0
        ? ownCards.map(c => renderCardHtml(c, true)).join('')
        : `<span style="color:var(--text-muted);font-size:0.86rem;">ไพ่ของคุณจะแสดงตรงนี้เมื่อเริ่มแจกไพ่</span>`;
    }

    // Render Contextual Action Buttons
    renderActionButtons(state, you, activeGame, gs, isHumanDealer);
  }

  function renderActionButtons(state, you, activeGame, gs, isHumanDealer) {
    const myId = clientState.playerId;

        // 1. IDLE or SETTLED or SHOWDOWN -> Start New Round button
    if (!gs || gs.phase === 'SETTLED' || gs.phase === 'SHOWDOWN') {
      el.actionControlsDock.innerHTML = `
        <div class="action-btn-row">
          <button type="button" id="btn-start-round" class="btn-neon btn-gold btn-block">
            🚀 เริ่มตาใหม่ (${activeGame === 'realcards' ? 'โหมดไพ่ของจริง' : 'Start Round'})
          </button>
          ${activeGame !== 'poker' ? `
            <button type="button" id="btn-dock-dealer" class="btn-neon btn-outline">
              🎩 เป็นเจ้ามือ
            </button>
          ` : ''}
        </div>
      `;
      document.getElementById('btn-start-round')?.addEventListener('click', () => {
        emitGameStartRound();
      });
      document.getElementById('btn-dock-dealer')?.addEventListener('click', () => {
        el.dealerModal.classList.remove('hidden');
      });
      return;
    }

    // 2. BETTING PHASE (Pok Deng, Blackjack & Real Cards)
    if (gs.phase === 'BETTING' && (activeGame === 'pokdeng' || activeGame === 'blackjack' || activeGame === 'realcards')) {
      const rawBetVal = gs.bets?.[myId];
      const isSkipped = rawBetVal === 0;
      const currentPlacedBet = rawBetVal > 0 ? rawBetVal : 0;
      if (clientState.draftBet > you.chips) {
        clientState.draftBet = you.chips;
      }

      const isHumanDealerPid = (pid) => state.dealer?.mode === 'player' && state.dealer?.playerId === pid;
      const eligiblePids = (state.playerOrder || Object.keys(state.players || {})).filter(pid => {
        const p = state.players?.[pid];
        return p && p.chips > 0 && p.connected !== false && !isHumanDealerPid(pid);
      });
      const confirmedCount = eligiblePids.filter(pid => typeof gs.bets?.[pid] === 'number').length;
      const totalEligible = eligiblePids.length;

      if (isHumanDealer) {
        el.actionControlsDock.innerHTML = `
          <div class="text-center" style="color:var(--neon-gold-bright);font-size:0.92rem;padding:0.45rem 0;">
            ⏳ รอผู้เล่นยืนยันเดิมพันให้ครบ (${confirmedCount}/${totalEligible} คน) — ครบแล้วเริ่มตาทันที!
          </div>
        `;
        return;
      }

      el.actionControlsDock.innerHTML = `
        <div class="chip-bet-bar">
          <button type="button" class="chip-btn" data-add-chip="50">+50</button>
          <button type="button" class="chip-btn" data-add-chip="100">+100</button>
          <button type="button" class="chip-btn" data-add-chip="500">+500</button>
          <button type="button" class="chip-btn chip-allin" id="btn-chip-allin">เทหน้าตัก All-in</button>
          <button type="button" class="chip-btn chip-clear" id="btn-chip-clear">ล้าง</button>
        </div>
        <div class="action-btn-row">
          <button type="button" id="btn-confirm-bet" class="btn-neon ${currentPlacedBet > 0 ? 'btn-emerald' : 'btn-primary'}">
            ${currentPlacedBet > 0
              ? `✅ ยืนยันแล้ว (${formatChips(currentPlacedBet)}) (${confirmedCount}/${totalEligible})`
              : `🪙 ยืนยันเดิมพัน (${formatChips(clientState.draftBet)}) (${confirmedCount}/${totalEligible})`}
          </button>
          <button type="button" id="btn-skip-bet" class="btn-neon ${isSkipped ? 'btn-crimson' : 'btn-outline'}">
            ${isSkipped ? `⏭️ ไม่ลงเดิมพันแล้ว (${confirmedCount}/${totalEligible})` : '⏭️ ไม่ลงเดิมพัน'}
          </button>
        </div>
      `;

      el.actionControlsDock.querySelectorAll('[data-add-chip]').forEach(btn => {
        btn.addEventListener('click', () => {
          const add = Number(btn.dataset.addChip) || 0;
          clientState.draftBet = Math.min(you.chips, clientState.draftBet + add);
          sfx.playChipBet();
          renderOwnHandAndActions(clientState.roomState);
        });
      });

      document.getElementById('btn-chip-allin')?.addEventListener('click', () => {
        clientState.draftBet = you.chips;
        sfx.playChipBet();
        renderOwnHandAndActions(clientState.roomState);
      });

      document.getElementById('btn-chip-clear')?.addEventListener('click', () => {
        clientState.draftBet = Math.min(50, you.chips);
        renderOwnHandAndActions(clientState.roomState);
      });

      document.getElementById('btn-confirm-bet')?.addEventListener('click', () => {
        if (clientState.draftBet <= 0) {
          showToast('กรุณาเลือกชิปเดิมพัน', true);
          return;
        }
        socket.emit(
          'game:placeBet',
          { roomCode: clientState.roomCode, playerId: myId, amount: clientState.draftBet },
          res => {
            if (!res?.ok) showToast(res?.error || 'วางเดิมพันไม่สำเร็จ', true);
            else {
              sfx.playChipBet();
              showToast(`ยืนยันเดิมพัน ${formatChips(clientState.draftBet)} ชิปแล้ว!`);
            }
          }
        );
      });

      document.getElementById('btn-skip-bet')?.addEventListener('click', () => {
        socket.emit(
          'game:placeBet',
          { roomCode: clientState.roomCode, playerId: myId, amount: 0, skip: true },
          res => {
            if (!res?.ok) showToast(res?.error || 'ไม่สามารถข้ามการเดิมพันได้', true);
            else {
              showToast('เลือกไม่ลงเดิมพันในตานี้แล้ว');
            }
          }
        );
      });
      return;
    }

    // 2.5 REAL CARDS PLAYING PHASE (Select Multiplier & Win/Tie/Lose)
    if (activeGame === 'realcards' && gs.phase === 'PLAYING') {
      const activePids = gs.activePlayers || [];
      const doneCount = activePids.filter(pid => gs.outcomes?.[pid]?.done).length;
      const totalActive = activePids.length;
      const myOutcome = gs.outcomes?.[myId];
      const myBet = gs.bets?.[myId] || 0;

      if (isHumanDealer || !activePids.includes(myId)) {
        el.actionControlsDock.innerHTML = `
          <div class="text-center" style="color:var(--neon-gold-bright);font-size:0.9rem;margin-bottom:0.4rem;">
            🖐️ รอผู้เล่นกดเลือกผลไพ่ของจริง (${doneCount}/${totalActive} คน)
          </div>
          ${(isHumanDealer || you.isAdmin) ? `
            <div class="action-btn-row">
              <button type="button" id="btn-rc-force-settle" class="btn-neon btn-gold btn-block">
                ⚖️ สรุปผลชิปทันที (${doneCount}/${totalActive} คนยืนยันแล้ว)
              </button>
            </div>
          ` : ''}
        `;
        document.getElementById('btn-rc-force-settle')?.addEventListener('click', () => {
          emitGameAction('settle');
        });
        return;
      }

      const subGame = gs.subGame || state.settings?.realCardsSubGame || 'pokdeng';
      const pdPay = state.settings?.payouts?.pokdeng || {};
      const bjPay = state.settings?.payouts?.blackjack || {};

      let multPresets = [
        { mult: pdPay.normal || 1, label: `1x (ปกติ)` },
        { mult: pdPay.deng2 || 2, label: `${pdPay.deng2 || 2}x (2 เด้ง)` },
        { mult: pdPay.deng3 || 3, label: `${pdPay.deng3 || 3}x (3 เด้ง/เรียง/เซียน)` },
        { mult: pdPay.tong || 5, label: `${pdPay.tong || 5}x (ตอง)` }
      ];
      if (subGame === 'blackjack') {
        multPresets = [
          { mult: bjPay.normal || 1, label: '1x (ชนะปกติ)' },
          { mult: bjPay.blackjack || 1.5, label: `${bjPay.blackjack || 1.5}x (Blackjack)` },
          { mult: 2, label: '2x (Double)' }
        ];
      } else if (subGame === 'custom') {
        multPresets = [
          { mult: 1, label: '1x' },
          { mult: 1.5, label: '1.5x' },
          { mult: 2, label: '2x' },
          { mult: 3, label: '3x' },
          { mult: 5, label: '5x' }
        ];
      }

      const curMult = Number(clientState.draftMultiplier) || 1;
      const expectedChips = Math.ceil(myBet * curMult);

      el.actionControlsDock.innerHTML = `
        <div class="chip-bet-bar" style="align-items:center;">
          <span style="font-size:0.78rem;color:var(--text-muted);margin-right:0.2rem;">อัตราจ่าย:</span>
          ${multPresets.map(p => `
            <button type="button" class="chip-btn ${curMult === Number(p.mult) ? 'chip-allin' : ''}" data-rc-mult="${p.mult}">
              ${p.label}
            </button>
          `).join('')}
          <input type="number" id="input-rc-custom-mult" class="neon-input" value="${curMult}" min="0.5" max="100" step="0.5" style="width:70px;padding:0.25rem 0.4rem;font-size:0.85rem;text-align:center;" title="กำหนดอัตราจ่ายเอง (เท่า)">
        </div>
        <div class="action-btn-row">
          <button type="button" id="btn-rc-win" class="btn-neon btn-emerald">
            🏆 ชนะ (+${formatChips(expectedChips)})
          </button>
          <button type="button" id="btn-rc-tie" class="btn-neon btn-outline">
            🤝 เสมอ (0)
          </button>
          <button type="button" id="btn-rc-lose" class="btn-neon btn-crimson">
            💸 แพ้ (-${formatChips(expectedChips)})
          </button>
        </div>
        ${myOutcome?.done ? `
          <div class="text-center" style="font-size:0.82rem;color:var(--neon-emerald);margin-top:0.25rem;">
            ✅ บันทึกแล้ว: ${escapeHtml(myOutcome.label)} — รอเพื่อน (${doneCount}/${totalActive} คน) (กดเปลี่ยนผลได้จนกว่าจะครบทุกคน)
          </div>
        ` : ''}
      `;

      el.actionControlsDock.querySelectorAll('[data-rc-mult]').forEach(btn => {
        btn.addEventListener('click', () => {
          clientState.draftMultiplier = Number(btn.dataset.rcMult) || 1;
          sfx.playChipBet();
          renderOwnHandAndActions(clientState.roomState);
        });
      });

      const multInput = document.getElementById('input-rc-custom-mult');
      multInput?.addEventListener('change', () => {
        const val = Number(multInput.value);
        if (!Number.isNaN(val) && val > 0) {
          clientState.draftMultiplier = val;
          renderOwnHandAndActions(clientState.roomState);
        }
      });

      const sendOutcome = (outcome) => {
        const inputVal = Number(document.getElementById('input-rc-custom-mult')?.value);
        const mult = (!Number.isNaN(inputVal) && inputVal > 0) ? inputVal : (clientState.draftMultiplier || 1);
        clientState.draftMultiplier = mult;
        socket.emit(
          'game:action',
          {
            roomCode: clientState.roomCode,
            playerId: myId,
            action: outcome,
            outcome,
            multiplier: outcome === 'tie' ? 1 : mult
          },
          res => {
            if (!res?.ok) showToast(res?.error || 'บันทึกผลไม่สำเร็จ', true);
            else {
              sfx.playChipBet();
              showToast('บันทึกผลไพ่จริงเรียบร้อย!');
            }
          }
        );
      };

      document.getElementById('btn-rc-win')?.addEventListener('click', () => sendOutcome('win'));
      document.getElementById('btn-rc-tie')?.addEventListener('click', () => sendOutcome('tie'));
      document.getElementById('btn-rc-lose')?.addEventListener('click', () => sendOutcome('lose'));
      return;
    }

    // 3. POK DENG PLAYER_TURN or DEALER_TURN
    if (activeGame === 'pokdeng') {
      if (gs.phase === 'PLAYER_TURN') {
        const myHand = gs.hands?.[myId];
        if (!myHand || myHand.done) {
          el.actionControlsDock.innerHTML = `<div class="text-center" style="color:var(--text-muted);font-size:0.88rem;">⏳ รอผู้เล่นคนอื่นตัดสินใจ...</div>`;
          return;
        }
        el.actionControlsDock.innerHTML = `
          <div class="action-btn-row">
            <button type="button" id="btn-pd-draw" class="btn-neon btn-gold">🎴 จั่วไพ่ใบที่ 3</button>
            <button type="button" id="btn-pd-stand" class="btn-neon btn-outline">✋ อยู่ (Stand)</button>
          </div>
        `;
        document.getElementById('btn-pd-draw')?.addEventListener('click', () => emitGameAction('draw'));
        document.getElementById('btn-pd-stand')?.addEventListener('click', () => emitGameAction('stand'));
        return;
      }

      if (gs.phase === 'DEALER_TURN') {
        if (!isHumanDealer) {
          el.actionControlsDock.innerHTML = `<div class="text-center" style="color:var(--text-muted);font-size:0.88rem;">⏳ รอเจ้ามือตัดสินใจ...</div>`;
          return;
        }
        el.actionControlsDock.innerHTML = `
          <div class="action-btn-row">
            <button type="button" id="btn-pd-dealer-draw" class="btn-neon btn-gold">👑 เจ้ามือจั่วไพ่</button>
            <button type="button" id="btn-pd-dealer-stand" class="btn-neon btn-primary">⚖️ อยู่ & เปิดไพ่ตัดสิน</button>
          </div>
        `;
        document.getElementById('btn-pd-dealer-draw')?.addEventListener('click', () => emitGameAction('draw'));
        document.getElementById('btn-pd-dealer-stand')?.addEventListener('click', () => emitGameAction('stand'));
        return;
      }
    }

    // 4. BLACKJACK PLAYER_TURN or DEALER_TURN
    if (activeGame === 'blackjack') {
      if (gs.phase === 'PLAYER_TURN') {
        if (gs.currentTurnPlayerId !== myId) {
          const turnName = state.players[gs.currentTurnPlayerId]?.name || 'เพื่อน';
          el.actionControlsDock.innerHTML = `<div class="text-center" style="color:var(--text-muted);font-size:0.88rem;">⏳ รอตาของ ${escapeHtml(turnName)}...</div>`;
          return;
        }
        const myHand = gs.hands?.[myId];
        const myBet = gs.bets?.[myId] || 0;
        const canDouble = myHand?.cards?.length === 2 && you.chips >= myBet * 2;

        el.actionControlsDock.innerHTML = `
          <div class="action-btn-row">
            <button type="button" id="btn-bj-hit" class="btn-neon btn-gold">🃏 จั่ว (Hit)</button>
            <button type="button" id="btn-bj-stand" class="btn-neon btn-outline">✋ อยู่ (Stand)</button>
            <button type="button" id="btn-bj-double" class="btn-neon btn-crimson" ${canDouble ? '' : 'disabled'}>⚡ คูณสอง (Double)</button>
          </div>
        `;
        document.getElementById('btn-bj-hit')?.addEventListener('click', () => emitGameAction('hit'));
        document.getElementById('btn-bj-stand')?.addEventListener('click', () => emitGameAction('stand'));
        document.getElementById('btn-bj-double')?.addEventListener('click', () => emitGameAction('double'));
        return;
      }

      if (gs.phase === 'DEALER_TURN') {
        if (!isHumanDealer) {
          el.actionControlsDock.innerHTML = `<div class="text-center" style="color:var(--text-muted);font-size:0.88rem;">⏳ รอเจ้ามือจั่วไพ่...</div>`;
          return;
        }
        el.actionControlsDock.innerHTML = `
          <div class="action-btn-row">
            <button type="button" id="btn-bj-dealer-hit" class="btn-neon btn-gold">👑 เจ้ามือจั่ว (Hit)</button>
            <button type="button" id="btn-bj-dealer-stand" class="btn-neon btn-primary">⚖️ เจ้ามืออยู่ (Stand)</button>
          </div>
        `;
        document.getElementById('btn-bj-dealer-hit')?.addEventListener('click', () => emitGameAction('hit'));
        document.getElementById('btn-bj-dealer-stand')?.addEventListener('click', () => emitGameAction('stand'));
        return;
      }
    }

    // 5. TEXAS HOLD'EM POKER STREETS
    if (activeGame === 'poker') {
      if (gs.currentTurnPlayerId !== myId) {
        const turnName = state.players[gs.currentTurnPlayerId]?.name || 'ผู้เล่น';
        el.actionControlsDock.innerHTML = `<div class="text-center" style="color:var(--text-muted);font-size:0.88rem;">⏳ รอตาของ ${escapeHtml(turnName)}...</div>`;
        return;
      }

      const pk = gs.players?.[myId];
      const toCall = Math.max(0, (gs.highestBet || 0) - (pk?.currentBet || 0));
      const canCheck = toCall === 0;
      const defaultRaise = Math.max(state.settings?.blinds?.bigBlind || 20, toCall + 20);

      el.actionControlsDock.innerHTML = `
        <div class="action-btn-row">
          <button type="button" id="btn-pk-fold" class="btn-neon btn-outline">🏳️ หมอบ Fold</button>
          <button type="button" id="btn-pk-check-call" class="btn-neon btn-primary">
            ${canCheck ? '✅ เช็ค (Check)' : `🪙 ตาม Call (${formatChips(Math.min(you.chips, toCall))})`}
          </button>
          <button type="button" id="btn-pk-allin" class="btn-neon btn-crimson">🔥 All-in (${formatChips(you.chips)})</button>
        </div>
        <div class="raise-input-row">
          <input type="number" id="input-pk-raise" class="neon-input" value="${defaultRaise}" min="1" step="10">
          <button type="button" id="btn-pk-raise" class="btn-neon btn-gold" style="flex:1;">📈 เกทับ Raise</button>
        </div>
      `;

      document.getElementById('btn-pk-fold')?.addEventListener('click', () => emitGameAction('fold'));
      document.getElementById('btn-pk-check-call')?.addEventListener('click', () => {
        emitGameAction(canCheck ? 'check' : 'call');
      });
      document.getElementById('btn-pk-allin')?.addEventListener('click', () => emitGameAction('allin'));
      document.getElementById('btn-pk-raise')?.addEventListener('click', () => {
        const amt = Number(document.getElementById('input-pk-raise')?.value) || defaultRaise;
        emitGameAction('raise', amt);
      });
    }
  }

  function emitGameStartRound() {
    if (!socket || !clientState.roomCode) return;
    socket.emit(
      'game:startRound',
      { roomCode: clientState.roomCode, playerId: clientState.playerId },
      res => {
        if (!res?.ok) showToast(res?.error || 'ไม่สามารถเริ่มตาใหม่ได้', true);
      }
    );
  }

  function emitGameAction(action, amount) {
    if (!socket || !clientState.roomCode) return;
    socket.emit(
      'game:action',
      { roomCode: clientState.roomCode, playerId: clientState.playerId, action, amount },
      res => {
        if (!res?.ok) showToast(res?.error || 'คำสั่งไม่สำเร็จ', true);
      }
    );
  }

  // ================= DEALER MODAL & SHARE MODAL =================
  function initModals() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.closeModal;
        document.getElementById(targetId)?.classList.add('hidden');
      });
    });

    el.btnDealerModal.addEventListener('click', () => {
      el.dealerModal.classList.remove('hidden');
    });

    el.btnSetAutoDealer.addEventListener('click', () => {
      if (!socket || !clientState.roomCode) return;
      socket.emit(
        'dealer:set',
        { roomCode: clientState.roomCode, playerId: clientState.playerId, mode: 'auto' },
        res => {
          if (!res?.ok) showToast(res?.error || 'ตั้งค่าเจ้ามือไม่สำเร็จ', true);
          else {
            showToast('เปลี่ยนเป็นโหมดบอทเป็นเจ้ามือ (Auto Dealer) แล้ว');
            el.dealerModal.classList.add('hidden');
          }
        }
      );
    });

    document.querySelectorAll('.btn-dealer-rounds').forEach(btn => {
      btn.addEventListener('click', () => {
        const rounds = Number(btn.dataset.rounds);
        if (!socket || !clientState.roomCode) return;
        socket.emit(
          'dealer:set',
          { roomCode: clientState.roomCode, playerId: clientState.playerId, mode: 'player', rounds },
          res => {
            if (!res?.ok) showToast(res?.error || 'ไม่สามารถตั้งเป็นเจ้ามือได้', true);
            else {
              showToast(`คุณเป็นเจ้ามือจำนวน ${rounds} ตา!`);
              el.dealerModal.classList.add('hidden');
            }
          }
        );
      });
    });

    // Share Room Modal
    el.btnShareRoom.addEventListener('click', () => {
      if (!clientState.roomCode) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${clientState.roomCode}`;
      el.shareRoomCodeBig.textContent = clientState.roomCode;
      el.shareRoomUrl.value = shareUrl;
      el.shareQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
      el.shareRoomModal.classList.remove('hidden');
    });

    el.btnCopyRoomLink.addEventListener('click', () => {
      const url = el.shareRoomUrl.value;
      const fallbackCopy = () => {
        try {
          el.shareRoomUrl.select();
          document.execCommand('copy');
          showToast('คัดลอกลิงก์ชวนเพื่อนเรียบร้อย!');
        } catch (_) {
          showToast('ไม่สามารถคัดลอกลิงก์ได้', true);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('คัดลอกลิงก์ชวนเพื่อนเรียบร้อย!');
        }).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    });

    // Sound Toggle
    el.btnSoundToggle.addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      el.btnSoundToggle.textContent = sfx.enabled ? '🔊' : '🔇';
      showToast(sfx.enabled ? 'เปิดเสียงเอฟเฟกต์แล้ว' : 'ปิดเสียงเอฟเฟกต์แล้ว');
    });
  }

  // ================= ADMIN PANEL LOGIC =================
  function initAdminPanel() {
    el.btnOpenAdmin.addEventListener('click', () => {
      populateAdminPanelFromState();
      el.adminPanelModal.classList.remove('hidden');
    });

    // Quick mint buttons
    document.querySelectorAll('.btn-quick-mint').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = Number(btn.dataset.amount) || 100;
        const target = el.adminMintTarget.value || 'ALL';
        emitAdminMint(target, amt);
      });
    });

    el.btnAdminMintCustom.addEventListener('click', () => {
      const amt = Number(el.adminMintAmount.value) || 500;
      const target = el.adminMintTarget.value || 'ALL';
      emitAdminMint(target, amt);
    });

    el.btnAdminReviveAll.addEventListener('click', () => {
      reviveBankruptPlayers(1000);
    });

    // Switch game buttons in Admin Panel
    document.querySelectorAll('.btn-game-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-game-switch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        clientState.adminDraftActiveGame = btn.dataset.game;
      });
    });

    // Punishment mode toggle
    el.btnPunishVerbal.addEventListener('click', () => {
      clientState.adminDraftPunishmentMode = 'verbal';
      el.btnPunishVerbal.classList.add('active');
      el.btnPunishRandom.classList.remove('active');
    });

    el.btnPunishRandom.addEventListener('click', () => {
      clientState.adminDraftPunishmentMode = 'random';
      el.btnPunishRandom.classList.add('active');
      el.btnPunishVerbal.classList.remove('active');
    });

    // Add custom punishment
    el.btnAddPunishment.addEventListener('click', () => {
      const val = el.inputNewPunishment.value.trim();
      if (!val) return;
      clientState.adminDraftPunishments.push(val);
      el.inputNewPunishment.value = '';
      renderAdminPunishmentList();
    });

    // Save all Admin settings
    el.btnSaveAdminSettings.addEventListener('click', () => {
      if (!socket || !clientState.roomCode) return;

      const payouts = {
        pokdeng: {
          normal: Number(el.payPdNormal.value) || 1,
          deng2: Number(el.payPdDeng2.value) || 2,
          deng3: Number(el.payPdDeng3.value) || 3,
          straight: Number(el.payPdStraight.value) || 3,
          sian: Number(el.payPdSian.value) || 3,
          tong: Number(el.payPdTong.value) || 5
        },
        blackjack: {
          normal: Number(el.payBjNormal.value) || 1,
          blackjack: Number(el.payBjBlackjack.value) || 1.5
        }
      };

      const blinds = {
        smallBlind: Number(el.blindSb.value) || 10,
        bigBlind: Number(el.blindBb.value) || 20
      };

      socket.emit(
        'admin:updateSettings',
        {
          roomCode: clientState.roomCode,
          playerId: clientState.playerId,
          payouts,
          blinds,
          punishmentMode: clientState.adminDraftPunishmentMode,
          punishments: clientState.adminDraftPunishments,
          activeGame: clientState.adminDraftActiveGame
        },
        res => {
          if (!res?.ok) {
            showToast(res?.error || 'บันทึกการตั้งค่าไม่สำเร็จ', true);
          } else {
            showToast('บันทึกการตั้งค่าโต๊ะเรียบร้อย!');
            el.adminPanelModal.classList.add('hidden');
          }
        }
      );
    });
  }

  function populateAdminPanelFromState() {
    const state = clientState.roomState;
    if (!state) return;

    // Populate player dropdown
    const prevTarget = el.adminMintTarget.value || 'ALL';
    const options = [`<option value="ALL">🌟 ทุกคนในห้อง (ALL)</option>`];
    for (const pid of state.playerOrder || Object.keys(state.players || {})) {
      const p = state.players[pid];
      if (!p) continue;
      const status = p.chips <= 0 ? ' (💀 ถังแตก)' : ` (${formatChips(p.chips)} ชิป)`;
      options.push(`<option value="${escapeHtml(pid)}">${escapeHtml(p.name)}${status}</option>`);
    }
    el.adminMintTarget.innerHTML = options.join('');
    if ([...el.adminMintTarget.options].some(o => o.value === prevTarget)) {
      el.adminMintTarget.value = prevTarget;
    }

    // Active game
    const activeGame = state.settings?.activeGame || 'pokdeng';
    clientState.adminDraftActiveGame = activeGame;
    document.querySelectorAll('.btn-game-switch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.game === activeGame);
    });

    // Payouts & blinds
    const pd = state.settings?.payouts?.pokdeng || {};
    el.payPdNormal.value = pd.normal ?? 1;
    el.payPdDeng2.value = pd.deng2 ?? 2;
    el.payPdDeng3.value = pd.deng3 ?? 3;
    el.payPdStraight.value = pd.straight ?? 3;
    el.payPdSian.value = pd.sian ?? 3;
    el.payPdTong.value = pd.tong ?? 5;

    const bj = state.settings?.payouts?.blackjack || {};
    el.payBjNormal.value = bj.normal ?? 1;
    el.payBjBlackjack.value = bj.blackjack ?? 1.5;

    const blinds = state.settings?.blinds || {};
    el.blindSb.value = blinds.smallBlind ?? 10;
    el.blindBb.value = blinds.bigBlind ?? 20;

    // Punishment settings
    clientState.adminDraftPunishmentMode = state.settings?.punishmentMode || 'verbal';
    el.btnPunishVerbal.classList.toggle('active', clientState.adminDraftPunishmentMode === 'verbal');
    el.btnPunishRandom.classList.toggle('active', clientState.adminDraftPunishmentMode === 'random');

    clientState.adminDraftPunishments = [...(state.settings?.punishments || [])];
    renderAdminPunishmentList();
  }

  function renderAdminPunishmentList() {
    el.adminPunishmentList.innerHTML = clientState.adminDraftPunishments.map((text, idx) => `
      <li>
        <span>${escapeHtml(text)}</span>
        <button type="button" class="btn-del-punish" data-del-idx="${idx}" title="ลบ">✕</button>
      </li>
    `).join('');

    el.adminPunishmentList.querySelectorAll('[data-del-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.delIdx);
        clientState.adminDraftPunishments.splice(idx, 1);
        renderAdminPunishmentList();
      });
    });
  }

  function emitAdminMint(targetPlayerId, amount) {
    if (!socket || !clientState.roomCode) return;
    socket.emit(
      'admin:mint',
      {
        roomCode: clientState.roomCode,
        playerId: clientState.playerId,
        targetPlayerId,
        amount
      },
      res => {
        if (!res?.ok) showToast(res?.error || 'เสกชิปไม่สำเร็จ', true);
        else {
          sfx.playChipBet();
          showToast(`เสกชิป +${formatChips(amount)} สำเร็จ!`);
        }
      }
    );
  }

  function reviveBankruptPlayers(amount = 1000) {
    const state = clientState.roomState;
    if (!state || !socket) return;
    const bankruptPids = Object.values(state.players || {})
      .filter(p => p.chips <= 0 || p.isBankrupt)
      .map(p => p.playerId);

    if (bankruptPids.length === 0) {
      emitAdminMint('ALL', amount);
      return;
    }

    bankruptPids.forEach(pid => {
      emitAdminMint(pid, amount);
    });
  }

  // ================= BANKRUPTCY PUNISHMENT OVERLAY =================
  function initBankruptcyOverlay() {
    el.btnDrawPunishment.addEventListener('click', () => {
      if (!socket || !clientState.roomCode) return;
      socket.emit(
        'punishment:draw',
        { roomCode: clientState.roomCode, playerId: clientState.playerId },
        res => {
          if (!res?.ok) showToast(res?.error || 'ไม่สามารถสุ่มบทลงโทษได้', true);
        }
      );
    });

    el.btnAdminQuickRevive.addEventListener('click', () => {
      reviveBankruptPlayers(1000);
    });

    el.btnAckBankruptcy.addEventListener('click', () => {
      if (!socket || !clientState.roomCode) return;
      socket.emit(
        'punishment:ack',
        { roomCode: clientState.roomCode, playerId: clientState.playerId, targetPlayerId: null },
        res => {
          if (!res?.ok) showToast(res?.error || 'ไม่สามารถปิดหน้าต่างได้', true);
        }
      );
    });
  }

  function renderBankruptcyOverlay(state) {
    const list = state.activeBankruptcies || [];
    if (list.length === 0) {
      el.bankruptcyOverlay.classList.add('hidden');
      return;
    }

    el.bankruptcyOverlay.classList.remove('hidden');

    el.bankruptcyVictims.innerHTML = list.map(item => `
      <div class="victim-pill">💀 ${escapeHtml(item.name)} — ชิปเหลือ 0!</div>
    `).join('');

    const mode = state.settings?.punishmentMode || 'verbal';
    if (mode === 'random') {
      el.punishmentVerbalBox.classList.add('hidden');
      el.punishmentRandomBox.classList.remove('hidden');
      if (state.lastPunishmentDraw && state.lastPunishmentDraw.text) {
        el.punishmentDrawResult.textContent = `🍺 "${state.lastPunishmentDraw.text}"`;
      }
    } else {
      el.punishmentVerbalBox.classList.remove('hidden');
      el.punishmentRandomBox.classList.add('hidden');
    }

    const you = state.you || state.players?.[clientState.playerId];
    if (you?.isAdmin) {
      el.btnAdminQuickRevive.classList.remove('hidden');
    } else {
      el.btnAdminQuickRevive.classList.add('hidden');
    }
  }

  function animatePunishmentWheel(draw) {
    if (!draw || !el.punishmentDrawResult) return;
    const pool = clientState.roomState?.settings?.punishments || [
      'ดื่มเพียว 1 ช็อต 🥃',
      'ดื่มหมดแก้ว! 🍺',
      'คนทางซ้ายสั่งดื่มอะไรก็ได้ 👉'
    ];

    el.punishmentVerbalBox.classList.add('hidden');
    el.punishmentRandomBox.classList.remove('hidden');
    el.punishmentDrawResult.classList.add('spinning');

    let ticks = 0;
    const interval = setInterval(() => {
      const sample = pool[ticks % pool.length];
      el.punishmentDrawResult.textContent = `🎰 กำลังสุ่ม... ${sample}`;
      sfx.playCardDeal();
      ticks++;
      if (ticks >= 10) {
        clearInterval(interval);
        el.punishmentDrawResult.classList.remove('spinning');
        el.punishmentDrawResult.textContent = `🍺 "${draw.text}"`;
        sfx.playWinFanfare();
      }
    }, 90);
  }

  // ================= SOCKET LISTENERS & BOOTSTRAP =================
  if (socket) {
    socket.on('room:state', state => {
      handleRoomState(state);
    });

    socket.on('punishment:drawn', draw => {
      animatePunishmentWheel(draw);
    });
  }

  document.addEventListener('dblclick', e => {
    e.preventDefault();
  }, { passive: false });

  initLobby();
  initModals();
  initAdminPanel();
  initBankruptcyOverlay();
})();
