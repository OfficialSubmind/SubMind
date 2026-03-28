import nodeFetch from "node-fetch";

// SUBMIND v8.1 - DEEP INTELLIGENCE RESEARCH ENGINE
// Parallel multi-provider sources + Glass Fang + Nemesis

const GEMINI_KEYS = (() => {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) keys.push(...process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean));
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  return [...new Set(keys)];
})();
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507';
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch(e) {}
  // Match code fences with backticks
  const fenceRe = /\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/;
  const cm = text.match(fenceRe);
  if (cm) { try { return JSON.parse(cm[1]); } catch(e) {} }
  // Find first balanced { } block
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (text[i] === '}') { depth--; if (depth === 0 && start !== -1) {
      try { return JSON.parse(text.substring(start, i + 1)); } catch(e) { start = -1; }
    }}
  }
  return null;
}

async function geminiGroundedSearch(topic) {
  const keys = shuffle(GEMINI_KEYS);
  for (const key of keys) {
    try {
      const resp = await nodeFetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Comprehensive factual summary with sources, URLs, dates, names for: ' + topic }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
          }),
          signal: AbortSignal.timeout(15000)
        }
      );
      if (!resp.ok) { console.log('[Gemini] Key ' + key.substring(0,8) + '... HTTP ' + resp.status); continue; }
      const data = await resp.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      let text = parts.map(p => p.text || '').join('\n');
      const grounding = data.candidates?.[0]?.groundingMetadata;
      const sources = [];
      if (grounding?.groundingChunks) {
        grounding.groundingChunks.forEach(chunk => {
          if (chunk.web?.uri) {
            sources.push({ url: chunk.web.uri, title: chunk.web.title || '', domain: new URL(chunk.web.uri).hostname.replace('www.','') });
          }
        });
      }
      console.log('[Gemini] OK: ' + text.length + 'ch, ' + sources.length + ' grounded sources');
      return { text, sources, provider: 'gemini-grounded' };
    } catch (err) { console.log('[Gemini] err: ' + err.message); }
  }
  return null;
}

async function openaiEnrichedContext(topic) {
  if (!OPENAI_KEY) return null;
  try {
    // Use chat completions to generate enriched source context
    const resp = await nodeFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are a research assistant. Provide specific factual information with real source URLs, exact dates (YYYY-MM-DD format), named entities, and organizations. Be as specific and detailed as possible.'
        }, {
          role: 'user',
          content: 'Research context for: ' + topic + '\n\nProvide: key events with dates, organizations involved, relevant statistics, and real source URLs from government (.gov), news (reuters, bloomberg, ap), and academic sources.'
        }],
        temperature: 0.1,
        max_tokens: 3000
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!resp.ok) { console.log('[OpenAI] Context HTTP ' + resp.status); return null; }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log('[OpenAI] Context OK: ' + text.length + 'ch');
    return { text, sources: [], provider: 'openai-context' };
  } catch (err) { console.log('[OpenAI] Context err: ' + err.message); return null; }
}

