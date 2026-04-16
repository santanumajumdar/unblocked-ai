/**
 * api.js — Claude API integration for real-time status generation
 *
 * Uses claude-haiku-4-5 for speed + cost efficiency.
 * Streams tokens directly to the DOM for a real-time typewriter effect.
 */

const API_KEY_PREFIX = 'unblocked_api_key_';
const PROVIDER_STORAGE = 'unblocked_provider';
const MOCK_KEY = 'sk-demo-mode';

const MODELS = {
  anthropic: 'claude-3-5-sonnet-20240620', // Defaulting to sonnet for better quality, or keep haiku
  gemini:    'gemini-1.5-flash'
};

const API_URLS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini:    'https://generativelanguage.googleapis.com/v1beta/models'
};

// ── PROVIDER MANAGEMENT ───────────────────────────────────────────
export function getProvider() {
  return localStorage.getItem(PROVIDER_STORAGE) || 'anthropic';
}

export function setProvider(provider) {
  localStorage.setItem(PROVIDER_STORAGE, provider);
}

export function getApiKey(provider = getProvider()) {
  // Backwards compatibility for the old key
  if (provider === 'anthropic' && !localStorage.getItem(API_KEY_PREFIX + 'anthropic')) {
    const oldKey = localStorage.getItem('unblocked_api_key');
    if (oldKey) {
      setApiKey(oldKey, 'anthropic');
      localStorage.removeItem('unblocked_api_key');
      return oldKey;
    }
  }
  return localStorage.getItem(API_KEY_PREFIX + provider) || '';
}

export function setApiKey(key, provider = getProvider()) {
  localStorage.setItem(API_KEY_PREFIX + provider, key.trim());
}

export function clearApiKey(provider = getProvider()) {
  localStorage.removeItem(API_KEY_PREFIX + provider);
}

export function hasApiKey(provider = getProvider()) {
  return !!getApiKey(provider);
}

// ── PERSONA SYSTEM PROMPTS ────────────────────────────────────────
// ... (PERSONA_PROMPTS stays same) ...

// ── MAIN GENERATION FUNCTION ──────────────────────────────────────
export async function generateStatusUpdate(programData, persona, targetEl, onDone, onError) {
  const provider = getProvider();
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    onError(`No ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'} API key set. Please add it in Settings.`);
    return;
  }

  // ── MOCK MODE ───────────────────────────────────────────────────
  if (apiKey === MOCK_KEY) {
    simulateMockGeneration(programData, persona, targetEl, onDone);
    return;
  }

  if (provider === 'gemini') {
    return generateGemini(programData, persona, targetEl, onDone, onError);
  } else {
    return generateAnthropic(programData, persona, targetEl, onDone, onError);
  }
}

/**
 * extractProgramSignals — Extracts program data from raw text
 * @param {string} text - Raw content from parsed documents
 * @param {function} onDone - Callback(programObject)
 * @param {function} onError - Callback(errString)
 */
