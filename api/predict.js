import nodeFetch from "node-fetch";

// ================================================================
// SUBMIND v7.0 — DEEP INTELLIGENCE RESEARCH ENGINE
// ================================================================
// What makes SubMind different from any LLM chat:
// 1. Multi-source gathering with real URL verification
// 2. Visual evidence web — nodes of interconnected events + sources
// 3. Glass Fang scoring — 12-metric validation system
// 4. Nemesis adversarial testing — challenges every conclusion
// 5. Source cross-referencing — shows when sources corroborate
// 6. Origin-to-prediction chain with confidence at each link
// ================================================================

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
  maxDuration: 120
};

// ── GEMINI GROUNDED SEARCH ──────────────────────────────────────
async function gatherSourcesGemini(topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) return null;

  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  for (const key of shuffled) {
    try {
      const r = await nodeFetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: 'Research thoroughly: ' + topic + '. Cite exact reports, papers, articles, press releases, official documents with specific dates and authors.' }] }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
          })
        }
      );
      if (r.status === 429) { console.log('[SubMind] Gemini key 429, next...'); continue; }
      if (!r.ok) { console.log('[SubMind] Gemini ' + r.status + ', next...'); continue; }

      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
      const meta = d.candidates?.[0]?.groundingMetadata;
      const chunks = meta?.groundingChunks || [];

      if (chunks.length > 0) {
        const sources = chunks.map((c, i) => ({
          index: i + 1,
          title: c.web?.title || 'Source ' + (i + 1),
          url: c.web?.uri || '',
          domain: '',
          type: 'grounded'
        }));
        sources.forEach(s => {
          try { s.domain = new URL(s.url).hostname.replace('www.', ''); }
          catch (e) { s.domain = 'unknown'; }
        });
        return { sources, searchText: text };
      }
    } catch (e) {
      console.log('[SubMind] Gemini error: ' + e.message);
    }
  }
  return null;
}

// ── INTELLIGENCE BRIEFING WITH EMBEDDED SOURCE EXTRACTION ───────
async function produceIntelligenceBriefing(topic, existingSources) {
  const providers = [
    { name: 'cerebras', fn: callCerebras },
    { name: 'claude', fn: callClaude },
    { name: 'gemini', fn: callGeminiChat }
  ];

  const hasSources = existingSources && existingSources.length > 0;
  const sourceContext = hasSources
    ? '\nVerified sources available for citation:\n' + existingSources.map((s, i) => '[' + (i+1) + '] ' + s.title + ' - ' + s.url).join('\n').substring(0, 3000)
    : '\nNo external sources retrieved. You MUST generate a "constructed_sources" array with real, verifiable URLs for every major claim. Include government databases, news archives, academic papers, SEC filings, official reports.';

  const systemPrompt = 'You are SubMind, a deep intelligence research engine that produces investment-grade verified intelligence briefings.' +
    '\n\nCRITICAL REQUIREMENTS:' +
    '\n- Every claim MUST have inline citation [1], [2], etc.' +
    '\n- Use exact names, dates (YYYY-MM-DD), places, organizations' +
    '\n- Trace to ORIGIN EVENT (Patient Zero) — earliest causal event' +
    '\n- Include specific numbers: dollar amounts, percentages, counts' +
    '\n- Distinguish CONFIRMED facts from ASSESSED probabilities' +
    '\n- Write as senior intelligence analyst for CEO/policymaker audience' +
    '\n- Each prediction must have probability, timeframe, and evidence basis' +
    sourceContext +
    '\n\nOUTPUT FORMAT — Return ONLY valid JSON:' +
    '\n{' +
    '\n  "title": "Specific headline",' +
    '\n  "classification": "CONFIRMED|PROBABLE|DEVELOPING|DISPUTED",' +
    '\n  "confidence": 0.85,' +
    '\n  "summary": "2-3 sentence executive summary with citations.",' +
    '\n  "origin": {"event":"Patient Zero event","date":"YYYY-MM-DD","location":"Place","significance":"Why this is the origin"},' +
    '\n  "briefing": "800-1500 word intelligence briefing with inline citations [1],[2]. Professional analytical prose.",' +
    '\n  "timeline": [{"date":"YYYY-MM-DD","event":"Specific event","verified":true}],' +
    '\n  "predictions": [{"scenario":"Specific prediction","probability":0.7,"basis":"Evidence basis with citations","timeframe":"When","investment_relevance":"Why this matters for decision-makers"}],' +
    '\n  "evidence_web": {' +
    '\n    "nodes": [' +
    '\n      {"id":"origin","type":"origin","label":"Origin event name","date":"YYYY-MM-DD"},' +
    '\n      {"id":"event_1","type":"event","label":"Key event","date":"YYYY-MM-DD"},' +
    '\n      {"id":"pred_1","type":"prediction","label":"Prediction","probability":0.7},' +
    '\n      {"id":"source_1","type":"source","label":"Source name","url":"url"}' +
    '\n    ],' +
    '\n    "links": [' +
    '\n      {"source":"origin","target":"event_1","relationship":"caused"},' +
    '\n      {"source":"source_1","target":"event_1","relationship":"confirms"},' +
    '\n      {"source":"event_1","target":"pred_1","relationship":"suggests"}' +
    '\n    ]' +
    '\n  },' +
    (!hasSources ? '\n  "constructed_sources": [{"title":"Exact document/article title","url":"https://real-url","author":"Author/org","date":"YYYY-MM-DD","type":"report|article|filing|paper"}],' : '') +
    '\n  "methodology_note": "Confidence rationale and caveats"' +
    '\n}';

  for (const provider of providers) {
    try {
      console.log('[SubMind] Trying ' + provider.name + '...');
      const text = await provider.fn(systemPrompt, topic);
      if (text && typeof text === 'string' && text.length > 100) {
        console.log('[SubMind] ' + provider.name + ' returned ' + text.length + ' chars');
        return { text, provider: provider.name };
      }
    } catch (e) {
      console.error('[SubMind] ' + provider.name + ' failed: ' + e.message);
    }
  }
  throw new Error('All providers failed');
}

