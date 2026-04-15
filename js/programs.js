/**
 * programs.js — Program data management with localStorage persistence
 */

const PROGRAMS_KEY = 'unblocked_programs';
const HISTORY_KEY  = 'unblocked_history';
const RISKS_KEY    = 'unblocked_risks';

// ── DEFAULT SEED DATA ────────────────────────────────────────────
const DEFAULT_PROGRAMS = [
  {
    id: 'prog_1',
    name: 'Orion — Cloud Cost Optimization',
    team: 'Platform Engineering',
    quarter: 'Q2 2026',
    rag: 'green',
    milestone: 'May 8',
    emoji: '☁️',
    blockers: '',
    decisions: '',
    milestones: 'Finalize savings model — Apr 20. Pilot with 3 teams — May 1. Full rollout — May 8.',
    dependencies: [],
    targetDate: '2026-05-08',
    lastUpdated: Date.now() - 2 * 86400000
  },
  {
    id: 'prog_2',
    name: 'Meridian — Data Governance Framework',
    team: 'Data & Analytics',
    quarter: 'Q2 2026',
    rag: 'amber',
    milestone: 'Apr 30',
    emoji: '🗂️',
    blockers: 'Legal review of data retention policy delayed by 10 days. Awaiting CLO sign-off.',
    decisions: 'Agreed to phase rollout — Tier 1 data first, Tier 2 and 3 in Q3.',
    milestones: 'Legal sign-off — Apr 22. Pilot with Data Eng team — Apr 28. Phase 1 go-live — Apr 30.',
    dependencies: ['prog_1'],
    targetDate: '2026-04-30',
    lastUpdated: Date.now() - 5 * 86400000
  },
  {
    id: 'prog_3',
    name: 'Nexus — Developer Platform Reboot',
    team: 'Developer Experience',
    quarter: 'Q2 2026',
    rag: 'red',
    milestone: 'May 15',
    emoji: '🚀',
    blockers: 'Core infra dependency on the DevOps team unresolved for 9 days. No ETA. CI/CD pipeline migration blocked.',
    decisions: 'Descoped mobile SDK support to Q3. Headcount request for 2 contractors approved.',
    milestones: 'DevOps unblock — Apr 18. API gateway migration — May 1. Beta launch — May 15.',
    dependencies: ['prog_5'],
    targetDate: '2026-05-15',
    lastUpdated: Date.now() - 9 * 86400000
  },
  {
    id: 'prog_4',
    name: 'Atlas — Global Localization System',
    team: 'Internationalization',
    quarter: 'Q3 2026',
    rag: 'green',
    milestone: 'Jun 30',
    emoji: '🌏',
    blockers: '',
    decisions: '',
    milestones: 'Language model evaluation — May 10. Pilot with 3 markets — Jun 1. Full rollout — Jun 30.',
    dependencies: ['prog_3'],
    targetDate: '2026-06-30',
    lastUpdated: Date.now() - 1 * 86400000
  },
  {
    id: 'prog_5',
    name: 'Pulse — Real-Time Observability',
    team: 'SRE / Infrastructure',
    quarter: 'Q2 2026',
    rag: 'amber',
    milestone: 'May 3',
    emoji: '📡',
    blockers: 'Alert fatigue study results delayed. Engineering team cannot finalize threshold config without it.',
    decisions: 'Adopted OpenTelemetry as standard. Grafana selected over Datadog for cost reasons.',
    milestones: 'Alert threshold finalization — Apr 21. Dashboards live — Apr 28. Prod rollout — May 3.',
    lastUpdated: Date.now() - 6 * 86400000
  },
  {
    id: 'prog_6',
    name: 'Cipher — Zero-Trust Security Rollout',
    team: 'Information Security',
    quarter: 'Q3 2026',
    rag: 'green',
    milestone: 'Jul 1',
    emoji: '🔐',
    blockers: '',
    decisions: '',
    milestones: 'Identity provider migration — May 20. MFA enforcement — Jun 1. Full zero-trust — Jul 1.',
    lastUpdated: Date.now() - 3 * 86400000
  }
];

const DEFAULT_HISTORY = [
  {
    id: 'hist_1',
    programId: 'prog_4',
    programName: 'Atlas — Global Localization System',
    personas: ['exec', 'pm'],
    rag: 'green',
    preview: 'Phase 1 language model evaluation on track. 3 target markets confirmed. No blockers.',
    content: { exec: 'Status: On Track — Atlas Global Localization\n\nPhase 1 evaluation complete. 3 target markets (DE, JP, BR) confirmed. Engineering at 72% against plan. No blockers. On track for Jun 30 delivery.' },
    createdAt: Date.now() - 1 * 86400000
  },
  {
    id: 'hist_2',
    programId: 'prog_3',
    programName: 'Nexus — Developer Platform Reboot',
    personas: ['exec', 'steering'],
    rag: 'red',
    preview: 'At risk. DevOps CI/CD dependency blocked 9 days. VP escalation requested.',
    content: { exec: 'Status: At Risk — Nexus Developer Platform\n\nCritical blocker: DevOps CI/CD pipeline dependency open 9 days, no ETA. Mobile SDK descoped to Q3. Requesting VP-level escalation by Apr 18.' },
    createdAt: Date.now() - 2 * 86400000
  },
  {
    id: 'hist_3',
    programId: 'prog_1',
    programName: 'Orion — Cloud Cost Optimization',
    personas: ['pm'],
    rag: 'green',
    preview: 'Cost model finalized. Projected 31% infrastructure savings in pilot phase.',
    content: { pm: 'Orion update: Cost model finalized and approved. Pilot with Platform, SRE, and Data Eng teams starting May 1. Projected savings: 31% infra cost reduction. No blockers.' },
    createdAt: Date.now() - 4 * 86400000
  }
];

