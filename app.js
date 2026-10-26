// State & DOM Elements
const body = document.getElementById('app-body');
const displayStage = document.getElementById('display-stage');
const displayText = document.getElementById('display-text');
const textInputField = document.getElementById('text-input-field');

const bgColorPicker = document.getElementById('bg-color-picker');
const bgHexValue = document.getElementById('bg-hex-value');
const bgPresets = document.querySelectorAll('#bg-presets .preset-btn');

const textColorPicker = document.getElementById('text-color-picker');
const toggleAutoContrast = document.getElementById('toggle-auto-contrast');
const toggleMarkdown = document.getElementById('toggle-markdown');
const textPresets = document.querySelectorAll('#text-presets .preset-btn');

const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');
const btnSizeDown = document.getElementById('btn-size-down');
const btnSizeUp = document.getElementById('btn-size-up');
const quickSizeBtns = document.querySelectorAll('.quick-size-btn');

const fontFamilySelect = document.getElementById('font-family-select');
const fontWeightSelect = document.getElementById('font-weight-select');
const segmentBtns = document.querySelectorAll('.segment-btn');
const vsegmentBtns = document.querySelectorAll('.vsegment-btn');

const controlPanel = document.getElementById('control-panel');
const btnHidePanel = document.getElementById('btn-hide-panel');
const btnShowControls = document.getElementById('btn-show-controls');
const btnScrollTop = document.getElementById('btn-scroll-top');
const btnFullscreen = document.getElementById('btn-fullscreen');

// Default / Stored State
const STORAGE_KEY = 'solid_display_state_v1';
let appState = {
  text: `3. AI ในการวิเคราะห์ข้อมูลทางการเงิน (Financial Data Analysis)
○ การประยุกต์ใช้ตามประเภทข้อมูล:
  ○ Structured Data (งบการเงิน, ราคาหุ้น) → Forecasting, Regression
  ○ Unstructured Data (ข่าวการเงิน, ทรานสคริปต์) → Summarization, Sentiment Analysis
  ○ Alternative Data (โซเชียลมีเดีย, ตัวชี้วัด ESG) → Trend Detection, Risk Signals
○ โมเดลและกรณีศึกษาจริง:
  ○ BloombergGPT: โมเดลภาษาขนาดใหญ่ที่เทรนด้วยข้อมูลการเงินโดยเฉพาะ
  ○ BlackRock Aladdin: AI ประเมินและวิเคราะห์ความเสี่ยงพอร์ตการลงทุนระดับโลก
  ○ JPMorgan Chase: ใช้ AI วิเคราะห์บทถอดเสียงแถลงผลประกอบการของผู้บริหาร

4. AI ในการตรวจจับการทุจริต (Fraud Detection)
ด้านการประเมิน\tTraditional Systems (ระบบดั้งเดิม)\tAI-Powered Systems (ระบบ AI)
เกณฑ์การทำงาน\tใช้กฎตายตัว (Static Rules)\tตรวจจับความผิดปกติเชิงพฤติกรรม (Anomaly Detection)
ความเร็ว\tประมวลผลช้า / ตรวจสอบย้อนหลัง\tวิเคราะห์แบบ Real-time ทันที
ความแม่นยำ\tการแจ้งเตือนผิดพลาดสูง (High False Positives)\tแม่นยำสูง และใช้ Behavioral Biometrics (เช่น จังหวะการพิมพ์)
การปรับปรุงระบบ\tต้องปรับแก้เงื่อนไขด้วยมือ\tโมเดลเรียนรู้และพัฒนาได้เอง (Self-learning)`,
  bgColor: '#111827',
  textColor: '#ffffff',
  autoContrast: true,
  useMarkdown: true,
  fontSize: 48,
  fontFamily: "'Prompt', sans-serif",
  fontWeight: '400',
  textAlign: 'left',
  valign: 'top',
  panelHidden: false
};

// Calculate luminance to decide best contrasting color (Black or White)
function getContrastingColor(hexColor) {
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // YIQ formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
}

// Save to LocalStorage
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    // ignore quota errors
  }
}

// Load from LocalStorage
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      appState = { ...appState, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Could not load saved state', e);
  }
}

