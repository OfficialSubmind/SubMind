import nodeFetch from "node-fetch";

// SUBMIND v9.1 - DEEP INTELLIGENCE RESEARCH ENGINE
// URL-verified sources + Reasoning chain + Pattern engine + Glass Fang + Nemesis
// Every source link verified + SubMind reasoning chain + competitive features

const GEMINI_KEYS = (() => {
    const keys = [];
    if (process.env.GEMINI_API_KEYS) keys.push(...process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean));
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
    return [...new Set(keys)];
})();

const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "llama-4-scout-17b-16e-instruct";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

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
// Checks if a URL actually resolves (not 404/dead)
async function verifyUrl(url, timeoutMs = 4000) {
    if (!url || typeof url !== 'string') return { valid: false, status: 0 };
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await nodeFetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'SubMind/9.0 LinkVerifier' }
        });
        clearTimeout(timer);
        return { valid: res.status >= 200 && res.status < 400, status: res.status };
    } catch(e) {
        // HEAD might be blocked, try GET with range header
        try {
            const controller2 = new AbortController();
            const timer2 = setTimeout(() => controller2.abort(), 3000);
            const res2 = await nodeFetch(url, {
                method: 'GET',
                signal: controller2.signal,
                redirect: 'follow',
                headers: { 'User-Agent': 'SubMind/9.0 LinkVerifier', 'Range': 'bytes=0-0' }
            });
            clearTimeout(timer2);
            return { valid: res2.status >= 200 && res2.status < 400, status: res2.status };
        } catch(e2) {
            return { valid: false, status: 0 };
        }
    }
}