export async function extractProgramSignals(text, onDone, onError) {
  const provider = getProvider();
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    onError(`No ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'} API key set.`);
    return;
  }

  // --- MOCK MODE ---
  if (apiKey === MOCK_KEY) {
    onDone({
      programs: [
        {
          name: "Project Orion (Extracted)",
          team: "Platform Engineering",
          quarter: "Q3 2026",
          rag: "amber",
          milestone: "July 12",
          blockers: "High-latency signals on the primary ingress. Need resource scaling."
        },
        {
          name: "Project Meridian (Extracted)",
          team: "Data & Analytics",
          quarter: "Q3 2026",
          rag: "green",
          milestone: "August 5",
          blockers: "No critical blockers."
        }
      ],
      decisions: [
        {
          title: "Descope mobile SDK for Q2",
          rationale: "Stabilize core web infra first.",
          dri: "Engineering Lead"
        }
      ]
    });
    return;
  }

  const systemPrompt = `You are a Senior TPM. Extract program information from the provided text and return it as a JSON object.
If the text describes multiple projects or programs, extract ALL of them.

Return the data in this exact format:
{
  "programs": [
    {
      "name": "Project Name",
      "team": "Team Name",
      "quarter": "Q3 2026",
      "rag": "green|amber|red",
      "milestone": "Date",
      "blockers": "Text"
    }
  ],
  "decisions": [
    {
      "title": "Short title of decision",
      "rationale": "Why this was decided",
      "dri": "Person responsible"
    }
  ]
}

Return ONLY valid JSON. If a field is missing, use an empty string. If no programs are found, return an empty array for "programs".`;

  try {
    if (provider === 'gemini') {
      const resp = await fetch(`${API_URLS.gemini}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `TEXT CONTENT:\n${text}\n\nReturn JSON only.` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await resp.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      onDone(JSON.parse(rawText));
    } else {
      const resp = await fetch(API_URLS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODELS.anthropic,
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: `PARSED CONTENT:\n${text}` }]
        })
      });
      const data = await resp.json();
      const rawText = data.content?.[0]?.text || '{}';
      onDone(JSON.parse(rawText));
    }
  } catch (err) {
    onError(err.message || 'Extraction failed');
  }
}

/**
 * analyzeSentiment — Analyzes the tone and sentiment of a status update
 */
export async function analyzeSentiment(text) {
  const provider = getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey || apiKey === MOCK_KEY) return { score: 7, label: 'Neutral' };

  const systemPrompt = `Analyze the sentiment of this TPM status update. 
Return ONLY JSON in this format: {"score": 1-10, "label": "One word sentiment (e.g. Optimistic, Urgent, Concerning, Confident)"}.
Scores: 1-3 (Red/At Risk), 4-6 (Amber/At Watch), 7-10 (Green/On Track).`;

  try {
    if (provider === 'gemini') {
      const resp = await fetch(`${API_URLS.gemini}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `STATUS TEXT:\n${text}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await resp.json();
      return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{"score":7,"label":"Neutral"}');
    } else {
      const resp = await fetch(API_URLS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODELS.anthropic,
          max_tokens: 100,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Analyze this content: \n${text}` }]
        })
      });
      const data = await resp.json();
      return JSON.parse(data.content?.[0]?.text || '{"score":7,"label":"Neutral"}');
    }
  } catch { return { score: 7, label: 'Neutral' }; }
}

/**
 * processTranscript — Extracts program status components from a meeting transcript
 */
