import nodeFetch from "node-fetch";

// ================================================================
// SUBMIND v6.2 — DEEP INTELLIGENCE RESEARCH ENGINE
// ================================================================
// Glass Fang + Nemesis = invisible immune system
// Sources = the differentiator — real traceable URLs
// ================================================================

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
  maxDuration: 120
};

// ── GEMINI GROUNDED SEARCH ──────────────────────────────────────
// Tries ALL available Gemini API keys until one succeeds
async function gatherSources(topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) {
    console.log('[SubMind] No Gemini keys configured');
    return { sources: [], searchText: '' };
  }

  // Shuffle keys to distribute load
  const shuffled = [...keys].sort(() => Math.random() - 0.5);

  for (const key of shuffled) {
    try {
      const r = await nodeFetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: 'Research this topic thoroughly. Gather specific facts, dates, names, places, events, document titles, report names, organization names. Be extremely specific with sourcing. Cite exact reports, papers, articles, press releases, official documents.' + '\n\nTopic: ' + topic }] }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
          })
        }
      );

      if (r.status === 429) {
        console.log('[SubMind] Gemini key rate limited, trying next...');
        continue;
      }
      if (!r.ok) {
        console.log('[SubMind] Gemini error ' + r.status + ', trying next...');
        continue;
      }

      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
      const meta = d.candidates?.[0]?.groundingMetadata;
      const chunks = meta?.groundingChunks || [];

      const sources = chunks.map((c, i) => ({
        index: i + 1,
        title: c.web?.title || 'Source ' + (i + 1),
        url: c.web?.uri || '',
        domain: ''
      }));

      sources.forEach(s => {
        try { s.domain = new URL(s.url).hostname.replace('www.', ''); }
        catch (e) { s.domain = 'unknown'; }
      });

      console.log('[SubMind] Gemini grounding returned ' + sources.length + ' sources');
      return { sources, searchText: text, searchQueries: meta?.webSearchQueries || [] };
    } catch (e) {
      console.log('[SubMind] Gemini key error: ' + e.message);
      continue;
    }
  }

  console.log('[SubMind] All Gemini keys exhausted');
  return { sources: [], searchText: '' };
}

// ── INTELLIGENCE BRIEFING ENGINE ────────────────────────────────
async function produceIntelligenceBriefing(topic, sourceData) {
  // Cerebras first (fast + reliable), then Claude, then Gemini
  const providers = [
    { name: 'cerebras', fn: callCerebras },
    { name: 'claude', fn: callClaude },
    { name: 'gemini', fn: callGemini }
  ];

  const systemPrompt = buildSystemPrompt(topic, sourceData);

  for (const provider of providers) {
    try {
      console.log('[SubMind] Trying ' + provider.name + '...');
      const resultText = await provider.fn(systemPrompt, topic);
      if (resultText && typeof resultText === 'string' && resultText.length > 100) {
        console.log('[SubMind] ' + provider.name + ' returned ' + resultText.length + ' chars');
        return { text: resultText, provider: provider.name };
      }
    } catch (e) {
      console.error('[SubMind] ' + provider.name + ' failed: ' + e.message);
    }
  }
  throw new Error('All AI providers failed');
}

