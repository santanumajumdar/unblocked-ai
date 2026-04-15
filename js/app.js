/**
 * app.js — Main application: router, state, page renders
 */

import {
  getPrograms, saveProgram, deleteProgram, getProgramById, newProgramId,
  getHistory, addHistoryEntry,
  getRisks, getActiveRisks, acknowledgeRisk, dismissRisk,
  getStats, getContentionReport
} from './programs.js';

import {
  generateStatusUpdate, extractProgramSignals, getApiKey, setApiKey, clearApiKey, hasApiKey,
  getProvider, setProvider, analyzeSentiment, processTranscript
} from './api.js';

import {
  signInWithGoogle, signInWithGitHub, signOut, getUser,
  onAuthStateChange, isAuthEnabled, getSupabaseConfig, setSupabaseConfig
} from './auth.js';

import { parseFile } from './parser.js';
import { 
  getIntegrations, saveIntegration, disconnectIntegration,
  syncJiraData, syncGitHubData, publishToSlack
} from './integrations.js';


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
    visuals:   renderVisuals,
    integrations: renderIntegrationsPage,
    monitoring: renderMonitoring,
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
           <div id="apppage-visuals"   class="app-page"></div>
          <div id="apppage-integrations" class="app-page"></div>
          <div id="apppage-monitoring"   class="app-page"></div>
          <div id="apppage-settings"     class="app-page"></div>
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
       <div id="nav-visuals"   data-page="visuals" class="nav-item">${ICONS.visuals} Portfolio Visuals <span class="nav-pill nav-pill-blue">NEW</span></div>
      <div id="nav-monitoring" data-page="monitoring" class="nav-item">${ICONS.generate} AI Insights <span class="nav-pill nav-pill-blue">BETA</span></div>
      <div id="nav-integrations" data-page="integrations" class="nav-item">${ICONS.slack} Integrations</div>
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
        <div class="metric-card clickable" onclick="showAppPage('programs')">
          <div class="metric-label">Active programs</div>
          <div class="metric-value">${stats.activePrograms}</div>
          <div class="metric-delta">${stats.onTrack} on track &middot; ${stats.atWatch} at watch</div>
        </div>
        <div class="metric-card clickable" onclick="showAppPage('history')">
          <div class="metric-label">Updates this week</div>
          <div class="metric-value">${stats.updatesThisWeek}</div>
          <div class="metric-delta up">AI-generated</div>
        </div>
        <div class="metric-card clickable" onclick="showAppPage('history')">
          <div class="metric-label">Hours saved est.</div>
          <div class="metric-value" style="color:var(--success)">${Math.round(stats.updatesThisWeek * 1.5)}</div>
          <div class="metric-delta up">this week</div>
        </div>
        <div class="metric-card clickable" onclick="showAppPage('risks')">
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
              <!-- LIVE SYNC SECTION -->
              <div class="live-sync-zone mb-16" id="live-sync-zone"></div>
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
              <button class="btn btn-secondary btn-sm" onclick="doSlackPublish()">${ICONS.slack} Post to Slack</button>
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
  updateLiveSyncZone();
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

function updateLiveSyncZone() {
  const zone = document.getElementById('live-sync-zone');
  if (!zone) return;
  
  const ints = getIntegrations();
  const jiraConnected = ints.jira.connected;
  const githubConnected = ints.github.connected;
  
  if (!jiraConnected && !githubConnected) {
    zone.innerHTML = `
      <div style="background:var(--surface-dim);border:1px dashed var(--border);border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
          ⚖️ Connect Jira/GitHub in Integrations to pull live signals
        </div>
        <button class="btn btn-ghost btn-xs" onclick="showAppPage('integrations')">Setup →</button>
      </div>
    `;
    return;
  }
  
  zone.innerHTML = `
    <div style="background:var(--accent-glow);border:1px solid rgba(45,125,210,0.2);border-radius:8px;padding:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:600;color:var(--accent-light);display:flex;align-items:center;gap:6px;">
          ${ICONS.history} Live Source Available
        </div>
        <div class="flex gap-4">
          ${jiraConnected ? `<button class="btn btn-primary btn-xs" id="btn-sync-jira" onclick="doSyncLive('jira')">${ICONS.jira} Jira</button>` : ''}
          ${githubConnected ? `<button class="btn btn-primary btn-xs" id="btn-sync-github" onclick="doSyncLive('github')">${ICONS.github} GitHub</button>` : ''}
        </div>
      </div>
      <div id="sync-status" style="font-size:11px;color:var(--text-muted);">Sync blockers or commit trends directly into your fields.</div>
    </div>
  `;
}