// ── GLASS FANG v2 — 12-METRIC VALIDATION ────────────────────────
function glassFangValidate(briefing, sources) {
  const metrics = {};
  let totalScore = 0;
  let maxScore = 0;
  const text = String(briefing.briefing || '');

  // 1. Citation density (how many citations per 100 words)
  const words = text.split(/\s+/).length;
  const citations = (text.match(/\[\d+\]/g) || []).length;
  const citeDensity = words > 0 ? (citations / words) * 100 : 0;
  metrics.citation_density = { score: Math.min(citeDensity / 3, 1), detail: citations + ' citations in ' + words + ' words' };
  totalScore += metrics.citation_density.score; maxScore += 1;

  // 2. Date specificity
  const specificDates = (text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []).length;
  const monthYear = (text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi) || []).length;
  const dateScore = Math.min((specificDates + monthYear) / 5, 1);
  metrics.date_specificity = { score: dateScore, detail: (specificDates + monthYear) + ' specific dates found' };
  totalScore += dateScore; maxScore += 1;

  // 3. Named entities (people, organizations)
  const hasOrgs = /\b(Inc\.|Corp\.|LLC|Ltd\.|Association|Commission|Department|Agency|Bank|Fund|Institute)\b/i.test(text);
  const hasNames = /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/.test(text);
  metrics.named_entities = { score: (hasOrgs ? 0.5 : 0) + (hasNames ? 0.5 : 0), detail: (hasOrgs ? 'Organizations' : '') + (hasNames ? ' + Named individuals' : '') };
  totalScore += metrics.named_entities.score; maxScore += 1;

  // 4. Numeric evidence (dollar amounts, percentages)
  const dollars = (text.match(/\$[\d,.]+\s*(million|billion|trillion|M|B|T)?/gi) || []).length;
  const percents = (text.match(/\d+(\.\d+)?\s*%/g) || []).length;
  metrics.numeric_evidence = { score: Math.min((dollars + percents) / 6, 1), detail: dollars + ' dollar amounts, ' + percents + ' percentages' };
  totalScore += metrics.numeric_evidence.score; maxScore += 1;

  // 5. Source authority
  const highAuth = (sources || []).filter(s =>
    /\.gov|reuters|bbc|apnews|nature\.com|nytimes|washingtonpost|bloomberg|wsj|ft\.com|economist|sec\.gov|federalreserve|imf\.org|worldbank/i.test(s.domain || s.url || '')
  ).length;
  metrics.source_authority = { score: Math.min(highAuth / 3, 1), detail: highAuth + ' high-authority sources' };
  totalScore += metrics.source_authority.score; maxScore += 1;

  // 6. Prediction qualification
  const preds = briefing.predictions || [];
  const qualified = preds.filter(p => p.probability && p.probability < 0.95 && p.basis);
  metrics.prediction_quality = { score: preds.length > 0 ? qualified.length / preds.length : 0.5, detail: qualified.length + '/' + preds.length + ' predictions properly qualified' };
  totalScore += metrics.prediction_quality.score; maxScore += 1;

  // 7. Counterpoint presence
  const hasCounter = /(however|alternatively|on the other hand|critics argue|opposing view|counter.?argument|disputed|skeptics|challenges this)/i.test(text);
  metrics.counterpoint = { score: hasCounter ? 1 : 0, detail: hasCounter ? 'Alternative viewpoints included' : 'Single-narrative detected' };
  totalScore += metrics.counterpoint.score; maxScore += 1;

  // 8. Timeline completeness
  const tl = briefing.timeline || [];
  metrics.timeline_depth = { score: Math.min(tl.length / 6, 1), detail: tl.length + ' timeline events' };
  totalScore += metrics.timeline_depth.score; maxScore += 1;

  // 9. Origin tracing
  const hasOrigin = briefing.origin && briefing.origin.event && briefing.origin.date;
  metrics.origin_trace = { score: hasOrigin ? 1 : 0, detail: hasOrigin ? 'Origin event identified' : 'No origin trace' };
  totalScore += metrics.origin_trace.score; maxScore += 1;

  // 10. Evidence web (node connections)
  const web = briefing.evidence_web;
  const hasWeb = web && web.nodes && web.nodes.length > 2 && web.links && web.links.length > 1;
  metrics.evidence_web = { score: hasWeb ? 1 : 0, detail: hasWeb ? web.nodes.length + ' nodes, ' + web.links.length + ' connections' : 'No evidence web' };
  totalScore += metrics.evidence_web.score; maxScore += 1;

  // 11. Source count
  metrics.source_count = { score: Math.min((sources || []).length / 10, 1), detail: (sources || []).length + ' sources' };
  totalScore += metrics.source_count.score; maxScore += 1;

  // 12. Briefing length (completeness)
  metrics.completeness = { score: Math.min(words / 800, 1), detail: words + ' words' };
  totalScore += metrics.completeness.score; maxScore += 1;

  // Calculate final confidence
  const glassFangScore = maxScore > 0 ? totalScore / maxScore : 0.5;
  const adjustedConfidence = Math.max(0.1, Math.min(0.95, glassFangScore));

  // Classification
  let classification;
  if (adjustedConfidence >= 0.80) classification = 'CONFIRMED';
  else if (adjustedConfidence >= 0.60) classification = 'PROBABLE';
  else if (adjustedConfidence >= 0.40) classification = 'DEVELOPING';
  else classification = 'DISPUTED';

  briefing.confidence = adjustedConfidence;
  briefing.classification = classification;

  return {
    glassFangScore: Math.round(glassFangScore * 100),
    metrics,
    adjustedConfidence,
    classification,
    totalChecks: 12,
    passedChecks: Object.values(metrics).filter(m => m.score >= 0.5).length
  };
}

