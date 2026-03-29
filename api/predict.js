import nodeFetch from "node-fetch";

import { createClient } from "@supabase/supabase-js";

// SUBMIND v11.0 - DEEP INTELLIGENCE RESEARCH ENGINE
// Supabase persistence + Upstash Redis caching + Full pipeline
// Behavioral Divergence + Source Provenance + Semantic Clustering
// Dark Matter Engine + Glass Fang + Nemesis + URL Verification

// ===== SUPABASE CLIENT =====
function makeSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ===== UPSTASH REDIS CACHE =====
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CACHE_TTL = 3600;

async function redisGet(key) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await nodeFetch(REDIS_URL + '/get/' + encodeURIComponent(key), {
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch(e) { return null; }
}

async function redisSet(key, value, ttl) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    await nodeFetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, JSON.stringify(value), 'EX', ttl || CACHE_TTL])
    });
  } catch(e) {}
}

async function savePrediction(supabase, query, responseData) {
  if (!supabase) return null;
  try {
    const b = responseData.briefing || {};
    const gf = responseData.validation?.glass_fang || {};
    const nem = responseData.validation?.nemesis || {};
    const intel = responseData.intelligence || {};
    const meta = responseData.meta || {};
    const row = {
      query,
      briefing: b,
      glass_fang_score: gf.score || 0,
      nemesis_severity: nem.severity || 'UNKNOWN',
      divergence_level: intel.behavioral_divergence?.divergence_level || 'BASELINE',
      source_count: meta.providers?.source_count || 0,
      verified_source_count: meta.source_verification?.verified || 0,
      provenance_summary: intel.provenance_summary || {},
      version: meta.version || '11.0',
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('predictions').insert(row).select('id').single();
    if (error) { console.error('[Supabase] Save error:', error.message); return null; }
    return data?.id || null;
  } catch(e) { console.error('[Supabase] Save failed:', e.message); return null; }
}

async function saveSearchHistory(supabase, query, predictionId) {
  if (!supabase) return;
  try {
    await supabase.from('search_history').insert({
      query, prediction_id: predictionId || null, created_at: new Date().toISOString()
    });
  } catch(e) { console.error('[Supabase] History failed:', e.message); }
}
const GEMINI_KEYS = (() => {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) keys.push(...process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean));
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  return [...new Set(keys)];
})();

const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "llama-4-scout-17b-16e-instruct";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ===== SOURCE PROVENANCE CLASSIFICATION =====
const PROVENANCE_TIERS = {
  TIER_1: { label: 'Primary Document', weight: 1.0, domains: ['.gov', 'sec.gov', 'congress.gov', 'whitehouse.gov', 'federalregister.gov', 'courtlistener.com', 'pacer.gov', 'patents.google.com', 'arxiv.org'] },
  TIER_2: { label: 'Official Source', weight: 0.9, domains: ['reuters.com', 'apnews.com', 'bbc.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'nature.com', 'science.org', 'ieee.org'] },
  TIER_3: { label: 'Reputable Analysis', weight: 0.75, domains: ['cnbc.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'economist.com', 'foreignaffairs.com', 'brookings.edu', 'rand.org'] },
  TIER_4: { label: 'Industry/Trade', weight: 0.6, domains: ['techcrunch.com', 'arstechnica.com', 'theverge.com', 'wired.com', 'politico.com', 'axios.com', 'semfor.com'] },
  TIER_5: { label: 'Secondary/Opinion', weight: 0.4, domains: [] }
};

function classifySourceProvenance(url) {
  if (!url) return { tier: 'TIER_5', ...PROVENANCE_TIERS.TIER_5 };
  const hostname = (() => { try { return new URL(url).hostname.toLowerCase(); } catch(e) { return url.toLowerCase(); } })();
  for (const [tierKey, tierData] of Object.entries(PROVENANCE_TIERS)) {
    for (const domain of tierData.domains) {
      if (hostname.includes(domain.replace(/^\./, ''))) return { tier: tierKey, ...tierData };
    }
  }
  // Check for .gov, .edu, .mil domains
  if (hostname.endsWith('.gov') || hostname.endsWith('.mil')) return { tier: 'TIER_1', ...PROVENANCE_TIERS.TIER_1 };
  if (hostname.endsWith('.edu')) return { tier: 'TIER_3', ...PROVENANCE_TIERS.TIER_3 };
  if (hostname.endsWith('.org')) return { tier: 'TIER_3', ...PROVENANCE_TIERS.TIER_3 };
  return { tier: 'TIER_5', ...PROVENANCE_TIERS.TIER_5 };
}

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch(e) {}
  const patterns = [/```json\s*([\s\S]*?)```/, /```\s*([\s\S]*?)```/, /\{[\s\S]*\}/];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { try { return JSON.parse(m[1] || m[0]); } catch(e) {} }
  }
  return null;
}

// ===== URL VERIFICATION SYSTEM =====
async function verifyUrl(url, timeoutMs = 4000) {
  if (!url || typeof url !== 'string') return { valid: false, status: 0 };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await nodeFetch(url, {
      method: 'HEAD', signal: controller.signal, redirect: 'follow',
      headers: { 'User-Agent': 'SubMind/11.0 LinkVerifier' }
    });
    clearTimeout(timer);
    return { valid: res.status >= 200 && res.status < 400, status: res.status };
  } catch(e) {
    try {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 3000);
      const res2 = await nodeFetch(url, {
        method: 'GET', signal: controller2.signal, redirect: 'follow',
        headers: { 'User-Agent': 'SubMind/11.0 LinkVerifier', 'Range': 'bytes=0-0' }
      });
      clearTimeout(timer2);
      return { valid: res2.status >= 200 && res2.status < 400, status: res2.status };
    } catch(e2) { return { valid: false, status: 0 }; }
  }
}

