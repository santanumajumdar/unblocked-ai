/**
 * jarvis_v2.js — J.A.R.V.I.S. Arc Edition Controller
 */

import { jarvisVoice } from './voice.js';
import {
  getJarvisHistory, saveJarvisHistory,
  extractJarvisAction, executeJarvisAction, stripJarvisAction
} from './jarvis.js';
import { generateJarvisResponse, formatOutputText } from './api.js';
import { ICONS, toast } from './ui.js';

export function setupJarvisV2(state, contextFns) {
  const { saveProgram, saveDecision, getPrograms, getActiveRisks, getDecisions, getSimulatedPrograms } = contextFns;

  // Create UI
  const orb = document.createElement('div');
  orb.id = 'jarvis-orb';
  orb.innerHTML = `
    <div class="arc-reactor-wrap">
      <div class="arc-reactor"></div>
      <div class="arc-ring arc-ring-1"></div>
      <div class="arc-ring arc-ring-2"></div>
      <div class="arc-ring arc-ring-3"></div>
    </div>
  `;
  document.body.appendChild(orb);

  const pane = document.createElement('div');
  pane.id = 'jarvis-pane';
  pane.className = 'jarvis-v2-pane';
  pane.innerHTML = `
    <div class="jarvis-header">
      <div class="flex items-center gap-12">
        <div id="jarvis-voice-toggle" class="voice-mode-toggle">
          ${ICONS.monitoring} <span>VOICE OFF</span>
        </div>
        <div class="jarvis-title">J.A.R.V.I.S. &middot; V2</div>
      </div>
      <button id="jarvis-close" style="background:none; border:none; color:var(--text-muted); font-size:24px; cursor:pointer;">×</button>
    </div>

    <!-- ARC HUD Home State -->
    <div id="jarvis-hud" class="jarvis-hud">
      <div class="arc-reactor-wrap" id="arc-reactor-main">
        <div class="arc-reactor"></div>
        <div class="arc-ring arc-ring-1"></div>
        <div class="arc-ring arc-ring-2"></div>
        <div class="arc-ring arc-ring-3"></div>
      </div>
      <div class="hud-greeting">
        <h2>At your service, Sir.</h2>
        <div style="font-size:11px; color:var(--jarvis-blue); margin-top:4px; font-weight:700;">ALL SYSTEMS GO</div>
      </div>
      <div class="hud-grid">
        <div class="hud-card" data-cmd="Deep scan bottlenecks">
          <div class="hud-card-icon">🔍</div>
          <div class="hud-card-title">Bottleneck Scan</div>
          <div class="hud-card-subtitle">Detect shadow patterns</div>
        </div>
        <div class="hud-card" data-cmd="Analyze blast radius">
          <div class="hud-card-icon">🧨</div>
          <div class="hud-card-title">Blast Radius</div>
          <div class="hud-card-subtitle">Calculate simulation slips</div>
        </div>
        <div class="hud-card" data-cmd="Log a strategic decision">
          <div class="hud-card-icon">📜</div>
          <div class="hud-card-title">Log Decision</div>
          <div class="hud-card-subtitle">Formal registry entry</div>
        </div>
        <div class="hud-card" data-cmd="Initiate new program">
          <div class="hud-card-icon">🚀</div>
          <div class="hud-card-title">New Program</div>
          <div class="hud-card-subtitle">Draft project directive</div>
        </div>
      </div>
    </div>

    <div id="jarvis-chat-body" class="jarvis-body" style="display:none;"></div>
    
    <div id="transcript-hint" class="transcript-hint">Listening for your command...</div>

    <div class="jarvis-footer">
      <button id="jarvis-mic" class="btn btn-icon" title="Voice Input">${ICONS.mic}</button>
      <input type="text" id="jarvis-input" autocomplete="off" placeholder="Pulse the Arc to speak, or type here...">
      <button id="jarvis-send" class="btn btn-primary btn-icon" style="padding: 8px 12px; border-radius: 50%;">${ICONS.generate}</button>
    </div>
  `;
  document.body.appendChild(pane);

  const input = document.getElementById('jarvis-input');
  const send  = document.getElementById('jarvis-send');
  const body  = document.getElementById('jarvis-chat-body');
  const hud   = document.getElementById('jarvis-hud');
  const arc   = document.getElementById('arc-reactor-main');
  const voiceToggle = document.getElementById('jarvis-voice-toggle');

  const showHUD = () => { hud.style.display = 'flex'; body.style.display = 'none'; };
  const showChat = () => { hud.style.display = 'none'; body.style.display = 'flex'; };

  const renderHistory = () => {
    body.innerHTML = state.jarvis.history.map(m => `
      <div class="jarvis-msg ${m.role}">
        <div class="msg-content">${m.role === 'assistant' ? formatOutputText(stripJarvisAction(m.content)) : m.content}</div>
      </div>
    `).join('');
    body.scrollTop = body.scrollHeight;
  };

  const toggleJarvis = () => {
    state.jarvis.open = !state.jarvis.open;
    pane.classList.toggle('active', state.jarvis.open);
    if (state.jarvis.open) {
      input.focus();
      if (state.jarvis.history.length > 0) {
        showChat();
        renderHistory();
      } else {
        showHUD();
      }
    }
  };

  orb.onclick = toggleJarvis;
  document.getElementById('jarvis-close').onclick = toggleJarvis;

  voiceToggle.onclick = () => {
    state.jarvis.voiceMode = !state.jarvis.voiceMode;
    jarvisVoice.setVoiceMode(state.jarvis.voiceMode);
    voiceToggle.classList.toggle('active', state.jarvis.voiceMode);
    voiceToggle.querySelector('span').textContent = state.jarvis.voiceMode ? 'VOICE ON' : 'VOICE OFF';
    toast(`Jarvis Voice Mode: ${state.jarvis.voiceMode ? 'Activated' : 'Silent'}`, 'info');
  };

  const micBtn = document.getElementById('jarvis-mic');
  const transcriptHint = document.getElementById('transcript-hint');

  const startListening = () => {
    document.body.classList.add('jarvis-listening');
    micBtn.classList.add('active');
    transcriptHint.textContent = 'Listening for your command...';
    
    jarvisVoice.listen(
      (transcript) => {
        input.value = transcript;
        transcriptHint.textContent = `Analyzing: "${transcript}"`;
        document.body.classList.remove('jarvis-listening');
        micBtn.classList.remove('active');
        send.click();
      },
      (err) => {
        document.body.classList.remove('jarvis-listening');
        micBtn.classList.remove('active');
        transcriptHint.textContent = 'Listening mode failed.';
        toast(`Listening failed: ${err}`, 'error');
      },
      (interim) => {
        input.value = interim;
        transcriptHint.textContent = `Listening: "${interim}..."`;
      }
    );
  };

  micBtn.onclick = startListening;
  arc.onclick = startListening;

  document.querySelectorAll('.hud-card').forEach(card => {
    card.onclick = () => {
      input.value = card.dataset.cmd;
      send.click();
    };
  });

  input.onkeydown = (e) => { if (e.key === 'Enter') send.click(); };

  send.onclick = async () => {
    const query = input.value.trim();
    if (!query || state.jarvis.generating) return;

    showChat();
    input.value = '';
    state.jarvis.history.push({ role: 'user', content: query });
    saveJarvisHistory(state.jarvis.history);
    renderHistory();

    const aiMsgEl = document.createElement('div');
    aiMsgEl.className = 'jarvis-msg assistant typing';
    body.appendChild(aiMsgEl);
    body.scrollTop = body.scrollHeight;

    state.jarvis.generating = true;
    
    generateJarvisResponse(query, state.jarvis.history, {
      programs: getSimulatedPrograms(getPrograms()),
      risks: getActiveRisks(),
      decisions: getDecisions()
    }, aiMsgEl, 
      (fullText) => {
        state.jarvis.generating = false;
        aiMsgEl.classList.remove('typing');
        
        const action = extractJarvisAction(fullText);
        const cleanText = stripJarvisAction(fullText);
        aiMsgEl.innerHTML = formatOutputText(cleanText);
        
        jarvisVoice.speak(cleanText);

        state.jarvis.history.push({ role: 'assistant', content: fullText, action });
        saveJarvisHistory(state.jarvis.history);
        
        if (action) {
          renderActionCard(aiMsgEl, action, contextFns);
        }
      },
      (err) => {
        state.jarvis.generating = false;
        aiMsgEl.innerHTML = `<span class="text-danger">${err}</span>`;
      }
    );
  };
}

function renderActionCard(parentEl, action, { saveProgram, saveDecision }) {
  const card = document.createElement('div');
  card.className = 'jarvis-action-card animate-slide-up';
  card.innerHTML = `
    <div class="action-header">PROPOSED ACTION: ${action.action.replace('_', ' ')}</div>
    <div class="action-body">
      ${Object.entries(action.data).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
    </div>
    <div class="action-footer">
      <button class="btn btn-primary btn-sm" id="confirm-action">Confirm Execution</button>
    </div>
  `;
  parentEl.appendChild(card);
  
  card.querySelector('#confirm-action').onclick = () => {
    const result = executeJarvisAction(action, { saveProgram, saveDecision });
    card.innerHTML = `<div class="text-success" style="font-size:12px; font-weight:600;">✅ ${result.message}</div>`;
    toast(result.message, 'success');
  };
}