function buildSystemPrompt(topic, sourceData) {
  const sourceList = (sourceData.sources || [])
    .map((s, i) => '[' + (i + 1) + '] ' + s.title + ' - ' + s.url)
    .join('\n')
    .substring(0, 3000);

  const researchData = (sourceData.searchText || '').substring(0, 8000);
  const hasRealSources = (sourceData.sources || []).length > 0;

  return 'You are SubMind, a deep intelligence research engine. You produce verified intelligence briefings, not chat responses.' +
    '\n\nCRITICAL RULES:' +
    '\n- Every factual claim MUST have an inline citation [1], [2], etc.' +
    '\n- Use exact names, dates, places, organizations, document titles' +
    '\n- Trace events to their ORIGIN (Patient Zero) - the earliest causally relevant event' +
    '\n- Distinguish confirmed facts from assessed probabilities' +
    '\n- Include specific numbers, dollar amounts, percentages' +
    '\n- Write like a senior intelligence analyst, not a chatbot' +
    '\n- The briefing must be authoritative enough for a CEO or policymaker' +
    (hasRealSources ?
      '\n\nYou have the following verified research data and sources:\n---\n' + researchData + '\n---\n\nAvailable sources for citation:\n' + sourceList :
      '\n\nNo external sources were retrieved for this query. Use your training knowledge. Be explicit about confidence levels. Still use citation numbers [1]-[N] to reference the knowledge basis for each claim.') +
    '\n\nOUTPUT FORMAT - Return ONLY valid JSON (no markdown, no code blocks, just raw JSON):' +
    '\n{' +
    '\n  "title": "Brief headline for this intelligence briefing",' +
    '\n  "classification": "CONFIRMED | PROBABLE | DEVELOPING | DISPUTED",' +
    '\n  "confidence": 0.85,' +
    '\n  "summary": "2-3 sentence executive summary with citations.",' +
    '\n  "origin": {' +
    '\n    "event": "The Patient Zero event",' +
    '\n    "date": "Specific date",' +
    '\n    "location": "Specific place",' +
    '\n    "significance": "Why this matters"' +
    '\n  },' +
    '\n  "briefing": "Full intelligence briefing. 800-1500 words. Flowing prose with inline citations [1], [2]. Cover: what happened, who, why, evidence, what comes next. Professional analytical tone.",' +
    '\n  "timeline": [' +
    '\n    {"date": "YYYY-MM-DD", "event": "Specific event", "verified": true, "citation": 1}' +
    '\n  ],' +
    '\n  "predictions": [' +
    '\n    {"scenario": "Specific prediction", "probability": 0.7, "basis": "Evidence", "timeframe": "When"}' +
    '\n  ],' +
    '\n  "methodology_note": "Confidence level and caveats"' +
    '\n}';
}

// ── GLASS FANG VALIDATION ───────────────────────────────────────
function glassFangValidate(briefing, sourceData) {
  const issues = [];
  let adj = 0;
  const text = String(briefing.briefing || '');

  const citations = (text.match(/\[\d+\]/g) || []).length;
  if (citations < 3) { issues.push('LOW_CITATIONS'); adj -= 0.1; }

  const overconf = (briefing.predictions || []).filter(p => p.probability > 0.95);
  if (overconf.length > 0) { issues.push('OVERCONFIDENT'); adj -= 0.05; }

  const hasDates = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b.*\d{4}/i.test(text) || /\b\d{4}-\d{2}-\d{2}\b/.test(text);
  if (!hasDates) { issues.push('NO_DATES'); adj -= 0.05; }

  const highAuth = (sourceData.sources || []).filter(s =>
    /\.gov|reuters|bbc|apnews|nature\.com|nytimes|washingtonpost|bloomberg|wsj|ft\.com|economist/i.test(s.domain || '')
  ).length;

  if (highAuth > 3) adj += 0.05;
  if (highAuth === 0 && (sourceData.sources || []).length > 0) { issues.push('NO_HIGH_AUTH'); adj -= 0.05; }

  const orig = Number(briefing.confidence) || 0.7;
  briefing.confidence = Math.max(0.1, Math.min(0.95, orig + adj));

  if (briefing.confidence >= 0.80) briefing.classification = 'CONFIRMED';
  else if (briefing.confidence >= 0.60) briefing.classification = 'PROBABLE';
  else if (briefing.confidence >= 0.40) briefing.classification = 'DEVELOPING';
  else briefing.classification = 'DISPUTED';

  return { issues, confidenceAdjustment: adj, highAuthorityCount: highAuth };
}

// ── NEMESIS ENGINE ──────────────────────────────────────────────
function nemesisCheck(briefing) {
  const caveats = [];
  const text = String(briefing.briefing || '');

  if (!/(however|alternatively|on the other hand|critics argue|opposing view|counter.?argument|disputed)/i.test(text)) {
    caveats.push('Analysis may present a single-perspective narrative.');
  }

  const bold = (briefing.predictions || []).filter(p => p.probability > 0.85);
  if (bold.length > 0) {
    caveats.push('Some predictions carry high confidence. Historical base rates suggest caution.');
  }

  if (caveats.length > 0) {
    briefing.methodology_note = (briefing.methodology_note || '') + ' ' + caveats.join(' ');
  }
  return caveats;
}

