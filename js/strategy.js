/**
 * strategy.js — Strategic Alignment Engine
 * Manages "North Star" goals and program alignment scoring.
 */

const PILLARS_KEY = 'unblocked_strategic_pillars';

const DEFAULT_PILLARS = [
  { id: 'pill_1', title: 'Operational Efficiency', keywords: ['cost', 'infrastructure', 'efficiency', 'infra', 'savings'] },
  { id: 'pill_2', title: 'Product Velocity', keywords: ['feature', 'launch', 'market', 'velocity', 'customer'] },
  { id: 'pill_3', title: 'System Reliability', keywords: ['reliability', 'sre', 'uptime', 'trust', 'security'] }
];

export function getStrategicPillars() {
  try {
    const raw = localStorage.getItem(PILLARS_KEY);
    return raw ? JSON.parse(raw) : initPillars();
  } catch { return initPillars(); }
}

function initPillars() {
  localStorage.setItem(PILLARS_KEY, JSON.stringify(DEFAULT_PILLARS));
  return DEFAULT_PILLARS;
}

export function saveStrategicPillars(pillars) {
  localStorage.setItem(PILLARS_KEY, JSON.stringify(pillars));
}

/**
 * calculateAlignmentScore — Heuristic to determine project value
 * @param {Object} program 
 * @param {Array} pillars 
 * @returns {Number} 0-100
 */
export function calculateAlignmentScore(program, pillars) {
  if (!pillars || pillars.length === 0) return 70; // Neutral baseline

  let score = 20; // Baseline
  const text = `${program.name} ${program.team} ${program.milestones || ''}`.toLowerCase();

  pillars.forEach(p => {
    let match = false;
    const keywords = p.keywords || p.title.toLowerCase().split(' ');
    
    keywords.forEach(k => {
      if (k.length > 2 && text.includes(k.toLowerCase())) {
        match = true;
      }
    });

    if (match) score += (80 / pillars.length);
  });

  return Math.min(100, Math.floor(score));
}