window.doSyncLive = async function(type) {
  const btn = document.getElementById(`btn-sync-${type}`);
  const statusLine = document.getElementById('sync-status');
  const blockersArea = document.getElementById('gen-blockers');
  
  setButtonLoading(btn, true);
  statusLine.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><span>Contacting ${type} API...</span></div>`;
  
  try {
    const data = type === 'jira' ? await syncJiraData() : await syncGitHubData();
    setButtonLoading(btn, false);
    
    if (data) {
      if (type === 'jira') {
        const text = `LIVE JIRA DATA:\n${data.blockers.map(b => `- ${b.id}: ${b.summary} [${b.priority}]`).join('\n')}\nVelocity: ${data.velocity}`;
        blockersArea.value = (blockersArea.value ? blockersArea.value + '\n\n' : '') + text;
      } else {
        const text = `LIVE GITHUB DATA:\n- Pull Requests: ${data.pullRequests}\n- Latest: ${data.lastCommit}\n- Sentiment: ${data.trends}`;
        blockersArea.value = (blockersArea.value ? blockersArea.value + '\n\n' : '') + text;
      }
      statusLine.innerText = `Successfully pulled ${type} data.`;
      toast(`${type} data synced`, 'success');
    }
  } catch (e) {
    setButtonLoading(btn, false);
    statusLine.innerText = `Error connecting to ${type}.`;
    toast(`Sync failed`, 'error');
  }
};

window.doSlackPublish = async function() {
  const sg = state.generate;
  const persona = sg.activeTab;
  const content = sg.outputs[persona];
  
  if (!content) return toast('First generate an update', 'error');
  
  try {
    setButtonLoading(document.activeElement, true);
    const success = await publishToSlack(content);
    setButtonLoading(document.activeElement, false);
    if (success) {
      toast('Update posted to Slack!', 'success');
    }
  } catch (e) {
    setButtonLoading(document.activeElement, false);
    toast(e.message, 'error');
  }
};

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

  // Save to history (with sentiment analysis)
  const firstOutput = Object.values(sg.outputs)[0] || '';
  const preview = firstOutput.replace(/<[^>]+>/g, '').slice(0, 120);
  
  // Analyze sentiment in background
  analyzeSentiment(preview).then(sentiment => {
    addHistoryEntry({
      programId,
      programName: programData.name,
      personas: sg.selectedPersonas,
      rag: sg.selectedRag,
      preview,
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      content: sg.outputs,
      createdAt: Date.now()
    });
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
        <label class="form-label">Target Completion Date</label>
        <input type="date" id="pf-date" value="${program?.targetDate || ''}">
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Key Milestone (Text)</label>
        <input type="text" id="pf-milestone" placeholder="e.g. May 15" value="${program?.milestone || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Blocks Programs (IDs)</label>
        <input type="text" id="pf-deps" placeholder="e.g. prog_1, prog_3" value="${(program?.dependencies || []).join(', ')}">
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
            if (p.targetDate) el.querySelector('#pf-date').value = p.targetDate;
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
    
    // Parse dependencies string to array
    const depsRaw = el.querySelector('#pf-deps').value;
    const dependencies = depsRaw.split(',').map(s => s.trim()).filter(s => !!s);

    const p = {
      id:           program?.id || newProgramId(),
      name,
      team:         el.querySelector('#pf-team').value.trim() || 'General',
      quarter:      el.querySelector('#pf-quarter').value,
      rag:          el.querySelector('#pf-rag').value,
      milestone:    el.querySelector('#pf-milestone').value.trim(),
      targetDate:   el.querySelector('#pf-date').value,
      dependencies,
      blockers:     el.querySelector('#pf-blockers').value.trim(),
      decisions:    program?.decisions || '',
      milestones:   program?.milestones || '',
      emoji:        '📁',
      lastUpdated:  program?.lastUpdated || null
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
      if (state.appPage === 'visuals') renderVisuals();
      else if (state.appPage === 'programs') renderPrograms();
      else renderPage(state.appPage);
    }
  };
}

// ── PORTFOLIO VISUALS ─────────────────────────────────────────────
let activeVisualTab = 'timeline';

function renderVisuals() {
  const el = document.getElementById('apppage-visuals');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Strategic <em>Portfolio</em> Visuals</div>
        <div class="page-subtitle">A high-level view of dependencies, timelines, and reporting across your portfolio.</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="window.print()">
          ${ICONS.copy} PDF Export
        </button>
      </div>
    </div>
    
    <div class="visuals-tabs mb-24">
      <div class="v-tab ${activeVisualTab === 'timeline' ? 'active' : ''}" onclick="switchVisualTab('timeline')">Timeline (Gantt)</div>
      <div class="v-tab ${activeVisualTab === 'mapper' ? 'active' : ''}" onclick="switchVisualTab('mapper')">Dependency Mapper</div>
      <div class="v-tab ${activeVisualTab === 'mbr' ? 'active' : ''}" onclick="switchVisualTab('mbr')">MBR Report</div>
    </div>

    <div id="visuals-content"></div>
  `;
  renderVisualContent();
}

window.switchVisualTab = function(tab) {
  activeVisualTab = tab;
  renderVisuals();
};

function renderVisualContent() {
  const container = document.getElementById('visuals-content');
  if (activeVisualTab === 'timeline') renderPortfolioTimeline(container);
  else if (activeVisualTab === 'mapper') renderDependencyMapper(container);
  else if (activeVisualTab === 'mbr') renderMBRReport(container);
}

