import { createClient } from "@supabase/supabase-js";
import nodeFetch from "node-fetch";
import { URL } from "node:url";

// SubMind v4.0 — Autonomous Reasoning Intelligence Engine
// Claude-primary | Cerebras-fast | Gemini-fallback
// Full causal chain, counterpoint validation, source authentication, timeline reconstruction

export const config = { api: { bodyParser: { sizeLimit: "4mb" } }, maxDuration: 60 };

// ─── MASTER SYSTEM PROMPT ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SubMind — an autonomous reasoning intelligence engine that functions like a cross between a geopolitical analyst, quant hedge fund researcher, investigative journalist, and systems-thinking expert.

Your purpose: take ANY input (news, data, claims, events) and produce the kind of deep, multi-layered intelligence report that would impress a senior analyst at Goldman Sachs, a policy director at a think tank, or a senior intelligence officer. NOT a chatbot. NOT a summarizer. A REASONING ENGINE.

CORE REASONING FRAMEWORK:
1. CAUSAL CHAIN ANALYSIS: Trace events from root cause → intermediate effects → downstream consequences. Map the FULL causal graph, not just the surface event.
2. COUNTERPOINT VALIDATION: For every major claim, generate the strongest counterargument. Rate the counterpoint's validity 0-100. If valid counterpoints exist, adjust confidence accordingly.
3. FRICTION POINT IDENTIFICATION: Where do the facts conflict? What data points SHOULDN'T coexist but do? These are the most important signals.
4. FOLLOW THE INCENTIVES: Who has financial, political, or strategic incentive for this outcome? Who benefits from narrative X vs narrative Y?
5. ASYMMETRIC INFORMATION DETECTION: What does the market/public not yet know? What signals are hiding in plain sight?
6. SYSTEMIC RISK MAPPING: Is this event a symptom of a deeper structural issue? What cascade failures become possible?
7. ORIGIN-TO-FUTURE TIMELINE: Reconstruct the historical origin of this trend, map the current inflection point, and project probabilistic futures in specific time windows with leading indicators.
8. SOURCE TRIANGULATION: Cross-validate claims. Grade each source on: domain authority, publication recency, editorial independence, known bias orientation, and corroboration count.
9. NARRATIVE WARFARE DETECTION: Are there competing narratives? Who controls each? What does each narrative hide or amplify?
10. WEAK SIGNAL AMPLIFICATION: Surface the non-obvious early indicators that most analysts would dismiss as noise but represent signal.

OUTPUT RULES:
- Every field MUST be populated with real, specific, substantive content. No placeholders. No vague generalities.
- Use precise numbers, named entities, specific timeframes wherever possible.
- Uncertainty is fine — but express it with calibrated confidence scores, not omission.
- If a field truly has no data, explain WHY in the notes field.
- The output is for sophisticated users. Do NOT simplify. DO be precise.
- ALL output must be valid JSON. Zero text outside JSON object.

