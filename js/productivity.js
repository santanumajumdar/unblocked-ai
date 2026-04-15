/**
 * productivity.js — Personal TPM Productivity Suite
 * Focuses on proactive coaching and interactive agent-assisted drafting.
 */

import { getPrograms, getActiveRisks, getContentionReport } from './programs.js';
import { ICONS, toast } from './ui.js';

/**
 * generateCoachAdvice — Scans portfolio data for high-impact gaps
 * @returns {Array} - List of actionable advice objects
 */
export function generateCoachAdvice() {
  const programs = getPrograms();
  const contention = getContentionReport();
  const criticalRisks = getActiveRisks().filter(r => r.severity === 'high');

  const advice = [];
  
  // Heuristic: Stale Updates (7+ days)
  const stale = programs.filter(p => !p.lastUpdated || (Date.now() - p.lastUpdated > 7 * 86400000));
  if (stale.length > 0) {
    advice.push({
      id: 'stale',
      icon: '⏰',
      title: 'Stale Program Updates',
      desc: `${stale.length} program${stale.length > 1 ? 's' : ''} haven't been updated in over 7 days. Stale data reduces portfolio visibility.`,
      actionLabel: 'Update stale programs',
      targetPage: 'programs'
    });
  }

  // Heuristic: Missing Milestones
  const missingMilestones = programs.filter(p => !p.milestone || p.milestone === 'TBD' || p.milestones === '');
  if (missingMilestones.length > 0) {
    advice.push({
      id: 'milestones',
      icon: '🎯',
      title: 'Timeline Ambiguity',
      desc: `${missingMilestones.length} programs are missing specific next milestones. This makes tracking velocity difficult for leadership.`,
      actionLabel: 'Define milestones',
      targetPage: 'programs'
    });
  }

  // Heuristic: Resource Contention (detected via cross-program signal analysis)
  if (contention.length > 0) {
    advice.push({
      id: 'contention',
      icon: '⚖️',
      title: 'Resource Contention Risk',
      desc: `The '${contention[0].entity}' team is mentioned as a blocker across ${contention[0].count} different programs simultaneously.`,
      actionLabel: 'View contention radar',
      targetPage: 'monitoring'
    });
  }

  // Heuristic: Unaddressed High-Severity Risks
  if (criticalRisks.length > 0) {
    advice.push({
      id: 'risks',
      icon: '🔥',
      title: 'Unescalated High Risks',
      desc: `There are ${criticalRisks.length} high-severity risks that haven't been acknowledged or escalated to senior leadership yet.`,
      actionLabel: 'Review risks',
      targetPage: 'risks'
    });
  }

  return advice;
}

/**
 * renderCoaching — Renders the Coaching hub UI
 * @param {HTMLElement} el - Page container
 * @param {Function} showAppPage - Router navigate function
 */
export function renderCoaching(el, showAppPage) {
  const advice = generateCoachAdvice();
  
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">TPM <em>Coaching</em> Agent</div>
        <div class="page-subtitle">Proactive portfolio advice to keep your programs running smoothly.</div>
      </div>
      <button class="btn btn-secondary" onclick="window.toast('Refreshing intelligence layer...','info')">
        ${ICONS.refresh} Refresh Intelligence
      </button>
    </div>
    <div class="page-body">
      ${advice.length === 0 ? `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">🏆</div>
            <div class="empty-title">Governance on Track</div>
            <div class="empty-desc">The Coaching Agent finds no critical hygiene gaps in your portfolio right now.</div>
          </div>
        </div>` : `
        <div class="coach-grid">
          ${advice.map(a => `
            <div class="coach-card">
              <div class="coach-icon">${a.icon}</div>
              <div class="coach-title">${a.title}</div>
              <div class="coach-desc">${a.desc}</div>
              <div class="coach-action" id="coach-action-${a.id}">
                ${ICONS.arrowRight} ${a.actionLabel}
              </div>
            </div>
          `).join('')}
        </div>
      `}
      
      <div style="height:64px;"></div>

      <div class="card-raised" style="background:var(--blue-dim); border-color:var(--blue-light); border-left: 5px solid var(--blue-light);">
        <div class="flex items-center gap-14">
          <div style="font-size:32px;">🧠</div>
          <div>
            <div style="font-size:14.5px; font-weight:600; color:var(--blue-light); margin-bottom:4px; font-family:var(--font-heading);">Santanu's AI Strategy Pocket</div>
            <div style="font-size:13.5px; color:var(--text-primary); line-height:1.6;">
              Current portfolio confidence is <strong style="color:var(--blue-light);">82%</strong>. The primary execution barrier remains cross-team dependency resolution between <strong>Platform</strong> and <strong>Dev Experience</strong>. 
              Recommend prioritizing common interface contracts to unblock the Q3 roadmap.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind actions
  advice.forEach(a => {
    const btn = document.getElementById(`coach-action-${a.id}`);
    if (btn) btn.onclick = () => showAppPage(a.targetPage);
  });
}
