import nodeFetch from "node-fetch";

import { createClient } from "@supabase/supabase-js";

// SUBMIND v14.0 - HYPER INTELLIGENCE RESEARCH ENGINE
// Advanced: Contradiction Detection + Strategic Intelligence + Confidence Calibration
// v13.0: Entity Verification + Souhrce Existence Check + Confidence Floor + Input Provenance Tagging
// Multi-Source Consensus + Temporal Anomaly Detection + Enhanced Behavioral Divergence
// Supabase persistence + Upstash Redis caching + Full pipeline
// Behavioral Divergence + Source Provenance + Semantic Clustering
// Dark Matter Engine + Glass Fang + Nemesis + URL Verification

// ===== SUPABASE CLIENT =====
function makeSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: nodeFetch } });
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
      version: meta.version || '13.0',
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
    const domain = (() => {
      try { return new URL(source.url).hostname; } catch(e) { return ''; }
    })();
    // Build a focused search query
    const q = domain ? `site:${domain} ${title}` : title;
    // Use Google News for recent items, regular search otherwise
    const dateStr = source.date || '';
    const isRecent = dateStr && (dateStr.includes('2024') || dateStr.includes('2025'));
    const base = isRecent 
      ? 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&tbm=nws'
      : 'https://www.google.com/search?q=' + encodeURIComponent(q);
    return base;
  }

async function verifyAndFixSources(sources) {
  if (!sources || !sources.length) return { sources: [], stats: { total: 0, verified: 0, fixed: 0, failed: 0 } };
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      if (!src.url || src.url.includes('google.com/search')) {
        return { ...src, verified: false, verification_status: 'failed', link_type: 'search' };
      }
      const check = await verifyUrl(src.url);
      if (check.valid) {
        return { ...src, verified: true, verification_status: 'verified', link_type: 'direct', http_status: check.status };
      }
      const fallbackUrl = buildSearchFallback(src);
      return { ...src, original_url: src.url, url: fallbackUrl, verified: false, verification_status: 'fixed', link_type: 'search', http_status: check.status, fallback_reason: `Original URL returned ${check.status || 'unreachable'}` };
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


// ===== URL CONTENT EXTRACTION ENGINE =====
async function fetchUrlContent(url, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await nodeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SubMind/13.1 Research Bot (+https://submind-blond.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    clearTimeout(timeout);
    
    if (!response.ok) return { success: false, error: 'HTTP ' + response.status };
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
      return { success: false, error: 'Non-text content: ' + contentType };
    }
    
    const html = await response.text();
    
    // Extract meaningful text content - strip HTML tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = metaMatch ? metaMatch[1].trim() : '';
    
    // Extract Open Graph data
    const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
    const ogDesc = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
    const ogSite = (html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
    
    // Truncate to 4000 chars for context window efficiency
    const truncatedText = text.substring(0, 4000);
    
    return {
      success: true,
      url: url,
      title: title || ogTitle,
      description: description || ogDesc,
      siteName: ogSite,
      content: truncatedText,
      contentLength: text.length,
      extractedAt: new Date().toISOString()
    };
  } catch (err) {
    return { success: false, error: err.message || 'Fetch failed' };
  }
}

// ===== MULTI-MODEL CONSENSUS ENGINE =====
async function multiModelConsensus(query, sourceContext, urlContent) {
  // Run Cerebras (fast) + Gemini (grounded) analysis in parallel
  // Then compare for consensus scoring
  
  const contextBlock = urlContent 
    ? `EXTRACTED URL CONTENT:\nTitle: ${urlContent.title}\nSite: ${urlContent.siteName}\nContent: ${urlContent.content}\n\nADDITIONAL CONTEXT:\n${sourceContext}`
    : sourceContext;
  
  const quickAnalysisPrompt = `Analyze this topic and provide 3 key claims with evidence strength (strong/moderate/weak) and 2 non-obvious insights most people miss. Topic: ${query}\n\nContext: ${contextBlock.substring(0, 2000)}\n\nRespond as JSON: {"claims":[{"claim":"...","evidence":"strong|moderate|weak","source_type":"..."}],"hidden_insights":["...","..."]}`;
  
  try {
    const [cerebrasQuick, geminiQuick] = await Promise.allSettled([
      // Cerebras quick analysis
      nodeFetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CEREBRAS_KEY}` },
        body: JSON.stringify({
          model: CEREBRAS_MODEL,
          messages: [{ role: 'user', content: quickAnalysisPrompt }],
          max_tokens: 800,
          temperature: 0.3
        })
      }).then(r => r.json()).then(d => d.choices?.[0]?.message?.content || '{}'),
      
      // Gemini quick analysis
      GEMINI_KEYS.length > 0 ? nodeFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEYS[0]}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: quickAnalysisPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
          })
        }
      ).then(r => r.json()).then(d => d.candidates?.[0]?.content?.parts?.[0]?.text || '{}') : Promise.resolve('{}')
    ]);
    
    const c1 = extractJSON(cerebrasQuick.status === 'fulfilled' ? cerebrasQuick.value : '{}');
    const c2 = extractJSON(geminiQuick.status === 'fulfilled' ? geminiQuick.value : '{}');
    
    // Calculate consensus - how much the models agree
    const claims1 = c1?.claims || [];
    const claims2 = c2?.claims || [];
    const insights1 = c1?.hidden_insights || [];
    const insights2 = c2?.hidden_insights || [];
    
    // Merge unique insights
    const allInsights = [...new Set([...insights1, ...insights2])];
    
    // Agreement scoring - check if models found similar claims
    let agreementCount = 0;
    for (const a of claims1) {
      for (const b of claims2) {
        if (a.claim && b.claim) {
          const wordsA = a.claim.toLowerCase().split(' ');
          const wordsB = b.claim.toLowerCase().split(' ');
          const overlap = wordsA.filter(w => w.length > 4 && wordsB.includes(w)).length;
          if (overlap >= 2) agreementCount++;
        }
      }
    }
    
    const totalClaims = Math.max(claims1.length, claims2.length, 1);
    const consensusScore = Math.min(100, Math.round((agreementCount / totalClaims) * 100) + 40);
    
    return {
      consensusScore,
      modelAgreement: agreementCount > 0 ? 'HIGH' : 'MODERATE',
      mergedClaims: [...claims1, ...claims2].slice(0, 6),
      hiddenInsights: allInsights.slice(0, 4),
      modelsUsed: ['cerebras', 'gemini']
    };
  } catch (err) {
    console.log('[Consensus] Error:', err.message);
    return { consensusScore: 50, modelAgreement: 'UNKNOWN', mergedClaims: [], hiddenInsights: [], modelsUsed: [] };
  }
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

// ===== SECONDARY SOURCE DISCOVERY (Gemini Deep Links) =====
  async function geminiDeepSourceSearch(query) {
    // Second Gemini call focused purely on finding real, direct article URLs
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      try {
        const res = await nodeFetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEYS[i]}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Find the most important and recent news articles, reports, and official documents about: ${query}

Focus on finding DIRECT ARTICLE URLS from these specific domains:
- reuters.com, apnews.com, bbc.com (wire services)
- cnbc.com, bloomberg.com, ft.com (financial)
- techcrunch.com, arstechnica.com, theverge.com (tech)
- .gov domains (government)
- Official company press releases and investor relations pages
- Academic papers on arxiv.org

Find at least 8-10 different sources with working URLs.` }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.1 }
            })
          }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const sources = [];
        const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || 'Deep Source',
              url: chunk.web.uri,
              type: 'deep_search',
              provider: 'gemini_deep',
              verified_by_search: true
            });
          }
        }
        return { sources, provider: 'gemini_deep' };
      } catch(e) { continue; }
    }
    return { sources: [], provider: 'gemini_deep' };
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
          content: `You are SubMind v14.0, the most advanced deep intelligence research engine ever built. You produce analysis that surpasses what any single AI, search engine, or analyst can deliver alone.

YOUR CORE MISSION: Find what others miss. Every query gets treated as an intelligence operation:
1. SIGNAL EXTRACTION - Identify the 2-3 data points that actually matter vs. noise
2. BEHAVIORAL DIVERGENCE - Map the gap between public narrative and underlying reality
3. TEMPORAL PATTERN MATCHING - What historical parallels predict about this situation
4. ADVERSARIAL ANALYSIS - What are the counter-arguments and who benefits from the current narrative
5. ACTIONABLE ALPHA - Give the user something they can DO with this information that they couldnt get from Google

You think like a hedge fund analyst, write like a journalist, and verify like a fact-checker. You never just summarize - you SYNTHESIZE across domains to find non-obvious connections.

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
  "user_strategies": [
      {
        "strategy": "Concrete strategy the user can implement",
        "who_benefits": "Who this strategy helps (investors, researchers, businesses, general public)",
        "difficulty": "EASY|MODERATE|HARD",
        "time_horizon": "Immediate|Short-term|Long-term",
        "prerequisite": "What you need to know or have before implementing"
      }
    ],
    "plain_language_summary": {
      "one_sentence": "The entire analysis in one simple sentence",
      "what_changed": "What recently changed about this topic",
      "why_it_matters": "Why a regular person should care",
      "what_to_watch": "The single most important thing to watch going forward"
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
12. Investment relevance with specific sectors, risk level, and opportunity windows
13. USER STRATEGIES: Provide at least 3 concrete strategies a regular person can use this information for. Think: how would an investor, researcher, business owner, or curious citizen USE this intelligence?
14. PLAIN LANGUAGE SUMMARY: Include a one_sentence summary, what_changed, why_it_matters, and what_to_watch - all in language a high school student could understand
15. Do NOT just summarize search results - synthesize, find patterns, detect contradictions, and produce ORIGINAL analytical insights
16. REALITY GATE COMPLIANCE: If the source context contains a REALITY GATE WARNING or CAUTION, you MUST prominently acknowledge the lack of evidence. Never present unverified information as fact. If evidence is weak or absent, say so clearly: "SubMind could not independently verify this claim" and explain what evidence IS and IS NOT available. Your credibility depends on honesty about what you don't know.
17. COMPETITIVE ADVANTAGE: Your analysis must contain AT LEAST 2 insights that cannot be found by searching Google or asking ChatGPT. Think: cross-domain pattern matching, temporal anomalies, contrarian analysis, second-order effects.
18. CONFIDENCE GRANULARITY: For each major claim, assign a micro-confidence (e.g., "this specific data point is 92% reliable, but the causal link is only 60% certain"). Dont just give one confidence number.
19. CONTRARIAN STRESS TEST: Before finalizing, argue AGAINST your own conclusions. Include the strongest counter-argument in your analysis.
20. NETWORK EFFECTS: Map who benefits and who loses from the current situation. Follow the money and incentives.
21. If EXTRACTED URL CONTENT is provided above, deeply analyze that specific content - summarize it, fact-check its claims against your knowledge, identify what it gets right and wrong, and provide additional context the source doesnt mention.`
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