export async function processTranscript(transcript, onDone, onError) {
  const provider = getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) { onError("Missing API Key"); return; }
  if (apiKey === MOCK_KEY) { 
    onDone({ name: "Meeting Project", rag: "amber", blockers: "Extracted from demo transcript", milestones: "Next week rollout" }); 
    return; 
  }

  const systemPrompt = `You are a Senior TPM. Extract a program status update from this meeting transcript.
Identify the program name (if mentioned, else "Meeting Update"), the likely RAG status (green, amber, or red), key blockers/risks, and next milestones.

Return ONLY JSON:
{
  "name": "Program Name",
  "rag": "green|amber|red",
  "blockers": "Extracted blockers...",
  "milestones": "Expected next steps..."
}`;

  try {
    if (provider === 'gemini') {
      const resp = await fetch(`${API_URLS.gemini}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `TRANSCRIPT:\n${transcript}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await resp.json();
      onDone(JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'));
    } else {
      const resp = await fetch(API_URLS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODELS.anthropic,
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Transcript:\n${transcript}` }]
        })
      });
      const data = await resp.json();
      onDone(JSON.parse(data.content?.[0]?.text || '{}'));
    }
  } catch (err) { onError(err.message || "Transcript processing failed"); }
}

async function generateAnthropic(programData, persona, targetEl, onDone, onError) {
  const apiKey = getApiKey('anthropic');
  const personaConfig = PERSONA_PROMPTS[persona];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ragLabel = { green: 'On Track', amber: 'At Watch', red: 'At Risk' }[programData.rag] || programData.rag;

  const userPrompt = `Write a status update for the following program:
**Program:** ${programData.name}
**RAG Status:** ${ragLabel}
**Quarter:** ${programData.quarter || 'Q2 2026'}
**Today's date:** ${today}
**Top blockers / risks:** ${programData.blockers || 'None'}
**Key decisions made:** ${programData.decisions || 'None'}
**Next milestones:** ${programData.milestones || 'Standard milestones on track'}
**Tone preference:** ${programData.tone || 'balanced'}
Write the update now.`;

  targetEl.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><div class="pulse-dot"></div><div class="pulse-dot"></div><span style="margin-left:8px;">Generating ${personaConfig.label} update…</span></div>`;

  try {
    const combinedSystem = `${personaConfig.system}${programData.fileContext ? '\n\nAdditional Ground Truth Context from project documents:\n' + programData.fileContext : ''}`;
    
    const response = await fetch(API_URLS.anthropic, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODELS.anthropic,
        max_tokens: 1000,

        stream: true,
        system: combinedSystem,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Claude API error ${response.status}`;
      try { const errJson = JSON.parse(errText); errMsg = errJson?.error?.message || errMsg; } catch {}
      onError(errMsg); return;
    }

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
            targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } catch {}
      }
    }
    targetEl.innerHTML = formatOutputText(fullText);
    if (onDone) onDone(fullText);
  } catch (err) { onError(err.message || 'Unknown network error'); }
}

async function generateGemini(programData, persona, targetEl, onDone, onError) {
  const apiKey = getApiKey('gemini');
  const personaConfig = PERSONA_PROMPTS[persona];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ragLabel = { green: 'On Track', amber: 'At Watch', red: 'At Risk' }[programData.rag] || programData.rag;

  const systemPrompt = `You are a Senior Technical Program Manager. ${personaConfig.system}`;
  const userPrompt = `Write a status update for the following program:
**Program:** ${programData.name}
**RAG Status:** ${ragLabel}
**Quarter:** ${programData.quarter || 'Q2 2026'}
**Today's date:** ${today}
**Top blockers / risks:** ${programData.blockers || 'None'}
**Key decisions made:** ${programData.decisions || 'None'}
**Next milestones:** ${programData.milestones || 'Standard milestones on track'}
**Tone preference:** ${programData.tone || 'balanced'}
Write the update now.`;

  targetEl.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><div class="pulse-dot"></div><div class="pulse-dot"></div><span style="margin-left:8px;">Generating ${personaConfig.label} update (Gemini)…</span></div>`;

  try {
    const combinedSystem = `${personaConfig.system}${programData.fileContext ? '\n\nAdditional Ground Truth Context from project documents:\n' + programData.fileContext : ''}`;
    
    const response = await fetch(`${API_URLS.gemini}?key=${apiKey}&alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${combinedSystem}\n\nUSER PROMPT:\n${userPrompt}` }]
        }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7
        }

      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Gemini API error ${response.status}`;
      try { const errJson = JSON.parse(errText); errMsg = errJson?.error?.message || errMsg; } catch {}
      onError(errMsg); return;
    }

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
        try {
          const data = JSON.parse(dataStr);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            targetEl.innerHTML = formatOutputText(fullText) + '<span class="cursor"></span>';
            targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } catch {}
      }
    }
    targetEl.innerHTML = formatOutputText(fullText);
    if (onDone) onDone(fullText);
  } catch (err) { onError(err.message || 'Unknown network error'); }
}
// ── MOCK GENERATION ───────────────────────────────────────────────
async function simulateMockGeneration(programData, persona, targetEl, onDone) {
  const text = getMockText(persona, programData);
  const words = text.split(' ');
  let current = '';

  targetEl.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><div class="pulse-dot"></div><div class="pulse-dot"></div><span style="margin-left:8px;">Generating ${persona} update…</span></div>`;
  await new Promise(r => setTimeout(r, 600));
  targetEl.innerHTML = '';

  for (let i = 0; i < words.length; i++) {
    current += words[i] + ' ';
    targetEl.innerHTML = formatOutputText(current) + '<span class="cursor"></span>';
    // Faster at the beginning, steadier later
    const delay = i < 5 ? 30 : Math.random() * 40 + 20;
    await new Promise(r => setTimeout(r, delay));
    if (i % 5 === 0) targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  targetEl.innerHTML = formatOutputText(current);
  if (onDone) onDone(current);
}

function getMockText(persona, data) {
  const rag = data.rag || 'green';
  const name = data.name || 'Sample Program';
  const blockers = data.blockers || 'None';

  const mocks = {
    exec: `**Status: ${rag.toUpperCase()} | ${name} | Week of April 14**

**Bottom line up front:** Program is currently ${rag === 'green' ? 'on track for all Q2 milestones' : rag === 'amber' ? 'facing minor headwinds but manageable' : 'at critical risk due to infrastructure dependencies'}.

**What's working:**
- Core system integration completed ahead of schedule.
- Stakeholder alignment secured for Phase 2 scope.
- Velocity remained steady at 42 points per sprint.

**Key risks / blockers:**
${rag === 'green' ? '- No active blockers — executing to plan.' : `- ${blockers}`}

**Decision needed:** ${rag === 'red' ? 'Approval for 2 additional contractors to accelerate remediation.' : 'None at this time.'}

**Next checkpoint:** April 28 — Staging validation results will be shared.`,

    pm: `${name} is currently ${rag === 'green' ? 'tracking well against our Q2 commitments' : 'facing some challenges that we are actively managing'}. We've made significant progress on the core feature set, with engineering completion at roughly 75%.

The primary focus right now is ${data.milestones || 'the upcoming staging release'}. We have a minor dependency on the SEO team for content tags, but that shouldn't impact our critical path.

${rag !== 'green' ? `**Blocker detail:** ${blockers}` : 'No major blockers at this stage.'}

**I need from you:** Final sign-off on the revised V2 documentation by end of week so we can stay on schedule.`,

    eng: `**${name} — Sprint Update | April 14**

**This period:**
- Completed migration of the legacy auth service to the new JWT-based system.
- Refactored the data ingestion pipeline to reduce latency by 40%.
- Fixed 12 high-priority bugs identified during the internal alpha.

**Blockers — ${rag === 'green' ? '0' : '1'} active:**
- [Blocker]: ${blockers}. Impact: Potential delay to the API hardening milestone.

**Next sprint:**
- Finalize the rate-limiting middleware.
- Implement end-to-end testing for the checkout flow.

**Action items:**
- @frontend: Please review the updated GraphQL schema by Wednesday.
- @devops: We need the staging environment credentials updated.`,

    steering: `**Program Steering Update — ${name}**
*Prepared for: Steering Committee | Date: April 14*

---

**Executive Summary**
The program is trending ${rag.toUpperCase()} as we enter the final phase of Q2 execution. While core development is progressing well, we are monitoring ${rag === 'green' ? 'resource availability' : 'significant external dependencies'} closely.

**Program Health**
| Dimension | Status | Notes |
|-----------|--------|-------|
| Schedule | ${rag === 'green' ? 'Green' : 'Amber'} | ${rag === 'green' ? 'On track' : 'Minor delay'} |
| Scope | Green | Aligned with steering |
| Budget | Green | Within 5% of forecast |
| Team Execution | Green | High velocity |

**Critical Risks**
${rag === 'green' ? '1. Resource contention for Q3 planning (Low severity).' : `1. ${blockers} (High severity).`}

**Steering Committee Action Required**
${rag === 'red' ? 'Approval of emergency headcount escalation to resolve staffing gaps.' : 'No action required — update only.'}

**Next Steering Checkpoint:** April 22`
  };

  return mocks[persona] || mocks.exec;
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
/**
 * refineStatusUpdate — Takes an existing draft and an instruction to refine it
 */
export async function refineStatusUpdate(currentText, instruction, targetEl, onDone, onError) {
  const provider = getProvider();
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    onError(`No API key set.`);
    return;
  }

  // --- MOCK MODE ---
  if (apiKey === MOCK_KEY) {
    targetEl.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><div class="pulse-dot"></div><div class="pulse-dot"></div><span style="margin-left:8px;">Refining draft…</span></div>`;
    await new Promise(r => setTimeout(r, 800));
    const refined = `**[REFINED PREVIEW]**\n\n${currentText.slice(0, 100)}... (Refinement applied: ${instruction})\n\nThis is a mock refinement. In live mode, the AI would rewrite this according to your instructions.`;
    targetEl.innerHTML = formatOutputText(refined);
    if (onDone) onDone(refined);
    return;
  }

  const systemPrompt = `You are a Senior Technical Program Manager. You are helping a colleague refine a status update.
Take the provided CURRENT DRAFT and modify it according to the REFINEMENT INSTRUCTION. 
Maintain the same persona and context, but apply the requested changes accurately.
Return only the revised status update text.`;

  const userPrompt = `CURRENT DRAFT:\n${currentText}\n\nREFINEMENT INSTRUCTION:\n${instruction}`;

  targetEl.innerHTML = `<div class="pulse-row"><div class="pulse-dot"></div><div class="pulse-dot"></div><div class="pulse-dot"></div><span style="margin-left:8px;">Applying AI refinement…</span></div>`;

  try {
    if (provider === 'gemini') {
      const resp = await fetch(`${API_URLS.gemini}?key=${apiKey}&alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
        })
      });
      if (!resp.ok) throw new Error(`Gemini error ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      targetEl.innerHTML = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6).trim());
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) { fullText += text; targetEl.innerHTML = formatOutputText(fullText) + '<span class="cursor"></span>'; }
          } catch {}
        }
      }
      targetEl.innerHTML = formatOutputText(fullText);
      if (onDone) onDone(fullText);
    } else {
      const resp = await fetch(API_URLS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODELS.anthropic,
          max_tokens: 1000,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      if (!resp.ok) throw new Error(`Anthropic error ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      targetEl.innerHTML = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              fullText += data.delta.text;
              targetEl.innerHTML = formatOutputText(fullText) + '<span class="cursor"></span>';
            }
          } catch {}
        }
      }
      targetEl.innerHTML = formatOutputText(fullText);
      if (onDone) onDone(fullText);
    }
  } catch (err) { onError(err.message || 'Refinement failed'); }
}