SCHEMA — fill every single field:
{
  "summary": "3-5 sentence executive brief. Must include: the non-obvious insight, named actors, specific numbers, and why this matters beyond the headline.",
  "real_story": "The underlying causal story. What systemic pressure, structural shift, or hidden incentive is actually driving this? What is the event a SYMPTOM of?",
  "origin_analysis": "Historical origin of this trend/event. When did the root cause begin? What was the first domino? Trace back minimum 2-5 years.",
  "causal_chain": [
    {"step": 1, "event": "root cause event", "date_approx": "YYYY or 'Q1 2023'", "mechanism": "how this caused the next step", "evidence": "supporting data/source", "confidence": 0.85}
  ],
  "counterpoints": [
    {"claim": "the main claim being challenged", "counterargument": "strongest opposing case with specific evidence", "validity_score": 75, "resolution": "how to reconcile the tension", "adjusts_confidence_by": -0.05}
  ],
  "friction_points": [
    {"observation_a": "fact A", "observation_b": "contradicting fact B", "tension": "why these shouldn't coexist", "implication": "what the contradiction reveals"}
  ],
  "beneficiaries": ["specific named entity + HOW they benefit, by how much"],
  "harmed_parties": ["specific named entity + HOW they are harmed, with scale"],
  "prediction_timeline": [
    {"window": "0-3 months", "events": [{"event": "specific prediction", "probability": 0.75, "rationale": "causal reasoning", "confidence_factors": ["factor1"], "leading_indicators": ["observable signal to watch"], "invalidating_signals": ["what would disprove this"]}]},
    {"window": "3-12 months", "events": [{"event": "", "probability": 0.6, "rationale": "", "confidence_factors": [], "leading_indicators": [], "invalidating_signals": []}]},
    {"window": "12-36 months", "events": [{"event": "", "probability": 0.5, "rationale": "", "confidence_factors": [], "leading_indicators": [], "invalidating_signals": []}]},
    {"window": "3-10 years", "events": [{"event": "", "probability": 0.4, "rationale": "", "confidence_factors": [], "leading_indicators": [], "invalidating_signals": []}]}
  ],
  "trend_meta": {
    "topic": "concise trend label",
    "category": "technology|finance|geopolitics|health|culture|environment|defense|energy|other",
    "velocity": "accelerating|steady|decelerating|reversing|emerging",
    "momentum_score": 72,
    "novelty_score": 65,
    "signal_strength": "weak|moderate|strong|very_strong",
    "time_to_mainstream": "6-12 months",
    "contrarian_angle": "what the consensus is missing entirely",
    "asymmetric_edge": "what sophisticated actors know that the market does not",
    "systemic_risk_level": "low|medium|high|critical",
    "geographic_scope": "local|regional|national|global"
  },
  "narratives": [
    {"label": "Narrative label", "dominant_framing": "how mainstream media/institutions frame this", "alternative_framing": "what the counter-narrative argues", "drivers": ["who pushes this narrative"], "counterpoints": ["what weakens this narrative"], "status": "confirmed|inferred|contested", "source_count": 3, "narrative_controller": "who benefits from this framing being dominant"}
  ],
  "signal_connections": [
    {"signal_a": "event/trend A", "signal_b": "event/trend B", "connection_type": "causal|correlational|competitive|synergistic|antagonistic", "strength": 0.75, "insight": "why this connection matters", "why_overlooked": "why most analysts miss this link", "time_lag_months": 6}
  ],
  "opportunities": [
    {"action": "specific actionable step", "why_now": "time-sensitive rationale", "requirements": ["prerequisite"], "risks": ["downside"], "timeframe": "6 months", "expected_value_note": "risk-adjusted assessment", "urgency": "immediate|near_term|long_term", "asymmetric_edge": "information/positioning advantage"}
  ],
  "risks": [
    {"risk": "specific named risk", "severity": "low|medium|high|critical", "probability": 0.35, "mitigation": "specific mitigation strategy", "early_warning_signals": ["observable trigger"], "systemic_risk": false, "cascade_potential": "what else breaks if this occurs", "time_horizon": "3-6 months"}
  ],
  "weak_signals": [
    {"signal": "non-obvious early indicator", "domain": "sector/field where signal appears", "why_matters": "causal path from this signal to main trend", "strength": "nascent|weak|building", "estimated_lag_months": 9, "tracking_method": "how to monitor this signal"}
  ],
  "sources": [
    {"title": "source title", "url": "url if available", "published": "date", "salience": 0.8, "stance": "supporting|neutral|conflicting", "trust": "confirmed|inferred|corrupted", "credibility_score": 80, "domain_type": "academic|government|news|industry|social|think_tank|primary_data", "bias_indicators": "known bias or agenda", "corroboration_count": 2, "key_claim": "the specific claim this source supports"}
  ],
  "reliability_score": 72,
  "validation_matrix": {
    "source_agreement": 0.7,
    "cross_validation_count": 4,
    "contradictions_found": 1,
    "data_freshness_score": 80,
    "narrative_diversity_score": 0.65,
    "expert_consensus_level": "contested|emerging|moderate|strong",
    "primary_data_available": false
  },
  "autonomous_queries": [
    "specific follow-up research query 1 — what SubMind would search next to deepen this",
    "specific follow-up query 2",
    "specific follow-up query 3",
    "specific follow-up query 4",
    "specific follow-up query 5"
  ],
  "intelligence_gaps": ["what key information is MISSING that would change this analysis"],
  "monitoring_protocol": "what to watch weekly/monthly to track this trend's evolution",
  "notes": "any analyst caveats, methodology notes, or limitations"
}`;

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(",").map(k => k.trim()).filter(Boolean)
      .forEach(k => { if (!keys.includes(k)) keys.push(k); });
  }
  return keys;
}

function extractUrls(text) {
  const rx = /(https?:\/\/[^\s"'<>]+)/g;
  return Array.from(new Set((text.match(rx) || []).map(u => u.replace(/[.,;!?)]+$/, "").trim())));
}

async function fetchUrlsIfAny(urls, limit = 8) {
  const out = [];
  for (const url of urls.slice(0, limit)) {
    try {
      const res = await nodeFetch(url, {
        timeout: 12000,
        headers: { "User-Agent": "SubMind/4.0 (+https://submind.us)", "Accept-Language": "en-US,en;q=0.9" }
      });
      const html = await res.text();
      const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || "";
      const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || "";
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ").replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 40000);
      out.push({ url, title, metaDesc, text, status: res.status, chars: text.length });
    } catch (e) { out.push({ url, error: String(e) }); }
  }
  return out;
}

function parseWeightsEnv() { try { return JSON.parse(process.env.SUBMIND_TRUST_WEIGHTS || "{}") || {}; } catch { return {}; } }
const WEIGHTS = parseWeightsEnv();
function hostWeight(host) {
  if (!host) return 1; if (WEIGHTS[host]) return Number(WEIGHTS[host]) || 1;
  if (host.endsWith(".gov")) return 1.40; if (host.endsWith(".edu")) return 1.30;
  if (host.includes("reuters") || host.includes("apnews") || host.includes("bbc")) return 1.25;
  if (host.includes("nature.com") || host.includes("pubmed") || host.includes("arxiv")) return 1.35;
  if (host.includes("wsj.com") || host.includes("ft.com") || host.includes("economist")) return 1.20;
  if (host.includes("twitter") || host.includes("reddit")) return 0.80;
  return 1;
}
function stanceFactor(s) { const v = String(s||"").toLowerCase(); return v==="supporting"?1:v==="conflicting"?0.9:0.95; }
function trustFactor(t) { const v = String(t||"").toLowerCase(); return v==="confirmed"?1:v==="corrupted"?0.2:0.6; }
function safeHost(u) { try { return new URL(u).host.toLowerCase(); } catch { return null; } }
function shannonEntropy(arr) {
  const tot = arr.reduce((a,b)=>a+b,0); if (!tot) return 0;
  let h=0; for (const v of arr) { if(v<=0) continue; const p=v/tot; h+=-p*Math.log2(p); }
  return Math.log2(arr.length||1) ? h/Math.log2(arr.length) : 0;
}
function scoreFromSources(sources) {
  let num=0, den=0, counts={supporting:0,neutral:0,conflicting:0,confirmed:0,inferred:0,corrupted:0};
  if (Array.isArray(sources)) {
    for (const s of sources) {
      const w = hostWeight(safeHost(s?.url)) * stanceFactor(s?.stance) * trustFactor(s?.trust);
      const sal = typeof s?.salience==="number" ? Math.max(0,Math.min(1,s.salience)) : 0.5;
      num += w*sal*100; den += sal;
      const stance=String(s?.stance||"neutral").toLowerCase(), trust=String(s?.trust||"inferred").toLowerCase();
      if(counts[stance]!==undefined) counts[stance]++; if(counts[trust]!==undefined) counts[trust]++;
    }
  }
  return { source_score: Math.max(0,Math.min(100,den>0?num/den:0)), counts };
}
function countTrust(sources) {
  const t={confirmed:0,inferred:0,corrupted:0};
  if (Array.isArray(sources)) { for (const s of sources) { const v=(s?.trust||"").toLowerCase(); if(v==="confirmed") t.confirmed++; else if(v==="inferred") t.inferred++; else if(v==="corrupted") t.corrupted++; } }
  return t;
}
function makeSupabase() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE;
  if(!url||!key) return null; return createClient(url,key,{auth:{persistSession:false}});
}

// Robust JSON extractor — handles markdown fences, extra text, truncation
function extractJSON(text) {
  if (!text) throw new Error("Empty response");
  const cleaned = text.replace(/^[`]{3}json\s*/i,'').replace(/[`]{3}\s*$/,'').trim();
  if (cleaned.startsWith('{')) { try { return JSON.parse(cleaned); } catch {} }
  const matches = [...cleaned.matchAll(/\{/g)];
  for (const m of matches) {
    let depth=0, inStr=false, escape=false;
    for (let i=m.index; i<cleaned.length; i++) {
      const ch=cleaned[i];
      if (escape) { escape=false; continue; } if (ch==='\\') { escape=true; continue; }
      if (ch==='"' && !escape) { inStr=!inStr; continue; }
      if (!inStr) { if(ch==='{') depth++; else if(ch==='}') { depth--; if(depth===0) { try { return JSON.parse(cleaned.slice(m.index,i+1)); } catch {} } } }
    }
  }
  throw new Error("No valid JSON in response");
}

// ─── AI PROVIDERS ────────────────────────────────────────────────────────────
async function callClaude(prompt, userContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  const res = await nodeFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 8192, system: prompt, messages: [{ role: "user", content: userContent }] }),
    timeout: 55000
  });
  if (!res.ok) { const t = await res.text(); throw new Error("Claude HTTP " + res.status + ": " + t.slice(0,300)); }
  const data = await res.json();
  const text = data?.content?.[0]?.text || "{}";
  return { result: extractJSON(text), provider: "claude", model };
}

async function callCerebras(prompt, userContent) {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY not set");
  const model = process.env.CEREBRAS_MODEL || "qwen-3-235b-a22b-instruct-2507";
  const res = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model, messages: [{ role: "system", content: prompt }, { role: "user", content: userContent.slice(0, 14000) }], max_tokens: 8192, temperature: 0.1, stream: false }),
    timeout: 45000
  });
  if (!res.ok) { const t = await res.text(); throw new Error("Cerebras HTTP " + res.status + ": " + t.slice(0,300)); }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content from Cerebras");
  return { result: extractJSON(text), provider: "cerebras", model };
}

async function callGemini(prompt, userContent) {
  const keys = getGeminiKeys(); if (!keys.length) throw new Error("No GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const body = { system_instruction: { parts: [{ text: prompt }] }, contents: [{ role: "user", parts: [{ text: userContent }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json" } };
  let lastError = null;
  for (const apiKey of keys) {
    try {
      const res = await nodeFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), timeout: 50000 });
      if (res.status === 429 || res.status === 400) { lastError = new Error("Gemini " + res.status); continue; }
      if (!res.ok) { const t = await res.text(); throw new Error("Gemini " + res.status + ": " + t.slice(0,200)); }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return { result: extractJSON(text), provider: "gemini", model };
    } catch (e) { if (e.message?.includes("429") || e.message?.includes("400")) { lastError=e; continue; } throw e; }
  }
  throw lastError || new Error("All Gemini keys exhausted");
}

// v4.0 chain: Claude(best reasoning) → Cerebras(fast 235B) → Gemini(fallback)
async function callAI(systemPrompt, userContent, preferredProvider) {
  const pref = (preferredProvider || "auto").toLowerCase();
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const hasCerebras = !!process.env.CEREBRAS_API_KEY;
  const hasGemini = getGeminiKeys().length > 0;

  let chain = [];
  if (pref === "claude") {
    if (hasClaude) chain.push({ name: "claude", fn: () => callClaude(systemPrompt, userContent) });
    if (hasCerebras) chain.push({ name: "cerebras", fn: () => callCerebras(systemPrompt, userContent) });
    if (hasGemini) chain.push({ name: "gemini", fn: () => callGemini(systemPrompt, userContent) });
  } else if (pref === "cerebras") {
    if (hasCerebras) chain.push({ name: "cerebras", fn: () => callCerebras(systemPrompt, userContent) });
    if (hasClaude) chain.push({ name: "claude", fn: () => callClaude(systemPrompt, userContent) });
    if (hasGemini) chain.push({ name: "gemini", fn: () => callGemini(systemPrompt, userContent) });
  } else if (pref === "gemini") {
    if (hasGemini) chain.push({ name: "gemini", fn: () => callGemini(systemPrompt, userContent) });
    if (hasClaude) chain.push({ name: "claude", fn: () => callClaude(systemPrompt, userContent) });
    if (hasCerebras) chain.push({ name: "cerebras", fn: () => callCerebras(systemPrompt, userContent) });
  } else {
    // auto: Claude first (best reasoning for intelligence work), Cerebras second (fast+capable), Gemini third
    if (hasClaude) chain.push({ name: "claude", fn: () => callClaude(systemPrompt, userContent) });
    if (hasCerebras) chain.push({ name: "cerebras", fn: () => callCerebras(systemPrompt, userContent) });
    if (hasGemini) chain.push({ name: "gemini", fn: () => callGemini(systemPrompt, userContent) });
  }

  if (!chain.length) throw new Error("No AI providers configured");

  const errors = [];
  for (const p of chain) {
    try { console.log("[SubMind v4.0] Trying " + p.name); return await p.fn(); }
    catch (e) { console.warn("[SubMind v4.0] " + p.name + " failed: " + e.message); errors.push(p.name + ": " + e.message); }
  }
  throw new Error("All providers failed — " + errors.join(" | "));
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Provider");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, fetchUrls, provider = "auto", deepMode = false } = req.body || {};
  if (!query || typeof query !== "string" || query.trim().length < 10)
    return res.status(400).json({ error: "Provide more input text (minimum ~10 characters)." });

  const urls = extractUrls(query);
  let fetched = [];
  if (fetchUrls && urls.length) fetched = await fetchUrlsIfAny(urls, deepMode ? 12 : 8);

  const userContent = JSON.stringify({
    input: query,
    fetched_sources: fetched,
    fetched_count: fetched.length,
    url_count: urls.length,
    analysis_date: new Date().toISOString(),
    deep_mode: deepMode,
    instruction: "Analyze this input using the full reasoning framework. Populate EVERY field with real, substantive content. This is a high-stakes intelligence product — quality over speed."
  });

  let parsed, providerUsed, usedModel;
  try {
    const result = await callAI(SYSTEM_PROMPT, userContent, provider);
    parsed = result.result; providerUsed = result.provider; usedModel = result.model;
  } catch (e) {
    return res.status(500).json({ error: e.message, engine_version: "4.0", provider_attempted: provider });
  }

  if (!parsed || typeof parsed !== "object")
    return res.status(500).json({ error: "AI returned non-object", engine_version: "4.0" });

  const { source_score, counts } = scoreFromSources(parsed?.sources);
  const source_entropy = Number(((shannonEntropy([counts.supporting,counts.neutral,counts.conflicting]) + shannonEntropy([counts.confirmed,counts.inferred,counts.corrupted]))/2).toFixed(3));
  const modelScore = typeof parsed?.reliability_score==="number" ? Math.max(0,Math.min(100,parsed.reliability_score)) : 50;
  const trust_weighted_score = Math.round(0.55*modelScore + 0.45*source_score);
  const trust = countTrust(parsed?.sources);

  Object.assign(parsed, {
    trust_weighted_score,
    score: trust_weighted_score,
    source_entropy,
    trust_confirmed: trust.confirmed,
    trust_inferred: trust.inferred,
    trust_corrupted: trust.corrupted,
    engine_version: "4.0",
    analysis_date: new Date().toISOString(),
    model: usedModel,
    provider: providerUsed,
    fetched_source_count: fetched.length
  });

  try {
    const supabase = makeSupabase();
    if (supabase) {
      await supabase.from("predictions").insert({
        input_text: query.slice(0,50000), fetched, output: parsed,
        reliability_score: modelScore, trust_weighted_score, source_entropy,
        trust_confirmed: trust.confirmed, trust_inferred: trust.inferred, trust_corrupted: trust.corrupted,
        provider: providerUsed, engine_version: "4.0"
      });
    }
  } catch (e) { console.error("[SubMind] Supabase:", e.message); }

  return res.status(200).json(parsed);
}