function buildSearchFallback(source) {
  const title = (source.title || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const domain = (() => { try { return new URL(source.url).hostname; } catch(e) { return ''; } })();
  const q = domain ? `site:${domain} ${title}` : title;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

async function verifyAndFixSources(sources) {
  if (!sources || !sources.length) return { sources: [], stats: { total: 0, verified: 0, fixed: 0, failed: 0 } };
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      if (!src.url || src.url.includes('google.com/search')) {
        return { ...src, verified: false, link_type: 'search' };
      }
      const check = await verifyUrl(src.url);
      if (check.valid) {
        return { ...src, verified: true, link_type: 'direct', http_status: check.status };
      }
      const fallbackUrl = buildSearchFallback(src);
      return { ...src, original_url: src.url, url: fallbackUrl, verified: false, link_type: 'search', http_status: check.status, fallback_reason: `Original URL returned ${check.status || 'unreachable'}` };
    })
  );
  const verified = [];
  let verifiedCount = 0, fixedCount = 0, failedCount = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const s = r.value;
      if (s.verified) verifiedCount++;
      else if (s.original_url) fixedCount++;
      else failedCount++;
      verified.push(s);
    }
  }
  return { sources: verified, stats: { total: verified.length, verified: verifiedCount, fixed: fixedCount, failed: failedCount } };
}

// ===== SOURCE GATHERING: GEMINI GROUNDED SEARCH =====
async function geminiGroundedSearch(query) {
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    try {
      const res = await nodeFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEYS[i]}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Research this topic with comprehensive sources. Find verified, real URLs from major news outlets (reuters.com, apnews.com, bbc.com, cnbc.com, nytimes.com, bloomberg.com, wsj.com), government sites (.gov), academic sources, and official company pages. Topic: ${query}` }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.2 }
          })
        }
      );
      if (!res.ok) { if (res.status === 429) continue; continue; }
      const data = await res.json();
      const sources = [];
      const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || 'Grounded Source',
            url: chunk.web.uri,
            type: 'grounded_search',
            provider: 'gemini',
            verified_by_search: true
          });
        }
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { sources, context: text, provider: 'gemini' };
    } catch(e) { continue; }
  }
  return { sources: [], context: '', provider: 'gemini' };
}

// ===== SOURCE GATHERING: OPENAI CONTEXT =====
async function openaiEnrichedContext(query) {
  if (!OPENAI_KEY) return { context: '', sources: [], provider: 'openai' };
  try {
    const res = await nodeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Research this topic and provide key facts with REAL source URLs from major outlets (reuters.com, apnews.com, bbc.com, cnbc.com, nytimes.com). Provide 5 verified facts with URLs. Topic: ${query}` }],
        temperature: 0.2,
        max_tokens: 1500
      })
    });
    if (!res.ok) return { context: '', sources: [], provider: 'openai' };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const urlMatches = text.match(/https?:\/\/[^\s\)\]"'<>]+/g) || [];
    const sources = urlMatches.map(url => ({
      title: 'OpenAI Referenced Source',
      url: url.replace(/[.,;:]+$/, ''),
      type: 'ai_referenced',
      provider: 'openai'
    }));
    return { context: text, sources, provider: 'openai' };
  } catch(e) { return { context: '', sources: [], provider: 'openai' }; }
}