async function produceIntelligenceBriefing(topic, sourceContext) {
  const providers = [];
  if (CEREBRAS_KEY) providers.push({ name: 'cerebras', key: CEREBRAS_KEY });
  if (OPENAI_KEY) providers.push({ name: 'openai', key: OPENAI_KEY });

  const systemPrompt = `You are SubMind v8.1, a deep intelligence research engine. NOT a chatbot. Produce structured intelligence briefings with investment-grade rigor.

REQUIREMENTS:
- Every claim must cite [N]. Use ALL dates in YYYY-MM-DD format.
- Every entity fully named (organization, person, city).
- Predictions: probability, timeframe (YYYY-MM-DD to YYYY-MM-DD), basis, investment_relevance.
- Trace to EARLIEST origin event with YYYY-MM-DD date.
- Show source cross-referencing in evidence_web links.

SOURCE CONTEXT:
${sourceContext}

Return ONLY valid JSON:
{
  "title": "Analytical headline",
  "classification": "CONFIRMED|PROBABLE|DEVELOPING|DISPUTED",
  "confidence": 0.0-1.0,
  "summary": "Executive summary",
  "origin": {"event":"Earliest origin","date":"YYYY-MM-DD","location":"City, Country","significance":"Why it matters"},
  "briefing": "500-800 word briefing. MUST use YYYY-MM-DD dates throughout. Use [N] citations. Include dollar amounts and percentages. Separate paragraphs with double newlines.",
  "timeline": [{"date":"YYYY-MM-DD","event":"Description"}],
  "predictions": [{"scenario":"What","probability":0.0-1.0,"timeframe":"YYYY-MM-DD to YYYY-MM-DD","basis":"Evidence","investment_relevance":"Impact"}],
  "sources": [{"index":1,"title":"Title","url":"https://real-url","domain":"domain.com","author":"Author","date":"YYYY-MM-DD","type":"filing|ruling|article|report|press_release"}],
  "evidence_web": {
    "nodes": [{"id":"unique","type":"origin|event|prediction|source","label":"Short label (max 30 chars)"}],
    "links": [{"source":"id","target":"id","relation":"caused|confirms|suggests|contradicts"}]
  }
}

CRITICAL: Use REAL authoritative URLs from sec.gov, uscourts.gov, congress.gov, reuters.com, bloomberg.com, apnews.com, bls.gov, treasury.gov, federalreserve.gov, imf.org, worldbank.org. Evidence web MUST have 8+ nodes and 7+ links.`;

  for (const provider of providers) {
    try {
      let resultText;
      if (provider.name === 'cerebras') {
        const resp = await nodeFetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.key },
          body: JSON.stringify({ model: CEREBRAS_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Intelligence briefing on: ' + topic }], temperature: 0.12, max_tokens: 8000 }),
          signal: AbortSignal.timeout(30000)
        });
        if (!resp.ok) { console.log('[Cerebras] HTTP ' + resp.status); continue; }
        const data = await resp.json();
        resultText = data.choices?.[0]?.message?.content || '';
      } else if (provider.name === 'openai') {
        const resp = await nodeFetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.key },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Intelligence briefing on: ' + topic }], temperature: 0.12, max_tokens: 8000 }),
          signal: AbortSignal.timeout(45000)
        });
        if (!resp.ok) { console.log('[OpenAI] Briefing HTTP ' + resp.status); continue; }
        const data = await resp.json();
        resultText = data.choices?.[0]?.message?.content || '';
      }
      console.log('[' + provider.name + '] Briefing: ' + resultText.length + 'ch');
      return { text: resultText, provider: provider.name };
    } catch (err) { console.log('[' + provider.name + '] err: ' + err.message); }
  }
  throw new Error('All providers failed');
}