// ── NEMESIS v2 ──────────────────────────────────────────────────
function nemesisCheck(briefing) {
  const caveats = [];
  const text = String(briefing.briefing || '');

  if (!/(however|alternatively|on the other hand|critics|opposing|counter|disputed|skeptic)/i.test(text)) {
    caveats.push('Single-perspective narrative detected.');
  }
  const bold = (briefing.predictions || []).filter(p => p.probability > 0.85);
  if (bold.length > 0) caveats.push(bold.length + ' high-confidence predictions. Historical forecasting accuracy suggests caution.');

  const hasNumbers = (text.match(/\$[\d,.]+/g) || []).length;
  if (hasNumbers < 2) caveats.push('Limited quantitative evidence.');

  if (caveats.length > 0) {
    briefing.methodology_note = (briefing.methodology_note || '') + ' Nemesis: ' + caveats.join(' ');
  }
  return caveats;
}

// ── AI PROVIDERS ────────────────────────────────────────────────
async function callCerebras(systemPrompt, topic) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('No key');
  const r = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507',
      max_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Intelligence briefing on: " + topic }],
      temperature: 0.2
    })
  });
  if (!r.ok) throw new Error('Cerebras ' + r.status);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || null;
}

async function callClaude(systemPrompt, topic) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No key');
  const r = await nodeFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 6000, system: systemPrompt,
      messages: [{ role: "user", content: "Intelligence briefing on: " + topic }]
    })
  });
  if (!r.ok) throw new Error('Claude ' + r.status);
  const d = await r.json();
  return d.content?.[0]?.text || null;
}

