// ==========================================================================
// Abiruchi Hotel Waiter Multi-Lingual Voice Control Engine
// Supports: English (en-IN), Telugu (te-IN), Hindi (hi-IN)
// Features: "Token Given", "Item Given", Multi-Dimensional Filtering & Log
// ==========================================================================

let waiterSpeechRecognition = null;
let currentWaiterVoiceLang = localStorage.getItem('abiruchi_waiter_voice_lang') || 'en-IN';
let waiterVoiceLog = [];

const WAITER_VOICE_RESPONSES = {
  'en-IN': {
    tokenGiven: (code) => `Token ${code} marked as given to customer.`,
    itemGiven: (name) => `Item ${name} marked as served.`,
    noReadyToken: () => 'No ready token found to mark given.',
    filterApplied: (desc) => `Filtered tokens by ${desc}.`,
    listening: 'Listening for waiter voice command...',
    error: 'Could not understand command. Please try again.',
  },
  'te-IN': {
    tokenGiven: (code) => `టోకెన్ ${code} కస్టమర్‌కి ఇచ్చినట్లు నమోదు చేయబడింది.`,
    itemGiven: (name) => `${name} సర్వ్ చేసినట్లు మార్క్ చేయబడింది.`,
    noReadyToken: () => 'ఇవ్వడానికి సిద్ధంగా ఉన్న టోకెన్లు లేవు.',
    filterApplied: (desc) => `${desc} ఫిల్టర్ చేయబడింది.`,
    listening: 'వాయిస్ కమాండ్ వింటున్నాము...',
    error: 'కమాండ్ అర్థం కాలేదు. మళ్ళీ చెప్పండి.',
  },
  'hi-IN': {
    tokenGiven: (code) => `टोकन ${code} ग्राहक को दे दिया गया है।`,
    itemGiven: (name) => `${name} सर्व कर दिया गया है।`,
    noReadyToken: () => 'देने के लिए कोई तैयार टोकन उपलब्ध नहीं है।',
    filterApplied: (desc) => `${desc} फ़िल्टर कर दिया गया है।`,
    listening: 'आर्डर वॉयस कमांड सुन रहे हैं...',
    error: 'कमांड समझ नहीं आई। कृपया पुनः प्रयास करें।',
  }
};

function setWaiterVoiceLang(lang) {
  currentWaiterVoiceLang = lang;
  localStorage.setItem('abiruchi_waiter_voice_lang', lang);
  showToast(`Voice language set to ${lang === 'te-IN' ? 'తెలుగు (Telugu)' : lang === 'hi-IN' ? 'हिंदी (Hindi)' : 'English'}`);
}

function speakWaiterFeedback(text) {
  if ('speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = currentWaiterVoiceLang;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
}

function toggleWaiterVoice() {
  const modal = document.getElementById('waiterVoiceModal');
  if (modal && modal.style.display === 'flex') {
    stopWaiterVoice();
  } else {
    startWaiterVoice();
  }
}

function startWaiterVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Web Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.');
    return;
  }

  const modal = document.getElementById('waiterVoiceModal');
  const transcriptEl = document.getElementById('waiterVoiceTranscript');
  const micBtn = document.getElementById('btnWaiterVoice');
  if (modal) modal.style.display = 'flex';
  if (micBtn) micBtn.classList.add('listening');

  const dict = WAITER_VOICE_RESPONSES[currentWaiterVoiceLang] || WAITER_VOICE_RESPONSES['en-IN'];
  if (transcriptEl) transcriptEl.textContent = dict.listening;

  try {
    waiterSpeechRecognition = new SpeechRecognition();
    waiterSpeechRecognition.lang = currentWaiterVoiceLang;
    waiterSpeechRecognition.continuous = false;
    waiterSpeechRecognition.interimResults = true;

    waiterSpeechRecognition.onspeechstart = () => {
      document.querySelector('.voice-wave')?.classList.add('speaking');
    };

    waiterSpeechRecognition.onspeechend = () => {
      document.querySelector('.voice-wave')?.classList.remove('speaking');
    };

    waiterSpeechRecognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        text += event.results[i][0].transcript;
      }
      if (transcriptEl) transcriptEl.textContent = `"${text}"`;

      if (event.results[0].isFinal) {
        document.querySelector('.voice-wave')?.classList.remove('speaking');
        processWaiterVoiceCommand(text.trim());
      }
    };

    waiterSpeechRecognition.onerror = () => {
      document.querySelector('.voice-wave')?.classList.remove('speaking');
      if (transcriptEl) transcriptEl.textContent = dict.error;
      stopWaiterVoice();
    };

    waiterSpeechRecognition.onend = () => {
      document.querySelector('.voice-wave')?.classList.remove('speaking');
      if (micBtn) micBtn.classList.remove('listening');
    };

    waiterSpeechRecognition.start();
  } catch (err) {
    console.error('Waiter speech error:', err);
    stopWaiterVoice();
  }
}

