/**
 * api.js — Claude API integration for real-time status generation
 *
 * Uses claude-haiku-4-5 for speed + cost efficiency.
 * Streams tokens directly to the DOM for a real-time typewriter effect.
 */

const API_KEY_STORAGE = 'unblocked_api_key';
const MODEL = 'claude-haiku-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

// ── API KEY MANAGEMENT ────────────────────────────────────────────
export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}

export function hasApiKey() {
  return !!getApiKey();
}

// ── PERSONA SYSTEM PROMPTS ────────────────────────────────────────
const PERSONA_PROMPTS = {
  exec: {
    label: 'Executive / VP',
    system: `You are an expert Technical Program Manager writing executive status updates for VP+ audiences.

Your output must follow this EXACT format:
**Status: [RAG] | [Program Name] | Week of [Current Date]**

**Bottom line up front:** [1-2 sentences. The single most important thing they need to know. No jargon.]

**What's working:** [2-3 bullet points of progress. Specific, not vague.]

**Key risks / blockers:** [Only if present. Be direct. Quantify impact in days/weeks.]

**Decision needed:** [Only if a decision is required from this exec. Else omit.]

**Next checkpoint:** [Date and what will be known by then.]

Rules:
- BLUF format — most important thing FIRST
- Max 200 words total
- Zero technical jargon
- If no blockers, say "No blockers — program is executing to plan."
- Tone: confident, factual, concise`
  },

  pm: {
    label: 'Product Manager',
    system: `You are an expert Technical Program Manager writing status updates for Product Managers.

Write a narrative paragraph update (not bullet points). Include:
1. Opening sentence with current RAG status and why
2. Progress made this period (specific)
3. Blockers or risks with owners named and impact quantified
4. What you need from the PM specifically
5. Next sync point

Rules:
- Conversational but professional tone — like a weekly written standup
- 150-220 words
- Name owners/teams for blockers
- End with a clear "I need from you" ask
- Use first person ("I", "we")`
  },

  eng: {
    label: 'Engineering Team',
    system: `You are a Technical Program Manager writing a status update for the engineering team.

Your output format:
**[Program Name] — Sprint/Weekly Update | [Date]**

**This period:**
- [Specific technical progress, % complete, systems/components affected]
- [Any technical debt or carry-forward items]

**Blockers — [COUNT] active:**
- [Blocker]: Owner: [Team/Name] | Open: [X days] | Impact: [specific technical consequence]

**Next sprint / period:**
- [Specific technical tasks with owners and estimates]

**Action items:**
- [Concrete asks with @owner and deadline]

Rules:
- Technical depth — engineers want specifics, not summaries
- Name systems, services, components
- Name blocker owners explicitly
- Include story points or % progress where available
- Tone: direct, peer-to-peer, no corporate speak
- 180-250 words`
  },

  steering: {
    label: 'Steering Committee',
    system: `You are a Senior Technical Program Manager writing a formal steering committee update.

Your output format:
**Program Steering Update — [Program Name]**
*Prepared for: Steering Committee | Date: [Date]*

---

**Executive Summary**
[2-3 sentences: current status, biggest risk, and primary ask from steering committee.]

**Program Health**
| Dimension | Status | Notes |
|-----------|--------|-------|
| Schedule | [Green/Amber/Red] | [brief note] |
| Scope | [Green/Amber/Red] | [brief note] |
| Budget | [Green/Amber/Red] | [brief note] |
| Team Execution | [Green/Amber/Red] | [brief note] |

**Critical Risks**
[If risks: numbered list with severity, description, and mitigation plan]
[If none: "No critical risks to report."]

**Steering Committee Action Required**
[Specific ask — approval, decision, escalation, or resource request. If none, state "No action required — update only."]

**Next Steering Checkpoint:** [Date]

Rules:
- Formal, board-room tone
- Every claim must be supported by data
- Make the "ask" crystal clear
- 220-280 words`
  }
};

// ── MAIN GENERATION FUNCTION ──────────────────────────────────────
/**
 * generateStatusUpdate — Calls Claude API and streams output to a DOM element
 *
 * @param {Object} programData - { name, rag, blockers, decisions, milestones, tone }
 * @param {string} persona - 'exec' | 'pm' | 'eng' | 'steering'
 * @param {HTMLElement} targetEl - DOM element to stream text into
 * @param {Function} onDone - callback when streaming completes
 * @param {Function} onError - callback on error
 */
