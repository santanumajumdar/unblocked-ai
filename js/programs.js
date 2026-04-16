/**
 * programs.js — Program data management with localStorage persistence
 */

const PROGRAMS_KEY = 'unblocked_programs';
const HISTORY_KEY  = 'unblocked_history';
const RISKS_KEY    = 'unblocked_risks';
const DECISIONS_KEY = 'unblocked_decisions';

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
  // Platform Team - Scenario: Fatigue (High Pressure + Dropping Velocity)
  {
    id: 'hist_p1',
    programId: 'prog_3',
    programName: 'Nexus — Developer Platform Reboot',
    rag: 'red',
    sentimentScore: 3,
    sentimentLabel: 'Urgent',
    velocity: 28, // Dropping from 40
    preview: 'Critical blocker on CI/CD. Team working overtime.',
    createdAt: Date.now() - 1 * 86400000
  },
  {
    id: 'hist_p2',
    programId: 'prog_3',
    programName: 'Nexus — Developer Platform Reboot',
    rag: 'amber',
    sentimentScore: 5,
    sentimentLabel: 'Concerned',
    velocity: 34,
    preview: 'Observing delays in infra-as-code migration.',
    createdAt: Date.now() - 8 * 86400000
  },
  {
    id: 'hist_p3',
    programId: 'prog_3',
    programName: 'Nexus — Developer Platform Reboot',
    rag: 'green',
    sentimentScore: 8,
    sentimentLabel: 'Stable',
    velocity: 40,
    preview: 'Phase 1 complete. Steady progress.',
    createdAt: Date.now() - 15 * 86400000
  },
  // Data Team - Scenario: Over-indexed (High Input + Flat Velocity)
  {
    id: 'hist_d1',
    programId: 'prog_2',
    programName: 'Meridian — Data Governance Framework',
    rag: 'amber',
    sentimentScore: 4,
    sentimentLabel: 'Strained',
    velocity: 22,
    preview: 'Legal review delay. Backlog growing.',
    createdAt: Date.now() - 2 * 86400000
  },
  {
    id: 'hist_d2',
    programId: 'prog_2',
    programName: 'Meridian — Data Governance Framework',
    rag: 'green',
    sentimentScore: 7,
    sentimentLabel: 'Active',
    velocity: 23,
    preview: 'Initial schemas approved.',
    createdAt: Date.now() - 9 * 86400000
  },
  // Infrastructure - Scenario: Healthy
  {
    id: 'hist_i1',
    programId: 'prog_5',
    programName: 'Pulse — Real-Time Observability',
    rag: 'green',
    sentimentScore: 9,
    sentimentLabel: 'Confident',
    velocity: 45,
    preview: 'Rollout trending ahead of schedule.',
    createdAt: Date.now() - 3 * 86400000
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

const DEFAULT_DECISIONS = [
  {
    id: 'dec_1',
    programId: 'prog_3',
    programName: 'Nexus — Developer Platform Reboot',
    title: 'Descope mobile SDK support to Q3',
    rationale: 'Strategic pivot to stabilize core web infra first. Headcount for contractors approved instead of immediate SDK push.',
    dri: 'VP of Engineering',
    date: '2026-04-12',
    createdAt: Date.now() - 4 * 86400000
  },
  {
    id: 'dec_2',
    programId: 'prog_5',
    programName: 'Pulse — Real-Time Observability',
    title: 'Adopt OpenTelemetry as observability standard',
    rationale: 'Avoid vendor lock-in and enable cross-provider flexibility for future-proofing.',
    dri: 'SRE Lead',
    date: '2026-04-10',
    createdAt: Date.now() - 6 * 86400000
  },
  {
    id: 'dec_3',
    programId: 'prog_2',
    programName: 'Meridian — Data Governance Framework',
    title: 'Phased rollout strategy for Data Retention',
    rationale: 'Legal recommended Tier 1 data focus for initial compliance milestone.',
    dri: 'CLO Office',
    date: '2026-04-05',
    createdAt: Date.now() - 11 * 86400000
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

// ── DECISIONS ─────────────────────────────────────────────────────
export function getDecisions() {
  try {
    const raw = localStorage.getItem(DECISIONS_KEY);
    return raw ? JSON.parse(raw) : initDecisions();
  } catch { return initDecisions(); }
}

function initDecisions() {
  localStorage.setItem(DECISIONS_KEY, JSON.stringify(DEFAULT_DECISIONS));
  return DEFAULT_DECISIONS;
}

export function saveDecision(decision) {
  const decisions = getDecisions();
  const idx = decisions.findIndex(d => d.id === decision.id);
  
  const d = {
    ...decision,
    id: decision.id || 'dec_' + Date.now(),
    createdAt: decision.createdAt || Date.now()
  };

  if (idx > -1) decisions[idx] = d;
  else decisions.push(d);
  
  localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  return d;
}

export function deleteDecision(id) {
  const decisions = getDecisions().filter(d => d.id !== id);
  localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
}

export function getDecisionsByProgram(programId) {
  return getDecisions().filter(d => d.programId === programId);
}

// ── CAPACITY ANALYSIS ───────────────────────────────────────────────
export function getTeamFatigueAnalysis() {
  const history = getHistory();
  const programs = getPrograms();
  const teams = [...new Set(programs.map(p => p.team).filter(Boolean))];
  
  const analysis = teams.map(teamName => {
    const teamHistory = history
      .filter(h => {
        const p = programs.find(pg => pg.id === h.programId);
        return p && p.team === teamName;
      })
      .sort((a,b) => b.createdAt - a.createdAt);

    if (teamHistory.length < 2) return null;

    const current = teamHistory[0];
    const previous = teamHistory[1];
    
    const sentimentDelta = (current.sentimentScore || 0) - (previous.sentimentScore || 0);
    const velocityDelta = (current.velocity || 0) - (previous.velocity || 0);
    
    // Fatigue Logic: Sentiment ↘️ AND Velocity ↘️
    let fatigueLevel = 'low';
    let prediction = 'Stable execution';
    let suggestion = '';

    if (sentimentDelta <= -2 && velocityDelta <= -5) {
      fatigueLevel = 'critical';
      prediction = 'Burnout likely in 2-3 weeks';
      suggestion = 'Reduce sprint scope by 20% immediately to stabilize.';
    } else if (sentimentDelta < 0 || velocityDelta < 0) {
      fatigueLevel = 'medium';
      prediction = 'Potential delivery slip in Q3';
      suggestion = 'Monitor 1:1s and re-prioritize technical debt.';
    }

    return {
      team: teamName,
      fatigueLevel,
      sentimentTrend: sentimentDelta,
      velocityTrend: velocityDelta,
      currentVelocity: current.velocity || 0,
      prediction,
      suggestion,
      updatedAt: current.createdAt
    };
  }).filter(Boolean);

  return analysis;
}

// ── MONITORING & CROSS-PROGRAM INSIGHTS ────────────────────────────
export function getContentionReport() {
  const programs = getPrograms();
  const contention = {};

  // Keywords to ignore
  const ignore = ['and', 'the', 'for', 'with', 'item', 'blocker', 'delay', 'issue', 'need', 'pending'];
  
  programs.forEach(p => {
    if (!p.blockers) return;
    
    // Simple heuristic: look for capitalized words or known teams
    const words = p.blockers.match(/[A-Z][a-z]+/g) || [];
    const uniqueWords = [...new Set(words)];
    
    uniqueWords.forEach(word => {
      if (ignore.includes(word.toLowerCase())) return;
      if (!contention[word]) contention[word] = { entity: word, count: 0, programs: [] };
      contention[word].count++;
      contention[word].programs.push(p.name);
    });
  });

  return Object.values(contention)
    .filter(c => c.count >= 2) // Flag if 2 or more programs share a keyword
    .sort((a, b) => b.count - a.count);
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