// ===== QUERY PREPROCESSING ENGINE =====
// Expands, classifies, and enriches queries before pipeline execution

const QUERY_EXPANSIONS = {
  // Common abbreviations
  'AI': 'artificial intelligence',
  'ML': 'machine learning',
  'LLM': 'large language model',
  'AGI': 'artificial general intelligence',
  'GPU': 'graphics processing unit',
  'EV': 'electric vehicle',
  'IPO': 'initial public offering',
  'M&A': 'mergers and acquisitions',
  'GDP': 'gross domestic product',
  'CPI': 'consumer price index',
  'Fed': 'Federal Reserve',
  'SEC': 'Securities and Exchange Commission',
  'FDA': 'Food and Drug Administration',
  'EPA': 'Environmental Protection Agency',
  'NATO': 'North Atlantic Treaty Organization',
  'OPEC': 'Organization of Petroleum Exporting Countries',
  'TSMC': 'Taiwan Semiconductor Manufacturing Company',
  'FAANG': 'Facebook Apple Amazon Netflix Google',
  'ETF': 'exchange traded fund',
  'ESG': 'environmental social governance',
  'DeFi': 'decentralized finance',
  'NFT': 'non-fungible token',
  'IoT': 'Internet of Things',
  'SaaS': 'software as a service',
  'CRISPR': 'CRISPR gene editing',
  'mRNA': 'messenger RNA',
  'SPAC': 'special purpose acquisition company',
  'PE': 'private equity',
  'VC': 'venture capital',
  'R&D': 'research and development'
};

const DOMAIN_CLASSIFIERS = [
  { pattern: /\b(stock|market|invest|trading|bull|bear|earnings|revenue|valuation|IPO|dividend|S&P|NASDAQ|dow jones|portfolio|hedge fund)\b/i, domain: 'finance' },
  { pattern: /\b(AI|artificial intelligence|machine learning|neural|GPT|LLM|deep learning|model|transformer|compute|GPU|chip|semiconductor|quantum)\b/i, domain: 'technology' },
  { pattern: /\b(war|sanctions|tariff|trade war|geopolit|diplomac|NATO|missile|military|defense|conflict|treaty|alliance)\b/i, domain: 'geopolitical' },
  { pattern: /\b(climate|carbon|renewable|solar|wind|emission|green|sustainability|ESG|energy transition|EV|battery)\b/i, domain: 'climate_energy' },
  { pattern: /\b(FDA|drug|pharma|biotech|clinical trial|vaccine|mRNA|CRISPR|gene|therapy|healthcare|hospital)\b/i, domain: 'biotech_health' },
  { pattern: /\b(crypto|bitcoin|ethereum|blockchain|DeFi|token|mining|web3|digital currency|stablecoin)\b/i, domain: 'crypto' },
  { pattern: /\b(regulation|law|court|ruling|antitrust|compliance|legislation|congress|senate|policy|executive order)\b/i, domain: 'regulatory' },
  { pattern: /\b(space|rocket|satellite|orbit|Mars|lunar|SpaceX|NASA|launch|constellation)\b/i, domain: 'aerospace' }
];

const TEMPORAL_BOOSTERS = {
  finance: 'latest quarterly earnings financial results market data',
  technology: 'latest development announcement release update',
  geopolitical: 'latest diplomatic summit sanctions response',
  climate_energy: 'latest policy targets deployment data',
  biotech_health: 'latest clinical results FDA approval trial data',
  crypto: 'latest on-chain data market cap regulatory',
  regulatory: 'latest ruling legislation hearing decision',
  aerospace: 'latest launch mission contract milestone'
};

