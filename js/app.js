/**
 * app.js — Main application: router, state, page renders
 */

import {
  getPrograms, saveProgram, deleteProgram, getProgramById, newProgramId,
  getHistory, addHistoryEntry,
  getRisks, getActiveRisks, acknowledgeRisk, dismissRisk,
  getStats
} from './programs.js';

import {
  generateStatusUpdate, extractProgramSignals, getApiKey, setApiKey, clearApiKey, hasApiKey,
  getProvider, setProvider
} from './api.js';

import {
  signInWithGoogle, signInWithGitHub, signOut, getUser,
  onAuthStateChange, isAuthEnabled, getSupabaseConfig, setSupabaseConfig
} from './auth.js';

import { parseFile } from './parser.js';


import {
  toast, openModal, confirm as uiConfirm, copyText,
  formatDate, daysAgo, ragBadge, ragEmoji, ragLabel,
  personaBadge, severityBadge, truncate, getTimeGreeting,
  setButtonLoading, scrollToTop, PERSONA_LABELS, ICONS
} from './ui.js';

// ── APP STATE ─────────────────────────────────────────────────────
const state = {
  page: 'landing',
  appPage: 'dashboard',
  generate: {
    selectedRag: 'green',
    selectedPersonas: ['exec'],
    activeTab: 'exec',
    generating: false,
    outputs: {}       // { persona: htmlString }
  },
  programForm: null,  // program being edited/created
};

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  // Restore last page
  const lastPage = sessionStorage.getItem('unblocked_page') || 'landing';
  if (lastPage !== 'landing' && hasApiKey()) {
    showPage('app');
    showAppPage(lastPage);
  }
});

// ── TOP-LEVEL ROUTING ─────────────────────────────────────────────
export function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  state.page = page;
}

export function showAppPage(name) {
  document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`apppage-${name}`);
  if (el) el.classList.add('active');
  // Nav highlight
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById(`nav-${name}`);
  if (navEl) navEl.classList.add('active');
  state.appPage = name;
  sessionStorage.setItem('unblocked_page', name);
  // Render page content
  renderPage(name);
  // Scroll to top
  const mc = document.getElementById('main-content');
  if (mc) scrollToTop(mc);
}

// ── RENDER ROUTER ─────────────────────────────────────────────────
function renderPage(name) {
  const renders = {
    dashboard: renderDashboard,
    generate:  renderGenerate,
    programs:  renderPrograms,
    history:   renderHistory,
    risks:     renderRisks,
    settings:  renderSettings
  };
  if (renders[name]) renders[name]();
}

// ── ENTER APP ─────────────────────────────────────────────────────
window.enterApp = function(targetPage = 'dashboard') {
  if (!hasApiKey()) {
    showApiKeyModal(() => {
      showPage('app');
      showAppPage(targetPage);
    });
  } else {
    showPage('app');
    showAppPage(targetPage);
  }
};

function showApiKeyModal(onSuccess) {
  let activeTab = 'anthropic';

  const { el, close } = openModal(`
    <div class="modal-logo">
      <div class="logo-mark">U</div>
      <div class="logo-wordmark">Un<span>blocked</span> AI</div>
    </div>
    <div class="modal-title">Select your AI provider</div>
    <div class="modal-sub">Choose a free or premium provider to power your status intelligence.</div>

    <div class="provider-tabs">
      <div class="p-tab active" data-p="anthropic">Claude (Anthropic)</div>
      <div class="p-tab" data-p="gemini">Gemini (Google)</div>
    </div>

    <div class="form-group mt-16">
      <label class="form-label" id="key-label">Anthropic API key <span class="required">*</span></label>
      <input type="password" id="modal-api-key" placeholder="sk-ant-…" autocomplete="off">
    </div>
    <div id="provider-note" class="modal-note mb-16" style="margin-top:-8px; font-style:italic;">
      Claude 3.5 Sonnet requires a paid key from Anthropic.
    </div>
    <button class="btn btn-primary btn-block" id="modal-save-key">Save key and activate</button>
    <div class="modal-divider-text"><span>OR</span></div>

    <button class="btn btn-ghost btn-block" id="modal-demo-mode" style="border-color:var(--blue-dim); color:var(--blue-light);">
      Try Demo Mode — No key required
    </button>
  `);

  const input = el.querySelector('#modal-api-key');
  const label = el.querySelector('#key-label');
  const note  = el.querySelector('#provider-note');
  const tabs  = el.querySelectorAll('.p-tab');
  const saveBtn = el.querySelector('#modal-save-key');


  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.p;
      if (activeTab === 'gemini') {
        label.innerHTML = 'Google Gemini API key <span class="required">*</span>';
        input.placeholder = 'AIza…';
        note.innerHTML = 'Gemini 1.5 Flash is <strong>free</strong> for up to 15 requests/min. <a href="https://aistudio.google.com/" target="_blank">Get free key →</a>';
      } else {
        label.innerHTML = 'Anthropic API key <span class="required">*</span>';
        input.placeholder = 'sk-ant-…';
        note.innerHTML = 'Claude 3.5 Sonnet requires a paid key from Anthropic. <a href="https://console.anthropic.com/" target="_blank">Get key →</a>';
      }
    };
  });

  input.focus();
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });

  saveBtn.addEventListener('click', () => {
    const key = input.value.trim();
    if (!key) { toast('Please enter a key', 'error'); return; }

    setProvider(activeTab);
    setApiKey(key, activeTab);
    close();
    toast(`${activeTab === 'gemini' ? 'Gemini' : 'Claude'} activated!`, 'success');

    if (onSuccess) onSuccess();
  });

  el.querySelector('#modal-demo-mode').onclick = () => {
    setProvider('anthropic');
    setApiKey('sk-demo-mode', 'anthropic');
    close();
    toast('Demo Mode activated!', 'info');
    if (onSuccess) onSuccess();
  };
}

function showLoginModal() {
  const { el, close } = openModal(`
    <div class="modal-logo">
      <div class="logo-mark">U</div>
      <div class="logo-wordmark">Un<span>blocked</span> AI</div>
    </div>
    <div class="modal-title">Sign in to Unblocked AI</div>
    <div class="modal-sub">Personalize your TPM dashboard and sync your program data across devices.</div>
    <div class="flex flex-col gap-12 mt-16">
      <button class="btn btn-secondary btn-block flex items-center justify-center gap-8" id="login-google" ${!isAuthEnabled()?'disabled':''}>
        <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#fbbc05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#ea4335"/></svg>
        Sign in with Google
      </button>
      <button class="btn btn-secondary btn-block flex items-center justify-center gap-8" id="login-github" ${!isAuthEnabled()?'disabled':''}>
        <svg width="18" height="18" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" fill="currentColor"/></svg>
        Sign in with GitHub
      </button>
    </div>
    <div class="modal-divider-text"><span>OR</span></div>
    <div class="modal-note text-center">
      You can also continue as a guest. All data stays in your browser.
      <br><br>
      <a href="#" id="modal-guest" style="color:var(--blue-light); text-decoration:none; font-weight:500;">Continue as Guest</a>
    </div>
    ${!isAuthEnabled() ? `
      <div class="alert alert-info mt-16" style="font-size:12px;">
        <strong>Note:</strong> OAuth requires Supabase configuration in Settings.
      </div>
    ` : ''}
  `);

  if (isAuthEnabled()) {
    el.querySelector('#login-google').onclick = async () => { try { await signInWithGoogle(); } catch (e) { toast(e.message, 'error'); } };
    el.querySelector('#login-github').onclick = async () => { try { await signInWithGitHub(); } catch (e) { toast(e.message, 'error'); } };
  }
  el.querySelector('#modal-guest').onclick = (e) => { e.preventDefault(); close(); };
}

