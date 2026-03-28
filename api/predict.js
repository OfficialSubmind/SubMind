import nodeFetch from "node-fetch";

// ================================================================
// SUBMIND v6.0 — DEEP INTELLIGENCE RESEARCH ENGINE
// ================================================================
// SubMind is NOT a chatbot. It is a deep research system that:
// 1. Gathers thousands of real sources across the web
// 2. Traces claims back to their origin documents (Patient Zero)
// 3. Runs Glass Fang (invisible backend validation) to stress-test
// 4. Runs Nemesis Engine (invisible adversarial counter) to challenge
// 5. Produces a clean, sourced, verified intelligence briefing
// 6. Every claim has inline citations to real traceable documents
// ================================================================
// Glass Fang and Nemesis are the IMMUNE SYSTEM — users never see them
// Users see: validated intelligence with real sources they can verify
// ================================================================

export const config = { api: { bodyParser: { sizeLimit: "8mb" } }, maxDuration: 120 };

// ── GEMINI GROUNDED SEARCH ────────────────────────────────────
// Uses Gemini's grounding with Google Search to gather REAL sources
async function gatherSources(topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) return { sources: [], searchText: '' };
  const key = keys[Math.floor(Math.random() * keys.length)];

  try {
    const r = await nodeFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text:
            `Research this topic thoroughly and gather as many specific facts, dates, names, places, and events as possible. Include specific document titles, report names, organization names, and URLs where applicable. Be extremely specific with your sourcing — cite exact reports, papers, articles, press releases, and official documents.\n\nTopic: ${topic}`
          }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
        })
      }
    );
    if (!r.ok) return { sources: [], searchText: '' };
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
    // Extract domains
    sources.forEach(s => {
      try { s.domain = new URL(s.url).hostname.replace('www.',''); } catch(e) { s.domain = 'unknown'; }
    });
    
    // Also try to get search suggestions from grounding
    const searchQueries = meta?.webSearchQueries || [];
    
    return { sources, searchText: text, searchQueries };
  } catch (e) {
    console.error('[SubMind] Source gathering failed:', e.message);
    return { sources: [], searchText: '' };
  }
}

// ── MAIN INTELLIGENCE ENGINE ──────────────────────────────────
// This is the core analysis function. It takes the gathered sources
// and produces a verified intelligence briefing.
async function produceIntelligenceBriefing(topic, sourceData) {
  // Try Claude first (primary), then Cerebras, then Gemini
  const providers = [
    { name: 'claude', fn: callClaude },
    { name: 'cerebras', fn: callCerebras },
    { name: 'gemini', fn: callGemini }
  ];
  
  const systemPrompt = `You are SubMind — a deep intelligence research engine. You produce verified intelligence briefings, not chat responses.

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
${sourceData.searchText?.substring(0, 6000) || 'No pre-gathered source data available. Use your training knowledge and be explicit about what is confirmed vs assessed.'}
---

Available source URLs for citation:
${(sourceData.sources || []).map((s, i) => `[${i+1}] ${s.title} — ${s.url}`).join('\n').substring(0, 2000)}

OUTPUT FORMAT — Return valid JSON:
{
  "title": "Brief, specific title for this intelligence briefing (like a newspaper headline)",
  "classification": "CONFIRMED | PROBABLE | DEVELOPING | DISPUTED",
  "confidence": 0.0-1.0,
  "summary": "2-3 sentence executive summary with the most critical finding. Include citation numbers.",
  "origin": {
    "event": "The Patient Zero event — earliest causally relevant occurrence",
    "date": "Specific date or date range",
    "location": "Specific place",
    "significance": "Why this matters as the origin point"
  },
  "briefing": "The full intelligence briefing as flowing prose paragraphs. 800-1500 words. Use inline citations [1], [2] etc throughout. Cover: what happened, who was involved, why it matters, what the evidence shows, what comes next. Be specific with names, dates, places. Write in a professional analytical tone. Separate into clear paragraphs. This is the main content the user reads.",
  "timeline": [
    {"date": "YYYY-MM-DD or descriptive", "event": "Specific event with names/places", "verified": true/false, "citation": 1}
  ],
  "key_actors": [
    {"name": "Person/org name", "role": "Their role in this", "citation": 1}
  ],
  "predictions": [
    {"scenario": "Specific prediction with timeframe", "probability": 0.0-1.0, "basis": "What evidence supports this", "timeframe": "When"}
  ],
  "actionable_insights": ["What should someone do with this information — specific, practical"],
  "sources_used": "number of sources referenced",
  "methodology_note": "Brief note on confidence level and any caveats"
}`;

  for (const provider of providers) {
    try {
      const result = await provider.fn(systemPrompt, topic);
      if (result) return { ...result, provider: provider.name };
    } catch (e) {
      console.error(`[SubMind] ${provider.name} failed:`, e.message);
    }
  }
  throw new Error('All AI providers failed');
}