function preprocessQuery(rawQuery) {
  const startMs = Date.now();
  const trimmed = rawQuery.trim();
  
  // 1. Classify query domain
  const domains = [];
  for (const clf of DOMAIN_CLASSIFIERS) {
    if (clf.pattern.test(trimmed)) domains.push(clf.domain);
  }
  const primaryDomain = domains[0] || 'general';
  
  // 2. Detect and expand abbreviations (for context enrichment, not query replacement)
  const expansions = [];
  for (const [abbr, full] of Object.entries(QUERY_EXPANSIONS)) {
    const regex = new RegExp('\\b' + abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    if (regex.test(trimmed)) {
      expansions.push({ abbreviation: abbr, expanded: full });
    }
  }
  
  // 3. Extract named entities (companies, people, organizations)
  const entities = [];
  const companyPatterns = /\b(Google|Microsoft|Apple|Amazon|Meta|Tesla|Nvidia|OpenAI|Anthropic|Intel|AMD|TSMC|Samsung|IBM|SpaceX|xAI|Mistral|Palantir|Databricks|Snowflake|CrowdStrike|Coinbase|Binance)\b/gi;
  let match;
  while ((match = companyPatterns.exec(trimmed)) !== null) {
    entities.push({ name: match[1], type: 'company' });
  }
  
  // 4. Detect temporal references
  const hasYear = /\b20[2-3]\d\b/.test(trimmed);
  const hasQuarter = /Q[1-4]\s*20[2-3]\d/i.test(trimmed);
  const hasRecent = /\b(latest|recent|current|today|now|new|upcoming|next)\b/i.test(trimmed);
  const temporalContext = hasYear || hasQuarter ? 'specific' : hasRecent ? 'recent' : 'open';
  
  // 5. Build enriched search query (used for source discovery, not main briefing)
  let enrichedQuery = trimmed;
  
  // Add temporal booster if query is open-ended
  if (temporalContext === 'open' && TEMPORAL_BOOSTERS[primaryDomain]) {
    enrichedQuery = trimmed + ' ' + TEMPORAL_BOOSTERS[primaryDomain].split(' ').slice(0, 3).join(' ');
  }
  
  // 6. Generate related search angles for deep source discovery
  const searchAngles = [];
  if (entities.length > 0) {
    const entityNames = entities.map(e => e.name);
    searchAngles.push(trimmed + ' official announcement');
    searchAngles.push(entityNames.join(' ') + ' investor relations press release');
    if (primaryDomain === 'finance') searchAngles.push(entityNames.join(' ') + ' SEC filing 10-K');
    if (primaryDomain === 'technology') searchAngles.push(entityNames.join(' ') + ' research paper arxiv');
    if (primaryDomain === 'regulatory') searchAngles.push(entityNames.join(' ') + ' court ruling decision');
  }
  searchAngles.push(trimmed + ' analysis report');
  searchAngles.push(trimmed + ' data statistics');
  
  // 7. Determine research depth hints
  const complexity = (entities.length >= 2 ? 1 : 0) + (domains.length >= 2 ? 1 : 0) + (trimmed.split(' ').length >= 6 ? 1 : 0);
  const researchDepth = complexity >= 2 ? 'deep' : complexity >= 1 ? 'standard' : 'broad';
  
  return {
    original: trimmed,
    enriched: enrichedQuery,
    classification: {
      primary_domain: primaryDomain,
      all_domains: domains,
      research_depth: researchDepth,
      temporal_context: temporalContext
    },
    entities,
    expansions,
    search_angles: searchAngles.slice(0, 5),
    preprocessing_ms: Date.now() - startMs
  };
}


// ===== CONTRADICTION DETECTION ENGINE =====
// Cross-references claims across sources to find conflicting narratives
function detectContradictions(briefing) {
  const contradictions = [];
  const findings = briefing?.key_findings || [];
  const predictions = briefing?.predictions || [];
  
  // Check for contradictory predictions (high prob event AND high prob opposite)
  for (let i = 0; i < predictions.length; i++) {
    for (let j = i + 1; j < predictions.length; j++) {
      const p1 = predictions[i];
      const p2 = predictions[j];
      // If both high probability but seemingly opposite
      if (p1.probability > 60 && p2.probability > 60) {
        const p1Words = (p1.prediction || '').toLowerCase().split(' ');
        const p2Words = (p2.prediction || '').toLowerCase().split(' ');
        const negators = ['decline', 'decrease', 'fall', 'drop', 'lose', 'fail', 'reject', 'slow', 'reduce', 'weaken'];
        const positives = ['increase', 'grow', 'rise', 'gain', 'succeed', 'accept', 'accelerate', 'expand', 'strengthen'];
        const p1Neg = p1Words.some(w => negators.includes(w));
        const p1Pos = p1Words.some(w => positives.includes(w));
        const p2Neg = p2Words.some(w => negators.includes(w));
        const p2Pos = p2Words.some(w => positives.includes(w));
        if ((p1Neg && p2Pos) || (p1Pos && p2Neg)) {
          contradictions.push({
            type: 'prediction_conflict',
            items: [p1.prediction?.substring(0, 80), p2.prediction?.substring(0, 80)],
            severity: 'HIGH',
            explanation: 'Two high-probability predictions point in opposite directions. This suggests the situation is genuinely uncertain or context-dependent.'
          });
        }
      }
    }
  }
  
  // Check for confidence vs evidence mismatch
  const conf = briefing?.confidence || 0;
  const sourcedFindings = findings.filter(f => f.sources && f.sources.length > 0);
  const unsourcedFindings = findings.filter(f => !f.sources || f.sources.length === 0);
  
  if (conf > 80 && unsourcedFindings.length > sourcedFindings.length) {
    contradictions.push({
      type: 'confidence_evidence_gap',
      severity: 'MEDIUM',
      explanation: 'Analysis claims high confidence (' + conf + '%) but most findings lack direct source citations. Confidence may be overstated.'
    });
  }
  
  // Check for timeline gaps suggesting missing information
  const timeline = briefing?.timeline || [];
  if (timeline.length >= 3) {
    const dates = timeline.map(t => t.date).filter(d => d && d.match(/\d{4}/));
    const years = dates.map(d => parseInt(d.substring(0, 4))).filter(y => !isNaN(y)).sort();
    for (let i = 1; i < years.length; i++) {
      if (years[i] - years[i-1] > 3) {
        contradictions.push({
          type: 'timeline_gap',
          severity: 'LOW',
          explanation: 'Gap of ' + (years[i] - years[i-1]) + ' years in timeline (' + years[i-1] + ' to ' + years[i] + '). Important developments may have occurred during this period.'
        });
      }
    }
  }
  
  return {
    contradictions,
    count: contradictions.length,
    has_critical: contradictions.some(c => c.severity === 'HIGH'),
    integrity_score: Math.max(0, 100 - (contradictions.filter(c => c.severity === 'HIGH').length * 25) - (contradictions.filter(c => c.severity === 'MEDIUM').length * 10) - (contradictions.filter(c => c.severity === 'LOW').length * 5))
  };
}

// ===== STRATEGIC INTELLIGENCE GENERATOR =====
// Produces actionable strategies beyond simple summaries
function generateStrategicIntel(briefing, divergenceData, contradictionData) {
  const strategies = [];
  const confidence = briefing?.confidence || 50;
  const predictions = briefing?.predictions || [];
  const actions = briefing?.executive_actions || [];
  const risk = briefing?.risk_matrix || {};
  const bd = briefing?.behavioral_divergence || {};
  
  // Strategy 1: Information Advantage Assessment
  if (divergenceData?.divergence_level === 'CRITICAL' || divergenceData?.divergence_level === 'ELEVATED') {
    strategies.push({
      category: 'information_advantage',
      title: 'You May Know Something Others Don\'t',
      strategy: 'SubMind detected significant gaps between what mainstream sources report and what the data shows. This divergence often precedes major shifts. Consider: ' + (bd.alpha_signal || 'The gap between public narrative and raw data suggests an opportunity for early movers.'),
      confidence_in_strategy: Math.min(85, divergenceData.dark_matter_score + 20),
      time_sensitivity: divergenceData.divergence_level === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      action_type: 'INVESTIGATE_DEEPER'
    });
  }
  
  // Strategy 2: Risk-Adjusted Decision Framework
  if (risk.primary_risk && risk.risk_probability) {
    const riskProb = risk.risk_probability;
    const riskAction = riskProb > 70 ? 'Prioritize defensive measures. The primary risk has a high probability of materializing.' :
                       riskProb > 40 ? 'Balance preparation with opportunity. Monitor the risk indicators closely.' :
                       'The primary risk is low-probability. Focus on upside while maintaining basic safeguards.';
    strategies.push({
      category: 'risk_management',
      title: 'Risk-Adjusted Action Plan',
      strategy: riskAction + ' Primary risk: ' + (risk.primary_risk || 'undefined') + '. Mitigation: ' + (risk.mitigation || 'Not specified.'),
      confidence_in_strategy: Math.min(90, 50 + Math.abs(50 - riskProb)),
      time_sensitivity: riskProb > 60 ? 'HIGH' : 'MEDIUM',
      action_type: riskProb > 60 ? 'DEFENSIVE' : 'BALANCED'
    });
  }
  
  // Strategy 3: High-Probability Opportunity Detection
  const highProbPreds = predictions.filter(p => p.probability >= 70);
  if (highProbPreds.length > 0) {
    const topPred = highProbPreds.reduce((best, p) => p.probability > best.probability ? p : best, highProbPreds[0]);
    strategies.push({
      category: 'opportunity',
      title: 'Highest-Confidence Projection',
      strategy: 'SubMind\'s strongest prediction (' + topPred.probability + '% probability): ' + (topPred.prediction || '') + '. Timeframe: ' + (topPred.timeframe || 'Not specified') + '. This is the single most likely outcome based on current data patterns.',
      confidence_in_strategy: topPred.probability,
      time_sensitivity: topPred.timeframe ? 'DEFINED' : 'OPEN',
      action_type: 'POSITION'
    });
  }
  
  // Strategy 4: Contradiction-Aware Hedging
  if (contradictionData?.has_critical) {
    strategies.push({
      category: 'hedging',
      title: 'Conflicting Signals Detected',
      strategy: 'SubMind found contradictory data points in this analysis. This typically means the situation is genuinely uncertain and outcomes could go either way. Avoid committing heavily to any single scenario. Instead, identify the key indicator that would resolve the contradiction and watch for it.',
      confidence_in_strategy: 60,
      time_sensitivity: 'MEDIUM',
      action_type: 'WAIT_AND_WATCH'
    });
  }
  
  // Strategy 5: Pattern-Based Timing
  const pa = briefing?.pattern_analysis || {};
  const convergencePoints = pa.convergence_points || [];
  if (convergencePoints.length >= 3) {
    strategies.push({
      category: 'timing',
      title: 'Pattern Convergence Alert',
      strategy: convergencePoints.length + ' independent data patterns are converging right now. Historically, this density of convergence precedes a significant move. The window for early positioning may be narrowing.',
      confidence_in_strategy: Math.min(80, 40 + convergencePoints.length * 10),
      time_sensitivity: 'HIGH',
      action_type: 'ACT_SOON'
    });
  }
  
  // Strategy 6: Source Quality Warning
  const findings = briefing?.key_findings || [];
  const highImpactUnsourced = findings.filter(f => f.impact === 'HIGH' && (!f.sources || f.sources.length === 0));
  if (highImpactUnsourced.length > 0) {
    strategies.push({
      category: 'verification_needed',
      title: 'Verify Before Acting',
      strategy: highImpactUnsourced.length + ' high-impact finding(s) lack direct source citations. While the analysis suggests these are important, independently verify before making major decisions based on them.',
      confidence_in_strategy: 40,
      time_sensitivity: 'LOW',
      action_type: 'VERIFY_FIRST'
    });
  }
  
  return {
    strategies,
    count: strategies.length,
    primary_action: strategies.length > 0 ? strategies[0].action_type : 'OBSERVE',
    overall_stance: strategies.some(s => s.action_type === 'DEFENSIVE') ? 'CAUTIOUS' :
                    strategies.some(s => s.action_type === 'ACT_SOON') ? 'URGENT' :
                    strategies.some(s => s.action_type === 'POSITION') ? 'OPPORTUNISTIC' : 'NEUTRAL'
  };
}

// ===== CONFIDENCE CALIBRATION ENGINE =====
// Adjusts raw confidence scores based on data quality and internal consistency
function calibrateConfidence(briefing, glassFang, nemesis, contradictionData, divergenceData) {
  const rawConfidence = briefing?.confidence || 50;
  let adjustments = [];
  let adjustedConfidence = rawConfidence;
  
  // Adjustment 1: Glass Fang score influence (trust score)
  const trustDelta = (glassFang?.score || 50) - 50;
  const trustAdj = Math.round(trustDelta * 0.15);
  adjustments.push({ factor: 'Trust Score', adjustment: trustAdj, reason: 'Glass Fang score ' + (glassFang?.score || 50) + '/100' });
  adjustedConfidence += trustAdj;
  
  // Adjustment 2: Nemesis issues (quality problems)
  const nemCount = nemesis?.count || 0;
  const nemAdj = -Math.min(15, nemCount * 3);
  if (nemAdj !== 0) {
    adjustments.push({ factor: 'Quality Issues', adjustment: nemAdj, reason: nemCount + ' issues found by Nemesis engine' });
    adjustedConfidence += nemAdj;
  }
  
  // Adjustment 3: Contradiction penalty
  if (contradictionData?.has_critical) {
    const contAdj = -10;
    adjustments.push({ factor: 'Contradictions', adjustment: contAdj, reason: 'Critical contradictions detected in analysis' });
    adjustedConfidence += contAdj;
  }
  
  // Adjustment 4: Source verification boost
  const sources = briefing?.sources || [];
  const verifiedPct = sources.length > 0 ? (sources.filter(s => s.verified).length / sources.length) * 100 : 0;
  if (verifiedPct > 50) {
    const verAdj = Math.round((verifiedPct - 50) * 0.1);
    adjustments.push({ factor: 'Source Verification', adjustment: verAdj, reason: Math.round(verifiedPct) + '% of sources verified live' });
    adjustedConfidence += verAdj;
  } else if (verifiedPct < 20) {
    const verAdj = -5;
    adjustments.push({ factor: 'Low Verification', adjustment: verAdj, reason: 'Only ' + Math.round(verifiedPct) + '% of sources verified' });
    adjustedConfidence += verAdj;
  }
  
  // Adjustment 5: Divergence signal (can increase confidence in divergence finding)
  if (divergenceData?.divergence_level === 'CRITICAL') {
    const divAdj = 5;
    adjustments.push({ factor: 'Strong Divergence Signal', adjustment: divAdj, reason: 'Critical divergence detected - strong hidden signal' });
    adjustedConfidence += divAdj;
  }
  
  // Clamp to 5-99 range
  adjustedConfidence = Math.max(5, Math.min(99, adjustedConfidence));
  
  // Generate human-readable confidence explanation
  const explanation = adjustedConfidence >= 80 ? 'High confidence: Multiple reliable sources agree, evidence is specific, and internal consistency is strong.' :
                      adjustedConfidence >= 60 ? 'Moderate confidence: Good evidence base but some gaps exist. Major conclusions are likely sound but details may shift.' :
                      adjustedConfidence >= 40 ? 'Low-moderate confidence: Mixed or limited evidence. Use this analysis as a starting point, not a final answer.' :
                      'Low confidence: Significant data gaps or contradictions. Treat all conclusions as preliminary.';
  
  return {
    raw_confidence: rawConfidence,
    calibrated_confidence: adjustedConfidence,
    delta: adjustedConfidence - rawConfidence,
    adjustments,
    explanation,
    confidence_tier: adjustedConfidence >= 80 ? 'HIGH' : adjustedConfidence >= 60 ? 'MODERATE' : adjustedConfidence >= 40 ? 'LOW_MODERATE' : 'LOW'
  };
}

// ===== LAYER 1: ENTITY VERIFICATION ENGINE =====
// Verifies tickers/companies against Yahoo Finance before analysis
async function verifyEntity(queryIntel) {
  const entities = queryIntel.entities || [];
  const tickerPattern = /\b[A-Z]{1,5}\b/;
  const results = { verified: [], unverifiable: [], checked: 0, pass: true, details: [] };
  
  // Extract potential tickers from entities and raw query
  const candidates = [];
  for (const e of entities) {
    if (e.type === 'company' || e.type === 'ticker') candidates.push(e.name);
  }
  // Also check for standalone tickers in the query
  const queryTokens = (queryIntel.original_query || '').split(/\s+/);
  for (const t of queryTokens) {
    if (/^[A-Z]{1,5}$/.test(t) && !['AI', 'EU', 'US', 'UK', 'GDP', 'FDA', 'SEC', 'IPO', 'CEO', 'CTO', 'CFO', 'ETF', 'ESG', 'API', 'IOT', 'VR', 'AR', 'EV', 'WHO', 'UN', 'NATO', 'NASA'].includes(t)) {
      candidates.push(t);
    }
  }
  
  if (candidates.length === 0) {
    results.details.push({ note: 'No ticker/entity candidates detected - general topic query' });
    return results;
  }
  
  for (const candidate of [...new Set(candidates)]) {
    results.checked++;
    try {
      const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(candidate) + '&quotesCount=3&newsCount=0';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await nodeFetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SubMind/13.0 EntityVerifier' }
      });
      clearTimeout(timer);
      
      if (res.ok) {
        const data = await res.json();
        const quotes = data.quotes || [];
        if (quotes.length > 0) {
          const match = quotes[0];
          results.verified.push({
            input: candidate,
            symbol: match.symbol,
            name: match.shortname || match.longname || candidate,
            exchange: match.exchange || 'UNKNOWN',
            type: match.quoteType || 'UNKNOWN',
            score: match.score || 0
          });
          results.details.push({ entity: candidate, status: 'VERIFIED', symbol: match.symbol, exchange: match.exchange });
        } else {
          results.unverifiable.push(candidate);
          results.details.push({ entity: candidate, status: 'NOT_FOUND', reason: 'No matching securities found' });
        }
      } else {
        // API error - don't penalize, mark as unchecked
        results.details.push({ entity: candidate, status: 'API_ERROR', code: res.status });
      }
    } catch(e) {
      results.details.push({ entity: candidate, status: 'TIMEOUT', reason: e.message });
    }
  }
  
  // If we checked entities and NONE verified, flag as fail
  if (results.checked > 0 && results.verified.length === 0 && results.unverifiable.length > 0) {
    results.pass = false;
  }
  
  return results;
}