function showSupabaseConfigModal() {
  const config = getSupabaseConfig();
  const { el, close } = openModal(`
    <div class="modal-title">Connect Supabase</div>
    <div class="modal-sub">Provide your Supabase Project URL and Anon Key to enable OAuth and cloud sync.</div>
    <div class="form-group">
      <label class="form-label">Supabase URL</label>
      <input type="text" id="s-url" value="${config.url}" placeholder="https://xyz.supabase.co">
    </div>
    <div class="form-group">
      <label class="form-label">Supabase Anon Key</label>
      <input type="password" id="s-key" value="${config.key}" placeholder="eyJhbGciOiJIUzI1NiI...">
    </div>
    <button class="btn btn-primary btn-block" id="save-s-config">Save and refresh</button>
  `);
  el.querySelector('#save-s-config').onclick = () => {
    const url = el.querySelector('#s-url').value.trim();
    const key = el.querySelector('#s-key').value.trim();
    setSupabaseConfig(url, key);
    close();
  };
}

// ── RENDER APP SHELL ──────────────────────────────────────────────
function renderApp() {
  document.getElementById('app').innerHTML = `
    <!-- LANDING PAGE -->
    <div id="page-landing" class="page active">
      ${renderLanding()}
    </div>

    <!-- APP SHELL -->
    <div id="page-app" class="page">
      <div class="layout-shell">
        ${renderSidebar()}
        <div class="main-content" id="main-content">
          <div id="apppage-dashboard" class="app-page"></div>
          <div id="apppage-generate"  class="app-page"></div>
          <div id="apppage-programs"  class="app-page"></div>
          <div id="apppage-history"   class="app-page"></div>
          <div id="apppage-risks"     class="app-page"></div>
          <div id="apppage-settings"  class="app-page"></div>
        </div>
      </div>
    </div>
  `;

  // Bind nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => showAppPage(item.dataset.page));
  });
}

// ── LANDING ───────────────────────────────────────────────────────
function renderLanding() {
  return `
  <div class="landing-hero">
    <div class="landing-eyebrow">Free forever &middot; Built for TPMs</div>
    <h1 class="landing-h1">Status updates that<br><em>write themselves</em></h1>
    <p class="landing-sub">Unblocked AI turns your program signals into role-aware narratives — for execs, engineers, PMs, and steering committees. In seconds, not hours.</p>
    <div class="landing-cta">
      <button class="btn btn-primary btn-xl" onclick="enterApp()">
        ${ICONS.generate} Get started — it's free
      </button>
      <button class="btn btn-ghost btn-lg" onclick="window.enterApp()">View demo →</button>
    </div>
    <div class="hero-image-wrap">
      <img src="assets/hero.png" alt="Unblocked AI Dashboard" class="hero-image">
    </div>
    <div class="social-proof">
      <div class="avatars">
        <div class="avatar" style="background:linear-gradient(135deg,#667eea,#764ba2)">AK</div>
        <div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c)">RJ</div>
        <div class="avatar" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">PM</div>
        <div class="avatar" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">SL</div>
      </div>
      <span>Used by 1,200+ TPMs at leading tech companies</span>
    </div>
    <div class="landing-features">
      <div class="feature-card" onclick="enterApp('generate')">
        <div class="feature-icon">${ICONS.generate}</div>
        <div class="feature-title">Role-aware personas</div>
        <div class="feature-desc">Exec BLUF, PM narrative, engineer deep-dive, steering committee brief — one click, four outputs, zero rewriting.</div>
      </div>
      <div class="feature-card" onclick="enterApp('history')">
        <div class="feature-icon">${ICONS.history}</div>
        <div class="feature-title">Program memory</div>
        <div class="feature-desc">AI remembers your program history, past decisions, and signals. Every update gets smarter over time.</div>
      </div>
      <div class="feature-card" onclick="enterApp('risks')">
        <div class="feature-icon">${ICONS.risks}</div>
        <div class="feature-title">Risk Radar</div>
        <div class="feature-desc">Automatically surfaces blockers, velocity drops, and missed milestones so your status is always complete and honest.</div>
      </div>
    </div>
  </div>`;
}

// ── SIDEBAR ───────────────────────────────────────────────────────
function renderSidebar() {
  return `
  <nav class="sidebar">
    <div class="sidebar-logo" onclick="showAppPage('dashboard')">
      <div class="logo-mark">U</div>
      <div class="logo-wordmark">Un<span>blocked</span> AI</div>
    </div>
    <div class="sidebar-nav">
      <div class="nav-label">Workspace</div>
      <div class="nav-item" id="nav-dashboard" data-page="dashboard">${ICONS.dashboard} Dashboard</div>
      <div class="nav-item" id="nav-generate"  data-page="generate">${ICONS.generate} Generate Status <span class="nav-pill nav-pill-blue">AI</span></div>
      <div class="nav-item" id="nav-programs"  data-page="programs">${ICONS.programs} My Programs</div>
      <div class="nav-item" id="nav-history"   data-page="history">${ICONS.history} Update History</div>
      <div class="nav-item" id="nav-risks"     data-page="risks">${ICONS.risks} Risk Radar <span class="nav-pill nav-pill-red" id="risk-count-badge"></span></div>
      <div class="nav-label" style="margin-top:10px;">Account</div>
      <div class="nav-item" id="nav-settings"  data-page="settings">${ICONS.settings} Settings</div>
    </div>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="avatar" id="sidebar-avatar">SM</div>
        <div>
          <div class="user-name" id="sidebar-name">Santanu Majumdar</div>
          <div class="user-role" id="sidebar-role">Sr. TPM</div>
        </div>
      </div>
    </div>
  </nav>`;
}