function renderPortfolioTimeline(container) {
  const allPrograms = getPrograms();
  const programs = allPrograms.filter(p => p.targetDate && p.targetDate !== '');
  
  if (programs.length === 0) {
    container.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No dates defined</div><div class="empty-desc">Add "Target Completion Dates" to your programs to see them on the timeline.</div></div></div>`;
    return;
  }

  // Calculate timeline range (6 months)
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  }
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 6, 0); // Last day of 6th month

  container.innerHTML = `
    <div class="card p-0 overflow-hidden">
      <div class="gantt-grid">
        <div class="gantt-header">
          <div class="gantt-label-col">Program</div>
          ${months.map(m => `<div class="gantt-month-col">${m}</div>`).join('')}
        </div>
        <div class="gantt-body">
          ${programs.map(p => {
            const tDate = new Date(p.targetDate);
            const totalMs = endMonth - startMonth;
            const posMs = tDate - startMonth;
            const posPercent = Math.max(0, Math.min(100, (posMs / totalMs) * 100));
            
            return `
              <div class="gantt-row">
                <div class="gantt-label-col">
                  <span class="rag-dot" style="background:var(--${p.rag})"></span>
                  ${truncate(p.name, 35)}
                </div>
                <div class="gantt-track">
                  <div class="gantt-bar-wrap" style="left: ${Math.max(0, posPercent - 20)}%; width: 20%;">
                    <div class="gantt-bar ${p.rag}" title="Target: ${p.targetDate}">
                      <span class="gantt-bar-label">${p.milestone || 'Target'}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderDependencyMapper(container) {
  const programs = getPrograms();
  const links = [];
  
  // Custom Mermaid Initialization for World Class Visuals
  if (window.mermaid) {
    window.mermaid.initialize({
      theme: 'base',
      startOnLoad: false,
      securityLevel: 'loose',
      flowchart: { 
        htmlLabels: true, 
        curve: 'basis',
        useMaxWidth: true,
        padding: 20
      },
      themeVariables: {
        darkMode: true,
        primaryColor: '#1a1f26',
        primaryTextColor: '#f8f9fa',
        primaryBorderColor: '#2d3748',
        lineColor: '#718096',
        secondaryColor: '#2d3748',
        tertiaryColor: '#1a202c',
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px'
      },
      themeCSS: `
        .node rect { stroke-width: 1.5px !important; rx: 10; ry: 10; }
        .node.green rect { fill: rgba(45, 106, 79, 0.9) !important; stroke: #52B788 !important; filter: drop-shadow(0 0 6px rgba(82, 183, 136, 0.3)); }
        .node.amber rect { fill: rgba(181, 101, 29, 0.9) !important; stroke: #FFB347 !important; filter: drop-shadow(0 0 6px rgba(255, 179, 71, 0.3)); }
        .node.red rect   { fill: rgba(123, 36, 28, 0.9) !important; stroke: #C0392B !important; filter: drop-shadow(0 0 6px rgba(192, 57, 43, 0.3)); }
        .edgePath .path { stroke-width: 2px !important; stroke: #4a5568 !important; }
        .marker { fill: #4a5568 !important; }
        .label { color: #f8f9fa !important; font-weight: 500; }
      `
    });
  }

  programs.forEach(p => {
    if (p.dependencies && p.dependencies.length > 0) {
      p.dependencies.forEach(depId => {
        const dep = getProgramById(depId);
        if (dep) {
          // No truncation, using full names (Mermaid handles wrapping in flowchart)
          const cleanDep = dep.name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
          const cleanP = p.name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
          links.push(`${dep.id}["${cleanDep}"] --> ${p.id}["${cleanP}"]`);
        }
      });
    }
  });

  if (links.length === 0) {
    container.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">🕸️</div><div class="empty-title">No dependencies</div><div class="empty-desc">Define dependencies in the "Add/Edit Program" modal to map them here.</div></div></div>`;
    return;
  }

  const graphDef = `flowchart TD\n${links.join('\n')}\n${programs.map(p => `class ${p.id} ${p.rag}`).join('\n')}`;

  container.innerHTML = `
    <div class="card p-24" style="background: #0D1117;">
      <div id="mermaid-container" style="display:flex; justify-content:center; align-items:center; min-height: 200px; line-height: 1.5;">
        <div class="pulse-row"><div class="pulse-dot"></div><span style="color:var(--text-muted); font-size:13px;">Generating visualization...</span></div>
      </div>
    </div>
  `;

  if (window.mermaid) {
    setTimeout(async () => {
      // Create an off-screen element so Mermaid calculating text dimensions doesn't flash in the UI.
      const offscreen = document.createElement('div');
      offscreen.style.position = 'absolute';
      offscreen.style.top = '-9999px';
      offscreen.style.left = '-9999px';
      offscreen.style.visibility = 'hidden';
      document.body.appendChild(offscreen);

      try {
        const id = 'mermaidsvg' + Date.now();
        const { svg } = await window.mermaid.render(id, graphDef, offscreen);
        const mc = document.getElementById('mermaid-container');
        if (mc) mc.innerHTML = svg;
      } catch (e) {
        console.error("Mermaid run failed", e);
        const mc = document.getElementById('mermaid-container');
        if (mc) mc.innerHTML = `<div style="color:var(--danger); font-size:13px;">Visual generation failed. Please check dependencies.</div>`;
      } finally {
        // Always clean up the hidden element
        if (offscreen.parentNode) {
          offscreen.parentNode.removeChild(offscreen);
        }
      }
    }, 50);
  }
}

function renderMBRReport(container) {
  const programs = getPrograms();
  const risks = getActiveRisks();
  
  container.innerHTML = `
    <div class="mbr-container">
      <div class="mbr-header">
        <div class="mbr-title">Monthly Business Review (MBR)</div>
        <div class="mbr-date">Portfolio Status &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
      </div>

      <div class="mbr-section">
        <h3 class="mbr-h3">Portfolio Health Summary</h3>
        <div class="metrics-grid mb-24">
          <div class="metric-card">
            <div class="metric-label">On Track</div>
            <div class="metric-value" style="color:var(--success)">${programs.filter(p => p.rag==='green').length}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">At Watch</div>
            <div class="metric-value" style="color:var(--warn)">${programs.filter(p => p.rag==='amber').length}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">At Risk</div>
            <div class="metric-value" style="color:var(--danger)">${programs.filter(p => p.rag==='red').length}</div>
          </div>
        </div>
      </div>

      <div class="mbr-section">
        <h3 class="mbr-h3">Program Deep-Dive</h3>
        <table class="mbr-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Status</th>
              <th>Top Risk / Blocker</th>
              <th>Next Milestone</th>
            </tr>
          </thead>
          <tbody>
            ${programs.map(p => `
              <tr>
                <td class="font-500">${p.name}</td>
                <td>${ragBadge(p.rag)}</td>
                <td class="text-xs color-muted">${truncate(p.blockers || 'None reported', 120)}</td>
                <td class="text-xs font-500">${p.milestone || 'TBD'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="mbr-section mt-24">
        <h3 class="mbr-h3">Critical Portfolio Risks</h3>
        ${risks.length === 0 ? '<p class="text-xs color-muted">No high-severity risks identified.</p>' : 
          risks.map(r => `
            <div class="mbr-risk-item mb-8">
              <div class="mbr-risk-title ${r.severity}">${r.programName}: ${r.title}</div>
              <div class="mbr-risk-desc">${r.description}</div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
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

// ── MONITORING ────────────────────────────────────────────────────
let activeMonitorTab = 'trends';

function renderMonitoring() {
  updateRiskBadge();
  const el = document.getElementById('apppage-monitoring');
  
  el.innerHTML = `
    <style>
      @keyframes pulse-ring {
        0% { transform: scale(.33); opacity: 1; }
        80%, 100% { opacity: 0; }
      }
      .pulse-marker {
        position: relative;
        width: 12px; height: 12px;
      }
      .pulse-marker::before {
        content: '';
        position: absolute; display: block; width: 300%; height: 300%;
        box-sizing: border-box; margin-left: -100%; margin-top: -100%;
        border-radius: 45px; background-color: var(--pulse-color, var(--accent));
        animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      }
      .intelligence-report {
        background: var(--onyx-deep);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        position: relative;
        overflow: hidden;
      }
      .intelligence-report::after {
        content: ''; position: absolute; top:0; right:0;
        width: 150px; height: 150px;
        background: radial-gradient(circle at 100% 0%, var(--accent-glow) 0%, transparent 70%);
        pointer-events: none;
      }
    </style>
    <div class="page-header">
      <div>
        <div class="page-title">AI <em>Insights</em> & Monitoring</div>
        <div class="page-subtitle">Deep intelligence across your portfolio, sentiment trends, and meeting processing.</div>
      </div>
    </div>
    
    <div class="page-body">
      <div class="v-tabs mb-24">
        <div class="v-tab ${activeMonitorTab === 'trends' ? 'active' : ''}" onclick="switchMonitorTab('trends')">Sentiment Trends</div>
        <div class="v-tab ${activeMonitorTab === 'radar' ? 'active' : ''}" onclick="switchMonitorTab('radar')">Contention Radar</div>
        <div class="v-tab ${activeMonitorTab === 'meeting' ? 'active' : ''}" onclick="switchMonitorTab('meeting')">Meeting-to-Status</div>
      </div>
      
      <div id="monitoring-content"></div>
    </div>
  `;
  renderMonitoringContent();
}

window.switchMonitorTab = function(tab) {
  activeMonitorTab = tab;
  renderMonitoring();
};

function renderMonitoringContent() {
  const container = document.getElementById('monitoring-content');
  if (activeMonitorTab === 'trends') renderSentimentTrends(container);
  else if (activeMonitorTab === 'radar') renderContentionRadar(container);
  else if (activeMonitorTab === 'meeting') renderMeetingProcessor(container);
}

function renderSentimentTrends(container) {
  const history = getHistory().slice(0, 10).reverse();
  const scores = history.map(h => h.sentimentScore || 7);
  
  const width = 800;
  const height = 300;
  const padding = 60;
  
  const getX = (i) => padding + (i * (width - padding * 2) / (scores.length - 1 || 1));
  const getY = (s) => height - padding - (s * (height - padding * 2) / 10);

  // Generate cubic bezier path for smooth spline
  let pathD = `M ${getX(0)} ${getY(scores[0])}`;
  let areaD = `M ${getX(0)} ${height - padding} L ${getX(0)} ${getY(scores[0])}`;
  
  for (let i = 0; i < scores.length - 1; i++) {
    const x1 = getX(i), y1 = getY(scores[i]);
    const x2 = getX(i + 1), y2 = getY(scores[i + 1]);
    const cx = (x1 + x2) / 2;
    pathD += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    areaD += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }
  areaD += ` L ${getX(scores.length - 1)} ${height - padding} Z`;

  container.innerHTML = `
    <div class="card p-32" style="background: linear-gradient(145deg, var(--onyx-light), var(--onyx-mid)); border: 1px solid var(--border-light);">
      <div class="flex items-center justify-between mb-32">
        <div>
          <div class="font-600 mb-4" style="font-size:18px; font-family:var(--font-heading);">Portfolio Tone Intelligence</div>
          <div class="text-xs text-secondary" style="letter-spacing:0.02em;">Real-time sentiment trajectory based on executive reporting patterns.</div>
        </div>
        <div class="flex gap-16">
          <div class="flex items-center gap-6 text-xs font-500"><span class="rag-dot" style="background:var(--success); box-shadow:0 0 8px var(--success);"></span> Optimistic</div>
          <div class="flex items-center gap-6 text-xs font-500"><span class="rag-dot" style="background:var(--warn); box-shadow:0 0 8px var(--warn);"></span> Neutral</div>
          <div class="flex items-center gap-6 text-xs font-500"><span class="rag-dot" style="background:var(--danger); box-shadow:0 0 8px var(--danger);"></span> Critical</div>
        </div>
      </div>
      
      <div style="height:${height}px; width:100%; position:relative;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; overflow:visible;">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <!-- Y-Axis Labels -->
          <text x="${padding-15}" y="${getY(10)}" text-anchor="end" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">10</text>
          <text x="${padding-15}" y="${getY(5)}" text-anchor="end" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">5</text>
          <text x="${padding-15}" y="${getY(0)}" text-anchor="end" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">0</text>

          <!-- Grid lines -->
          <line x1="${padding}" y1="${getY(10)}" x2="${width-padding}" y2="${getY(10)}" stroke="var(--border)" stroke-dasharray="4,4" opacity="0.5" />
          <line x1="${padding}" y1="${getY(5)}" x2="${width-padding}" y2="${getY(5)}" stroke="var(--border)" stroke-dasharray="4,4" opacity="0.5" />
          <line x1="${padding}" y1="${getY(0)}" x2="${width-padding}" y2="${getY(0)}" stroke="var(--border)" />
          
          <!-- Area & Path -->
          <path d="${areaD}" fill="url(#chartGradient)" />
          <path d="${pathD}" fill="none" stroke="var(--accent-light)" stroke-width="3" filter="url(#glow)" />
          
          <!-- Points -->
          ${scores.map((s, i) => {
            const x = getX(i), y = getY(s);
            const isLast = i === scores.length - 1;
            const color = s >= 7 ? 'var(--success)' : s >= 4 ? 'var(--warn)' : 'var(--danger)';
            return `
              <g class="chart-point">
                <circle cx="${x}" cy="${y}" r="4" fill="var(--surface-raised)" stroke="${color}" stroke-width="2" />
                <text x="${x}" y="${height-20}" text-anchor="middle" font-size="10" fill="${isLast ? 'var(--text-primary)' : 'var(--text-muted)'}" font-weight="${isLast ? '600' : '400'}">${history[i].programName.slice(0,5)}</text>
              </g>
            `;
          }).join('')}
        </svg>
        
        <!-- Pulse for latest point -->
        <div class="pulse-marker" style="position:absolute; left:${(getX(scores.length-1)/width)*100}%; top:${(getY(scores[scores.length-1])/height)*100}%; --pulse-color:${scores[scores.length-1] >= 7 ? 'var(--success)' : scores[scores.length-1] >= 4 ? 'var(--warn)' : 'var(--danger)'};"></div>
      </div>
      
      <div class="mt-40 p-20 intelligence-report">
        <div class="flex items-start gap-16">
          <div style="font-size:24px;">${scores[scores.length-1] < 5 ? '⚠️' : '✨'}</div>
          <div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:6px; font-family:var(--font-heading);">Executive Summary & Trend Vector</div>
            <div style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
              ${scores[scores.length-1] < scores[scores.length-2] 
                ? `<span style="color:var(--danger); font-weight:600;">Negative Delta Detected:</span> Portfolio sentiment has shifted by <span style="font-family:var(--font-mono);">${Math.abs(scores[scores.length-1]-scores[scores.length-2])}pts</span>. Historical correlation suggests high risk of milestone slippage in cross-functional streams. Immediate leadership alignment recommended.` 
                : `<span style="color:var(--success); font-weight:600;">Stability Confirmed:</span> The tone vector remains positive. Teams are reporting high confidence in current Q2 execution and cross-team dependency resolution.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderContentionRadar(container) {
  const contention = getContentionReport();
  
  container.innerHTML = `
    <div class="card p-32">
      <div class="flex items-center justify-between mb-24">
        <div>
          <div class="font-600 mb-4" style="font-size:18px; font-family:var(--font-heading);">Resource Contention Radar</div>
          <div class="text-xs text-secondary">Isolating critical bottlenecks blocking multiple program tracks.</div>
        </div>
        <div class="badge badge-blue">Portfolio Coverage: 100%</div>
      </div>
      
      ${contention.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon" style="filter: drop-shadow(0 0 10px var(--success));">🛡️</div>
          <div class="empty-title">Structural Stability Confirmed</div>
          <div class="empty-desc">No repeat blockers detected across your current program portfolio. Resource distribution is optimized for current sprint cycles.</div>
        </div>` : `
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
          ${contention.map(c => {
            const severity = c.count >= 3 ? 'danger' : 'warn';
            return `
              <div class="card p-20" style="background:var(--onyx-deep); border-left: 4px solid var(--${severity}); height:100%;">
                <div class="flex items-center justify-between mb-16">
                  <div class="flex items-center gap-10">
                    <div style="width:36px; height:36px; border-radius:10px; background:var(--${severity}-bg); color:var(--${severity}); display:flex; align-items:center; justify-content:center; font-weight:700; font-family:var(--font-mono);">!</div>
                    <div>
                      <div style="font-weight:600; font-size:16px; color:var(--text-primary);">${c.entity}</div>
                      <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Critical Bottleneck</div>
                    </div>
                  </div>
                </div>
                
                <div class="mb-16">
                  <div class="flex justify-between text-xs mb-6">
                    <span style="color:var(--text-secondary);">Contention Score</span>
                    <span style="font-weight:600; color:var(--${severity});">${Math.min(100, Math.round((c.count / getPrograms().length) * 100))}% Impact</span>
                  </div>
                  <div style="height:4px; width:100%; background:var(--border); border-radius:10px; overflow:hidden;">
                    <div style="height:100%; width:${(c.count / getPrograms().length) * 100}%; background:var(--${severity});"></div>
                  </div>
                </div>

                <div style="font-size:12px; color:var(--text-secondary); line-height:1.4;">
                  <strong style="color:var(--text-muted);">Impacted Streams:</strong><br>
                  ${c.programs.map(p => `<span style="display:inline-block; margin-top:4px; padding:2px 6px; background:var(--surface-light); border-radius:4px; margin-right:4px;">${p}</span>`).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

function renderMeetingProcessor(container) {
  container.innerHTML = `
    <div class="card p-32">
      <div class="flex items-center justify-between mb-24">
        <div>
          <div class="font-600 mb-4" style="font-size:18px; font-family:var(--font-heading);">Meeting-to-Status 🎙️</div>
          <div class="text-xs text-secondary">Convert raw transcripts into high-fidelity program intelligence.</div>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
        <div>
          <div class="form-group">
            <label class="form-label" style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Transcript Input</label>
            <textarea id="transcript-input" placeholder="Paste your standup notes, Zoom transcript, or Otter.ai export here..." style="min-height:300px; font-size:14px; background:var(--onyx-deep); border-radius:12px; padding:16px;"></textarea>
          </div>
          
          <button class="btn btn-primary btn-block p-16" id="process-transcript-btn" onclick="doProcessTranscript()" style="font-size:15px; font-weight:600; border-radius:12px;">
            ${ICONS.generate} Extract Portfolio Signals
          </button>
        </div>
        
        <div id="transcript-result-container">
           <div id="transcript-placeholder" class="flex flex-col items-center justify-center" style="height:100%; border:2px dashed var(--border); border-radius:16px; color:var(--text-muted);">
              <div style="font-size:32px; margin-bottom:12px; opacity:0.3;">📋</div>
              <div style="font-size:13px;">Intelligence Report will appear here</div>
           </div>
           
           <div id="transcript-result" style="display:none; height:100%;">
             <div class="intelligence-report" style="height:100%; border-color:var(--accent-dim);">
                <div class="flex items-center gap-10 mb-20">
                  <div style="width:30px; height:30px; border-radius:50%; background:var(--accent-glow); color:var(--accent); display:flex; align-items:center; justify-content:center;">${ICONS.check}</div>
                  <div style="font-weight:600; font-size:15px; font-family:var(--font-heading);">Structured Intelligence Report</div>
                </div>
                
                <div id="extracted-content" class="flex flex-col gap-16">
                  <!-- Result injected here -->
                </div>
                
                <button class="btn btn-secondary btn-block mt-32" id="use-extracted-btn" style="background:var(--surface-light); border:1px solid var(--border-light);">
                   Use Intelligence to Generate Status updates →
                </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  `;
}

window.doProcessTranscript = async function() {
  const input = document.getElementById('transcript-input').value.trim();
  if (!input) return toast('Please paste a transcript first', 'error');
  
  const btn = document.getElementById('process-transcript-btn');
  const resultContainer = document.getElementById('transcript-result');
  const placeholder = document.getElementById('transcript-placeholder');
  const contentEl = document.getElementById('extracted-content');
  
  setButtonLoading(btn, true);
  
  await processTranscript(input, (data) => {
    setButtonLoading(btn, false);
    placeholder.style.display = 'none';
    resultContainer.style.display = 'block';
    
    contentEl.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
        <div class="card p-12" style="background:var(--surface-light); border:1px solid var(--border);">
          <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Program</div>
          <div style="font-size:14px; font-weight:600; color:var(--text-primary);">${data.name}</div>
        </div>
        <div class="card p-12" style="background:var(--surface-light); border:1px solid var(--border);">
          <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">RAG Status</div>
          <div>${ragBadge(data.rag)}</div>
        </div>
      </div>
      <div class="card p-16" style="background:var(--surface-light); border:1px solid var(--border);">
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Extracted Blockers</div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.5;">${data.blockers || '<span style="opacity:0.5 italic">None detected</span>'}</div>
      </div>
      <div class="card p-16" style="background:var(--surface-light); border:1px solid var(--border);">
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Upcoming Milestones</div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.5;">${data.milestones || '<span style="opacity:0.5 italic">None detected</span>'}</div>
      </div>
    `;
    
    document.getElementById('use-extracted-btn').onclick = () => {
      // Find or Create Program
      let prog = getPrograms().find(p => p.name.toLowerCase().includes(data.name.toLowerCase()));
      if (!prog) {
        prog = saveProgram({
          id: newProgramId(),
          name: data.name,
          team: 'Unassigned',
          quarter: 'Q2 2026',
          rag: data.rag,
          blockers: data.blockers,
          milestones: data.milestones,
          lastUpdated: Date.now()
        });
      }
      showAppPage('generate');
      setTimeout(() => {
        const progSelect = document.getElementById('gen-program');
        if (progSelect) {
          progSelect.value = prog.id;
          progSelect.dispatchEvent(new Event('change'));
        }
        // Pre-fill fields
        setTimeout(() => {
          const b = document.getElementById('gen-blockers');
          const m = document.getElementById('gen-milestones');
          if (b) b.value = data.blockers || '';
          if (m) m.value = data.milestones || '';
        }, 100);

        toast('Transcript signals pre-filled!', 'success');
      }, 50);
    };
    
  }, (err) => {
    setButtonLoading(btn, false);
    toast(err, 'error');
  });
};
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

// ── INTEGRATIONS ──────────────────────────────────────────────────
function renderIntegrationsPage() {
  const ints = getIntegrations();
  const el = document.getElementById('apppage-integrations');
  
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Integration <em>Ecosystem</em></div>
        <div class="page-subtitle">Pull live data from your source-of-truth tools to automate status intelligence.</div>
      </div>
    </div>
    <div class="page-body">
      <div class="int-grid">
        <!-- JIRA -->
        <div class="int-card int-jira">
          <div class="int-header">
            <div class="int-icon-box">${ICONS.jira}</div>
            <div class="int-badge ${ints.jira.connected ? 'int-badge-connected' : 'int-badge-disconnected'}">
              ${ints.jira.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div>
            <div class="int-title">Jira Cloud</div>
            <div class="int-desc">Sync active blockers, sprint velocity, and ticket trends directly into reports.</div>
          </div>
          <div class="int-meta">
            ${ints.jira.connected ? `Linked to ${ints.jira.domain}` : 'No active connection'}
          </div>
          <button class="btn ${ints.jira.connected ? 'btn-ghost' : 'btn-primary'}" onclick="showIntegrationModal('jira')">
            ${ints.jira.connected ? 'Configure' : 'Connect Jira'}
          </button>
        </div>

        <!-- GITHUB -->
        <div class="int-card int-github">
          <div class="int-header">
            <div class="int-icon-box">${ICONS.github}</div>
            <div class="int-badge ${ints.github.connected ? 'int-badge-connected' : 'int-badge-disconnected'}">
              ${ints.github.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div>
            <div class="int-title">GitHub</div>
            <div class="int-desc">Track PR volume, commit frequency, and release cycles across repositories.</div>
          </div>
          <div class="int-meta">
             ${ints.github.connected ? `Syncing ${ints.github.repo}` : 'No active connection'}
          </div>
          <button class="btn ${ints.github.connected ? 'btn-ghost' : 'btn-primary'}" onclick="showIntegrationModal('github')">
            ${ints.github.connected ? 'Configure' : 'Connect GitHub'}
          </button>
        </div>

        <!-- SLACK -->
        <div class="int-card int-slack">
          <div class="int-header">
            <div class="int-icon-box">${ICONS.slack}</div>
            <div class="int-badge ${ints.slack.connected ? 'int-badge-connected' : 'int-badge-disconnected'}">
              ${ints.slack.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div>
            <div class="int-title">Slack</div>
            <div class="int-desc">One-click publishing for generated status updates to specific project channels.</div>
          </div>
          <div class="int-meta">
            ${ints.slack.connected ? 'Webhook active' : 'No active connection'}
          </div>
          <button class="btn ${ints.slack.connected ? 'btn-ghost' : 'btn-primary'}" onclick="showIntegrationModal('slack')">
            ${ints.slack.connected ? 'Configure' : 'Connect Slack'}
          </button>
        </div>

        <!-- GOOGLE CALENDAR -->
        <div class="int-card int-google">
          <div class="int-header">
            <div class="int-icon-box">${ICONS.calendar}</div>
            <div class="int-badge ${ints.google.connected ? 'int-badge-connected' : 'int-badge-disconnected'}">
              ${ints.google.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div>
            <div class="int-title">Google Calendar</div>
            <div class="int-desc">Sync team OOO blocks and upcoming milestones into your Risk Radar.</div>
          </div>
          <div class="int-meta">
            ${ints.google.connected ? 'Syncing active' : 'No active connection'}
          </div>
          <button class="btn ${ints.google.connected ? 'btn-ghost' : 'btn-primary'}" onclick="showIntegrationModal('google')">
            ${ints.google.connected ? 'Configure' : 'Connect Google'}
          </button>
        </div>
      </div>
    </div>
  `;
}

window.showIntegrationModal = function(type) {
  const ints = getIntegrations();
  const config = ints[type];
  
  let modalHtml = '';
  if (type === 'jira') {
    modalHtml = `
      <div class="form-group">
        <label class="form-label">Atlassian Domain</label>
        <input type="text" id="int-domain" placeholder="your-company.atlassian.net" value="${config.domain || ''}">
      </div>
      <div class="form-group mt-12">
        <label class="form-label">API Token (PAT)</label>
        <input type="password" id="int-token" placeholder="Paste your token..." value="${config.token || ''}">
      </div>
      <div class="form-group mt-12">
        <label class="form-label">Default Project Key</label>
        <input type="text" id="int-project" placeholder="PROJ" value="${config.project || ''}">
      </div>
    `;
  } else if (type === 'github') {
    modalHtml = `
      <div class="form-group">
        <label class="form-label">Personal Access Token</label>
        <input type="password" id="int-token" placeholder="ghp_..." value="${config.token || ''}">
      </div>
      <div class="form-group mt-12">
        <label class="form-label">Target Repository</label>
        <input type="text" id="int-repo" placeholder="owner/repo" value="${config.repo || ''}">
      </div>
    `;
  } else if (type === 'slack') {
    modalHtml = `
      <div class="form-group">
        <label class="form-label">Incoming Webhook URL</label>
        <input type="text" id="int-webhook" placeholder="https://hooks.slack.com/services/..." value="${config.webhook || ''}">
      </div>
    `;
  } else if (type === 'google') {
    modalHtml = `
      <div class="modal-note mb-16">Google Calendar integration uses OAuth. Click below to authorize Unblocked AI to read your calendar.</div>
    `;
  }

  const { el, close } = openModal(`
    <div class="modal-title">Configure ${type.charAt(0).toUpperCase() + type.slice(1)}</div>
    <div class="modal-sub">Your credentials are stored securely in your local browser storage.</div>
    ${modalHtml}
    <div class="flex gap-12 mt-24">
      <button class="btn btn-primary flex-1" id="save-int">Save Connection</button>
      ${config.connected ? `<button class="btn btn-ghost" id="disconnect-int" style="color:var(--danger)">Disconnect</button>` : ''}
    </div>
  `);

  el.querySelector('#save-int').onclick = () => {
    const data = { connected: true };
    if (type === 'jira') {
      data.domain = el.querySelector('#int-domain').value.trim();
      data.token = el.querySelector('#int-token').value.trim();
      data.project = el.querySelector('#int-project').value.trim();
    } else if (type === 'github') {
      data.token = el.querySelector('#int-token').value.trim();
      data.repo = el.querySelector('#int-repo').value.trim();
    } else if (type === 'slack') {
      data.webhook = el.querySelector('#int-webhook').value.trim();
    }
    saveIntegration(type, data);
    close();
    renderIntegrationsPage();
    toast(`${type.charAt(0).toUpperCase() + type.slice(1)} connected!`, 'success');
  };

  if (config.connected) {
    el.querySelector('#disconnect-int').onclick = () => {
      disconnectIntegration(type);
      close();
      renderIntegrationsPage();
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} disconnected`, 'info');
    };
  }
};