// ===== LAYER 2: SOURCE EXISTENCE CHECK =====
// Verifies cited sources actually exist at their URLs. Already partially done in Phase 4.
// This adds SYNTHETIC tagging to sources that fail verification.
function tagSyntheticSources(sources, verificationStats) {
  let syntheticCount = 0;
  let confirmedCount = 0;
  const tagged = sources.map(s => {
    const isVerified = s.verified === true || !!s.original_url;
    if (isVerified) {
      confirmedCount++;
      return { ...s, provenance_tag: s.provenance_tag || 'RETRIEVED', synthetic: false };
    } else {
      syntheticCount++;
      return { ...s, provenance_tag: 'SYNTHETIC', synthetic: true, trust_weight: 0 };
    }
  });
  
  const existenceRate = sources.length > 0 ? confirmedCount / sources.length : 0;
  return {
    sources: tagged,
    existence_check: {
      total: sources.length,
      confirmed: confirmedCount,
      synthetic: syntheticCount,
      existence_rate: Math.round(existenceRate * 100),
      threshold: 30,
      pass: existenceRate * 100 >= 30
    }
  };
}

// ===== LAYER 3: CONFIDENCE FLOOR ENFORCEMENT =====
// Gates the entire report if entity verification OR source existence fails
function enforceConfidenceFloor(entityVerification, sourceExistence) {
  const entityPass = entityVerification.pass;
  const sourcePass = sourceExistence.pass;
  const existenceRate = sourceExistence.existence_rate;
  
  const blocked = !entityPass || !sourcePass;
  const reasons = [];
  
  if (!entityPass) {
    reasons.push({
      layer: 'ENTITY_VERIFICATION',
      severity: 'CRITICAL',
      message: 'Could not verify any referenced securities/entities against financial databases',
      unverifiable: entityVerification.unverifiable
    });
  }
  
  if (!sourcePass) {
    reasons.push({
      layer: 'SOURCE_EXISTENCE',
      severity: 'CRITICAL',
      message: 'Source existence rate (' + existenceRate + '%) below minimum threshold (30%)',
      existence_rate: existenceRate
    });
  }
  
  return {
    blocked,
    synthetic_data_detected: blocked,
    reasons,
    enforcement: {
      entity_gate: entityPass ? 'PASSED' : 'BLOCKED',
      source_gate: sourcePass ? 'PASSED' : 'BLOCKED',
      overall: blocked ? 'REPORT_BLOCKED' : 'REPORT_ALLOWED'
    }
  };
}