function stopWaiterVoice() {
  if (waiterSpeechRecognition) {
    try { waiterSpeechRecognition.stop(); } catch (e) {}
  }
  document.querySelector('.voice-wave')?.classList.remove('speaking');
  const modal = document.getElementById('waiterVoiceModal');
  const micBtn = document.getElementById('btnWaiterVoice');
  if (modal) modal.style.display = 'none';
  if (micBtn) micBtn.classList.remove('listening');
}

function closeWaiterVoiceOnBackdrop(e) {
  if (e && e.target && e.target.id === 'waiterVoiceModal') {
    stopWaiterVoice();
  }
}

// ==========================================================================
// Multi-Lingual Waiter Voice Command Interpreter
// English + Telugu (తెలుగు) + Hindi (हिंदी) + Phonetic Transliteration
// ==========================================================================
async function processWaiterVoiceCommand(transcript) {
  stopWaiterVoice();
  const lower = transcript.toLowerCase();
  const dict = WAITER_VOICE_RESPONSES[currentWaiterVoiceLang] || WAITER_VOICE_RESPONSES['en-IN'];
  let logEntry = { timestamp: new Date().toISOString(), command: transcript, result: 'Unknown' };

  // Fetch currently loaded tokens from the host page
  const allTokens = window.activeTokensCache || [];

  // Helper: Extract any spoken token code e.g. "A101", "101", "A-01", "B 12"
  function extractTokenCode(str) {
    // English digit & prefix match
    const match = str.match(/\b([A-Fa-f][- ]?)?(\d{1,4})\b/);
    if (match) {
      const prefix = match[1] ? match[1].replace(/[- ]/g, '').toUpperCase() : '';
      const num = match[2];
      return { prefix, num, full: prefix ? `${prefix}-${num.padStart(2, '0')}` : num };
    }
    return null;
  }

  // 1. Check for "TOKEN GIVEN" / "TOKEN HANDED OVER" command
  // English: "token given", "token handed over", "token delivered", "token 101 given"
  // Telugu: "టోకెన్ ఇచ్చాం", "టోకెన్ ఇచ్చాను", "టోకెన్ ఇచ్చేసాం", "టోకెన్ 101 ఇచ్చాను", "token ichanu", "token icham"
  // Hindi: "टोकन दे दिया", "टोकन दिया", "टोकन 101 दे दिया", "टोकन सौंप दिया", "token de diya", "token diya"
  const isTokenGiven = (
    /token.*?(given|handed|delivered|served|hand over)/i.test(lower) ||
    /టోకెన్.*?(ఇచ్చాం|ఇచ్చాను|ఇచ్చేసాం|ఇచ్చేయడం)/i.test(lower) ||
    /token.*?(ichanu|icham)/i.test(lower) ||
    /टोकन.*?(दे दिया|दिया|सौंप दिया)/i.test(lower) ||
    /token.*?(de diya|diya)/i.test(lower) ||
    lower.includes('hand over')
  );

  if (isTokenGiven) {
    const extracted = extractTokenCode(lower);
    let targetToken = null;

    if (extracted) {
      targetToken = allTokens.find(t => {
        const code = (t.token_code || t.code || '').toUpperCase().replace(/[- ]/g, '');
        return code.includes(extracted.num) || (extracted.prefix && code.includes(extracted.prefix + extracted.num));
      });
    }

    // If no specific token number was spoken, pick the oldest READY token
    if (!targetToken) {
      targetToken = allTokens.find(t => t.state === 'READY') || allTokens[0];
    }

    if (targetToken) {
      await markTokenServed(targetToken.id);
      const code = targetToken.token_code || targetToken.code || 'TOKEN';
      const msg = dict.tokenGiven(code);
      showToast(`🎙️ ${msg}`);
      speakWaiterFeedback(msg);
      logEntry.result = `Marked token ${code} as SERVED/GIVEN`;
      waiterVoiceLog.unshift(logEntry);
      return;
    } else {
      const msg = dict.noReadyToken();
      showToast(msg);
      speakWaiterFeedback(msg);
      logEntry.result = msg;
      waiterVoiceLog.unshift(logEntry);
      return;
    }
  }

  // 2. Check for "ITEM GIVEN" / "DISH SERVED" command
  // English: "item given", "item served", "Masala Dosa given", "Biryani served", "item delivered"
  // Telugu: "ఐటమ్ ఇచ్చాం", "ఐటమ్ ఇచ్చాను", "దోస ఇచ్చాం", "వంటకం ఇచ్చాను", "item icham", "dosa icham"
  // Hindi: "आइटम दे दिया", "आइटम दिया", "मसाला डोसा दे दिया", "खाना दे दिया", "item de diya"
  const isItemGiven = (
    lower.includes('item given') || lower.includes('item served') || lower.includes('dish served') || lower.includes('dish delivered') ||
    lower.includes('ఐటమ్ ఇచ్చాం') || lower.includes('ఐటమ్ ఇచ్చాను') || lower.includes('సర్వ్ చేశాం') || lower.includes('వంటకం ఇచ్చాను') || lower.includes('item icham') ||
    lower.includes('आइटम दे दिया') || lower.includes('आइटम दिया') || lower.includes('आइटम सर्व') || lower.includes('खाना दे दिया') || lower.includes('item de diya')
  );

  if (isItemGiven) {
    // Try to find if a specific dish name was spoken
    let itemName = lower
      .replace(/\b(item|dish|given|served|delivered|order|టోకెన్|ఐటమ్|వంటకం|ఇచ్చాం|ఇచ్చాను|సర్వ్|చేశాం|टोकन|आइटम|खाना|दे दिया|दिया|सर्व)\b/gi, '')
      .trim();

    let matchingToken = null;
    if (itemName.length > 2) {
      matchingToken = allTokens.find(t => {
        const items = t.items || [];
        return items.some(i => i.name && i.name.toLowerCase().includes(itemName));
      });
    }

    if (!matchingToken) {
      matchingToken = allTokens.find(t => t.state === 'READY') || allTokens[0];
    }

    if (matchingToken) {
      await markTokenServed(matchingToken.id);
      const code = matchingToken.token_code || matchingToken.code || 'TOKEN';
      const displayName = itemName || code;
      const msg = dict.itemGiven(displayName);
      showToast(`🎙️ ${msg}`);
      speakWaiterFeedback(msg);
      logEntry.result = `Marked item "${displayName}" (${code}) as SERVED`;
      waiterVoiceLog.unshift(logEntry);
      return;
    }
  }

  // 3. Check for Voice Filters (Quantity, Time, Bucket)
  // "Show large orders", "Filter single item", "పెద్ద ఆర్డర్లు", "बड़े आर्डर"
  if (lower.includes('large') || lower.includes('bulk') || lower.includes('పెద్ద') || lower.includes('बड़े') || lower.includes('4+')) {
    const qtySelect = document.getElementById('filterTokenQty');
    if (qtySelect) {
      qtySelect.value = 'BULK';
      if (window.applyTokenFilters) window.applyTokenFilters();
      const msg = dict.filterApplied('Bulk Orders (4+ items)');
      showToast(`🎙️ ${msg}`);
      speakWaiterFeedback(msg);
      logEntry.result = 'Filter: Bulk Orders';
      waiterVoiceLog.unshift(logEntry);
      return;
    }
  }

  if (lower.includes('single') || lower.includes('one item') || lower.includes('ఒక్కటి') || lower.includes('एक आइटम')) {
    const qtySelect = document.getElementById('filterTokenQty');
    if (qtySelect) {
      qtySelect.value = 'SINGLE';
      if (window.applyTokenFilters) window.applyTokenFilters();
      const msg = dict.filterApplied('Single Item Orders');
      showToast(`🎙️ ${msg}`);
      speakWaiterFeedback(msg);
      logEntry.result = 'Filter: Single Item';
      waiterVoiceLog.unshift(logEntry);
      return;
    }
  }

  if (lower.includes('fresh') || lower.includes('recent') || lower.includes('కొత్త') || lower.includes('ताजा')) {
    const timeSelect = document.getElementById('filterTokenTime');
    if (timeSelect) {
      timeSelect.value = 'FRESH';
      if (window.applyTokenFilters) window.applyTokenFilters();
      const msg = dict.filterApplied('Fresh Orders (< 10 mins)');
      showToast(`🎙️ ${msg}`);
      speakWaiterFeedback(msg);
      logEntry.result = 'Filter: Fresh (< 10m)';
      waiterVoiceLog.unshift(logEntry);
      return;
    }
  }

  if (lower.includes('delayed') || lower.includes('overdue') || lower.includes('లేట్') || lower.includes('देरी')) {
    const timeSelect = document.getElementById('filterTokenTime');
    if (timeSelect) {
      timeSelect.value = 'DELAYED';
      if (window.applyTokenFilters) window.applyTokenFilters();
      const msg = dict.filterApplied('Delayed Orders (> 20 mins)');
      showToast(`🎙️ ${msg}`);
      speakWaiterFeedback(msg);
      logEntry.result = 'Filter: Delayed (> 20m)';
      waiterVoiceLog.unshift(logEntry);
      return;
    }
  }

  // 4. Fallback search by token or keyword
  const searchInput = document.getElementById('searchTokenInput');
  if (searchInput) {
    searchInput.value = transcript;
    if (window.applyTokenFilters) window.applyTokenFilters();
    const msg = dict.filterApplied(`Search "${transcript}"`);
    showToast(`🎙️ ${msg}`);
    speakWaiterFeedback(msg);
    logEntry.result = `Search: ${transcript}`;
    waiterVoiceLog.unshift(logEntry);
  }
}