// ===== BEHAVIORAL DIVERGENCE DETECTION ENGINE =====
// Identifies gaps between "what mainstream says" vs "what raw data shows"
function detectBehavioralDivergence(briefing) {
  const divergences = [];
  const findings = briefing?.key_findings || [];
  const predictions = briefing?.predictions || [];
  const patterns = briefing?.pattern_analysis || {};

  // Check for high-confidence predictions that contradict consensus status
  if (briefing?.status === 'DISPUTED' && briefing?.confidence > 75) {
    divergences.push({
      type: 'consensus_confidence_gap',
      signal: 'High analytical confidence despite disputed public status',
      severity: 'HIGH',
      detail: `SubMind confidence (${briefing.confidence}%) diverges from disputed consensus`,
      implication: 'Raw data supports a stronger position than public narrative suggests'
    });
  }

  // Check for pattern convergence pointing opposite to consensus
  const convergencePoints = patterns.convergence_points || [];
  const currentSignals = patterns.current_signals || [];
  if (convergencePoints.length >= 3 && currentSignals.length >= 2) {
    divergences.push({
      type: 'pattern_convergence_anomaly',
      signal: 'Multiple independent data streams converging',
      severity: 'MEDIUM',
      detail: `${convergencePoints.length} convergence points detected with ${currentSignals.length} active signals`,
      implication: 'Pattern density suggests imminent shift not yet reflected in mainstream coverage'
    });
  }

  // Check for HIGH impact findings with low media coverage indicators
  const highImpact = findings.filter(f => f.impact === 'HIGH');
  if (highImpact.length >= 2) {
    divergences.push({
      type: 'underreported_high_impact',
      signal: 'Multiple high-impact findings detected',
      severity: 'HIGH',
      detail: `${highImpact.length} high-impact findings identified that may be underrepresented in mainstream analysis`,
      implication: 'Market or public may not be fully pricing in these developments'
    });
  }

  // Prediction clustering - when multiple predictions point same direction
  const bullish = predictions.filter(p => p.probability > 70);
  const bearish = predictions.filter(p => p.probability < 30);
  if (bullish.length >= 3 || bearish.length >= 3) {
    const direction = bullish.length >= 3 ? 'positive' : 'negative';
    divergences.push({
      type: 'prediction_cluster',
      signal: `Strong ${direction} prediction clustering detected`,
      severity: 'HIGH',
      detail: `${Math.max(bullish.length, bearish.length)} predictions align in ${direction} direction`,
      implication: `Concentrated ${direction} signal suggests strong directional conviction`
    });
  }

  return {
    divergences,
    divergence_count: divergences.length,
    divergence_level: divergences.filter(d => d.severity === 'HIGH').length >= 2 ? 'CRITICAL' :
                      divergences.length >= 2 ? 'ELEVATED' : divergences.length >= 1 ? 'MODERATE' : 'BASELINE',
    dark_matter_score: Math.min(100, divergences.length * 20 + divergences.filter(d => d.severity === 'HIGH').length * 15)
  };
}

// ===== SEMANTIC CLUSTERING ENGINE =====
// Groups sources by domain/topic similarity to find dense "neighborhoods"
function semanticClusterSources(sources) {
  const clusters = {};
  
  for (const src of sources) {
    const hostname = (() => { try { return new URL(src.url || '').hostname.replace('www.', ''); } catch(e) { return 'unknown'; } })();
    
    // Cluster by domain first
    if (!clusters[hostname]) {
      clusters[hostname] = { domain: hostname, sources: [], count: 0 };
    }
    clusters[hostname].sources.push(src);
    clusters[hostname].count++;
  }

  const clusterArray = Object.values(clusters);
  
  // Calculate domain diversity
  const totalDomains = clusterArray.length;
  const maxClusterSize = Math.max(...clusterArray.map(c => c.count), 0);
  const diversity = totalDomains > 0 ? (totalDomains / sources.length) : 0;
  
  // Flag over-reliance on single domain
  const dominantSources = clusterArray.filter(c => c.count > 2);
  const warnings = [];
  if (dominantSources.length > 0) {
    for (const d of dominantSources) {
      warnings.push(`Over-representation from ${d.domain} (${d.count} sources) - may indicate echo chamber`);
    }
  }
  
  // Calculate cluster health
  const clusterHealth = diversity > 0.5 ? 'DIVERSE' : diversity > 0.3 ? 'MODERATE' : 'CONCENTRATED';

  return {
    clusters: clusterArray.map(c => ({ domain: c.domain, count: c.count, sources: c.sources.map(s => s.title) })),
    total_clusters: totalDomains,
    diversity_ratio: Math.round(diversity * 100) / 100,
    cluster_health: clusterHealth,
    warnings,
    dominant_domains: dominantSources.map(d => d.domain)
  };
}