// Build a guaranteed-working search URL as fallback
function buildSearchFallback(source) {
    const title = (source.title || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const domain = (() => {
        try { return new URL(source.url).hostname; } catch(e) { return ''; }
    })();
    const q = domain ? `site:${domain} ${title}` : title;
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// Verify all sources in parallel and fix dead links
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
            // URL is dead - replace with search fallback
            const fallbackUrl = buildSearchFallback(src);
            return {
                ...src,
                original_url: src.url,
                url: fallbackUrl,
                verified: false,
                link_type: 'search',
                http_status: check.status,
                fallback_reason: `Original URL returned ${check.status || 'unreachable'}`
            };
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
    
    return {
        sources: verified,
        stats: { total: verified.length, verified: verifiedCount, fixed: fixedCount, failed: failedCount }
    };
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
            if (!res.ok) { 
                if (res.status === 429) continue;
                continue;
            }
            const data = await res.json();
            const sources = [];
            const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const supports = data?.candidates?.[0]?.groundingMetadata?.groundingSupports || [];
            
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
                messages: [{
                    role: "user",
                    content: `Research this topic and provide key facts with REAL source URLs from major outlets (reuters.com, apnews.com, bbc.com, cnbc.com, nytimes.com). Provide 5 verified facts with URLs. Topic: ${query}`
                }],
                temperature: 0.2,
                max_tokens: 1500
            })
        });
        if (!res.ok) return { context: '', sources: [], provider: 'openai' };
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        // Extract any URLs from the response
        const urlMatches = text.match(/https?:\/\/[^\s\)\]"'<>]+/g) || [];
        const sources = urlMatches.map(url => ({
            title: 'OpenAI Referenced Source',
            url: url.replace(/[.,;:]+$/, ''),
            type: 'ai_referenced',
            provider: 'openai'
        }));
        return { context: text, sources, provider: 'openai' };
    } catch(e) {
        return { context: '', sources: [], provider: 'openai' };
    }
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
                    content: `You are SubMind, a deep intelligence research engine that produces investment-grade analysis. You trace events from origin to present to future predictions.

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
- NEVER fabricate URL paths - a wrong URL destroys user trust

FORMAT: Return valid JSON with this structure:
{
  "title": "Intelligence Briefing Title",
  "summary": "2-3 sentence executive summary",
  "status": "CONFIRMED|DEVELOPING|PROJECTED|DISPUTED",
  "confidence": 85,
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "event": "What happened",
      "significance": "Why it matters",
      "sources": ["url1"]
    }
  ],
  "key_findings": [
    {
      "finding": "Specific finding with names, dates, numbers",
      "evidence": "Supporting evidence",
      "sources": ["url1"],
      "impact": "HIGH|MEDIUM|LOW"
    }
  ],
  "predictions": [
    {
      "prediction": "What SubMind projects will happen",
      "probability": 75,
      "timeframe": "Q3 2025",
      "basis": "Pattern recognition basis",
      "indicators": ["What to watch for"],
      "confidence_interval": "plus or minus 5%"
    }
  ],
  "pattern_analysis": {
    "historical_patterns": ["Past patterns identified"],
    "current_signals": ["Current indicators"],
    "convergence_points": ["Where patterns intersect"]
  },
    "reasoning_chain": [
    {
      "step": 1,
      "thought": "SubMind analytical reasoning step",
      "evidence": "What data supports this",
      "conclusion": "What this means"
    }
  ],
  "investment_relevance": {
    "sectors_affected": ["sector1"],
    "risk_level": "HIGH|MEDIUM|LOW",
    "opportunity_window": "timeframe",
    "key_metrics": ["metric1"]
  },
  "sources": [
    {
      "title": "Descriptive Source Title",
      "url": "https://exact-verified-url",
      "type": "primary|supporting|official|data",
      "date": "YYYY-MM-DD",
      "credibility": "HIGH|MEDIUM"
    }
  ],
  "methodology_note": "How SubMind reached these conclusions"
}`
                }, {
                    role: "user",
                    content: `Produce a comprehensive intelligence briefing on: ${query}

Available research context:\n${sourceContext.substring(0, 6000)}

Requirements:
1. Trace the ORIGIN of this topic - how it came to be, key historical events
2. Map the PRESENT state with specific data points, names, dates
3. Project the FUTURE using pattern recognition - what trends suggest
4. Include AT LEAST 8 sources with REAL, WORKING URLs
5. Every date must be YYYY-MM-DD format
6. Include investment relevance and what to watch for
7. Pattern analysis showing historical precedents and current signals
8. Make predictions with probability percentages, basis, and confidence intervals
9. Include a REASONING CHAIN showing SubMind step-by-step analytical process
10. Each reasoning step must have: step number, thought process, supporting evidence, and conclusion`
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
            body: {
                model: 'gpt-4o-mini',
                messages: providers[0].body.messages,
                temperature: 0.3,
                max_tokens: 4000
            }
        });
    }

    for (const provider of providers) {
        try {
            const res = await nodeFetch(provider.url, {
                method: 'POST',
                headers: provider.headers,
                body: JSON.stringify(provider.body)
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

// ===== GLASS FANG VALIDATION ENGINE =====
function glassFangValidation(briefing, sources, verificationStats) {
    const metrics = {};
    const s = briefing || {};
    
    // 1. Source Count & Quality
    const srcCount = (s.sources || []).length;
    metrics.source_depth = Math.min(100, srcCount * 10);
    
    // 2. Source Diversity
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
    const timeline = s.timeline || [];
    metrics.timeline_depth = Math.min(100, timeline.length * 15);
    
    // 11. Confidence Calibration
    const conf = s.confidence || 50;
    const hasStrong = srcCount >= 5 && findings.length >= 3;
    metrics.confidence_calibration = hasStrong ? Math.min(100, 60 + srcCount * 3) : Math.min(80, 40 + srcCount * 5);
    
    // 12. NEW: Source Verification Score
    if (verificationStats) {
        const vr = verificationStats.total > 0 ? (verificationStats.verified / verificationStats.total) * 100 : 0;
        metrics.source_verification = Math.round(vr);
    } else {
        metrics.source_verification = 0;
    }
    
    // Weighted composite
    const weights = {
        source_depth: 0.10, source_diversity: 0.08, temporal_coverage: 0.08,
        specificity: 0.10, prediction_quality: 0.10, evidence_chain: 0.12,
        cross_reference: 0.08, pattern_depth: 0.08, investment_relevance: 0.06,
        timeline_depth: 0.06, confidence_calibration: 0.06, source_verification: 0.08
    };
    
    let composite = 0;
    for (const [k, w] of Object.entries(weights)) {
        composite += (metrics[k] || 0) * w;
    }
    
    return { score: Math.round(composite), metrics, weights };
}

// ===== NEMESIS ADVERSARIAL ENGINE =====
function nemesisEngine(briefing) {
    const issues = [];
    const s = briefing || {};
    
    // Check for vague predictions
    for (const p of (s.predictions || [])) {
        if (!p.probability) issues.push({ type: 'weak_prediction', detail: 'Prediction missing probability: ' + (p.prediction || '').substring(0, 60) });
        if (!p.basis) issues.push({ type: 'unsubstantiated', detail: 'No basis for prediction: ' + (p.prediction || '').substring(0, 60) });
    }
    
    // Check for unsourced claims
    for (const f of (s.key_findings || [])) {
        if (!f.sources || !f.sources.length) issues.push({ type: 'unsourced_claim', detail: 'Finding lacks sources: ' + (f.finding || '').substring(0, 60) });
    }
    
    // Check timeline gaps
    const timeline = s.timeline || [];
    if (timeline.length < 3) issues.push({ type: 'thin_timeline', detail: 'Timeline has fewer than 3 events' });
    
    // Check confidence vs evidence alignment
    if ((s.confidence || 0) > 90 && (s.sources || []).length < 5) {
        issues.push({ type: 'overconfident', detail: 'Confidence >90% but fewer than 5 sources' });
    }
    
    // Check for missing dates
    const undated = timeline.filter(t => !t.date || t.date === 'Unknown');
    if (undated.length) issues.push({ type: 'missing_dates', detail: undated.length + ' timeline events without dates' });
    
    // Check reasoning chain quality
    const reasoning = s.reasoning_chain || [];
    if (reasoning.length < 2) issues.push({ type: 'weak_reasoning', detail: 'Reasoning chain has fewer than 2 steps' });
    const unsupported = reasoning.filter(r => !r.evidence);
    if (unsupported.length) issues.push({ type: 'unsupported_reasoning', detail: unsupported.length + ' reasoning steps lack evidence' });
    
    // Check source-finding alignment
    const findingSrcCount = (s.key_findings || []).filter(f => f.sources && f.sources.length > 0).length;
    const totalFindings = (s.key_findings || []).length;
    if (totalFindings > 0 && findingSrcCount / totalFindings < 0.5) {
        issues.push({ type: 'poorly_sourced_findings', detail: 'Less than 50% of findings have source citations' });
    }
    
    return { issues, count: issues.length, severity: issues.length > 5 ? 'HIGH' : issues.length > 2 ? 'MEDIUM' : 'LOW' };
}

// ===== SOURCE MERGING & DEDUPLICATION =====
function mergeSources(briefingSources, groundedSources) {
    const seen = new Set();
    const merged = [];
    
    // Priority: grounded search sources first (they have real URLs from Google)
    for (const src of groundedSources) {
        const key = src.url?.toLowerCase().replace(/\/$/, '');
        if (key && !seen.has(key)) {
            seen.add(key);
            merged.push({ ...src, merge_priority: 'grounded' });
        }
    }
    
    // Then briefing sources
    for (const src of (briefingSources || [])) {
        const key = src.url?.toLowerCase().replace(/\/$/, '');
        if (key && !seen.has(key)) {
            seen.add(key);
            merged.push({ ...src, merge_priority: 'briefing' });
        }
    }
    
    return merged;
}

// ===== MAIN HANDLER =====
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });
    
    const startTime = Date.now();
    console.log('[SubMind v9.1] Query:', query);
    
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
        
        // ===== PHASE 4: URL VERIFICATION (CRITICAL) =====
        console.log('[Phase 4] Verifying source URLs...');
        const { sources: verifiedSources, stats: verificationStats } = await verifyAndFixSources(mergedSources);
        console.log('[Phase 4] Verified:', verificationStats.verified, '| Fixed:', verificationStats.fixed, '| Total:', verificationStats.total);
        
        // ===== PHASE 5: GLASS FANG VALIDATION =====
        console.log('[Phase 5] Glass Fang validation...');
        const glassFang = glassFangValidation(briefing, verifiedSources, verificationStats);
        console.log('[Phase 5] Glass Fang Score:', glassFang.score + '/100');
        
        // ===== PHASE 6: NEMESIS ADVERSARIAL CHECK =====
        console.log('[Phase 6] Nemesis adversarial engine...');
        const nemesis = nemesisEngine(briefing);
        console.log('[Phase 6] Nemesis issues:', nemesis.count, '| Severity:', nemesis.severity);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('[SubMind v9.1] Complete in', elapsed + 's');
        
        // ===== RESPONSE =====
        return res.status(200).json({
            success: true,
            query,
            briefing: {
                ...briefing,
                sources: verifiedSources
            },
            validation: {
                glass_fang: glassFang,
                nemesis: nemesis
            },
            meta: {
                version: '9.1',
                elapsed_seconds: parseFloat(elapsed),
                providers: {
                    search: gemini.sources.length > 0 ? 'gemini' : 'openai',
                    briefing: briefingProvider,
                    source_count: verifiedSources.length,
                    grounded_sources: gemini.sources.length,
                    ai_referenced_sources: openai.sources.length
                },
                source_verification: verificationStats,
                pipeline: ['search', 'briefing', 'merge', 'verify_urls', 'glass_fang', 'nemesis']
            }
        });
    } catch(e) {
        console.error('[SubMind v9.1] Fatal:', e.message);
        return res.status(500).json({ error: 'Pipeline failed', detail: e.message });
    }
}
