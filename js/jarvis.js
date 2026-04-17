/**
 * jarvis.js — Persistent AI Assistant Logic & Action Handling
 */

const JARVIS_HISTORY_KEY = 'unblocked_jarvis_history';

export function getJarvisHistory() {
  try {
    const raw = localStorage.getItem(JARVIS_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveJarvisHistory(history) {
  // Keep last 50 messages to avoid local storage bloat
  const limited = history.slice(-50);
  localStorage.setItem(JARVIS_HISTORY_KEY, JSON.stringify(limited));
}

export function clearJarvisHistory() {
  localStorage.removeItem(JARVIS_HISTORY_KEY);
}

/**
 * Detects actions in Jarvis's response.
 * Look for JSON blocks or specialized markers.
 */
export function extractJarvisAction(text) {
  try {
    const startIdx = text.indexOf('{"action"');
    if (startIdx === -1) return null;
    
    const endIdx = text.lastIndexOf('}');
    if (endIdx === -1 || endIdx < startIdx) return null;
    
    const jsonStr = text.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse Jarvis action:', e);
  }
  return null;
}

/**
 * Removes the JSON action block from text for clean UI display
 */
export function stripJarvisAction(text) {
  const startIdx = text.indexOf('{"action"');
  if (startIdx === -1) return text;
  
  const endIdx = text.lastIndexOf('}');
  if (endIdx === -1 || endIdx < startIdx) return text;
  
  return (text.substring(0, startIdx) + text.substring(endIdx + 1)).trim();
}

/**
 * Executes confirmed actions
 */
export function executeJarvisAction(action, context = {}) {
  const { action: type, data } = action;
  
  switch (type) {
    case 'CREATE_PROGRAM':
      if (context.saveProgram) {
        context.saveProgram({
          id: 'prog_' + Date.now(),
          name: data.name || 'New Program',
          team: data.team || 'Unassigned',
          rag: data.rag || 'green',
          quarter: data.quarter || 'Q2 2026',
          milestone: data.milestone || '',
          emoji: data.emoji || '🚀',
          lastUpdated: Date.now(),
          milestones: data.milestones || '',
          blockers: data.blockers || '',
          decisions: data.decisions || '',
          targetDate: data.targetDate || '',
          dependencies: []
        });
        return { success: true, message: `Program "${data.name}" created successfully.` };
      }
      break;

    case 'LOG_DECISION':
      if (context.saveDecision) {
        context.saveDecision({
          id: 'dec_' + Date.now(),
          programId: data.programId || '',
          programName: data.programName || 'Unknown',
          title: data.title || 'New Decision',
          rationale: data.rationale || '',
          dri: data.dri || 'Santanu Majumdar',
          date: new Date().toISOString().split('T')[0],
          createdAt: Date.now()
        });
        return { success: true, message: `Decision logged: ${data.title}` };
      }
      break;

    default:
      return { success: false, message: `Unknown action type: ${type}` };
  }
  
  return { success: false, message: 'Action execution failed - missing context.' };
}