// ===== INTELLIGENCE BRIEFING GENERATION =====
async function generateBriefing(query, sourceContext) {
  const providers = [
    {
      name: 'cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CEREBRAS_KEY}` },
      body: {
        model: CEREBRAS_MODEL,
        messages: [{
          role: "system",
          content: `You are SubMind v11.0, a deep intelligence research engine that produces institutional-grade analysis. You hunt for Behavioral Divergence - the gap between what mainstream sources say and what raw data actually shows. You trace events from origin to present to future predictions with ruthless precision.

CRITICAL RULES FOR SOURCES:
- ONLY cite URLs you are CERTAIN exist and are real
- Use ONLY these known-working URL patterns:
  * reuters.com/[category]/[slug]-YYYY-MM-DD/
  * apnews.com/article/[slug]-[hex]
  * bbc.com/news/[category]-[number]
  * cnbc.com/YYYY/MM/DD/[slug].html
  * nytimes.com/YYYY/MM/DD/[section]/[slug].html
  * bloomberg.com/news/articles/YYYY-MM-DD/[slug]
  * Official .gov domains for government sources
  * Official company investor relations / press release pages
- If you are NOT 100% certain a specific URL exists, use the general domain (e.g., reuters.com) with a descriptive title
- NEVER fabricate URL paths

FORMAT: Return valid JSON with this structure:
{
  "title": "Intelligence Briefing Title",
  "summary": "2-3 sentence executive summary highlighting the most critical finding",
  "status": "CONFIRMED|DEVELOPING|PROJECTED|DISPUTED",
  "confidence": 85,
  "behavioral_divergence": {
    "mainstream_narrative": "What most media/public believes",
    "raw_data_reality": "What the actual data shows",
    "divergence_gap": "Where the gap exists and why it matters",
    "alpha_signal": "The actionable insight from this divergence"
  },
  "timeline": [
    { "date": "YYYY-MM-DD", "event": "What happened", "significance": "Why it matters", "sources": ["url1"] }
  ],
  "key_findings": [
    { "finding": "Specific finding with names, dates, numbers", "evidence": "Supporting evidence", "sources": ["url1"], "impact": "HIGH|MEDIUM|LOW" }
  ],
  "predictions": [
    { "prediction": "What SubMind projects will happen", "probability": 75, "timeframe": "Q3 2025", "basis": "Pattern recognition basis", "indicators": ["What to watch for"], "confidence_interval": "plus or minus 5%" }
  ],
  "pattern_analysis": {
    "historical_patterns": ["Past patterns identified"],
    "current_signals": ["Current indicators"],
    "convergence_points": ["Where patterns intersect"]
  },
  "reasoning_chain": [
    { "step": 1, "thought": "SubMind analytical reasoning step", "evidence": "What data supports this", "conclusion": "What this means" }
  ],
  "investment_relevance": {
    "sectors_affected": ["sector1"],
    "risk_level": "HIGH|MEDIUM|LOW",
    "opportunity_window": "timeframe",
    "key_metrics": ["metric1"]
  },
  "sources": [
    { "title": "Descriptive Source Title", "url": "https://exact-verified-url", "type": "primary|supporting|official|data", "date": "YYYY-MM-DD", "credibility": "HIGH|MEDIUM",
              "snippet": "Key quote or data point from this source",
              "relevance": "Why this source matters for the analysis" }
  ],
  "related_queries": ["Follow-up topic 1", "Deeper dive topic 2", "Adjacent macro trend 3"],
  "executive_actions": [
    { "action": "What to do based on this intelligence", "urgency": "HIGH|MEDIUM|LOW", "rationale": "Why this matters now" }
  ],
  "risk_matrix": {
    "primary_risk": "The biggest risk identified",
    "risk_probability": 60,
    "mitigation": "How to mitigate",
    "upside_scenario": "Best case outcome",
    "downside_scenario": "Worst case outcome"
  },
  "methodology_note": "How SubMind reached these conclusions"
}`
        }, {
          role: "user",
          content: `Produce a comprehensive intelligence briefing on: ${query}

Available research context:
${sourceContext.substring(0, 6000)}

Requirements:
1. Trace the ORIGIN - how this topic came to be, the foundational events
2. Map the PRESENT state with specific data: names, dates (YYYY-MM-DD), dollar amounts, percentages
3. Project the FUTURE using pattern recognition - what historical trends suggest
4. Include AT LEAST 12 sources with REAL, WORKING URLs from diverse domains
5. Include a BEHAVIORAL DIVERGENCE section: what mainstream says vs what raw data shows
6. Include a REASONING CHAIN of at least 4 steps showing analytical thinking with evidence
7. Include EXECUTIVE ACTIONS - what someone should DO based on this
8. Include a RISK MATRIX with primary risk, probability, mitigation, best/worst case
9. Include 3-5 RELATED QUERIES for deeper investigation
10. Make predictions with probability percentages, confidence intervals, and pattern basis
11. Pattern analysis showing historical precedents converging with current signals
12. Investment relevance with specific sectors, risk level, and opportunity windows`
        }],
        temperature: 0.3,
        max_tokens: 8000
      }
    }
  ];

  if (OPENAI_KEY) {
    providers.push({
      name: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: { model: 'gpt-4o-mini', messages: providers[0].body.messages, temperature: 0.3, max_tokens: 4000 }
    });
  }

  for (const provider of providers) {
    try {
      const res = await nodeFetch(provider.url, {
        method: 'POST', headers: provider.headers, body: JSON.stringify(provider.body)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const briefing = extractJSON(text);
      if (briefing && (briefing.title || briefing.summary)) {
        return { briefing, provider: provider.name, raw_length: text.length };
      }
    } catch(e) { continue; }
  }
  return { briefing: null, provider: 'none', raw_length: 0 };
}

// ===== GLASS FANG VALIDATION ENGINE v10 =====
function glassFangValidation(briefing, sources, verificationStats, clusterData, divergenceData) {
  const metrics = {};
  const s = briefing || {};

  // 1. Source Count & Quality
  const srcCount = (s.sources || []).length;
  metrics.source_depth = Math.min(100, srcCount * 10);

  // 2. Source Diversity (enhanced with cluster data)
  const domains = new Set((s.sources || []).map(src => { try { return new URL(src.url).hostname; } catch(e) { return src.url; } }));
  metrics.source_diversity = Math.min(100, domains.size * 15);

  // 3. Temporal Coverage
  const allDates = JSON.stringify(s).match(/\d{4}-\d{2}-\d{2}/g) || [];
  const writtenDates = JSON.stringify(s).match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi) || [];
  const quarterDates = JSON.stringify(s).match(/Q[1-4]\s+\d{4}/gi) || [];
  const totalDates = allDates.length + writtenDates.length + quarterDates.length;
  metrics.temporal_coverage = Math.min(100, totalDates * 8);

  // 4. Specificity Score
  const text = JSON.stringify(s);
  const numbers = text.match(/\$[\d,.]+[BMTbmt]?|\d+\.\d+%|\d{1,3}(?:,\d{3})+/g) || [];
  const properNouns = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)+/g) || [];
  metrics.specificity = Math.min(100, (numbers.length * 5) + (properNouns.length * 2));

  // 5. Prediction Quality
  const preds = s.predictions || [];
  const qualityPreds = preds.filter(p => p.probability && p.timeframe && p.basis);
  metrics.prediction_quality = preds.length ? Math.round((qualityPreds.length / preds.length) * 100) : 0;

  // 6. Evidence Chain
  const findings = s.key_findings || [];
  const evidenced = findings.filter(f => f.evidence && f.sources && f.sources.length);
  metrics.evidence_chain = findings.length ? Math.round((evidenced.length / findings.length) * 100) : 0;

  // 7. Cross-Reference Density
  const allUrls = (s.sources || []).map(src => src.url);
  const timelineUrls = (s.timeline || []).flatMap(t => t.sources || []);
  const findingUrls = (s.key_findings || []).flatMap(f => f.sources || []);
  const crossRefs = new Set([...timelineUrls, ...findingUrls].filter(u => allUrls.includes(u)));
  metrics.cross_reference = Math.min(100, crossRefs.size * 12);

  // 8. Pattern Analysis Depth
  const pa = s.pattern_analysis || {};
  const patternItems = (pa.historical_patterns || []).length + (pa.current_signals || []).length + (pa.convergence_points || []).length;
  metrics.pattern_depth = Math.min(100, patternItems * 12);

  // 9. Investment Relevance
  const ir = s.investment_relevance || {};
  const irScore = (ir.sectors_affected?.length ? 25 : 0) + (ir.risk_level ? 25 : 0) + (ir.opportunity_window ? 25 : 0) + (ir.key_metrics?.length ? 25 : 0);
  metrics.investment_relevance = irScore;

  // 10. Timeline Completeness
  metrics.timeline_depth = Math.min(100, (s.timeline || []).length * 15);

  // 11. Confidence Calibration
  const conf = s.confidence || 50;
  const hasStrong = srcCount >= 5 && findings.length >= 3;
  metrics.confidence_calibration = hasStrong ? Math.min(100, 60 + srcCount * 3) : Math.min(80, 40 + srcCount * 5);

  // 12. Source Verification Score
  if (verificationStats) {
    const vr = verificationStats.total > 0 ? (verificationStats.verified / verificationStats.total) * 100 : 0;
    metrics.source_verification = Math.round(vr);
  } else { metrics.source_verification = 0; }

  // 13. NEW: Provenance Score - weighted by source tier quality
  const provenanceScores = (sources || []).map(src => {
    const prov = classifySourceProvenance(src.url);
    return prov.weight;
  });
  metrics.provenance_quality = provenanceScores.length > 0 ?
    Math.round((provenanceScores.reduce((a, b) => a + b, 0) / provenanceScores.length) * 100) : 0;

  // 14. NEW: Cluster Health Score
  if (clusterData) {
    metrics.cluster_health = clusterData.cluster_health === 'DIVERSE' ? 100 :
                             clusterData.cluster_health === 'MODERATE' ? 60 : 30;
  } else { metrics.cluster_health = 50; }

  // 15. NEW: Reasoning Quality
  const reasoning = s.reasoning_chain || [];
  const evidencedReasoning = reasoning.filter(r => r.evidence && r.conclusion);
  metrics.reasoning_quality = reasoning.length > 0 ?
    Math.round((evidencedReasoning.length / reasoning.length) * 100) : 0;

  // 16. NEW: Behavioral Divergence Detection
  if (divergenceData) {
    metrics.divergence_detection = Math.min(100, divergenceData.dark_matter_score);
  } else { metrics.divergence_detection = 0; }

  // Weighted composite (16 metrics)
  const weights = {
    source_depth: 0.07, source_diversity: 0.06, temporal_coverage: 0.05,
    specificity: 0.07, prediction_quality: 0.08, evidence_chain: 0.09,
    cross_reference: 0.06, pattern_depth: 0.06, investment_relevance: 0.05,
    timeline_depth: 0.05, confidence_calibration: 0.05, source_verification: 0.06,
    provenance_quality: 0.07, cluster_health: 0.05, reasoning_quality: 0.07,
    divergence_detection: 0.06
  };

  let composite = 0;
  for (const [k, w] of Object.entries(weights)) { composite += (metrics[k] || 0) * w; }

  return { score: Math.round(composite), metrics, weights, metric_count: Object.keys(metrics).length };
}