export async function generateStatusUpdate(programData, persona, targetEl, onDone, onError) {
  const apiKey = getApiKey();
  if (!apiKey) {
    onError('No API key set. Please add your Anthropic API key in Settings.');
    return;
  }

  const personaConfig = PERSONA_PROMPTS[persona];
  if (!personaConfig) {
    onError('Unknown persona: ' + persona);
    return;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const ragLabel = { green: 'On Track', amber: 'At Watch', red: 'At Risk' }[programData.rag] || programData.rag;

  const userPrompt = `Write a status update for the following program:

**Program:** ${programData.name}
**RAG Status:** ${ragLabel}
**Quarter:** ${programData.quarter || 'Q2 2026'}
**Team:** ${programData.team || 'Cross-functional'}
**Today's date:** ${today}

**Top blockers / risks:**
${programData.blockers || 'No blockers. Program is executing to plan.'}

**Key decisions made:**
${programData.decisions || 'No major decisions to report this period.'}

**Next milestones:**
${programData.milestones || 'Standard milestones on track — see program plan.'}

**Tone preference:** ${programData.tone || 'Balanced — factual with context'}

Write the update now.`;

  // Show loading state
  targetEl.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><div class="pulse-dot"></div><div class="pulse-dot"></div><span style="margin-left:8px;">Generating ${personaConfig.label} update…</span></div>`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        stream: true,
        system: personaConfig.system,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `API error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errMsg;
      } catch {}
      onError(errMsg);
      return;
    }

    // Stream parsing
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    targetEl.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            fullText += data.delta.text;
            targetEl.innerHTML = formatOutputText(fullText) + '<span class="cursor"></span>';
            // Auto-scroll to bottom
            targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // Final render — remove cursor
    targetEl.innerHTML = formatOutputText(fullText);
    if (onDone) onDone(fullText);

  } catch (err) {
    const msg = err.name === 'TypeError'
      ? 'Network error. Check your internet connection or API key.'
      : err.message || 'Unknown error occurred.';
    onError(msg);
  }
}

// ── FORMAT OUTPUT ─────────────────────────────────────────────────
function formatOutputText(text) {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary);font-weight:500;">$1</strong>')
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Markdown table rows
    .replace(/^\|(.+)\|$/gm, (match) => {
      if (match.replace(/\|/g, '').replace(/-/g, '').replace(/\s/g, '') === '') {
        return '<tr class="table-divider" style="display:none;"></tr>';
      }
      const cells = match.split('|').slice(1, -1).map(c => c.trim());
      const isHeader = cells.some(c => /^[A-Z]/.test(c));
      const tag = isHeader ? 'th' : 'td';
      return `<tr>${cells.map(c => `<${tag} style="padding:5px 12px;text-align:left;border-bottom:1px solid var(--border);font-size:13px;font-weight:${tag==='th'?500:400};">${c}</${tag}>`).join('')}</tr>`;
    })
    // Wrap table rows in table
    .replace(/(<tr>.*<\/tr>\n?)+/gs, (match) => {
      return `<div style="overflow-x:auto;margin:8px 0;"><table style="border-collapse:collapse;width:100%;border:1px solid var(--border);border-radius:8px;overflow:hidden;">${match}</table></div>`;
    })
    // Bullet points
    .replace(/^- (.+)$/gm, '<li style="margin-left:18px;margin-bottom:4px;color:var(--text-primary);">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, '<ul style="margin:6px 0;">$&</ul>')
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:18px;margin-bottom:4px;">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:12px 0;">')
    // Newlines
    .replace(/\n/g, '<br>');
}

// ── GENERATE ALL PERSONAS IN SEQUENCE ────────────────────────────
export async function generateAllPersonas(programData, personas, onPersonaDone, onAllDone, onError) {
  const results = {};
  for (const persona of personas) {
    await new Promise((resolve) => {
      const tempEl = document.createElement('div');
      generateStatusUpdate(
        programData, persona, tempEl,
        (text) => { results[persona] = { text, el: tempEl }; resolve(); },
        (err) => { onError(persona, err); resolve(); }
      );
    });
    if (onPersonaDone) onPersonaDone(persona, results[persona]);
  }
  if (onAllDone) onAllDone(results);
}