const DEFAULT_RISKS = [
  {
    id: 'risk_1',
    programId: 'prog_3',
    programName: 'Nexus — Developer Platform Reboot',
    severity: 'high',
    title: 'DevOps CI/CD dependency unresolved — 9 days',
    description: 'The DevOps team dependency for Nexus CI/CD pipeline migration has been open for 9 days with no ETA. Above your 7-day escalation threshold. If unresolved by Apr 18, the May 15 beta launch risks a 3-week slip.',
    detectedAt: Date.now() - 2 * 86400000,
    acknowledged: false
  },
  {
    id: 'risk_2',
    programId: 'prog_2',
    programName: 'Meridian — Data Governance Framework',
    severity: 'medium',
    title: 'Legal review delay — policy sign-off at risk',
    description: 'CLO office review is 10 days behind schedule. Apr 30 Phase 1 go-live depends on sign-off by Apr 22. No mitigation plan in place yet.',
    detectedAt: Date.now() - 3 * 86400000,
    acknowledged: false
  },
  {
    id: 'risk_3',
    programId: 'prog_5',
    programName: 'Pulse — Real-Time Observability',
    severity: 'medium',
    title: 'Alert fatigue study blocked — threshold config stalled',
    description: 'Alert threshold configuration cannot be finalized without the fatigue study results. Study is 6 days overdue. May 3 prod rollout carries risk if not resolved by Apr 21.',
    detectedAt: Date.now() - 1 * 86400000,
    acknowledged: false
  }
];

// ── PROGRAMS ─────────────────────────────────────────────────────
export function getPrograms() {
  try {
    const raw = localStorage.getItem(PROGRAMS_KEY);
    let programs = raw ? JSON.parse(raw) : initPrograms();
    
    // Migration: ensure targetDate and dependencies exist
    let changed = false;
    programs = programs.map(p => {
      const defaultP = DEFAULT_PROGRAMS.find(dp => dp.id === p.id);
      if (defaultP) {
        if (p.targetDate === undefined) { p.targetDate = defaultP.targetDate || ''; changed = true; }
        if (p.dependencies === undefined) { p.dependencies = defaultP.dependencies || []; changed = true; }
      } else {
        if (p.targetDate === undefined) { p.targetDate = ''; changed = true; }
        if (p.dependencies === undefined) { p.dependencies = []; changed = true; }
      }
      return p;
    });
    if (changed) localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
    return programs;
  } catch { return initPrograms(); }
}

function initPrograms() {
  localStorage.setItem(PROGRAMS_KEY, JSON.stringify(DEFAULT_PROGRAMS));
  return DEFAULT_PROGRAMS;
}

export function saveProgram(program) {
  const programs = getPrograms();
  const idx = programs.findIndex(p => p.id === program.id);
  if (idx > -1) programs[idx] = program;
  else programs.push(program);
  localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
  return program;
}

export function deleteProgram(id) {
  const programs = getPrograms().filter(p => p.id !== id);
  localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
}

export function getProgramById(id) {
  return getPrograms().find(p => p.id === id) || null;
}

export function newProgramId() {
  return 'prog_' + Date.now();
}

// ── HISTORY ──────────────────────────────────────────────────────
export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : initHistory();
  } catch { return initHistory(); }
}

function initHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(DEFAULT_HISTORY));
  return DEFAULT_HISTORY;
}

export function addHistoryEntry(entry) {
  const history = getHistory();
  history.unshift({ ...entry, id: 'hist_' + Date.now() });
  // keep last 100 entries
  if (history.length > 100) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ── RISKS ─────────────────────────────────────────────────────────
export function getRisks() {
  try {
    const raw = localStorage.getItem(RISKS_KEY);
    return raw ? JSON.parse(raw) : initRisks();
  } catch { return initRisks(); }
}

function initRisks() {
  localStorage.setItem(RISKS_KEY, JSON.stringify(DEFAULT_RISKS));
  return DEFAULT_RISKS;
}

export function acknowledgeRisk(id) {
  const risks = getRisks().map(r => r.id === id ? { ...r, acknowledged: true } : r);
  localStorage.setItem(RISKS_KEY, JSON.stringify(risks));
}

export function dismissRisk(id) {
  const risks = getRisks().filter(r => r.id !== id);
  localStorage.setItem(RISKS_KEY, JSON.stringify(risks));
}

export function getActiveRisks() {
  return getRisks().filter(r => !r.acknowledged);
}

// ── STATS ──────────────────────────────────────────────────────────
export function getStats() {
  const programs = getPrograms();
  const history  = getHistory();
  const risks    = getActiveRisks();

  const weekMs = 7 * 86400000;
  const updatesThisWeek = history.filter(h => Date.now() - h.createdAt < weekMs).length;

  return {
    activePrograms: programs.length,
    updatesThisWeek,
    riskCount: risks.length,
    atRisk: programs.filter(p => p.rag === 'red').length,
    atWatch: programs.filter(p => p.rag === 'amber').length,
    onTrack: programs.filter(p => p.rag === 'green').length
  };
}