// ===== NEMESIS ADVERSARIAL ENGINE v10 =====
function nemesisEngine(briefing) {
  const issues = [];
  const s = briefing || {};

  // Check for vague predictions
  for (const p of (s.predictions || [])) {
    if (!p.probability) issues.push({ type: 'weak_prediction', detail: 'Prediction missing probability: ' + (p.prediction || '').substring(0, 60) });
    if (!p.basis) issues.push({ type: 'unsubstantiated', detail: 'No basis for prediction: ' + (p.prediction || '').substring(0, 60) });
    if (!p.confidence_interval) issues.push({ type: 'missing_interval', detail: 'No confidence interval on prediction: ' + (p.prediction || '').substring(0, 40) });
  }

  // Check for unsourced claims
  for (const f of (s.key_findings || [])) {
    if (!f.sources || !f.sources.length) issues.push({ type: 'unsourced_claim', detail: 'Finding lacks sources: ' + (f.finding || '').substring(0, 60) });
  }

  // Check timeline gaps
  const timeline = s.timeline || [];
  if (timeline.length < 3) issues.push({ type: 'thin_timeline', detail: 'Timeline has fewer than 3 events' });

  // Overconfidence check
  if ((s.confidence || 0) > 90 && (s.sources || []).length < 5) {
    issues.push({ type: 'overconfident', detail: 'Confidence >90% but fewer than 5 sources' });
  }

  // Missing dates
  const undated = timeline.filter(t => !t.date || t.date === 'Unknown');
  if (undated.length) issues.push({ type: 'missing_dates', detail: undated.length + ' timeline events without dates' });

  // Reasoning chain quality
  const reasoning = s.reasoning_chain || [];
  if (reasoning.length < 2) issues.push({ type: 'weak_reasoning', detail: 'Reasoning chain has fewer than 2 steps' });
  const unsupported = reasoning.filter(r => !r.evidence);
  if (unsupported.length) issues.push({ type: 'unsupported_reasoning', detail: unsupported.length + ' reasoning steps lack evidence' });

  // Source-finding alignment
  const findingSrcCount = (s.key_findings || []).filter(f => f.sources && f.sources.length > 0).length;
  const totalFindings = (s.key_findings || []).length;
  if (totalFindings > 0 && findingSrcCount / totalFindings < 0.5) {
    issues.push({ type: 'poorly_sourced_findings', detail: 'Less than 50% of findings have source citations' });
  }

  // NEW: Behavioral divergence quality check
  const bd = s.behavioral_divergence || {};
  if (!bd.mainstream_narrative || !bd.raw_data_reality) {
    issues.push({ type: 'missing_divergence', detail: 'Behavioral divergence analysis incomplete or missing' });
  }

  // NEW: Executive actions check
  const actions = s.executive_actions || [];
  if (actions.length === 0) {
    issues.push({ type: 'no_actions', detail: 'No executive actions provided - users need actionable intelligence' });
  }

  return {
    issues,
    count: issues.length,
    severity: issues.length > 5 ? 'HIGH' : issues.length > 2 ? 'MEDIUM' : 'LOW'
  };
}