// ===== LAYER 4: INPUT PROVENANCE TAGGING =====
// Tags data points from user input vs SubMind retrieval
function tagInputProvenance(briefing, originalQuery) {
  const queryTerms = originalQuery.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  const tagged = {
    user_asserted_claims: [],
    independently_corroborated: [],
    provenance_summary: { user_asserted: 0, corroborated: 0, total_claims: 0 }
  };
  
  // Check predictions for user-asserted data
  const predictions = briefing.predictions || [];
  for (const pred of predictions) {
    tagged.provenance_summary.total_claims++;
    const predText = (pred.prediction || pred.title || '').toLowerCase();
    // If prediction closely mirrors query terms without independent evidence
    const queryOverlap = queryTerms.filter(t => predText.includes(t)).length;
    const overlapRatio = queryTerms.length > 0 ? queryOverlap / queryTerms.length : 0;
    
    if (overlapRatio > 0.7 && (!pred.evidence || pred.evidence === '')) {
      tagged.user_asserted_claims.push({
        claim: pred.prediction || pred.title,
        tag: 'USER_ASSERTED',
        weight: 0,
        reason: 'High query overlap without independent evidence'
      });
      tagged.provenance_summary.user_asserted++;
    } else {
      tagged.independently_corroborated.push({
        claim: pred.prediction || pred.title,
        tag: 'CORROBORATED',
        weight: 1
      });
      tagged.provenance_summary.corroborated++;
    }
  }
  
  // Check key findings
  const findings = briefing.key_findings || [];
  for (const finding of findings) {
    tagged.provenance_summary.total_claims++;
    const findingText = (finding.finding || finding.title || '').toLowerCase();
    const queryOverlap = queryTerms.filter(t => findingText.includes(t)).length;
    const overlapRatio = queryTerms.length > 0 ? queryOverlap / queryTerms.length : 0;
    
    if (overlapRatio > 0.7 && (!finding.evidence || finding.source === '')) {
      tagged.user_asserted_claims.push({
        claim: finding.finding || finding.title,
        tag: 'USER_ASSERTED',
        weight: 0,
        reason: 'Finding mirrors user query without independent source'
      });
      tagged.provenance_summary.user_asserted++;
    } else {
      tagged.independently_corroborated.push({
        claim: finding.finding || finding.title,
        tag: 'CORROBORATED',
        weight: 1
      });
      tagged.provenance_summary.corroborated++;
    }
  }
  
  return tagged;
}