function updateRiskBadge() {
  const badge = document.getElementById('risk-count-badge');
  if (!badge) return;
  const count = getActiveRisks().length;
  badge.textContent = count > 0 ? count : '';
  badge.style.display = count > 0 ? 'inline' : 'none';
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function renderDashboard() {
  updateRiskBadge();
  const stats = getStats();
  const programs = getPrograms();
  const history = getHistory().slice(0, 3);
  const risks = getActiveRisks().slice(0, 3);

  const needsUpdate = programs
    .filter(p => !p.lastUpdated || Date.now() - p.lastUpdated > 6 * 86400000)
    .sort((a, b) => (a.lastUpdated || 0) - (b.lastUpdated || 0))
    .slice(0, 3);

  const el = document.getElementById('apppage-dashboard');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${getTimeGreeting()}, <em>${getDisplayName()}</em></div>
        <div class="page-subtitle">${needsUpdate.length > 0 ? `${needsUpdate.length} program${needsUpdate.length > 1 ? 's' : ''} due for a status update.` : 'All programs are up to date.'}</div>
      </div>
      <button class="btn btn-primary" onclick="showAppPage('generate')">
        ${ICONS.generate} Generate status
      </button>
    </div>
    <div class="page-body">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Active programs</div>
          <div class="metric-value">${stats.activePrograms}</div>
          <div class="metric-delta">${stats.onTrack} on track &middot; ${stats.atWatch} at watch</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Updates this week</div>
          <div class="metric-value">${stats.updatesThisWeek}</div>
          <div class="metric-delta up">AI-generated</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Hours saved est.</div>
          <div class="metric-value" style="color:var(--success)">${Math.round(stats.updatesThisWeek * 1.5)}</div>
          <div class="metric-delta up">this week</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Risk signals</div>
          <div class="metric-value" style="color:${stats.riskCount > 0 ? 'var(--warn)' : 'var(--success)'}">${stats.riskCount}</div>
          <div class="metric-delta ${stats.riskCount > 0 ? 'warn' : ''}">${stats.riskCount > 0 ? 'Needs attention' : 'All clear'}</div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="flex items-center justify-between mb-12">
            <div class="font-500" style="font-size:14px;">Programs needing update</div>
            <button class="btn btn-ghost btn-sm" onclick="showAppPage('programs')">View all</button>
          </div>
          <div class="card">
            ${needsUpdate.length === 0 ? `<div class="empty-state" style="padding:30px 20px;"><div class="empty-icon">✅</div><div class="empty-title">All up to date</div><div class="empty-desc">No programs need an update right now.</div></div>` :
              needsUpdate.map(p => `
                <div class="program-row" onclick="goToGenerate('${p.id}')">
                  <div class="program-icon" style="background:var(--${p.rag === 'red' ? 'danger' : p.rag === 'amber' ? 'warn' : 'success'}-bg)">${ragEmoji(p.rag)}</div>
                  <div class="program-info">
                    <div class="program-name">${p.name}</div>
                    <div class="program-meta">Last updated ${p.lastUpdated ? daysAgo(p.lastUpdated) : 'never'} &middot; ${p.team}</div>
                  </div>
                  <div class="program-right">${ragBadge(p.rag)}</div>
                </div>`).join('')
            }
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-12">
            <div class="font-500" style="font-size:14px;">Active risk signals</div>
            <button class="btn btn-ghost btn-sm" onclick="showAppPage('risks')">View all</button>
          </div>
          ${risks.length === 0 ? `<div class="card"><div class="empty-state" style="padding:30px 20px;"><div class="empty-icon">🟢</div><div class="empty-title">No active risks</div><div class="empty-desc">Your portfolio is clear.</div></div></div>` :
            risks.map(r => `
              <div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);margin-bottom:8px;">
                <div class="risk-severity-bar ${r.severity}"></div>
                <div>
                  <div style="font-size:13px;font-weight:500;margin-bottom:2px;">${r.title}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${truncate(r.description, 90)}</div>
                </div>
              </div>`).join('')
          }
        </div>
      </div>

      <div class="divider"></div>
      <div class="flex items-center justify-between mb-12">
        <div class="font-500" style="font-size:14px;">Recent updates</div>
        <button class="btn btn-ghost btn-sm" onclick="showAppPage('history')">Full history</button>
      </div>
      <div class="card">
        ${history.length === 0 ? `<div class="empty-state" style="padding:30px 20px;"><div class="empty-icon">📋</div><div class="empty-title">No updates yet</div><div class="empty-desc">Generate your first status update to see it here.</div><button class="btn btn-primary" onclick="showAppPage('generate')">Generate now</button></div>` :
          history.map(h => `
            <div class="history-item">
              <div class="history-date">${formatDate(h.createdAt)}</div>
              <div class="history-body">
                <div class="history-program">${h.programName} ${h.personas.map(personaBadge).join('')}</div>
                <div class="history-preview">${truncate(h.preview, 80)}</div>
              </div>
            </div>`).join('')
        }
      </div>
    </div>`;
}

// ── GENERATE ──────────────────────────────────────────────────────
function renderGenerate(prefillProgramId) {
  updateRiskBadge();
  const programs = getPrograms();
  const prefill = prefillProgramId ? getProgramById(prefillProgramId) : null;
  const sg = state.generate;

  const el = document.getElementById('apppage-generate');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title"><em>Generate</em> status update</div>
        <div class="page-subtitle">Fill in your program signals. AI writes the right message for every audience.</div>
      </div>
    </div>
    <div class="page-body">
      ${!hasApiKey() ? `<div class="api-banner">${ICONS.warning} No API key set. <a onclick="openApiKeyModal()">Add your key in Settings</a> to enable AI generation.</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">

        <!-- INPUT FORM -->
        <div>
          <div class="card-raised">
            <div class="card-header">
              <div class="card-title">Program signals</div>
              <span class="text-xs text-muted">Step 1 of 2</span>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">Program <span class="required">*</span></label>
                <select id="gen-program" onchange="onProgramSelect(this.value)">
                  <option value="">Select a program…</option>
                  ${programs.map(p => `<option value="${p.id}" ${prefill?.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                  <option value="__new__">+ Add new program</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">RAG status <span class="required">*</span></label>
                <div class="rag-selector" id="rag-selector">
                  <div class="rag-option ${sg.selectedRag==='green'?'selected':''}" data-rag="green" onclick="selectRag('green')"><span class="rag-dot"></span>On Track</div>
                  <div class="rag-option ${sg.selectedRag==='amber'?'selected':''}" data-rag="amber" onclick="selectRag('amber')"><span class="rag-dot"></span>At Watch</div>
                  <div class="rag-option ${sg.selectedRag==='red'?'selected':''}"   data-rag="red"   onclick="selectRag('red')"  ><span class="rag-dot"></span>At Risk</div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Top blockers / risks</label>
                <textarea id="gen-blockers" placeholder="e.g. Dependency on ML Infra team unresolved 9 days. No ETA. Risk of 2-week milestone slip.">${prefill?.blockers || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Key decisions made</label>
                <textarea id="gen-decisions" placeholder="e.g. Agreed to descope feature X to Q3. Approved additional headcount request." style="min-height:76px;">${prefill?.decisions || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Next milestones</label>
                <textarea id="gen-milestones" placeholder="e.g. Phase 2 integration — Apr 20. Staging QA — Apr 28. Prod release — May 3." style="min-height:76px;">${prefill?.milestones || ''}</textarea>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Tone preference</label>
                <select id="gen-tone">
                  <option value="balanced">Balanced — factual with context</option>
                  <option value="direct">Direct — no fluff, just facts</option>
                  <option value="reassuring">Reassuring — calm confidence</option>
                  <option value="urgent">Urgent — escalation tone</option>
                </select>
              </div>
            </div>
          </div>

          <div class="card-raised mt-14">
            <div class="card-header">
              <div class="card-title">Select audience personas</div>
              <span class="text-xs text-muted">Step 2 of 2</span>
            </div>
            <div class="card-body">
              <div class="persona-grid" id="persona-grid">
                ${renderPersonaCards()}
              </div>
              <button class="btn btn-primary btn-block mt-14" id="gen-btn" onclick="doGenerate()">
                ${ICONS.generate} Generate status updates
              </button>
            </div>
          </div>

          <!-- DOCUMENT UPLOAD ZONE -->
          <div class="card-raised mt-14">
            <div class="card-header">
              <div class="card-title">Project documents (PDF, XLS, Word)</div>
              <span class="text-xs text-muted">Optional Context</span>
            </div>
            <div class="card-body">
              <div class="upload-zone" id="gen-upload-zone" style="border:2px dashed var(--border);border-radius:var(--radius-sm);padding:24px;text-align:center;cursor:pointer;transition:all 0.2s;">
                <div style="font-size:24px;margin-bottom:8px;">📄</div>
                <div style="font-size:13.5px;font-weight:500;">Drop project documents here</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">or click to upload</div>
                <input type="file" id="gen-file-input" multiple style="display:none">
              </div>
              <div id="gen-file-list" class="flex flex-wrap gap-8 mt-12"></div>
              <div id="gen-parsing-indicator" class="mt-8" style="display:none;">
                <div class="pulse-row"><div class="pulse-dot"></div><span style="font-size:12px;">Extracting signals...</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- OUTPUT PANEL -->
        <div id="output-col">
          <div style="font-size:13.5px;font-weight:500;margin-bottom:10px;">Generated output</div>
          <div class="output-panel" id="output-panel">
            <div class="output-tabs" id="output-tabs">
              ${sg.selectedPersonas.map((p, i) => `<div class="output-tab ${i===0?'active':''}" data-persona="${p}" onclick="switchOutputTab('${p}')">${PERSONA_LABELS[p]}</div>`).join('')}
            </div>
            <div class="output-content" id="output-content">
              ${Object.keys(sg.outputs).length === 0 ? `
                <div class="output-placeholder">
                  <div class="output-placeholder-icon">⚡</div>
                  <div class="output-placeholder-text">Fill in your program signals and click Generate to see role-aware status updates appear here in real time.</div>
                </div>` : renderOutputContent()
              }
            </div>
            <div class="output-actions" id="output-actions" style="${Object.keys(sg.outputs).length===0?'display:none':''}">
              <button class="btn btn-secondary btn-sm" onclick="doCopy()">${ICONS.copy} Copy</button>
              <button class="btn btn-secondary btn-sm" onclick="toast('Slack integration coming soon!','info')">${ICONS.slack} Slack</button>
              <button class="btn btn-secondary btn-sm" onclick="toast('Email draft copied!','success')">${ICONS.email} Email draft</button>
              <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="doGenerate()">${ICONS.refresh} Regenerate</button>
            </div>
          </div>
          <div id="insight-card-wrap"></div>
        </div>
      </div>
    </div>`;

  // Prefill RAG if program selected
  if (prefill) {
    refreshRagUI();
  }

  // Initialize file upload UI
  initUploadZone();
  renderFileChips();
}

function renderPersonaCards() {
  const personas = [
    { id: 'exec',     icon: ICONS.generate, label: 'Executive / VP',    desc: 'BLUF format. 3-5 bullets. Decision-focused.' },
    { id: 'pm',       icon: ICONS.programs, label: 'Product Manager',   desc: 'Narrative. Risk + dependency context.' },
    { id: 'eng',      icon: ICONS.settings, label: 'Engineering team',  desc: 'Technical depth. Sprint data. Owners named.' },
    { id: 'steering', icon: ICONS.risks,    label: 'Steering committee',desc: 'Formal. Health table. Portfolio view.' }
  ];
  return personas.map(p => {
    const selected = state.generate.selectedPersonas.includes(p.id);
    return `
    <div class="persona-card ${selected ? 'selected' : ''}" id="persona-${p.id}" onclick="togglePersona('${p.id}')">
      <div class="persona-name">
        ${p.icon} ${p.label}
        <div class="persona-check">${selected ? ICONS.check : ''}</div>
      </div>
      <div class="persona-desc">${p.desc}</div>
    </div>`;
  }).join('');
}

function renderOutputContent() {
  const sg = state.generate;
  return Object.entries(sg.outputs).map(([persona, html]) =>
    `<div class="output-text" id="output-text-${persona}" style="${persona !== sg.activeTab ? 'display:none' : ''}">${html}</div>`
  ).join('');
}

// ── GENERATE LOGIC ────────────────────────────────────────────────
window.doGenerate = async function() {
  const sg = state.generate;
  if (sg.generating) return;

  const programId = document.getElementById('gen-program')?.value;
  if (!programId || programId === '__new__') {
    toast('Please select a program first', 'error'); return;
  }
  if (sg.selectedPersonas.length === 0) {
    toast('Please select at least one audience persona', 'error'); return;
  }
  if (!hasApiKey()) {
    openApiKeyModal(); return;
  }

  const program = getProgramById(programId);
  const programData = {
    name:       program?.name || programId,
    team:       program?.team || '',
    quarter:    program?.quarter || 'Q2 2026',
    rag:        sg.selectedRag,
    blockers:   document.getElementById('gen-blockers')?.value || '',
    decisions:  document.getElementById('gen-decisions')?.value || '',
    milestones: document.getElementById('gen-milestones')?.value || '',
    tone:       document.getElementById('gen-tone')?.value || 'balanced',
    fileContext: (window.genFiles || []).map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n')
  };

  sg.generating = true;
  sg.outputs = {};
  sg.activeTab = sg.selectedPersonas[0];

  const btn = document.getElementById('gen-btn');
  setButtonLoading(btn, true);

  // Update tabs
  const tabsEl = document.getElementById('output-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = sg.selectedPersonas.map((p, i) =>
      `<div class="output-tab ${i===0?'active':''}" data-persona="${p}" onclick="switchOutputTab('${p}')">${PERSONA_LABELS[p]}</div>`
    ).join('');
  }

  // Clear output, show content area
  const contentEl = document.getElementById('output-content');
  if (contentEl) contentEl.innerHTML = sg.selectedPersonas.map((p, i) =>
    `<div class="output-text" id="output-text-${p}" style="${i===0?'':'display:none'}"></div>`
  ).join('');

  document.getElementById('output-actions').style.display = 'none';
  document.getElementById('insight-card-wrap').innerHTML = '';

  // Generate each persona sequentially
  for (const persona of sg.selectedPersonas) {
    const targetEl = document.getElementById(`output-text-${persona}`);
    if (!targetEl) continue;
    // Switch to this tab while generating
    if (persona === sg.selectedPersonas[0]) switchOutputTab(persona);

    await new Promise(resolve => {
      generateStatusUpdate(programData, persona, targetEl,
        (text) => {
          sg.outputs[persona] = targetEl.innerHTML;
          resolve();
        },
        (err) => {
          targetEl.innerHTML = `<span style="color:var(--danger);">Error: ${err}</span>`;
          toast(err, 'error');
          resolve();
        }
      );
    });
  }

  // Save to history
  const firstOutput = Object.values(sg.outputs)[0] || '';
  const preview = firstOutput.replace(/<[^>]+>/g, '').slice(0, 120);
  addHistoryEntry({
    programId,
    programName: programData.name,
    personas: sg.selectedPersonas,
    rag: sg.selectedRag,
    preview,
    content: sg.outputs,
    createdAt: Date.now()
  });

  // Update program lastUpdated
  if (program) saveProgram({ ...program, lastUpdated: Date.now() });

  document.getElementById('output-actions').style.display = 'flex';

  // Show insight if blockers
  if (programData.blockers.length > 10) {
    document.getElementById('insight-card-wrap').innerHTML = `
      <div class="insight-card">
        <div class="insight-label">${ICONS.warning} AI risk insight</div>
        <div class="insight-body">Blockers detected in this update. Your executive output includes an escalation flag. Consider scheduling a sync or creating a risk in Risk Radar.</div>
      </div>`;
  }

  setButtonLoading(btn, false, `${ICONS.generate} Generate status updates`);
  sg.generating = false;
  toast('Status updates generated!', 'success');
};

window.switchOutputTab = function(persona) {
  state.generate.activeTab = persona;
  document.querySelectorAll('.output-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.persona === persona);
  });
  document.querySelectorAll('[id^="output-text-"]').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`output-text-${persona}`);
  if (target) target.style.display = 'block';
};