function glassFangValidation(briefing) {
  const b = briefing.briefing || '';
  const sources = briefing.sources || [];
  const timeline = briefing.timeline || [];
  const predictions = briefing.predictions || [];
  const web = briefing.evidence_web || { nodes: [], links: [] };
  const metrics = {};
  let totalScore = 0, totalWeight = 0;

  const citations = (b.match(/\[\d+\]/g) || []).length;
  const words = b.split(/\s+/).length;
  metrics.citation_density = { score: Math.min(citations / Math.max(words / 40, 1), 1), detail: citations + ' citations in ' + words + ' words' };
  totalScore += metrics.citation_density.score * 10; totalWeight += 10;

  // Improved date detection: YYYY-MM-DD, YYYY-MM, Month YYYY, Q[1-4] YYYY
  const isoDate = (b.match(/\d{4}-\d{2}(-\d{2})?/g) || []).length;
  const writtenDate = (b.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi) || []).length;
  const quarterDate = (b.match(/Q[1-4]\s+\d{4}/gi) || []).length;
  const totalDates = isoDate + writtenDate + quarterDate;
  metrics.date_specificity = { score: Math.min(totalDates / 6, 1), detail: totalDates + ' specific dates found' };
  totalScore += metrics.date_specificity.score * 10; totalWeight += 10;

  const orgs = (b.match(/(?:SEC|FBI|DOJ|Fed(?:eral)?|Congress|Court|Commission|Board|Agency|Corporation|Inc\.|Corp\.|LLC|University|Institute|Reserve|Treasury|Bureau|Department|Association|Administration)/gi) || []).length;
  metrics.named_entities = { score: Math.min(orgs / 8, 1), detail: orgs + ' organizational references' };
  totalScore += metrics.named_entities.score * 8; totalWeight += 8;

  const dollars = (b.match(/\$[\d,.]+\s*(?:billion|million|trillion|B|M|T)?/gi) || []).length;
  const pcts = (b.match(/\d+\.?\d*\s*(?:%|percent|basis points|bps)/gi) || []).length;
  metrics.numeric_evidence = { score: Math.min((dollars + pcts) / 10, 1), detail: dollars + ' amounts, ' + pcts + ' percentages' };
  totalScore += metrics.numeric_evidence.score * 9; totalWeight += 9;

  const highAuth = sources.filter(s => /\.gov$|reuters|bloomberg|apnews|wsj|nytimes|ft\.com|economist|nature|science|arxiv|pubmed|imf\.org|worldbank|federalreserve/.test((s.domain || '').toLowerCase())).length;
  metrics.source_authority = { score: Math.min(highAuth / 3, 1), detail: highAuth + ' high-authority sources' };
  totalScore += metrics.source_authority.score * 12; totalWeight += 12;

  const qualPreds = predictions.filter(p => p.probability && p.timeframe && p.basis).length;
  metrics.prediction_quality = { score: predictions.length > 0 ? qualPreds / predictions.length : 0, detail: qualPreds + '/' + predictions.length + ' fully qualified' };
  totalScore += metrics.prediction_quality.score * 8; totalWeight += 8;

  const counter = (b.match(/however|although|despite|nevertheless|risk|caveat|challenge|criticism|debate|contrar|skeptic|concern|limitation|downside|obstacle|uncertainty|volatile/gi) || []).length;
  metrics.counterpoint = { score: Math.min(counter / 3, 1), detail: counter > 2 ? 'Multiple perspectives' : counter > 0 ? 'Limited counterpoint' : 'Single-narrative' };
  totalScore += metrics.counterpoint.score * 7; totalWeight += 7;

  metrics.timeline_depth = { score: Math.min(timeline.length / 5, 1), detail: timeline.length + ' events' };
  totalScore += metrics.timeline_depth.score * 7; totalWeight += 7;

  const hasOrigin = briefing.origin && briefing.origin.event && briefing.origin.date ? 1 : 0;
  metrics.origin_trace = { score: hasOrigin, detail: hasOrigin ? 'Origin identified' : 'No origin' };
  totalScore += hasOrigin * 9; totalWeight += 9;

  const nc = (web.nodes || []).length, lc = (web.links || []).length;
  metrics.evidence_web = { score: Math.min((nc + lc) / 14, 1), detail: nc + ' nodes, ' + lc + ' connections' };
  totalScore += metrics.evidence_web.score * 8; totalWeight += 8;

  metrics.source_count = { score: Math.min(sources.length / 5, 1), detail: sources.length + ' sources' };
  totalScore += metrics.source_count.score * 6; totalWeight += 6;

  metrics.completeness = { score: Math.min(words / 400, 1), detail: words + ' words' };
  totalScore += metrics.completeness.score * 6; totalWeight += 6;

  return { glassFangScore: Math.round((totalScore / totalWeight) * 100), metrics, passedChecks: Object.values(metrics).filter(m => m.score >= 0.5).length, totalChecks: 12, highAuthoritySources: highAuth };
}

function nemesisChallenge(briefing, validation) {
  const issues = [];
  if (validation.metrics.counterpoint.score < 0.3) issues.push('Single-perspective narrative. Confidence reduced.');
  if (validation.metrics.source_authority.score < 0.5) issues.push('Insufficient high-authority sources.');
  if (validation.metrics.date_specificity.score < 0.4) issues.push('Vague temporal claims.');
  if ((briefing.sources || []).length < 3) issues.push('Below minimum source threshold.');
  if (validation.metrics.evidence_web.score < 0.4) issues.push('Evidence web too sparse.');
  let confAdj = -issues.length * 0.03;
  if (validation.glassFangScore < 50) confAdj -= 0.1;
  if (validation.glassFangScore > 80) confAdj += 0.05;
  return { issues, confidenceAdjustment: confAdj };
}

