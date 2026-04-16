/**
 * sandbox.js — Portfolio "What-IF" Simulation Engine
 * Manages ephemeral state for risk modeling.
 */

window.sandboxState = {
  active: false,
  programs: [],
  originalPrograms: [],
  history: [] // Simulation logs
};

export function isSandboxActive() {
  return window.sandboxState.active;
}

export function initSandbox(livePrograms) {
  window.sandboxState.originalPrograms = JSON.parse(JSON.stringify(livePrograms));
  window.sandboxState.programs = JSON.parse(JSON.stringify(livePrograms));
  window.sandboxState.active = true;
  window.sandboxState.history = [];
  return window.sandboxState.programs;
}

export function resetSandbox() {
  window.sandboxState.active = false;
  window.sandboxState.programs = [];
  window.sandboxState.originalPrograms = [];
}

/**
 * getSimulatedPrograms — Returns either sandbox or live data
 */
export function getSimulatedPrograms(livePrograms) {
  return window.sandboxState.active ? window.sandboxState.programs : livePrograms;
}

/**
 * simulateSlip — Propagates a date shift through the dependency tree
 * @param {string} programId 
 * @param {number} days 
 */
export function simulateSlip(programId, days) {
  if (!window.sandboxState.active) return;

  const shiftedIds = new Set();
  
  function applyShift(id, d) {
    const p = window.sandboxState.programs.find(prog => prog.id === id);
    if (!p || shiftedIds.has(id)) return;

    shiftedIds.add(id);

    // Shift Date
    if (p.targetDate) {
      const current = new Date(p.targetDate);
      current.setDate(current.getDate() + d);
      p.targetDate = current.toISOString().split('T')[0];
    }

    // Impact Status
    if (p.rag === 'green') p.rag = 'amber';
    else if (p.rag === 'amber') p.rag = 'red';

    // Log it
    window.sandboxState.history.push({
      programName: p.name,
      shift: d,
      newDate: p.targetDate
    });

    // Propagate to Children (programs that list this ID as a dependency)
    const children = window.sandboxState.programs.filter(prog => 
      prog.dependencies && prog.dependencies.includes(id)
    );
    children.forEach(c => applyShift(c.id, d));
  }

  applyShift(programId, days);
}

/**
 * getSimulationImpact — Summary of differences
 */
export function getSimulationImpact() {
  if (!window.sandboxState.active) return null;
  
  const live = window.sandboxState.originalPrograms;
  const sim = window.sandboxState.programs;
  
  const redDelta = sim.filter(p => p.rag === 'red').length - live.filter(p => p.rag === 'red').length;
  const amberDelta = sim.filter(p => p.rag === 'amber').length - live.filter(p => p.rag === 'amber').length;
  
  return {
    redDelta,
    amberDelta,
    totalShifted: window.sandboxState.history.length
  };
}