// =========================================
// Smart Preprocessor (Markdown, TSV Tables, Bullets)
// =========================================
function preprocessText(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const result = [];
  let inTsv = false;
  let tsvRows = [];

  function flushTsv() {
    if (tsvRows.length === 0) return;
    const maxCols = Math.max(...tsvRows.map(r => r.length));
    const normalized = tsvRows.map(r => {
      const copy = [...r];
      while (copy.length < maxCols) copy.push('');
      return copy;
    });

    const header = '| ' + normalized[0].join(' | ') + ' |';
    const separator = '| ' + normalized[0].map(() => '---').join(' | ') + ' |';
    const bodyRows = normalized.slice(1).map(r => '| ' + r.join(' | ') + ' |');

    result.push('');
    result.push(header);
    result.push(separator);
    result.push(...bodyRows);
    result.push('');

    tsvRows = [];
    inTsv = false;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Detect Tab-Separated Table rows (2+ columns separated by \t)
    if (line.includes('\t')) {
      const cells = line.split('\t').map(c => c.trim());
      if (cells.length >= 2) {
        inTsv = true;
        tsvRows.push(cells);
        continue;
      }
    }

    if (inTsv) {
      flushTsv();
    }

    // Convert bullet symbols: ○, •, ◦, ⁃ with any indentation level into Markdown list '- '
    // Preserves indentation spaces so nested sub-lists render accurately
    line = line.replace(/^(\s*)[○•◦⁃]\s+/g, '$1- ');

    // Convert arrows "->" or "-->" into clean Unicode "→"
    line = line.replace(/(\s)-(?:->|>)\s/g, '$1→ ');

    result.push(line);
  }

  if (inTsv) {
    flushTsv();
  }

  return result.join('\n');
}

// Fallback Markdown parser if marked.min.js is unavailable
function fallbackMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Parse pipe tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = [];
  let finalLines = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('|') && l.endsWith('|')) {
      const cells = l.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHtml.push('<div class="table-wrapper"><table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>');
      } else {
        tableHtml.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>');
      }
    } else {
      if (inTable) {
        tableHtml.push('</tbody></table></div>');
        finalLines.push(tableHtml.join(''));
        tableHtml = [];
        inTable = false;
      }
      finalLines.push(l);
    }
  }
  if (inTable) {
    tableHtml.push('</tbody></table></div>');
    finalLines.push(tableHtml.join(''));
  }

  return finalLines.join('<br>');
}

// Render Markdown or HTML safely
function parseMarkdownToHtml(rawText) {
  const prepared = preprocessText(rawText);

  let rendered = '';
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      rendered = marked.parse(prepared);
    } catch (e) {
      console.warn('marked.js parse error, using fallback', e);
      rendered = fallbackMarkdown(prepared);
    }
  } else {
    rendered = fallbackMarkdown(prepared);
  }

  // Ensure all tables are wrapped in a responsive scroll container
  rendered = rendered.replace(/(?<!<div class="table-wrapper">)(<table>[\s\S]*?<\/table>)/g, '<div class="table-wrapper">$1</div>');

  return rendered;
}

// Render content into DOM based on active mode
function renderDisplay() {
  if (appState.useMarkdown) {
    displayText.classList.remove('raw-mode');
    displayText.classList.add('markdown-mode');
    displayText.innerHTML = parseMarkdownToHtml(appState.text);
  } else {
    displayText.classList.remove('markdown-mode');
    displayText.classList.add('raw-mode');
    displayText.textContent = appState.text;
  }
}

// Update Background Color
function setBackgroundColor(color, save = true) {
  appState.bgColor = color;
  body.style.backgroundColor = color;
  bgColorPicker.value = color;
  bgHexValue.textContent = color.toUpperCase();

  if (appState.autoContrast) {
    const contrastColor = getContrastingColor(color);
    setTextColor(contrastColor, false);
  }

  bgPresets.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color.toLowerCase() === color.toLowerCase());
  });

  if (save) saveState();
}

// Update Text Color
function setTextColor(color, manual = true, save = true) {
  appState.textColor = color;
  displayText.style.color = color;
  textColorPicker.value = color;

  if (manual) {
    appState.autoContrast = false;
    toggleAutoContrast.checked = false;
  }

  textPresets.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color.toLowerCase() === color.toLowerCase());
  });

  if (save) saveState();
}

// Update Font Size
function setFontSize(size, save = true) {
  const parsed = Math.max(16, Math.min(240, parseInt(size, 10)));
  appState.fontSize = parsed;
  fontSizeSlider.value = parsed;
  fontSizeValue.textContent = `${parsed}px`;
  displayText.style.fontSize = `${parsed}px`;

  quickSizeBtns.forEach(btn => {
    if (parseInt(btn.dataset.size, 10) === parsed) {
      btn.style.background = 'rgba(59, 130, 246, 0.4)';
      btn.style.borderColor = '#3b82f6';
      btn.style.color = '#fff';
    } else {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });

  if (save) saveState();
}

// Update Text Content
function setText(content, save = true) {
  appState.text = content;
  if (textInputField.value !== content) {
    textInputField.value = content;
  }
  renderDisplay();
  if (save) saveState();
}

// Update Font Family
function setFontFamily(font, save = true) {
  appState.fontFamily = font;
  fontFamilySelect.value = font;
  displayText.style.fontFamily = font;
  if (save) saveState();
}

// Update Font Weight
function setFontWeight(weight, save = true) {
  appState.fontWeight = weight;
  fontWeightSelect.value = weight;
  displayText.style.fontWeight = weight;
  if (save) saveState();
}

// Update Text Align
function setTextAlign(align, save = true) {
  appState.textAlign = align;
  displayText.style.textAlign = align;
  segmentBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.align === align);
  });
  if (save) saveState();
}