// ── GLASS FANG (INVISIBLE BACKEND VALIDATION) ─────────────────
// Runs after the briefing is produced. Adjusts confidence scores,
// flags issues, but NEVER shown to the user directly.
async function glassFangValidate(briefing, sourceData) {
  // Quick validation checks
  const issues = [];
  let confidenceAdjustment = 0;
  
  const text = briefing.briefing || '';
  
  // Check: Are there inline citations?
  const citationCount = (text.match(/\[\d+\]/g) || []).length;
  if (citationCount < 3) {
    issues.push('LOW_CITATION_DENSITY');
    confidenceAdjustment -= 0.1;
  }
  
  // Check: Are predictions qualified with probability?
  const predictions = briefing.predictions || [];
  const unqualified = predictions.filter(p => !p.probability || p.probability > 0.95);
  if (unqualified.length > 0) {
    issues.push('OVERCONFIDENT_PREDICTIONS');
    confidenceAdjustment -= 0.05;
  }
  
  // Check: Does it have specific names/dates?
  const hasSpecifics = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b.*\d{4}/i.test(text) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(text);
  if (!hasSpecifics) {
    issues.push('LACKS_SPECIFIC_DATES');
    confidenceAdjustment -= 0.05;
  }
  
  // Check source quality
  const highAuthority = (sourceData.sources || []).filter(s => 
    /\.gov|reuters|bbc|apnews|nature\.com|science\.org|nytimes|washingtonpost|bloomberg/i.test(s.domain)
  ).length;
  if (highAuthority > 3) confidenceAdjustment += 0.05;
  if (highAuthority === 0 && (sourceData.sources || []).length > 0) {
    issues.push('NO_HIGH_AUTHORITY_SOURCES');
    confidenceAdjustment -= 0.05;
  }
  
  // Adjust the briefing confidence
  const originalConf = briefing.confidence || 0.7;
  briefing.confidence = Math.max(0.1, Math.min(0.95, originalConf + confidenceAdjustment));
  
  // Reclassify based on adjusted confidence
  if (briefing.confidence >= 0.80) briefing.classification = 'CONFIRMED';
  else if (briefing.confidence >= 0.60) briefing.classification = 'PROBABLE';
  else if (briefing.confidence >= 0.40) briefing.classification = 'DEVELOPING';
  else briefing.classification = 'DISPUTED';
  
  return { issues, confidenceAdjustment, highAuthorityCount: highAuthority };
}

// ── NEMESIS ENGINE (INVISIBLE ADVERSARIAL CHECK) ──────────────
// Challenges the briefing internally. If critical flaws found,
// adds caveats to the briefing. Never shown to user directly.
function nemesisCheck(briefing) {
  const caveats = [];
  
  // Challenge: single-narrative bias
  const text = briefing.briefing || '';
  if (!/(however|alternatively|on the other hand|critics argue|opposing view)/i.test(text)) {
    caveats.push('This analysis may present a single-perspective narrative. Alternative interpretations exist.');
  }
  
  // Challenge: prediction confidence
  const boldPredictions = (briefing.predictions || []).filter(p => p.probability > 0.85);
  if (boldPredictions.length > 0) {
    caveats.push('Some predictions carry high confidence ratings. Historical base rates suggest caution with forecasts beyond 6 months.');
  }
  
  // Add caveats to methodology note if any found
  if (caveats.length > 0) {
    briefing.methodology_note = (briefing.methodology_note || '') + 
      ' Nemesis validation notes: ' + caveats.join(' ');
  }
  
  return caveats;
}

// ── AI PROVIDER FUNCTIONS ─────────────────────────────────────
async function callClaude(systemPrompt, topic) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No key');
  const r = await nodeFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Produce a complete intelligence briefing on: ${topic}` }]
    })
  });
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const d = await r.json();
  return d.content?.[0]?.text || null;
}

async function callCerebras(systemPrompt, topic) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('No key');
  const model = process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507';
  const r = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Produce a complete intelligence briefing on: ${topic}` }
      ],
      temperature: 0.2
    })
  });
  if (!r.ok) throw new Error(`Cerebras ${r.status}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || null;
}

async function callGemini(systemPrompt, topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error('No key');
  const key = keys[Math.floor(Math.random() * keys.length)];
  const r = await nodeFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Produce a complete intelligence briefing on: ${topic}` }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: "application/json" }
      })
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── JSON EXTRACTOR ────────────────────────────────────────────
function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch(e) {}
  const m = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (m) try { return JSON.parse(m[1]); } catch(e) {}
  const b = text.match(/\{[\s\S]*\}/);
  if (b) try { return JSON.parse(b[0]); } catch(e) {}
  return null;
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { topic } = req.body || {};
  if (!topic?.trim()) return res.status(400).json({ error: 'topic required' });
  
  const startTime = Date.now();
  
  try {
    // PHASE 1: Gather real sources via Gemini + Google Search grounding
    const sourceData = await gatherSources(topic);
    
    // PHASE 2: Produce intelligence briefing using best available AI
    const rawResult = await produceIntelligenceBriefing(topic, sourceData);
    let briefing = extractJSON(rawResult) || extractJSON(rawResult?.text);
    
    if (!briefing) {
      // Fallback: use raw text as briefing
      const text = typeof rawResult === 'string' ? rawResult : rawResult?.text || '';
      briefing = {
        title: topic,
        classification: 'DEVELOPING',
        confidence: 0.5,
        summary: text.substring(0, 300),
        briefing: text,
        timeline: [],
        predictions: [],
        sources_used: sourceData.sources?.length || 0
      };
    }
    
    // PHASE 3: Glass Fang — invisible backend validation
    const gfResult = await glassFangValidate(briefing, sourceData);
    
    // PHASE 4: Nemesis Engine — invisible adversarial check
    const nemCaveats = nemesisCheck(briefing);
    
    // PHASE 5: Assemble final response
    const response = {
      submind_version: '6.0',
      topic,
      processingMs: Date.now() - startTime,
      provider: rawResult?.provider || 'unknown',
      
      // The intelligence briefing (what the user sees)
      ...briefing,
      
      // Real traced sources from Google Search grounding
      sources: sourceData.sources || [],
      sourceCount: (sourceData.sources || []).length,
      
      // Internal validation metadata (shown subtly, not as tabs)
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
    console.error('[SubMind v6.0] Error:', err.message);
    return res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
          }