async function markTokenServed(tokenId) {
  try {
    const res = await fetch(`/api/v1/tokens/${tokenId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'SERVED', waiterId: 'waiter_voice' })
    });
    if (window.loadBoard) window.loadBoard();
    if (window.loadTokens) window.loadTokens();
  } catch (e) {
    console.error('Failed to mark token served:', e);
  }
}

function openWaiterVoiceLogModal() {
  const modal = document.getElementById('waiterVoiceLogModal');
  const list = document.getElementById('waiterVoiceLogList');
  if (!modal || !list) return;

  if (waiterVoiceLog.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px;">No waiter voice commands executed this shift.</p>';
  } else {
    list.innerHTML = waiterVoiceLog.map(v => `
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 14px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:800; font-size:0.85rem; color:#fff;">🎙️ "${v.command}"</span>
          <span style="font-size:0.7rem; color:var(--text-muted);">${new Date(v.timestamp).toLocaleTimeString()}</span>
        </div>
        <div style="font-size:0.78rem; color:#38bdf8; margin-top:4px;">${v.result}</div>
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
}

function closeWaiterVoiceLogModal(e) {
  if (e && e.target && e.target.id !== 'waiterVoiceLogModal') return;
  const modal = document.getElementById('waiterVoiceLogModal');
  if (modal) modal.style.display = 'none';
}
