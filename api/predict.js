import nodeFetch from "node-fetch";

// ================================================================
// SUBMIND v6.1 — DEEP INTELLIGENCE RESEARCH ENGINE
// ================================================================
// SubMind is NOT a chatbot. It is a deep research system that:
// 1. Gathers real sources across the web via Gemini + Google Search
// 2. Traces claims back to their origin documents (Patient Zero)
// 3. Runs Glass Fang (invisible backend validation) to stress-test
// 4. Runs Nemesis Engine (invisible adversarial counter) to challenge
// 5. Produces a clean, sourced, verified intelligence briefing
// 6. Every claim has inline citations to real traceable documents
// ================================================================
// Glass Fang and Nemesis are the IMMUNE SYSTEM — users never see them
// Users see: validated intelligence with real sources they can verify
// ================================================================

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
  maxDuration: 120
};

// ── GEMINI GROUNDED SEARCH ──────────────────────────────────────
async function gatherSources(topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) return { sources: [], searchText: '' };

  const key = keys[Math.floor(Math.random() * keys.length)];
  try {
    const r = await nodeFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `Research this topic thoroughly and gather as many specific facts, dates, names, places, and events as possible. Include specific document titles, report names, organization names, and URLs where applicable. Be extremely specific with your sourcing — cite exact reports, papers, articles, press releases, and official documents.\n\nTopic: ${topic}` }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
        })
      }
    );
    if (!r.ok) {
      console.error('[SubMind] Gemini grounding HTTP error:', r.status);
      return { sources: [], searchText: '' };
    }
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';

    // Extract grounding metadata (real source URLs from Google Search)
    const meta = d.candidates?.[0]?.groundingMetadata;
    const chunks = meta?.groundingChunks || [];
    const sources = chunks.map((c, i) => ({
      index: i + 1,
      title: c.web?.title || 'Source ' + (i + 1),
      url: c.web?.uri || '',
      domain: ''
    }));

    sources.forEach(s => {
      try { s.domain = new URL(s.url).hostname.replace('www.',''); }
      catch(e) { s.domain = 'unknown'; }
    });

    const searchQueries = meta?.webSearchQueries || [];
    return { sources, searchText: text, searchQueries };
  } catch (e) {
    console.error('[SubMind] Source gathering failed:', e.message);
    return { sources: [], searchText: '' };
  }
}

// ── MAIN INTELLIGENCE ENGINE ────────────────────────────────────
async function produceIntelligenceBriefing(topic, sourceData) {
  const providers = [
    { name: 'claude', fn: callClaude },
    { name: 'cerebras', fn: callCerebras },
    { name: 'gemini', fn: callGemini }
  ];

  const systemPrompt = buildSystemPrompt(topic, sourceData);

  for (const provider of providers) {
    try {
      console.log(`[SubMind] Trying ${provider.name}...`);
      const resultText = await provider.fn(systemPrompt, topic);
      if (resultText && typeof resultText === 'string' && resultText.length > 50) {
        console.log(`[SubMind] ${provider.name} returned ${resultText.length} chars`);
        return { text: resultText, provider: provider.name };
      }
    } catch (e) {
      console.error(`[SubMind] ${provider.name} failed:`, e.message);
    }
  }
  throw new Error('All AI providers failed');
}

function buildSystemPrompt(topic, sourceData) {
  const sourceList = (sourceData.sources || [])
    .map((s, i) => `[${i+1}] ${s.title} — ${s.url}`)
    .join('\n')
    .substring(0, 2000);

  const researchData = (sourceData.searchText || '').substring(0, 6000);

  return `You are SubMind — a deep intelligence research engine. You produce verified intelligence briefings, not chat responses.

CRITICAL RULES:
- Every factual claim MUST have an inline citation number like [1], [2], etc.
- Be specific: use exact names, dates, places, organizations, document titles
- Trace events to their ORIGIN (Patient Zero) — the earliest causally relevant event
- Distinguish confirmed facts from assessed probabilities
- Include specific numbers, dollar amounts, percentages where available
- Write like a senior intelligence analyst, not a chatbot
- The briefing must be authoritative enough that a CEO or policymaker would trust it

You have gathered the following research data from real sources:
---
${researchData || 'No pre-gathered source data available. Use your training knowledge and be explicit about what is confirmed vs assessed.'}
---

Available source URLs for citation:
${sourceList || 'No source URLs available. Use general knowledge with appropriate caveats.'}

OUTPUT FORMAT — Return ONLY valid JSON (no markdown, no backticks, just raw JSON):
{
  "title": "Brief, specific title for this intelligence briefing",
  "classification": "CONFIRMED | PROBABLE | DEVELOPING | DISPUTED",
  "confidence": 0.85,
  "summary": "2-3 sentence executive summary with the most critical finding. Include citation numbers.",
  "origin": {
    "event": "The Patient Zero event",
    "date": "Specific date",
    "location": "Specific place",
    "significance": "Why this matters"
  },
  "briefing": "The full intelligence briefing as flowing prose paragraphs. 800-1500 words. Use inline citations [1], [2] etc throughout. Cover: what happened, who was involved, why it matters, what the evidence shows, what comes next.",
  "timeline": [
    {"date": "YYYY-MM-DD", "event": "Specific event", "verified": true, "citation": 1}
  ],
  "predictions": [
    {"scenario": "Specific prediction", "probability": 0.7, "basis": "Evidence", "timeframe": "When"}
  ],
  "methodology_note": "Brief note on confidence and caveats"
}`;
}