window.doCopy = function() {
  const active = document.getElementById(`output-text-${state.generate.activeTab}`);
  if (!active) return;
  const text = active.innerText || active.textContent;
  copyText(text).then(() => toast('Copied to clipboard!', 'success'));
};

window.selectRag = function(rag) {
  state.generate.selectedRag = rag;
  refreshRagUI();
};
function refreshRagUI() {
  document.querySelectorAll('.rag-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.rag === state.generate.selectedRag);
  });
}

window.togglePersona = function(id) {
  const sg = state.generate;
  const has = sg.selectedPersonas.includes(id);
  if (has && sg.selectedPersonas.length === 1) { toast('Select at least one persona', 'info'); return; }
  if (has) sg.selectedPersonas = sg.selectedPersonas.filter(p => p !== id);
  else sg.selectedPersonas.push(id);
  const card = document.getElementById(`persona-${id}`);
  if (card) {
    card.classList.toggle('selected', !has);
    card.querySelector('.persona-check').innerHTML = !has ? ICONS.check : '';
  }
  // Refresh tabs
  const tabsEl = document.getElementById('output-tabs');
  if (tabsEl && Object.keys(sg.outputs).length === 0) {
    tabsEl.innerHTML = sg.selectedPersonas.map((p, i) =>
      `<div class="output-tab ${i===0?'active':''}" data-persona="${p}" onclick="switchOutputTab('${p}')">${PERSONA_LABELS[p]}</div>`
    ).join('');
  }
};