// ===== SOURCE MERGING & DEDUPLICATION =====
function mergeSources(briefingSources, groundedSources) {
  const seen = new Set();
  const merged = [];
  for (const src of groundedSources) {
    const key = src.url?.toLowerCase().replace(/\/$/, '');
    if (key && !seen.has(key)) { seen.add(key); merged.push({ ...src, merge_priority: 'grounded' }); }
  }
  for (const src of (briefingSources || [])) {
    const key = src.url?.toLowerCase().replace(/\/$/, '');
    if (key && !seen.has(key)) { seen.add(key); merged.push({ ...src, merge_priority: 'briefing' }); }
  }
  return merged;
}

// ===== SELF-TEST HEALTHCHECK ENGINE =====
async function selfTestPipeline() {
  const results = { timestamp: new Date().toISOString(), tests: [], pass: true };

  // Test 1: Cerebras API connectivity
  try {
    const res = await nodeFetch('https://api.cerebras.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${CEREBRAS_KEY}` }
    });
    results.tests.push({ name: 'cerebras_api', status: res.ok ? 'PASS' : 'FAIL', code: res.status });
    if (!res.ok) results.pass = false;
  } catch(e) {
    results.tests.push({ name: 'cerebras_api', status: 'FAIL', error: e.message });
    results.pass = false;
  }

  // Test 2: Gemini API connectivity
  let geminiOk = false;
  for (const key of GEMINI_KEYS) {
    try {
      const res = await nodeFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (res.ok) { geminiOk = true; break; }
    } catch(e) {}
  }
  results.tests.push({ name: 'gemini_api', status: geminiOk ? 'PASS' : 'DEGRADED', keys_available: GEMINI_KEYS.length });

  // Test 3: URL verification system
  try {
    const testCheck = await verifyUrl('https://www.reuters.com', 5000);
    results.tests.push({ name: 'url_verifier', status: testCheck.valid ? 'PASS' : 'DEGRADED', http_status: testCheck.status });
  } catch(e) {
    results.tests.push({ name: 'url_verifier', status: 'FAIL', error: e.message });
  }

  // Test 4: JSON extraction
  const testJson = extractJSON('{ "test": true }');
  results.tests.push({ name: 'json_parser', status: testJson?.test === true ? 'PASS' : 'FAIL' });

  // Test 5: Provenance classification
  const testProv = classifySourceProvenance('https://www.reuters.com/article/test');
  results.tests.push({ name: 'provenance_classifier', status: testProv.tier === 'TIER_2' ? 'PASS' : 'FAIL', result: testProv.tier });

  results.passed = results.tests.filter(t => t.status === 'PASS').length;
  results.total = results.tests.length;
  results.health_score = Math.round((results.passed / results.total) * 100);

  return results;
}