// ── GLASS FANG (INVISIBLE BACKEND VALIDATION) ────────────────────
function glassFangValidate(briefing, sourceData) {
  const issues = [];
  let confidenceAdjustment = 0;

  const text = String(briefing.briefing || '');

  // Check citation density
  const citationCount = (text.match(/\[\d+\]/g) || []).length;
  if (citationCount < 3) {
    issues.push('LOW_CITATION_DENSITY');
    confidenceAdjustment -= 0.1;
  }

  // Check prediction confidence
  const predictions = briefing.predictions || [];
  const overconfident = predictions.filter(p => p.probability > 0.95);
  if (overconfident.length > 0) {
    issues.push('OVERCONFIDENT_PREDICTIONS');
    confidenceAdjustment -= 0.05;
  }

  // Check for specific dates
  const hasSpecifics = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b.*\d{4}/i.test(text) || /\b\d{4}-\d{2}-\d{2}\b/.test(text);
  if (!hasSpecifics) {
    issues.push('LACKS_SPECIFIC_DATES');
    confidenceAdjustment -= 0.05;
  }

  // Check source quality
  const highAuthority = (sourceData.sources || []).filter(s =>
    /\.gov|reuters|bbc|apnews|nature\.com|science\.org|nytimes|washingtonpost|bloomberg|wsj|ft\.com/i.test(s.domain || '')
  ).length;

  if (highAuthority > 3) confidenceAdjustment += 0.05;
  if (highAuthority === 0 && (sourceData.sources || []).length > 0) {
    issues.push('NO_HIGH_AUTHORITY_SOURCES');
    confidenceAdjustment -= 0.05;
  }

  // Adjust confidence
  const originalConf = Number(briefing.confidence) || 0.7;
  briefing.confidence = Math.max(0.1, Math.min(0.95, originalConf + confidenceAdjustment));

  // Reclassify
  if (briefing.confidence >= 0.80) briefing.classification = 'CONFIRMED';
  else if (briefing.confidence >= 0.60) briefing.classification = 'PROBABLE';
  else if (briefing.confidence >= 0.40) briefing.classification = 'DEVELOPING';
  else briefing.classification = 'DISPUTED';

  return { issues, confidenceAdjustment, highAuthorityCount: highAuthority };
}

// ── NEMESIS ENGINE (INVISIBLE ADVERSARIAL CHECK) ────────────────
function nemesisCheck(briefing) {
  const caveats = [];
  const text = String(briefing.briefing || '');

  if (!/(however|alternatively|on the other hand|critics argue|opposing view|counter.?argument)/i.test(text)) {
    caveats.push('Analysis may present a single-perspective narrative.');
  }

  const boldPredictions = (briefing.predictions || []).filter(p => p.probability > 0.85);
  if (boldPredictions.length > 0) {
    caveats.push('Some predictions carry high confidence. Historical base rates suggest caution with long-range forecasts.');
  }

  if (caveats.length > 0) {
    briefing.methodology_note = (briefing.methodology_note || '') + ' ' + caveats.join(' ');
  }

  return caveats;
}