function mergeSources(aiSources, groundedSources) {
  const seen = new Set();
  const merged = [];
  for (const s of groundedSources) {
    const key = (s.url || '').replace(/\/$/, '').toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); merged.push(s); }
  }
  for (const s of aiSources) {
    const key = (s.url || '').replace(/\/$/, '').toLowerCase();
    if (key && seen.has(key)) continue;
    const domDup = merged.some(m => (m.domain || '') === (s.domain || '') && (m.title || '').substring(0, 30) === (s.title || '').substring(0, 30));
    if (domDup) continue;
    seen.add(key); merged.push(s);
  }
  return merged.map((s, i) => ({ ...s, index: i + 1 }));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const startTime = Date.now();
  const { topic } = req.body || {};
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) return res.status(400).json({ error: 'Topic required' });

  console.log('\n======== SubMind v8.1 ========');
  console.log('Query: ' + topic.substring(0, 100));

  try {
    // PHASE 1: Parallel source gathering (Gemini grounded + OpenAI context enrichment)
    console.log('[Phase 1] Parallel source search...');
    const [geminiResult, openaiResult] = await Promise.all([
      geminiGroundedSearch(topic).catch(e => { console.log('[Gemini] Fail: ' + e.message); return null; }),
      openaiEnrichedContext(topic).catch(e => { console.log('[OpenAI] Fail: ' + e.message); return null; })
    ]);

    let groundedSources = [];
    let sourceContext = '';
    for (const r of [geminiResult, openaiResult]) {
      if (r) {
        sourceContext += '\n--- ' + r.provider + ' ---\n' + r.text + '\n';
        if (r.sources) groundedSources.push(...r.sources);
      }
    }
    const seenUrls = new Set();
    groundedSources = groundedSources.filter(s => { const k = (s.url || '').toLowerCase(); if (seenUrls.has(k)) return false; seenUrls.add(k); return true; });
    console.log('[Phase 1] ' + groundedSources.length + ' grounded, ' + sourceContext.length + 'ch context');

    // PHASE 2: Intelligence briefing
    console.log('[Phase 2] Briefing...');
    const briefingResult = await produceIntelligenceBriefing(topic, sourceContext || 'No web sources available. Use authoritative training data.');
    const parsed = extractJSON(briefingResult.text);
    if (!parsed) throw new Error('Unparseable response');
    console.log('[Phase 2] ' + (parsed.title || 'untitled').substring(0, 60));

    // PHASE 3: Source merge
    const aiSources = (parsed.sources || []).map((s, i) => ({ ...s, index: i + 1 }));
    const finalSources = mergeSources(aiSources, groundedSources.map((s, i) => ({ ...s, index: i + 1, type: s.type || 'article', author: s.author || s.domain })));
    console.log('[Phase 3] ' + finalSources.length + ' sources');

    // PHASE 4: Glass Fang
    const fullBriefing = { ...parsed, sources: finalSources };
    const validation = glassFangValidation(fullBriefing);
    console.log('[Phase 4] GF: ' + validation.glassFangScore + '/100');

    // PHASE 5: Nemesis
    const nemesis = nemesisChallenge(fullBriefing, validation);
    const adjConf = Math.max(0.1, Math.min(0.99, (parsed.confidence || 0.5) + nemesis.confidenceAdjustment));
    console.log('[Phase 5] Nemesis: ' + nemesis.issues.length + ' issues');

    const processingMs = Date.now() - startTime;
    console.log('[Done] ' + processingMs + 'ms');

    const methParts = [];
    if (validation.highAuthoritySources > 0) methParts.push(validation.highAuthoritySources + ' high-authority sources validated.');
    if (groundedSources.length > 0) methParts.push(groundedSources.length + ' web-verified sources.');
    if (nemesis.issues.length > 0) methParts.push('Nemesis: ' + nemesis.issues[0]);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      topic, title: parsed.title || topic,
      classification: parsed.classification || 'DEVELOPING',
      confidence: adjConf, summary: parsed.summary || '',
      origin: parsed.origin || null, briefing: parsed.briefing || '',
      timeline: parsed.timeline || [], predictions: parsed.predictions || [],
      sources: finalSources, sourceCount: finalSources.length,
      evidence_web: parsed.evidence_web || { nodes: [], links: [] },
      validation,
      provider: briefingResult.provider + (groundedSources.length > 0 ? ' + web-grounded' : '') + (sourceContext.length > 100 ? ' + enriched' : ''),
      processingMs,
      methodology_note: methParts.join(' ') || 'Analysis based on available intelligence sources.'
    });
  } catch (err) {
    console.error('[FATAL] ' + err.message);
    return res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
}