// ===== MAIN HANDLER =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ===== HEALTHCHECK ENDPOINT =====
  if (req.method === 'GET') {
    try {
      const health = await selfTestPipeline();
      return res.status(health.pass ? 200 : 503).json({
        success: true,
        type: 'healthcheck',
        version: '11.0',
        ...health
      });
    } catch(e) {
      return res.status(500).json({ error: 'Healthcheck failed', detail: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  const startTime = Date.now();
  const cacheKey = 'submind:q:' + query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 200);

  // ===== REDIS CACHE CHECK =====
  console.log('[Cache] Checking Redis for:', cacheKey);
  const cached = await redisGet(cacheKey);
  if (cached) {
    console.log('[Cache] HIT - returning cached result');
    const supabase = makeSupabase();
    await saveSearchHistory(supabase, query, cached.predictionId || null);
    return res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cache: 'HIT', cached_at: cached.timestamp } });
  }
  console.log('[Cache] MISS - running full pipeline');

  const supabase = makeSupabase();
  console.log('[SubMind v11.0] Query:', query);

  try {
    // ===== PHASE 1: PARALLEL SOURCE GATHERING =====
    console.log('[Phase 1] Parallel source gathering...');
    const [geminiResult, openaiResult] = await Promise.allSettled([
      geminiGroundedSearch(query),
      openaiEnrichedContext(query)
    ]);

    const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : { sources: [], context: '' };
    const openai = openaiResult.status === 'fulfilled' ? openaiResult.value : { sources: [], context: '' };
    const groundedSources = [...gemini.sources, ...openai.sources];
    const combinedContext = [gemini.context, openai.context].filter(Boolean).join('\n\n');
    console.log('[Phase 1] Gemini sources:', gemini.sources.length, '| OpenAI sources:', openai.sources.length);

    // ===== PHASE 2: INTELLIGENCE BRIEFING =====
    console.log('[Phase 2] Generating intelligence briefing...');
    const { briefing, provider: briefingProvider, raw_length } = await generateBriefing(query, combinedContext);

    if (!briefing) {
      return res.status(500).json({
        error: 'Briefing generation failed',
        debug: { gemini_sources: gemini.sources.length, openai_sources: openai.sources.length }
      });
    }
    console.log('[Phase 2] Briefing by:', briefingProvider, '| Length:', raw_length);

    // ===== PHASE 3: SOURCE MERGE =====
    console.log('[Phase 3] Merging & deduplicating sources...');
    const mergedSources = mergeSources(briefing.sources || [], groundedSources);
    console.log('[Phase 3] Total merged sources:', mergedSources.length);

    // ===== PHASE 4: URL VERIFICATION =====
    console.log('[Phase 4] Verifying source URLs...');
    const { sources: verifiedSources, stats: verificationStats } = await verifyAndFixSources(mergedSources);
    console.log('[Phase 4] Verified:', verificationStats.verified, '| Fixed:', verificationStats.fixed);

    // ===== PHASE 5: SOURCE PROVENANCE CLASSIFICATION =====
    console.log('[Phase 5] Classifying source provenance...');
    const classifiedSources = verifiedSources.map(src => ({
      ...src,
      provenance: classifySourceProvenance(src.url)
    }));
    const provenanceSummary = {
      tier_1: classifiedSources.filter(s => s.provenance.tier === 'TIER_1').length,
      tier_2: classifiedSources.filter(s => s.provenance.tier === 'TIER_2').length,
      tier_3: classifiedSources.filter(s => s.provenance.tier === 'TIER_3').length,
      tier_4: classifiedSources.filter(s => s.provenance.tier === 'TIER_4').length,
      tier_5: classifiedSources.filter(s => s.provenance.tier === 'TIER_5').length
    };
    console.log('[Phase 5] Provenance:', JSON.stringify(provenanceSummary));

    // ===== PHASE 6: SEMANTIC CLUSTERING =====
    console.log('[Phase 6] Semantic clustering...');
    const clusterData = semanticClusterSources(classifiedSources);
    console.log('[Phase 6] Clusters:', clusterData.total_clusters, '| Health:', clusterData.cluster_health);

    // ===== PHASE 7: BEHAVIORAL DIVERGENCE DETECTION =====
    console.log('[Phase 7] Behavioral divergence detection...');
    const divergenceData = detectBehavioralDivergence(briefing);
    console.log('[Phase 7] Divergence level:', divergenceData.divergence_level, '| Dark Matter:', divergenceData.dark_matter_score);

    // ===== PHASE 8: GLASS FANG VALIDATION =====
    console.log('[Phase 8] Glass Fang validation (16 metrics)...');
    const glassFang = glassFangValidation(briefing, classifiedSources, verificationStats, clusterData, divergenceData);
    console.log('[Phase 8] Glass Fang Score:', glassFang.score + '/100');

    // ===== PHASE 9: NEMESIS ADVERSARIAL CHECK =====
    console.log('[Phase 9] Nemesis adversarial engine...');
    const nemesis = nemesisEngine(briefing);
    console.log('[Phase 9] Nemesis issues:', nemesis.count, '| Severity:', nemesis.severity);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('[SubMind v11.0] Complete in', elapsed + 's');

    // ===== PERSIST TO SUPABASE + CACHE =====
    const responsePayload = {
      success: true,
      query,
      briefing: {
        ...briefing,
        sources: classifiedSources
      },
      validation: {
        glass_fang: glassFang,
        nemesis: nemesis
      },
      intelligence: {
        behavioral_divergence: divergenceData,
        source_clusters: clusterData,
        provenance_summary: provenanceSummary
      },
      meta: {
        version: '11.0',
        elapsed_seconds: parseFloat(elapsed),
        providers: {
          search: gemini.sources.length > 0 ? 'gemini' : 'openai',
          briefing: briefingProvider,
          source_count: classifiedSources.length,
          grounded_sources: gemini.sources.length,
          ai_referenced_sources: openai.sources.length
        },
        source_verification: verificationStats,
        pipeline: ['search', 'briefing', 'merge', 'verify_urls', 'provenance', 'cluster', 'divergence', 'glass_fang', 'nemesis', 'persist']
      }
    };

    // Save to Supabase (non-blocking)
    let predictionId = null;
    try {
      predictionId = await savePrediction(supabase, query, responsePayload);
      if (predictionId) {
        await saveSearchHistory(supabase, query, predictionId);
        console.log('[Supabase] Saved prediction:', predictionId);
      }
    } catch(e) { console.error('[Supabase] Persist error:', e.message); }

    // Cache in Redis
    try {
      await redisSet(cacheKey, { data: responsePayload, predictionId, timestamp: new Date().toISOString() });
      console.log('[Cache] Saved to Redis with TTL:', CACHE_TTL);
    } catch(e) { console.error('[Cache] Redis save error:', e.message); }

    // ===== RESPONSE =====
    return res.status(200).json(responsePayload);
  } catch(e) {
    console.error('[SubMind v11.0] Fatal:', e.message);
    return res.status(500).json({ error: 'Pipeline failed', detail: e.message });
  }
          }
