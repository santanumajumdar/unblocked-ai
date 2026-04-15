/**
 * ui.js — UI utility functions: toasts, modals, formatting helpers
 */

// ── TOAST NOTIFICATIONS ───────────────────────────────────────────
let toastWrap = null;
function getToastWrap() {
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.className = 'toast-wrap';
    toastWrap.id = 'toast-wrap';
    document.body.appendChild(toastWrap);
  }
  return toastWrap;
}

const TOAST_ICONS = {
  success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue-light)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

export function toast(message, type = 'success', duration = 3200) {
  const wrap = getToastWrap();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${TOAST_ICONS[type] || ''}<span>${message}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

// ── MODAL ─────────────────────────────────────────────────────────
export function openModal(html, { onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); }
  });
  document.body.appendChild(overlay);
  return {
    el: overlay,
    close: () => { overlay.remove(); if (onClose) onClose(); }
  };
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────
export function confirm(message, onConfirm) {
  const { el, close } = openModal(`
    <div style="text-align:center;">
      <div style="font-size:32px;margin-bottom:14px;">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:8px;">Are you sure?</div>
      <div style="font-size:13.5px;color:var(--text-secondary);margin-bottom:22px;">${message}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Delete</button>
      </div>
    </div>
  `);
  el.querySelector('#confirm-cancel').onclick = close;
  el.querySelector('#confirm-ok').onclick = () => { close(); onConfirm(); };
}

// ── COPY TO CLIPBOARD ─────────────────────────────────────────────
export function copyText(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    return Promise.resolve(true);
  } catch { return Promise.resolve(false); }
}

// ── DATE FORMATTING ───────────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return 'Today, ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday, ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
}

export function daysAgo(ts) {
  const diffDays = Math.floor((Date.now() - ts) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

// ── RAG HELPERS ───────────────────────────────────────────────────
export function ragBadge(rag) {
  const map = {
    green: `<span class="badge badge-green"><span class="badge-dot"></span>On Track</span>`,
    amber: `<span class="badge badge-amber"><span class="badge-dot"></span>At Watch</span>`,
    red:   `<span class="badge badge-red"><span class="badge-dot"></span>At Risk</span>`
  };
  return map[rag] || `<span class="badge badge-gray">${rag}</span>`;
}

export function ragEmoji(rag) {
  return { green: '✅', amber: '⚠️', red: '🚨' }[rag] || '🔵';
}

export function ragLabel(rag) {
  return { green: 'On Track', amber: 'At Watch', red: 'At Risk' }[rag] || rag;
}

// ── PERSONA LABELS ────────────────────────────────────────────────
export const PERSONA_LABELS = {
  exec:     'Executive',
  pm:       'Product Mgr',
  eng:      'Engineering',
  steering: 'Steering'
};

export function personaBadge(persona) {
  const map = {
    exec:     'badge-blue',
    pm:       'badge-gray',
    eng:      'badge-gray',
    steering: 'badge-amber'
  };
  return `<span class="badge ${map[persona] || 'badge-gray'}">${PERSONA_LABELS[persona] || persona}</span>`;
}

// ── SEVERITY HELPERS ──────────────────────────────────────────────
export function severityBadge(severity) {
  const map = {
    high:   `<span class="badge badge-red">High</span>`,
    medium: `<span class="badge badge-amber">Medium</span>`,
    low:    `<span class="badge badge-blue">Low</span>`
  };
  return map[severity] || `<span class="badge badge-gray">${severity}</span>`;
}

// ── TOGGLE HELPER ─────────────────────────────────────────────────
export function bindToggle(el, onChange) {
  if (!el) return;
  el.addEventListener('click', () => {
    el.classList.toggle('on');
    if (onChange) onChange(el.classList.contains('on'));
  });
}

// ── LOADING STATE ─────────────────────────────────────────────────
export function setButtonLoading(btn, loading, originalHTML) {
  if (!btn) return;
  if (loading) {
    btn._originalHTML = originalHTML || btn.innerHTML;
    btn.innerHTML = `<div class="spinner"></div> Generating…`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalHTML || originalHTML || 'Generate';
    btn.disabled = false;
  }
}

// ── SCROLL TO ─────────────────────────────────────────────────────
export function scrollToTop(el) {
  if (el) el.scrollTop = 0;
}

// ── TRUNCATE ─────────────────────────────────────────────────────
export function truncate(str, max = 100) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── TIME GREETING ────────────────────────────────────────────────
export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── RISK ICON ─────────────────────────────────────────────────────
export const ICONS = {
  dashboard:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  generate:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
  programs:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  history:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  risks:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  settings:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  copy:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  refresh:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  trash:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  edit:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  plus:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check:      `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
  slack:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.08 9C19.81 3.42 13.41.66 7.83 2.93 2.25 5.19-.51 11.6 1.77 17.17c2.27 5.57 8.67 8.33 14.25 6.06C21.6 21 24.36 14.6 22.08 9z"/></svg>`,
  email:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  warning:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  visuals:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`
};