// Update Vertical Align
function setVerticalAlign(valign, save = true) {
  appState.valign = valign;
  displayStage.classList.remove('valign-top', 'valign-center');
  displayStage.classList.add(`valign-${valign}`);
  vsegmentBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.valign === valign);
  });
  if (save) saveState();
}

// Toggle Control Panel Visibility
function togglePanel(hide) {
  appState.panelHidden = hide !== undefined ? hide : !controlPanel.classList.contains('hidden');
  if (appState.panelHidden) {
    controlPanel.classList.add('hidden');
    btnShowControls.classList.remove('hidden');
  } else {
    controlPanel.classList.remove('hidden');
    btnShowControls.classList.add('hidden');
  }
}

// Fullscreen Toggle
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn(`Fullscreen error: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// Event Listeners
function setupEventListeners() {
  // 1. Text input sync
  textInputField.addEventListener('input', (e) => {
    setText(e.target.value);
  });

  // Direct paste on display area
  displayText.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text/plain');
    setText(pastedText);
  });

  // Toggle Markdown / Rich format
  if (toggleMarkdown) {
    toggleMarkdown.addEventListener('change', (e) => {
      appState.useMarkdown = e.target.checked;
      renderDisplay();
      saveState();
    });
  }

  // 2. Background Color Picker & Presets
  bgColorPicker.addEventListener('input', (e) => {
    setBackgroundColor(e.target.value);
  });

  bgPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      setBackgroundColor(btn.dataset.color);
    });
  });

  // 3. Text Color Picker, Presets & Auto Contrast
  textColorPicker.addEventListener('input', (e) => {
    setTextColor(e.target.value, true);
  });

  toggleAutoContrast.addEventListener('change', (e) => {
    appState.autoContrast = e.target.checked;
    if (appState.autoContrast) {
      setTextColor(getContrastingColor(appState.bgColor), false);
    }
    saveState();
  });

  textPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      setTextColor(btn.dataset.color, true);
    });
  });

  // 4. Font Size
  fontSizeSlider.addEventListener('input', (e) => {
    setFontSize(e.target.value);
  });

  btnSizeDown.addEventListener('click', () => {
    setFontSize(appState.fontSize - 6);
  });

  btnSizeUp.addEventListener('click', () => {
    setFontSize(appState.fontSize + 6);
  });

  quickSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setFontSize(btn.dataset.size);
    });
  });

  // 5. Typography & Align
  fontFamilySelect.addEventListener('change', (e) => {
    setFontFamily(e.target.value);
  });

  fontWeightSelect.addEventListener('change', (e) => {
    setFontWeight(e.target.value);
  });

  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setTextAlign(btn.dataset.align);
    });
  });

  vsegmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setVerticalAlign(btn.dataset.valign);
    });
  });

  // 6. Panel Controls & Scroll to Top
  btnHidePanel.addEventListener('click', () => togglePanel(true));
  btnShowControls.addEventListener('click', () => togglePanel(false));
  btnFullscreen.addEventListener('click', toggleFullscreen);

  // Scroll to Top
  btnScrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollY > 120) {
      btnScrollTop.classList.remove('hidden');
    } else {
      btnScrollTop.classList.add('hidden');
    }
  }, { passive: true });

  // Keyboard shortcut 'H' to toggle panel
  window.addEventListener('keydown', (e) => {
    if (e.target !== displayText && e.target !== textInputField) {
      if (e.key === 'h' || e.key === 'H') {
        togglePanel();
      }
    }
  });
}

// Initializer
function init() {
  loadState();

  // Apply state to DOM
  setBackgroundColor(appState.bgColor, false);
  
  if (appState.autoContrast) {
    toggleAutoContrast.checked = true;
    setTextColor(getContrastingColor(appState.bgColor), false, false);
  } else {
    toggleAutoContrast.checked = false;
    setTextColor(appState.textColor, false, false);
  }

  if (toggleMarkdown) {
    toggleMarkdown.checked = appState.useMarkdown !== false;
  }

  setFontSize(appState.fontSize, false);
  setFontFamily(appState.fontFamily, false);
  setFontWeight(appState.fontWeight, false);
  setTextAlign(appState.textAlign, false);
  setVerticalAlign(appState.valign || 'top', false);
  togglePanel(appState.panelHidden);

  setText(appState.text, false);
  setupEventListeners();
}

// Run on load
document.addEventListener('DOMContentLoaded', init);