// ── AI PROVIDERS ────────────────────────────────────────────────
async function callCerebras(systemPrompt, topic) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('No Cerebras key');
  const model = process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507';

  const r = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Produce a complete intelligence briefing on: " + topic }
      ],
      temperature: 0.2
    })
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error('Cerebras HTTP ' + r.status + ': ' + errBody.substring(0, 200));
  }
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras empty response');
  return text;
}

async function callClaude(systemPrompt, topic) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No Claude key');

  const r = await nodeFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Produce a complete intelligence briefing on: " + topic }]
    })
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error('Claude HTTP ' + r.status + ': ' + errBody.substring(0, 200));
  }
  const d = await r.json();
  const text = d.content?.[0]?.text;
  if (!text) throw new Error('Claude empty response');
  return text;
}

async function callGemini(systemPrompt, topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error('No Gemini key');
  const key = keys[Math.floor(Math.random() * keys.length)];

  const r = await nodeFetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: "Produce a complete intelligence briefing on: " + topic }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: "application/json" }
      })
    }
  );

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error('Gemini HTTP ' + r.status + ': ' + errBody.substring(0, 200));
  }
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty response');
  return text;
}

// ── JSON EXTRACTOR ──────────────────────────────────────────────
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (e) {}

  // Try code block extraction
  const codeBlock = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (codeBlock) try { return JSON.parse(codeBlock[1]); } catch (e) {}

  // Try largest JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) try { return JSON.parse(jsonMatch[0]); } catch (e) {}

  return null;
}

// ── MAIN HANDLER ────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic } = req.body || {};
  if (!topic?.trim()) return res.status(400).json({ error: 'topic required' });

  const startTime = Date.now();

  try {
    // PHASE 1: Gather sources
    console.log('[SubMind] Phase 1: Gathering sources for:', topic);
    const sourceData = await gatherSources(topic);
    console.log('[SubMind] Found ' + (sourceData.sources?.length || 0) + ' grounded sources');

    // PHASE 2: Produce briefing
    console.log('[SubMind] Phase 2: Producing briefing...');
    const rawResult = await produceIntelligenceBriefing(topic, sourceData);

    // PHASE 3: Parse JSON
    let briefing = extractJSON(rawResult.text);
    if (!briefing) {
      console.log('[SubMind] JSON parse failed, using raw text');
      briefing = {
        title: topic,
        classification: 'DEVELOPING',
        confidence: 0.5,
        summary: (rawResult.text || '').substring(0, 300),
        briefing: rawResult.text || '',
        timeline: [],
        predictions: [],
        origin: null,
        methodology_note: 'Raw analysis output.'
      };
    }

    // PHASE 4: Glass Fang
    const gf = glassFangValidate(briefing, sourceData);
    console.log('[SubMind] Glass Fang: ' + gf.issues.length + ' issues');

    // PHASE 5: Nemesis
    const nem = nemesisCheck(briefing);

    const ms = Date.now() - startTime;
    console.log('[SubMind] Done in ' + ms + 'ms via ' + rawResult.provider);

    return res.status(200).json({
      submind_version: '6.2',
      topic,
      processingMs: ms,
      provider: rawResult.provider,
      title: briefing.title || topic,
      classification: briefing.classification || 'DEVELOPING',
      confidence: briefing.confidence || 0.5,
      summary: briefing.summary || '',
      origin: briefing.origin || null,
      briefing: briefing.briefing || '',
      timeline: briefing.timeline || [],
      predictions: briefing.predictions || [],
      methodology_note: briefing.methodology_note || '',
      sources: sourceData.sources || [],
      sourceCount: (sourceData.sources || []).length,
      validation: {
        glassFangPassed: gf.issues.length === 0,
        glassFangIssues: gf.issues.length,
        highAuthoritySources: gf.highAuthorityCount,
        nemesisCaveats: nem.length,
        adjustedConfidence: briefing.confidence
      }
    });
  } catch (err) {
    console.error('[SubMind v6.2] Error:', err.message);
    return res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
  }