window.onProgramSelect = function(id) {
  if (id === '__new__') { showAddProgramModal(); return; }
  const p = getProgramById(id);
  if (!p) return;
  if (p.rag) { state.generate.selectedRag = p.rag; refreshRagUI(); }
  const blockers  = document.getElementById('gen-blockers');
  const decisions = document.getElementById('gen-decisions');
  const milestones= document.getElementById('gen-milestones');
  if (blockers && p.blockers)   blockers.value   = p.blockers;
  if (decisions && p.decisions) decisions.value  = p.decisions;
  if (milestones && p.milestones) milestones.value = p.milestones;
};

window.goToGenerate = function(programId) {
  state.generate.outputs = {};
  showAppPage('generate');
  setTimeout(() => {
    const sel = document.getElementById('gen-program');
    if (sel) { sel.value = programId; onProgramSelect(programId); }
  }, 100);
};

// ── FILE HANDLING ────────────────────────────────────────────────
window.genFiles = [];

function initUploadZone() {
  const zone = document.getElementById('gen-upload-zone');
  const input = document.getElementById('gen-file-input');
  if (!zone || !input) return;

  zone.onclick = () => input.click();
  zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--blue-light)'; zone.style.background = 'var(--surface-light)'; };
  zone.ondragleave = () => { zone.style.borderColor = 'var(--border)'; zone.style.background = 'none'; };
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.style.borderColor = 'var(--border)';
    zone.style.background = 'none';
    handleGenFiles(e.dataTransfer.files);
  };
  input.onchange = (e) => handleGenFiles(e.target.files);
}