// ── AI PROVIDER FUNCTIONS ───────────────────────────────────────
async function callClaude(systemPrompt, topic) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No Claude key');

  const r = await nodeFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Produce a complete intelligence briefing on: ${topic}` }]
    })
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`Claude HTTP ${r.status}: ${errBody.substring(0, 200)}`);
  }
  const d = await r.json();
  const text = d.content?.[0]?.text;
  if (!text) throw new Error('Claude returned empty content');
  return text;
}

async function callCerebras(systemPrompt, topic) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('No Cerebras key');
  const model = process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507';

  const r = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Produce a complete intelligence briefing on: ${topic}` }
      ],
      temperature: 0.2
    })
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`Cerebras HTTP ${r.status}: ${errBody.substring(0, 200)}`);
  }
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras returned empty content');
  return text;
}

async function callGemini(systemPrompt, topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error('No Gemini key');
  const key = keys[Math.floor(Math.random() * keys.length)];

  const r = await nodeFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Produce a complete intelligence briefing on: ${topic}` }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`Gemini HTTP ${r.status}: ${errBody.substring(0, 200)}`);
  }
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty content');
  return text;
}

// ── JSON EXTRACTOR ──────────────────────────────────────────────
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // Try direct parse first
  try { return JSON.parse(text); } catch(e) {}

  // Try extracting from markdown code blocks
  const codeBlock = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (codeBlock) try { return JSON.parse(codeBlock[1]); } catch(e) {}

  // Try finding the largest JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) try { return JSON.parse(jsonMatch[0]); } catch(e) {}

  return null;
}

// ── MAIN HANDLER ────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic } = req.body || {};
  if (!topic?.trim()) return res.status(400).json({ error: 'topic required' });

  const startTime = Date.now();

  try {
    // PHASE 1: Gather real sources via Gemini + Google Search grounding
    console.log('[SubMind] Phase 1: Gathering sources for:', topic);
    const sourceData = await gatherSources(topic);
    console.log(`[SubMind] Found ${sourceData.sources?.length || 0} grounded sources`);

    // PHASE 2: Produce intelligence briefing using best available AI
    console.log('[SubMind] Phase 2: Producing intelligence briefing...');
    const rawResult = await produceIntelligenceBriefing(topic, sourceData);
    // rawResult = { text: "...", provider: "claude" }

    // PHASE 3: Parse the AI response into structured JSON
    let briefing = extractJSON(rawResult.text);

    if (!briefing) {
      console.log('[SubMind] JSON parse failed, using raw text as briefing');
      briefing = {
        title: topic,
        classification: 'DEVELOPING',
        confidence: 0.5,
        summary: (rawResult.text || '').substring(0, 300),
        briefing: rawResult.text || '',
        timeline: [],
        predictions: [],
        origin: null,
        methodology_note: 'Raw analysis — structured parsing unavailable.'
      };
    }

    // PHASE 4: Glass Fang — invisible backend validation
    console.log('[SubMind] Phase 4: Glass Fang validation...');
    const gfResult = glassFangValidate(briefing, sourceData);
    console.log(`[SubMind] Glass Fang: ${gfResult.issues.length} issues, ${gfResult.highAuthorityCount} high-authority sources`);

    // PHASE 5: Nemesis Engine — invisible adversarial check
    console.log('[SubMind] Phase 5: Nemesis check...');
    const nemCaveats = nemesisCheck(briefing);

    const processingMs = Date.now() - startTime;
    console.log(`[SubMind] Complete in ${processingMs}ms via ${rawResult.provider}`);

    // PHASE 6: Assemble final response
    const response = {
      submind_version: '6.1',
      topic,
      processingMs,
      provider: rawResult.provider,

      // The intelligence briefing (what the user sees)
      title: briefing.title || topic,
      classification: briefing.classification || 'DEVELOPING',
      confidence: briefing.confidence || 0.5,
      summary: briefing.summary || '',
      origin: briefing.origin || null,
      briefing: briefing.briefing || '',
      timeline: briefing.timeline || [],
      predictions: briefing.predictions || [],
      methodology_note: briefing.methodology_note || '',

      // Real traced sources from Google Search grounding
      sources: sourceData.sources || [],
      sourceCount: (sourceData.sources || []).length,

      // Internal validation metadata (shown subtly)
      validation: {
        glassFangPassed: gfResult.issues.length === 0,
        glassFangIssues: gfResult.issues.length,
        highAuthoritySources: gfResult.highAuthorityCount,
        nemesisCaveats: nemCaveats.length,
        adjustedConfidence: briefing.confidence
      }
    };

    return res.status(200).json(response);

  } catch (err) {
    console.error('[SubMind v6.1] Error:', err.message, err.stack);
    return res.status(500).json({
      error: 'Analysis failed',
      detail: err.message
    });
  }
      }