// ===== REALITY GATE ENGINE =====
// Validates whether source evidence actually supports the user's query
// before allowing the pipeline to generate analysis. Prevents fabricated
// inputs from producing authoritative-looking but baseless output.
function realityGate(query, sources, sourceContext) {
  const result = {
    passed: true,
    reality_score: 100,
    verdict: 'VERIFIED',
    flags: [],
    evidence_density: 0,
    source_corroboration: 0,
    recommendation: null,
    details: {}
  };

  // ---- QUERY TYPE DETECTION ----
  // URLs, trend queries, and exploratory research should ALWAYS pass through
  const isUrl = /^https?:\/\//i.test(query.trim()) || /\.(com|org|net|io|gov|edu)(\/|$)/i.test(query.trim());
  const isExploration = /^(what|how|why|when|where|who|tell me|explain|show me|find|search|latest|trending|current|recent|top|best|compare)/i.test(query.trim());
  const isTrendQuery = /(trend|viral|popular|buzz|hot topic|breaking|this week|today|tonight|tomorrow)/i.test(query);
  const isClaim = /\b(discovered|invented|announced|confirmed|proved|found that|created|developed|achieved|broke)\b/i.test(query) && /\b(Dr\.|Prof\.|[A-Z][a-z]+ [A-Z][a-z]+)\b/.test(query);
  
  const queryType = isUrl ? 'URL_ANALYSIS' : isClaim ? 'CLAIM_VERIFICATION' : (isExploration || isTrendQuery) ? 'EXPLORATION' : 'GENERAL';
  result.details.query_type = queryType;

  // URLs and exploration queries get automatic pass - SubMind should analyze ANYTHING
  if (queryType === 'URL_ANALYSIS' || queryType === 'EXPLORATION') {
    result.passed = true;
    result.verdict = 'VERIFIED';
    result.reality_score = 75; // Default good score for explorations
    result.recommendation = null;
    // Still do light checks for scoring display purposes
    const sourceCount = sources ? sources.length : 0;
    const contextLen = (sourceContext || '').length;
    if (sourceCount === 0) result.reality_score = 50;
    if (contextLen < 200) result.reality_score = Math.min(result.reality_score, 45);
    if (sourceCount > 3 && contextLen > 500) result.reality_score = 85;
    result.evidence_density = Math.min(100, contextLen / 30);
    result.source_corroboration = sourceCount > 0 ? Math.min(100, sourceCount * 15) : 0;
    return result;
  }

  // ---- For CLAIM_VERIFICATION and GENERAL queries, run full checks ----
  const sourceCount = sources ? sources.length : 0;
  
  // CHECK 1: Source Quantity
  let sourceScore = 100;
  if (sourceCount === 0) {
    sourceScore = 0;
    result.flags.push('ZERO_SOURCES: No external sources found for this claim');
  } else if (sourceCount <= 2) {
    sourceScore = 40;
    result.flags.push('MINIMAL_SOURCES: Only ' + sourceCount + ' source(s) found');
  } else if (sourceCount <= 4) {
    sourceScore = 70;
  }
  result.details.source_quantity_score = sourceScore;

  // CHECK 2: Source-Query Relevance
  const queryWords = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['what','when','where','which','that','this','from','with','about','have','will','been','more','than','into','also','does','most','they','some','were','each','make','like','just','over','such','after','year','could','them','only','then','these','other'].includes(w));
  
  const contextLower = (sourceContext || '').toLowerCase();
  let matchedTerms = 0;
  let unmatchedTerms = [];
  for (const word of queryWords) {
    if (contextLower.includes(word)) {
      matchedTerms++;
    } else {
      unmatchedTerms.push(word);
    }
  }
  
  const relevanceRatio = queryWords.length > 0 ? matchedTerms / queryWords.length : 0.5;
  let relevanceScore = Math.round(relevanceRatio * 100);
  if (relevanceRatio < 0.2 && queryType === 'CLAIM_VERIFICATION') {
    result.flags.push('LOW_RELEVANCE: Sources don\'t appear to discuss key claim terms');
  }
  result.details.relevance_score = relevanceScore;
  result.details.unmatched_key_terms = unmatchedTerms.slice(0, 8);

  // CHECK 3: Evidence Density
  const contextLength = (sourceContext || '').length;
  let densityScore = 100;
  if (contextLength < 200) {
    densityScore = 15;
    result.flags.push('EMPTY_EVIDENCE: Almost no source content retrieved');
  } else if (contextLength < 500) {
    densityScore = 40;
    result.flags.push('THIN_EVIDENCE: Very little source content available');
  } else if (contextLength < 1000) {
    densityScore = 65;
  }
  result.details.evidence_density_score = densityScore;

  // CHECK 4: Source URL Quality
  let urlQualityScore = 70; // Default reasonable
  if (sources && sources.length > 0) {
    const hasRealDomains = sources.some(s => s.url && !/google\.com\/search|bing\.com\/search/.test(s.url));
    const hasAcademic = sources.some(s => s.url && /\.edu|arxiv|nature\.com|science\.org|pubmed|ieee/.test(s.url));
    if (hasRealDomains) urlQualityScore = 80;
    if (hasAcademic) urlQualityScore = 95;
    if (!hasRealDomains) {
      urlQualityScore = 30;
      result.flags.push('SEARCH_ONLY_URLS: No direct source URLs, only search redirects');
    }
  }
  result.details.url_quality_score = urlQualityScore;

  // CHECK 5: Fabrication Indicators (only for claims)
  let fabricationRisk = 0;
  if (queryType === 'CLAIM_VERIFICATION') {
    const specificityCues = (query.match(/\b(Dr\.|Prof\.|January|February|March|April|May|June|July|August|September|October|November|December|\d{4})\b/gi) || []).length;
    if (specificityCues >= 3 && relevanceRatio < 0.3) {
      fabricationRisk = 80;
      result.flags.push('FABRICATION_RISK: Highly specific claim with no corroborating evidence');
    } else if (specificityCues >= 2 && relevanceRatio < 0.2) {
      fabricationRisk = 60;
      result.flags.push('UNVERIFIABLE_CLAIMS: Specific claims in query have no source backing');
    }
  }
  result.details.fabrication_risk = fabricationRisk;

  // ---- AGGREGATE SCORING ----
  const weights = { source: 0.20, relevance: 0.25, density: 0.20, urlQuality: 0.10, fabrication: 0.25 };
  const fabricationPenalty = fabricationRisk > 0 ? (100 - fabricationRisk) : 100;
  
  result.reality_score = Math.round(
    sourceScore * weights.source +
    relevanceScore * weights.relevance +
    densityScore * weights.density +
    urlQualityScore * weights.urlQuality +
    fabricationPenalty * weights.fabrication
  );
  
  result.evidence_density = densityScore;
  result.source_corroboration = relevanceScore;

  // ---- VERDICT ----
  // Only block reports that are clearly fabricated (very low score + fabrication flags)
  if (result.reality_score >= 60) {
    result.verdict = 'VERIFIED';
    result.passed = true;
    result.recommendation = null;
  } else if (result.reality_score >= 30) {
    result.verdict = 'LOW_CONFIDENCE';
    result.passed = true; // Still passes but with warnings
    result.recommendation = 'CAUTION: Limited evidence found. Results may rely heavily on AI inference rather than verified sources.';
  } else if (fabricationRisk >= 60) {
    result.verdict = 'UNVERIFIED';
    result.passed = false;
    result.recommendation = 'WARNING: SubMind could not find credible sources to support this query. The information below is based on minimal or no external evidence and should NOT be treated as reliable intelligence.';
  } else {
    // Even low scores pass through - just with heavy warnings
    result.verdict = 'LOW_CONFIDENCE';
    result.passed = true;
    result.recommendation = 'NOTE: Limited source material available. Treat conclusions as preliminary.';
  }

  return result;
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
        version: '13.0',
        ...health
      });
    } catch(e) {
      return res.status(500).json({ error: 'Healthcheck failed', detail: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

    // ===== QUERY PREPROCESSING =====
  const queryIntel = preprocessQuery(query);
  console.log('[Preprocessor] Domain:', queryIntel.classification.primary_domain,
    '| Entities:', queryIntel.entities.length,
    '| Depth:', queryIntel.classification.research_depth,
    '| Temporal:', queryIntel.classification.temporal_context);

  const startTime = Date.now();
  const cacheKey = 'submind:q:' + query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 200);

    // ===== URL CONTENT EXTRACTION (if URL detected) =====
    let urlContent = null;
    const urlMatch = query.match(/https?:\/\/[^\s]+/) || query.match(/(?:www\.)?[a-zA-Z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?/);
    if (urlMatch) {
      let extractUrl = urlMatch[0];
      if (!extractUrl.startsWith('http')) extractUrl = 'https://' + extractUrl;
      console.log('[URL Extract] Fetching content from:', extractUrl);
      urlContent = await fetchUrlContent(extractUrl, 4000);
      if (urlContent.success) {
        console.log('[URL Extract] Success - Title:', urlContent.title, 'Content length:', urlContent.contentLength);
      } else {
        console.log('[URL Extract] Failed:', urlContent.error);
        urlContent = null;
      }
    }


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

    // ===== LAYER 1: ENTITY VERIFICATION =====
    console.log('[Layer 1] Verifying entities against securities databases...');
    const entityVerification = await verifyEntity(queryIntel);
    console.log('[Layer 1] Verified:', entityVerification.verified.length, '| Unverifiable:', entityVerification.unverifiable.length, '| Pass:', entityVerification.pass);
    
    // If entity verification fails completely, short-circuit with blocked response
    if (!entityVerification.pass) {
      console.log('[Layer 1] BLOCKED - Unverifiable entities:', entityVerification.unverifiable.join(', '));
      const blockedPayload = {
        success: true,
        query,
        blocked: true,
        synthetic_data_detected: true,
        block_reason: 'ENTITY_VERIFICATION_FAILED',
        message: 'SubMind could not verify the referenced entities against financial databases. The ticker(s) [' + entityVerification.unverifiable.join(', ') + '] returned no results. SubMind only analyzes what it can independently corroborate.',
        entity_verification: entityVerification,
        meta: { version: '13.0', pipeline: ['preprocess', 'entity_verify'], blocked_at: 'Layer 1 - Entity Verification' }
      };
      // Still cache the blocked result to avoid repeated lookups
      try { await redisSet(cacheKey, { data: blockedPayload, timestamp: new Date().toISOString() }, 600); } catch(e) {}
      res.status(200).json(blockedPayload);
      return;
    }

  const supabase = makeSupabase();
  console.log('[SubMind v13.0] Query:', query);

  try {
    // ===== PHASE 1: PARALLEL SOURCE GATHERING =====
    console.log('[Phase 1] Parallel source gathering...');
    const [geminiResult, openaiResult, deepResult] = await Promise.allSettled([
      geminiGroundedSearch(query),
      openaiEnrichedContext(query),
      geminiDeepSourceSearch(queryIntel.enriched)
    ]);

    const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : { sources: [], context: '' };
    const openai = openaiResult.status === 'fulfilled' ? openaiResult.value : { sources: [], context: '' };
    const deep = deepResult.status === 'fulfilled' ? deepResult.value : { sources: [] };
    const groundedSources = [...gemini.sources, ...deep.sources, ...openai.sources];
    const combinedContext = [gemini.context, openai.context].filter(Boolean).join('\n\n');
    console.log('[Phase 1] Gemini sources:', gemini.sources.length, '| Deep sources:', deep.sources.length, '| OpenAI sources:', openai.sources.length);

    // ===== PHASE 2: INTELLIGENCE BRIEFING =====
    // ---- Phase 1.5: REALITY GATE ----
    const allSourcesForGate = [...(gemini.sources || []), ...(deep.sources || [])];
    const realityCheck = realityGate(query, allSourcesForGate, combinedContext);
    let gatedContext;
    console.log('[Reality Gate] Score:', realityCheck.reality_score, '| Verdict:', realityCheck.verdict, '| Flags:', realityCheck.flags.length);
    
    // If reality gate fails hard, inject warning into the context
    const enrichedContext = queryIntel.entities.length > 0 
      ? combinedContext + '\n\nKEY ENTITIES: ' + queryIntel.entities.map(e => e.name + ' (' + e.type + ')').join(', ') 
        + '\nDOMAIN: ' + queryIntel.classification.primary_domain
        + '\nSEARCH ANGLES: ' + queryIntel.search_angles.join('; ')
        : combinedContext;
    // Apply Reality Gate to context
    if (realityCheck.verdict === 'UNVERIFIED') {
      gatedContext = 'CRITICAL REALITY GATE WARNING: SubMind found NO credible external evidence supporting this query. Reality Score: ' + realityCheck.reality_score + '/100. Flags: ' + realityCheck.flags.join('; ') + '. You MUST acknowledge this lack of evidence prominently in your briefing. Do NOT present unverified claims as facts. State clearly what could NOT be verified.\n\n' + enrichedContext;
    } else if (realityCheck.verdict === 'LOW_CONFIDENCE') {
      gatedContext = 'REALITY GATE CAUTION: Evidence quality is low for this query. Reality Score: ' + realityCheck.reality_score + '/100. Flags: ' + realityCheck.flags.join('; ') + '. Clearly distinguish between verified facts and speculation in your briefing.\n\n' + enrichedContext;
    } else {
      gatedContext = enrichedContext;
    }

    console.log('[Phase 2] Generating intelligence briefing...');
    // ===== ENRICH CONTEXT WITH URL CONTENT =====
    if (urlContent && urlContent.success) {
      const urlContextBlock = '\n\n=== EXTRACTED CONTENT FROM USER URL ===\n' +
        'Source: ' + urlContent.url + '\n' +
        'Title: ' + urlContent.title + '\n' +
        'Site: ' + urlContent.siteName + '\n' +
        'Content: ' + urlContent.content.substring(0, 3000) + '\n' +
        '=== END EXTRACTED CONTENT ===\n';
      gatedContext = urlContextBlock + gatedContext;
      console.log('[URL Inject] Enriched context with URL content');
    }

    
    // Run briefing + multi-model consensus in parallel for speed
    const [briefingResult, consensusResult] = await Promise.allSettled([
      generateBriefing(query, gatedContext),
      multiModelConsensus(query, gatedContext, urlContent)
    ]);
    const { briefing, provider: briefingProvider, raw_length } = briefingResult.status === 'fulfilled' ? briefingResult.value : { briefing: null, provider: 'none', raw_length: 0 };
    const consensus = consensusResult.status === 'fulfilled' ? consensusResult.value : { consensusScore: 50, modelAgreement: 'UNKNOWN', mergedClaims: [], hiddenInsights: [] };
    console.log('[Consensus] Score:', consensus.consensusScore, 'Agreement:', consensus.modelAgreement);

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

    // ===== LAYER 2: SOURCE EXISTENCE CHECK =====
    console.log('[Layer 2] Checking source existence & tagging synthetics...');
    const { sources: existenceTaggedSources, existence_check: sourceExistence } = tagSyntheticSources(verifiedSources, verificationStats);
    console.log('[Layer 2] Confirmed:', sourceExistence.confirmed, '| Synthetic:', sourceExistence.synthetic, '| Rate:', sourceExistence.existence_rate + '%', '| Pass:', sourceExistence.pass);
    
    // ===== LAYER 3: CONFIDENCE FLOOR ENFORCEMENT =====
    console.log('[Layer 3] Enforcing confidence floor...');
    const confidenceFloor = enforceConfidenceFloor(entityVerification, sourceExistence);
    console.log('[Layer 3] Entity gate:', confidenceFloor.enforcement.entity_gate, '| Source gate:', confidenceFloor.enforcement.source_gate, '| Overall:', confidenceFloor.enforcement.overall);
    
    if (confidenceFloor.blocked) {
      console.log('[Layer 3] REPORT BLOCKED - Synthetic data detected');
      const blockedPayload = {
        success: true,
        query,
        blocked: true,
        synthetic_data_detected: true,
        block_reason: 'CONFIDENCE_FLOOR_FAILED',
        message: 'SubMind detected insufficient verifiable data to generate a reliable report. ' + confidenceFloor.reasons.map(r => r.message).join(' '),
        confidence_floor: confidenceFloor,
        entity_verification: entityVerification,
        source_existence: sourceExistence,
        briefing: { ...briefing, sources: existenceTaggedSources },
        meta: { version: '13.0', pipeline: ['preprocess', 'entity_verify', 'search', 'briefing', 'merge', 'verify_urls', 'existence_check', 'confidence_floor'], blocked_at: 'Layer 3 - Confidence Floor' }
      };
      try { await redisSet(cacheKey, { data: blockedPayload, timestamp: new Date().toISOString() }, 600); } catch(e) {}
      res.status(200).json(blockedPayload);
      return;
    }

    // ===== PHASE 5: SOURCE PROVENANCE CLASSIFICATION =====
    console.log('[Phase 5] Classifying source provenance...');
    const classifiedSources = existenceTaggedSources.map(src => ({
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


    // ===== PHASE 10: CONTRADICTION DETECTION =====
    console.log('[Phase 10] Contradiction detection...');
    const contradictionData = detectContradictions(briefing);
    console.log('[Phase 10] Contradictions:', contradictionData.count, '| Integrity:', contradictionData.integrity_score);

    // ===== PHASE 11: CONFIDENCE CALIBRATION =====
    console.log('[Phase 11] Confidence calibration...');
    const calibratedConf = calibrateConfidence(briefing, glassFang, nemesis, contradictionData, divergenceData);
    console.log('[Phase 11] Raw:', calibratedConf.raw_confidence, '-> Calibrated:', calibratedConf.calibrated_confidence, '| Tier:', calibratedConf.confidence_tier);

    // ===== PHASE 12: STRATEGIC INTELLIGENCE =====
    console.log('[Phase 12] Generating strategic intelligence...');
    const strategicIntel = generateStrategicIntel(briefing, divergenceData, contradictionData);
    console.log('[Phase 12] Strategies:', strategicIntel.count, '| Stance:', strategicIntel.overall_stance);

    // ===== LAYER 4: INPUT PROVENANCE TAGGING =====
    console.log('[Layer 4] Tagging input provenance...');
    const inputProvenance = tagInputProvenance(briefing, query);
    console.log('[Layer 4] User-asserted:', inputProvenance.provenance_summary.user_asserted, '| Corroborated:', inputProvenance.provenance_summary.corroborated);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('[SubMind v13.0] Complete in', elapsed + 's');

    // ===== PERSIST TO SUPABASE + CACHE =====
    const responsePayload = {
      success: true,
      query,
      multi_model_consensus: consensus,
      url_analysis: urlContent ? { extracted: true, title: urlContent.title, site: urlContent.siteName, contentLength: urlContent.contentLength } : null,
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
        query_intelligence: queryIntel,
        source_clusters: clusterData,
        provenance_summary: provenanceSummary,
        reality_gate: realityCheck,
        contradictions: contradictionData,
        strategic_intel: strategicIntel,
        confidence_calibration: calibratedConf,
        entity_verification: entityVerification,
        source_existence: sourceExistence,
        confidence_floor: confidenceFloor,
        input_provenance: inputProvenance
      },
      meta: {
        version: '13.0',
        elapsed_seconds: parseFloat(elapsed),
        providers: {
          search: gemini.sources.length > 0 ? 'gemini' : 'openai',
          briefing: briefingProvider,
          source_count: classifiedSources.length,
          grounded_sources: gemini.sources.length + deep.sources.length,
          ai_referenced_sources: openai.sources.length
        },
        source_verification: verificationStats,
        pipeline: ['preprocess', 'entity_verify', 'search', 'reality_gate', 'briefing', 'merge', 'verify_urls', 'existence_check', 'confidence_floor', 'provenance', 'cluster', 'divergence', 'glass_fang', 'nemesis', 'contradictions', 'calibration', 'strategic_intel', 'input_provenance']
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
    console.error('[SubMind v14.0] Fatal:', e.message);
    return res.status(500).json({ error: 'Pipeline failed', detail: e.message });
  }
          }