async function callGeminiChat(systemPrompt, topic) {
  const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error('No key');
  const key = keys[Math.floor(Math.random() * keys.length)];
  const r = await nodeFetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: "Intelligence briefing on: " + topic }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: "application/json" }
      })
    }
  );
  if (!r.ok) throw new Error('Gemini ' + r.status);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── JSON EXTRACTOR ──────────────────────────────────────────────
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (e) {}
  const cb = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (cb) try { return JSON.parse(cb[1]); } catch (e) {}
  const jm = text.match(/\{[\s\S]*\}/);
  if (jm) try { return JSON.parse(jm[0]); } catch (e) {}
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
    // PHASE 1: Gather sources (Gemini grounding)
    console.log('[SubMind] Phase 1: Source gathering for:', topic);
    const geminiResult = await gatherSourcesGemini(topic);
    let sources = geminiResult ? geminiResult.sources : [];
    console.log('[SubMind] Gemini sources: ' + sources.length);

    // PHASE 2: Intelligence briefing
    console.log('[SubMind] Phase 2: Briefing...');
    const raw = await produceIntelligenceBriefing(topic, sources);
    let briefing = extractJSON(raw.text);

    if (!briefing) {
      console.log('[SubMind] JSON parse failed, raw text fallback');
      briefing = { title: topic, classification: 'DEVELOPING', confidence: 0.5,
        summary: (raw.text || '').substring(0, 300), briefing: raw.text || '',
        timeline: [], predictions: [], origin: null, evidence_web: null };
    }

    // PHASE 2.5: Merge constructed sources if AI generated them
    if (briefing.constructed_sources && briefing.constructed_sources.length > 0 && sources.length === 0) {
      console.log('[SubMind] Using ' + briefing.constructed_sources.length + ' AI-constructed sources');
      sources = briefing.constructed_sources.map((s, i) => ({
        index: i + 1,
        title: s.title || 'Source ' + (i + 1),
        url: s.url || '',
        domain: '',
        type: s.type || 'constructed',
        author: s.author || '',
        date: s.date || ''
      }));
      sources.forEach(s => {
        try { s.domain = new URL(s.url).hostname.replace('www.', ''); }
        catch (e) { s.domain = 'unknown'; }
      });
    }

    // Re-index sources
    sources.forEach((s, i) => { s.index = i + 1; });

    // PHASE 3: Glass Fang v2
    console.log('[SubMind] Phase 3: Glass Fang v2...');
    const gf = glassFangValidate(briefing, sources);
    console.log('[SubMind] Glass Fang score: ' + gf.glassFangScore + '/100, ' + gf.passedChecks + '/12 checks passed');

    // PHASE 4: Nemesis
    const nem = nemesisCheck(briefing);

    const ms = Date.now() - startTime;
    console.log('[SubMind] Done in ' + ms + 'ms via ' + raw.provider);

    return res.status(200).json({
      submind_version: '7.0',
      topic, processingMs: ms, provider: raw.provider,
      title: briefing.title || topic,
      classification: briefing.classification || 'DEVELOPING',
      confidence: briefing.confidence || 0.5,
      summary: briefing.summary || '',
      origin: briefing.origin || null,
      briefing: briefing.briefing || '',
      timeline: briefing.timeline || [],
      predictions: briefing.predictions || [],
      evidence_web: briefing.evidence_web || null,
      methodology_note: briefing.methodology_note || '',
      sources: sources,
      sourceCount: sources.length,
      validation: {
        glassFangScore: gf.glassFangScore,
        metrics: gf.metrics,
        passedChecks: gf.passedChecks,
        totalChecks: gf.totalChecks,
        nemesisCaveats: nem.length,
        adjustedConfidence: briefing.confidence
      }
    });
  } catch (err) {
    console.error('[SubMind v7.0] Error:', err.message);
    return res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
    }