async function handleGenFiles(files) {
  const indicator = document.getElementById('gen-parsing-indicator');
  if (indicator) indicator.style.display = 'block';
  
  for (const file of files) {
    try {
      const text = await parseFile(file);
      window.genFiles.push({ name: file.name, content: text });
      renderFileChips();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  if (indicator) indicator.style.display = 'none';
}

function renderFileChips() {
  const list = document.getElementById('gen-file-list');
  if (!list) return;
  list.innerHTML = window.genFiles.map((f, i) => `
    <div class="file-chip" style="background:var(--surface-light);border:1px solid var(--border);border-radius:12px;padding:4px 10px;display:flex;align-items:center;gap:6px;font-size:12px;">
      <span class="truncate" style="max-width:140px;">${f.name}</span>
      <button onclick="window.removeGenFile(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;">&times;</button>
    </div>
  `).join('');
}

window.removeGenFile = (idx) => {
  window.genFiles.splice(idx, 1);
  renderFileChips();
};

// ── PROGRAMS ──────────────────────────────────────────────────────
function renderPrograms() {
  updateRiskBadge();
  const programs = getPrograms();
  const el = document.getElementById('apppage-programs');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">My <em>Programs</em></div>
        <div class="page-subtitle">${programs.length} active programs in your portfolio.</div>
      </div>
      <button class="btn btn-primary" onclick="showAddProgramModal()">
        ${ICONS.plus} Add program
      </button>
    </div>
    <div class="page-body">
      <div class="card">
        ${programs.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <div class="empty-title">No programs yet</div>
            <div class="empty-desc">Add your first program to start generating status updates.</div>
            <button class="btn btn-primary" onclick="showAddProgramModal()">Add program</button>
          </div>` :
          programs.map(p => `
            <div class="program-row">
              <div class="program-icon" style="background:var(--${p.rag==='red'?'danger':p.rag==='amber'?'warn':'success'}-bg)">${ragEmoji(p.rag)}</div>
              <div class="program-info">
                <div class="program-name">${p.name}</div>
                <div class="program-meta">${p.team} &middot; ${p.quarter} &middot; Next: ${p.milestone || '—'}</div>
              </div>
              <div class="program-right" style="gap:8px;">
                ${ragBadge(p.rag)}
                <button class="btn btn-secondary btn-sm" onclick="goToGenerate('${p.id}')">Update</button>
                <button class="btn btn-ghost btn-sm" onclick="showEditProgramModal('${p.id}')">${ICONS.edit}</button>
                <button class="btn btn-ghost btn-sm text-danger" onclick="confirmDeleteProgram('${p.id}')">${ICONS.trash}</button>
              </div>
            </div>`).join('')
        }
      </div>
    </div>`;
}

window.showAddProgramModal = function() {
  showProgramModal(null);
};
window.showEditProgramModal = function(id) {
  showProgramModal(getProgramById(id));
};

function showProgramModal(program) {
  const isEdit = !!program;
  const { el, close } = openModal(`
    <div style="font-size:17px;font-weight:500;margin-bottom:18px;">${isEdit ? 'Edit program' : 'Add new program'}</div>
    
    ${!isEdit ? `
    <div class="upload-zone mb-16" id="pf-upload-zone" style="border:2px dashed var(--border);border-radius:var(--radius-sm);padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;">
      <div style="font-size:20px;margin-bottom:4px;">📄</div>
      <div style="font-size:13.5px;font-weight:500;">Auto-populate from document</div>
      <div style="font-size:11.5px;color:var(--text-muted);">Drop project report, plan, or spec here</div>
      <input type="file" id="pf-file-input" style="display:none">
    </div>
    <div id="pf-parsing-indicator" class="mb-16" style="display:none;">
      <div class="pulse-row"><div class="pulse-dot"></div><span style="font-size:12px;">AI is extracting program signals...</span></div>
    </div>
    ` : ''}

    <div class="form-group">
      <label class="form-label">Program name <span class="required">*</span></label>
      <input type="text" id="pf-name" placeholder="e.g. Orion — Cloud Cost Optimization" value="${program?.name || ''}">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Team / Org</label>
        <input type="text" id="pf-team" placeholder="Platform Engineering" value="${program?.team || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Quarter</label>
        <select id="pf-quarter">
          ${['Q1 2026','Q2 2026','Q3 2026','Q4 2026','Q1 2027'].map(q =>
            `<option ${(program?.quarter||'Q2 2026')===q?'selected':''}>${q}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">RAG status</label>
        <select id="pf-rag">
          <option value="green" ${program?.rag==='green'?'selected':''}>On Track</option>
          <option value="amber" ${program?.rag==='amber'?'selected':''}>At Watch</option>
          <option value="red"   ${program?.rag==='red'  ?'selected':''}>At Risk</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Next milestone date</label>
        <input type="text" id="pf-milestone" placeholder="May 15" value="${program?.milestone || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Recurring blockers / context</label>
      <textarea id="pf-blockers" placeholder="Ongoing blockers or dependencies...">${program?.blockers || ''}</textarea>
    </div>
    <div class="flex gap-8" style="margin-top:4px;">
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button class="btn btn-primary" style="flex:1;" id="pf-save">
        ${isEdit ? 'Save changes' : 'Add program'}
      </button>
    </div>
  `);

  if (!isEdit) {
    const zone = el.querySelector('#pf-upload-zone');
    const input = el.querySelector('#pf-file-input');
    const indicator = el.querySelector('#pf-parsing-indicator');

    zone.onclick = () => input.click();
    input.onchange = (e) => handlePfUpload(e.target.files);
    
    zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; zone.style.background = 'var(--accent-glow)'; };
    zone.ondragleave = () => { zone.style.borderColor = 'var(--border)'; zone.style.background = 'none'; };
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--border)';
      zone.style.background = 'none';
      handlePfUpload(e.dataTransfer.files);
    };

    const handlePfUpload = async (files) => {
      if (!files.length) return;
      indicator.style.display = 'block';
      let fullText = '';
      try {
        for (const file of files) {
          const text = await parseFile(file);
          fullText += text + '\n\n';
        }
        
        extractProgramSignals(fullText, (data) => {
          indicator.style.display = 'none';
          const programs = data.programs || (data.name ? [data] : []);
          
          if (programs.length > 1) {
            renderBulkReview(programs, el, close);
            return;
          }
          
          if (programs.length === 1) {
            const p = programs[0];
            if (p.name) el.querySelector('#pf-name').value = p.name;
            if (p.team) el.querySelector('#pf-team').value = p.team;
            if (p.quarter) el.querySelector('#pf-quarter').value = p.quarter;
            if (p.rag) el.querySelector('#pf-rag').value = p.rag;
            if (p.milestone) el.querySelector('#pf-milestone').value = p.milestone;
            if (p.blockers) el.querySelector('#pf-blockers').value = p.blockers;
            toast('Signals extracted from document!', 'success');
          } else {
            toast('No programs found in document', 'info');
          }
        }, (err) => {
          indicator.style.display = 'none';
          toast(err, 'error');
        });
      } catch (err) {
        indicator.style.display = 'none';
        toast('Document parsing failed', 'error');
      }
    };
  }

  el.querySelector('#pf-save').onclick = () => {
    const name = el.querySelector('#pf-name').value.trim();
    if (!name) { toast('Program name is required', 'error'); return; }
    const p = {
      id:          program?.id || newProgramId(),
      name,
      team:        el.querySelector('#pf-team').value.trim() || 'General',
      quarter:     el.querySelector('#pf-quarter').value,
      rag:         el.querySelector('#pf-rag').value,
      milestone:   el.querySelector('#pf-milestone').value.trim(),
      blockers:    el.querySelector('#pf-blockers').value.trim(),
      decisions:   program?.decisions || '',
      milestones:  program?.milestones || '',
      emoji:       '📁',
      lastUpdated: program?.lastUpdated || null
    };
    saveProgram(p);
    close();
    toast(`Program ${isEdit ? 'updated' : 'added'}!`, 'success');
    // Go back to generate if we came from __new__
    const genSel = document.getElementById('gen-program');
    if (genSel && genSel.value === '__new__') {
      renderGenerate();
      setTimeout(() => { const s = document.getElementById('gen-program'); if (s) s.value = p.id; }, 50);
    } else {
      renderPrograms();
    }
  };
}

function renderBulkReview(programs, modalEl, close) {
  modalEl.innerHTML = `
    <div style="font-size:17px;font-weight:500;margin-bottom:8px;">Bulk Program Import</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:18px;">AI detected ${programs.length} programs. Review and import them.</div>
    
    <div class="bulk-import-container">
      ${programs.map((p, i) => `
        <div class="bulk-program-item" id="bulk-item-${i}">
          <div class="bulk-info">
            <div class="bulk-name">${p.name || 'Untitled Program'}</div>
            <div class="bulk-meta">${p.team || 'General'} &middot; ${p.quarter || 'Q2 2026'} &middot; ${ragLabel(p.rag)}</div>
          </div>
          <div class="bulk-actions">
            <button class="btn btn-ghost btn-sm text-danger" onclick="this.closest('.bulk-program-item').remove()">Skip</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="flex gap-8 mt-24">
      <button class="btn btn-ghost" style="flex:1;" onclick="location.reload()">Cancel</button>
      <button class="btn btn-primary" style="flex:2;" id="bulk-save-all">Import All Programs</button>
    </div>
  `;

  modalEl.querySelector('#bulk-save-all').onclick = () => {
    const items = modalEl.querySelectorAll('.bulk-program-item');
    const toSave = Array.from(items).map(item => {
      const idx = parseInt(item.id.split('-').pop());
      return programs[idx];
    });

    toSave.forEach(p => {
      // Find existing by name for basic de-duplication
      const existing = getPrograms().find(ep => ep.name.toLowerCase() === p.name.toLowerCase());
      const programToSave = {
        id:          existing?.id || newProgramId(),
        name:        p.name,
        team:        p.team || 'General',
        quarter:     p.quarter || 'Q2 2026',
        rag:         p.rag || 'green',
        milestone:   p.milestone || '',
        blockers:    p.blockers || '',
        decisions:   existing?.decisions || '',
        milestones:  existing?.milestones || '',
        emoji:       '📁',
        lastUpdated: Date.now()
      };
      saveProgram(programToSave);
    });

    close();
    toast(`Successfully imported ${toSave.length} programs!`, 'success');
    renderPrograms();
  };
}


window.confirmDeleteProgram = function(id) {
  const p = getProgramById(id);
  uiConfirm(`Delete "${p?.name}"? This cannot be undone.`, () => {
    deleteProgram(id);
    toast('Program deleted', 'info');
    renderPrograms();
  });
};

// ── HISTORY ───────────────────────────────────────────────────────
function renderHistory() {
  updateRiskBadge();
  const history = getHistory();
  const el = document.getElementById('apppage-history');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Update <em>History</em></div>
        <div class="page-subtitle">${history.length} generated updates saved.</div>
      </div>
    </div>
    <div class="page-body">
      <div class="card">
        ${history.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">No history yet</div>
            <div class="empty-desc">Generated updates will appear here automatically.</div>
            <button class="btn btn-primary" onclick="showAppPage('generate')">Generate now</button>
          </div>` :
          history.map(h => `
            <div class="history-item" onclick="showHistoryDetail('${h.id}')">
              <div class="history-date">${formatDate(h.createdAt)}</div>
              <div class="history-body">
                <div class="history-program">${h.programName} ${ragBadge(h.rag)} ${h.personas.map(personaBadge).join('')}</div>
                <div class="history-preview">${truncate(h.preview, 100)}</div>
              </div>
              <button class="btn btn-ghost btn-sm nowrap" onclick="event.stopPropagation();reuseHistory('${h.id}')">Reuse</button>
            </div>`).join('')
        }
      </div>
    </div>`;
}

window.showHistoryDetail = function(id) {
  const h = getHistory().find(x => x.id === id);
  if (!h) return;
  const { el, close } = openModal(`
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">${formatDate(h.createdAt)}</div>
    <div style="font-size:16px;font-weight:500;margin-bottom:4px;">${h.programName}</div>
    <div style="margin-bottom:16px;">${ragBadge(h.rag)} ${h.personas.map(personaBadge).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      ${h.personas.map(p => `<button class="btn btn-ghost btn-sm" onclick="switchHistoryTab(this,'${h.id}','${p}')">${PERSONA_LABELS[p]}</button>`).join('')}
    </div>
    <div id="history-detail-content" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;font-size:13.5px;line-height:1.75;color:var(--text-primary);max-height:320px;overflow-y:auto;">
      ${h.content?.[h.personas[0]] || h.preview}
    </div>
    <div class="flex gap-8 mt-12">
      <button class="btn btn-secondary btn-sm" onclick="copyHistoryContent('${h.id}','${h.personas[0]}')">${ICONS.copy} Copy</button>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>
  `);
};

window.switchHistoryTab = function(btn, id, persona) {
  const h = getHistory().find(x => x.id === id);
  if (!h) return;
  const contentEl = document.getElementById('history-detail-content');
  if (contentEl) contentEl.innerHTML = h.content?.[persona] || h.preview;
  // update copy button
  const copyBtn = btn.closest('.modal').querySelector('.btn-secondary');
  if (copyBtn) copyBtn.onclick = () => copyHistoryContent(id, persona);
};

window.copyHistoryContent = function(id, persona) {
  const h = getHistory().find(x => x.id === id);
  const text = h?.content?.[persona] || h?.preview || '';
  copyText(text.replace(/<[^>]+>/g, '')).then(() => toast('Copied!', 'success'));
};

window.reuseHistory = function(id) {
  const h = getHistory().find(x => x.id === id);
  if (!h) return;
  goToGenerate(h.programId);
  toast('Program pre-filled. Click Generate to create a fresh update.', 'info');
};

// ── RISKS ──────────────────────────────────────────────────────────
function renderRisks() {
  updateRiskBadge();
  const risks = getRisks();
  const active = risks.filter(r => !r.acknowledged);
  const el = document.getElementById('apppage-risks');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Risk <em>Radar</em></div>
        <div class="page-subtitle">AI-detected signals across your portfolio.</div>
      </div>
      ${active.length > 0 ? `<span class="badge badge-red"><span class="badge-dot"></span>${active.length} active risk${active.length>1?'s':''}</span>` : ''}
    </div>
    <div class="page-body">
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
        <div class="metric-card">
          <div class="metric-label">High severity</div>
          <div class="metric-value" style="color:var(--danger)">${active.filter(r=>r.severity==='high').length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Medium severity</div>
          <div class="metric-value" style="color:var(--warn)">${active.filter(r=>r.severity==='medium').length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Acknowledged</div>
          <div class="metric-value" style="color:var(--success)">${risks.filter(r=>r.acknowledged).length}</div>
        </div>
      </div>

      ${active.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🟢</div>
          <div class="empty-title">Portfolio is clear</div>
          <div class="empty-desc">No active risk signals detected. Check back after your next program update.</div>
        </div>` :
        active.map(r => `
          <div class="risk-card" style="border-color:var(--${r.severity==='high'?'danger':r.severity==='medium'?'warn':'blue'}-border);">
            <div class="risk-header" style="background:var(--${r.severity==='high'?'danger':r.severity==='medium'?'warn':'blue'}-bg);">
              <div class="flex items-center gap-8">
                ${severityBadge(r.severity)}
                <span style="font-size:13.5px;font-weight:500;">${r.title}</span>
              </div>
              <span class="text-xs text-muted">${daysAgo(r.detectedAt)}</span>
            </div>
            <div class="risk-body">
              ${r.description}
              <div class="risk-body-actions">
                <button class="btn btn-primary btn-sm" onclick="goToGenerate('${r.programId}');toast('Pre-filled with program context','info')">${ICONS.generate} Generate escalation update</button>
                <button class="btn btn-ghost btn-sm" onclick="doAcknowledge('${r.id}')">Acknowledge</button>
                <button class="btn btn-ghost btn-sm text-danger" onclick="doDismissRisk('${r.id}')">${ICONS.trash} Dismiss</button>
              </div>
            </div>
          </div>`).join('')
      }
    </div>`;
}

window.doAcknowledge = function(id) {
  acknowledgeRisk(id);
  toast('Risk acknowledged', 'success');
  renderRisks();
  updateRiskBadge();
};
window.doDismissRisk = function(id) {
  dismissRisk(id);
  toast('Risk dismissed', 'info');
  renderRisks();
  updateRiskBadge();
};

// ── SETTINGS ──────────────────────────────────────────────────────
function renderSettings() {
  updateRiskBadge();
  const name = localStorage.getItem('unblocked_name') || 'Santanu Majumdar';
  const role = localStorage.getItem('unblocked_role') || 'Senior Technical Program Manager';
  const org  = localStorage.getItem('unblocked_org')  || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const hasKey = hasApiKey();

  const el = document.getElementById('apppage-settings');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Account <em>Settings</em></div>
        <div class="page-subtitle">Manage your profile, API key, and preferences.</div>
      </div>
    </div>
    <div class="page-body" style="max-width:640px;">

      <div class="settings-section">
        <div class="settings-title">Profile</div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Full name</label><input type="text" id="s-name" value="${name}"></div>
          <div class="form-group"><label class="form-label">Role / Title</label><input type="text" id="s-role" value="${role}"></div>
        </div>
        <div class="form-group"><label class="form-label">Organization</label><input type="text" id="s-org" placeholder="Amazon, Google, Meta…" value="${org}"></div>
        <button class="btn btn-primary btn-sm" onclick="saveProfile()">Save profile</button>
      </div>

      <div class="settings-section">
        <div class="settings-title">AI Provider & API</div>
        
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-name">AI Provider</div>
            <div class="setting-desc">Choose which AI powers your generations</div>
          </div>
          <select id="s-provider" style="width:170px;" onchange="window.changeProvider(this.value)">
            <option value="anthropic" ${getProvider()==='anthropic'?'selected':''}>Claude (Anthropic)</option>
            <option value="gemini"    ${getProvider()==='gemini'?'selected':''}>Gemini (Google)</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-name">${getProvider()==='gemini'?'Gemini':'Claude'} API Key</div>
            <div class="setting-desc">${getProvider()==='gemini'?'Free tier supported (up to 15 RPM)':'Professional tier (Sonnet 3.5)'}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="window.openApiKeyModal()">Update Key</button>
            ${hasKey ? `<button class="btn btn-ghost btn-sm text-danger" onclick="removeApiKey()">Remove</button>` : ''}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">AI preferences</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-name">Default tone</div>
            <div class="setting-desc">How AI frames status updates by default</div>
          </div>
          <select id="s-tone" style="width:170px;" onchange="savePref('tone',this.value)">
            <option value="balanced" ${(localStorage.getItem('unblocked_tone')||'balanced')==='balanced'?'selected':''}>Balanced</option>
            <option value="direct"   ${localStorage.getItem('unblocked_tone')==='direct'  ?'selected':''}>Direct</option>
            <option value="reassuring" ${localStorage.getItem('unblocked_tone')==='reassuring'?'selected':''}>Reassuring</option>
            <option value="urgent"   ${localStorage.getItem('unblocked_tone')==='urgent'  ?'selected':''}>Urgent</option>
          </select>
        </div>
      </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-name">Escalation threshold</div>
            <div class="setting-desc">Flag blockers older than this as high severity</div>
          </div>
          <select style="width:140px;" onchange="savePref('threshold',this.value)">
            ${['3 days','5 days','7 days','14 days'].map(d =>
              `<option ${(localStorage.getItem('unblocked_threshold')||'7 days')===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-name">Weekly update reminder</div>
            <div class="setting-desc">Alert when a program hasn't been updated in 7+ days</div>
          </div>
          <div class="toggle ${localStorage.getItem('unblocked_reminder')!=='false'?'on':''}" id="toggle-reminder" onclick="togglePref('reminder',this)"><div class="toggle-thumb"></div></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">Integrations (coming soon)</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-name">Slack</div><div class="setting-desc">Publish updates directly to Slack channels</div></div>
          <button class="btn btn-ghost btn-sm" onclick="toast('Slack integration coming soon!','info')">Connect</button>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-name">Jira</div><div class="setting-desc">Auto-pull sprint data and blockers</div></div>
          <button class="btn btn-ghost btn-sm" onclick="toast('Jira integration coming soon!','info')">Connect</button>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-name">Linear</div><div class="setting-desc">Sync cycle data automatically</div></div>
          <button class="btn btn-ghost btn-sm" onclick="toast('Linear integration coming soon!','info')">Connect</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">Integrations & Cloud</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-name">Supabase Connection</div>
            <div class="setting-desc">${isAuthEnabled() ? '✓ Connected to your Supabase project' : 'Configure Supabase to enable OAuth and cloud data sync'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.openSupabaseConfig()">
            ${isAuthEnabled() ? 'Update Config' : 'Configure'}
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">Account Actions</div>
        <div class="setting-row" style="border:none;padding-top:0;">
          <div class="setting-info">
            <div class="setting-name text-danger">Reset all local data</div>
            <div class="setting-desc">Clear all projects, history, and settings from this browser</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="confirmResetAll()">Reset all</button>
        </div>
      </div>

      <div class="free-badge mt-16">
        <div style="font-size:13px;font-weight:500;color:var(--blue-light);margin-bottom:3px;">Unblocked AI &middot; Open Source</div>
        <div style="font-size:12.5px;color:var(--text-muted);">No ads. No paywalls. Built by a TPM, for TPMs.</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Built by Santanu Majumdar &middot; <a href="https://topmate.io/santanumajumdar" target="_blank">Coaching</a> &middot; <a href="https://linkedin.com/in/santanumajumdar" target="_blank">LinkedIn</a></div>
      </div>
    </div>`;
}

window.saveProfile = function() {
  const name = document.getElementById('s-name')?.value.trim();
  const role = document.getElementById('s-role')?.value.trim();
  const org  = document.getElementById('s-org')?.value.trim();
  if (name) localStorage.setItem('unblocked_name', name);
  if (role) localStorage.setItem('unblocked_role', role);
  if (org !== undefined) localStorage.setItem('unblocked_org', org);
  // Update sidebar
  const nameEl = document.getElementById('sidebar-name');
  const roleEl = document.getElementById('sidebar-role');
  if (nameEl && name) nameEl.textContent = name;
  if (roleEl && role) roleEl.textContent = role;
  toast('Profile saved!', 'success');
};

window.savePref = function(key, value) {
  localStorage.setItem('unblocked_' + key, value);
};

window.togglePref = function(key, toggleEl) {
  toggleEl.classList.toggle('on');
  localStorage.setItem('unblocked_' + key, toggleEl.classList.contains('on') ? 'true' : 'false');
};

window.changeProvider = function(val) {
  setProvider(val);
  renderSettings();
  toast(`${val === 'gemini' ? 'Gemini' : 'Claude'} selected as provider`, 'info');
};

window.removeApiKey = function() {
  uiConfirm('Remove your API key? AI generation will be disabled.', () => {
    clearApiKey();
    toast('API key removed', 'info');
    renderSettings();
  });
};

window.openApiKeyModal = function() {
  showApiKeyModal(() => {
    toast('API key saved!', 'success');
    renderSettings();
  });
};

window.confirmResetAll = function() {
  uiConfirm('This will delete ALL your programs, history, settings, and API key from this browser. This cannot be undone.', () => {
    ['unblocked_programs','unblocked_history','unblocked_risks',
     'unblocked_name','unblocked_role','unblocked_org',
     'unblocked_api_key','unblocked_tone','unblocked_threshold','unblocked_reminder'].forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    toast('All data cleared. Reloading…', 'info');
    setTimeout(() => location.reload(), 1200);
  });
};

// ── HELPERS ───────────────────────────────────────────────────────
function getDisplayName() {
  const full = localStorage.getItem('unblocked_name') || 'there';
  return full.split(' ')[0];
}

// Make key functions globally accessible
window.showPage     = showPage;
window.showAppPage  = showAppPage;
window.toast        = toast;
window.openLoginModal = showLoginModal;
window.openApiKeyModal = showApiKeyModal;
window.openSupabaseConfig = showSupabaseConfigModal;

window.currentUser = null;

// Track auth state
onAuthStateChange((event, user) => {
  window.currentUser = user;
  updateAuthUI();
  if (event === 'SIGNED_IN') {
    toast(`Welcome back, ${user.user_metadata?.full_name || user.email}!`, 'success');
  }
});

function updateAuthUI() {
  const sidebarFooter = document.querySelector('.sidebar-footer');
  const user = window.currentUser;
  
  if (user) {
    const name = user.user_metadata?.full_name || user.email;
    const avatar = user.user_metadata?.avatar_url;
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    
    sidebarFooter.innerHTML = `
      <div class="user-chip border-t pt-16">
        <div class="avatar">${avatar ? `<img src="${avatar}" style="width:100%;height:100%;border-radius:50%">` : initials}</div>
        <div class="flex-1 overflow-hidden">
          <div class="user-name truncate">${name}</div>
          <div class="user-role">Authenticated</div>
        </div>
        <button class="icon-btn-ghost ml-8" onclick="window.doSignOut()" title="Sign Out">
          ${ICONS.logout || '⏻'}
        </button>
      </div>
    `;
  } else {
    sidebarFooter.innerHTML = `
      <div class="px-4 border-t pt-16">
        <button class="btn btn-ghost btn-block flex items-center justify-center gap-8" onclick="window.openLoginModal()">
          ${ICONS.user} Sign in
        </button>
      </div>
    `;
  }
}

window.doSignOut = async function() {
  uiConfirm('Are you sure you want to sign out?', async () => {
    await signOut();
    toast('Signed out successfully', 'info');
  });
};
