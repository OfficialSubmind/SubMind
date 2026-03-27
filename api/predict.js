import { createClient } from "@supabase/supabase-js";
import nodeFetch from "node-fetch";
import { URL } from "node:url";

// SubMind v3.0 - Multi-provider AI: Claude+Cerebras+Gemini+HF fallback chain
// Enhanced schema with real_story, beneficiaries, weak_signals, autonomous_queries

const SYSTEM_PROMPT = `You are SubMind, an autonomous evidence-led foresight and intelligence engine. You find connections, patterns, and signals that human analysts miss.

Core directives:
- Output MUST be valid JSON matching the schema. Zero text outside JSON.
- Find the REAL story beneath the stated story. Second-order effects matter most.
- Apply multi-source validation: cross-check, flag contradictions, detect framing.
- Score source credibility: domain authority, recency, editorial independence.
- Trust: "confirmed" (multi-source) | "inferred" (single-source) | "corrupted" (contradicted).
- Identify WHO benefits and WHO is harmed. Follow the money. Follow the power.
- Detect HIDDEN connections that non-obvious analysis surfaces.
- Detect trend velocity: accelerating, steady, decelerating, reversing, emerging.
- Generate actionable intelligence, not summaries.

JSON schema (fill EVERY field with real data):
{
  "summary": "one-paragraph incisive synopsis with non-obvious insight",
  "real_story": "the underlying story beyond the surface narrative",
  "beneficiaries": ["who gains from this trend"],
  "harmed_parties": ["who loses or is displaced"],
  "trend_meta": {
    "topic": "concise trend name",
    "category": "technology|finance|geopolitics|health|culture|environment|other",
    "velocity": "accelerating|steady|decelerating|reversing|emerging",
    "momentum_score": 0,
    "novelty_score": 0,
    "signal_strength": "weak|moderate|strong|very_strong",
    "time_to_mainstream": "estimate when widely understood",
    "contrarian_angle": "what most analysts are missing"
  },
  "prediction_timeline": [
    {"window":"0-3 months","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[],"leading_indicators":[]}]},
    {"window":"3-12 months","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[],"leading_indicators":[]}]},
    {"window":"12-36 months","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[],"leading_indicators":[]}]},
    {"window":"3-10 years","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[],"leading_indicators":[]}]}
  ],
  "narratives": [
    {"label":"","drivers":[],"counterpoints":[],"status":"inferred","source_count":0,"dominant_framing":"","alternative_framing":""}
  ],
  "signal_connections": [
    {"signal_a":"","signal_b":"","connection_type":"causal|correlational|competitive|synergistic|antagonistic","strength":0.5,"insight":"","why_overlooked":""}
  ],
  "opportunities": [
    {"action":"","why_now":"","requirements":[],"risks":[],"timeframe":"","expected_value_note":"","urgency":"near_term","asymmetric_edge":""}
  ],
  "risks":[{"risk":"","severity":"medium","probability":0.3,"mitigation":"","early_warning_signals":[],"systemic_risk":false}],
  "weak_signals": [
    {"signal":"","domain":"","why_matters":"","strength":"nascent|weak|building","estimated_lag_months":0}
  ],
  "sources": [
    {"title":"","url":"","published":"","salience":0.5,"stance":"neutral","trust":"inferred","credibility_score":50,"domain_type":"unknown","bias_indicators":""}
  ],
  "reliability_score": 50,
  "validation_matrix": {
    "source_agreement": 0.5,
    "cross_validation_count": 0,
    "contradictions_found": 0,
    "data_freshness_score": 50,
    "narrative_diversity_score": 0.5
  },
  "autonomous_queries": ["3-5 follow-up search queries to deepen this analysis"],
  "notes": ""
}`;

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(",").map(k => k.trim()).filter(Boolean).forEach(k => {
      if (!keys.includes(k)) keys.push(k);
    });
  }
  return keys;
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  return Array.from(new Set((text.match(urlRegex) || []).map(u => u.replace(/[.,;!?)]+$/, "").trim())));
}

async function fetchUrlsIfAny(urls, limit = 8) {
  const out = [];
  for (const url of urls.slice(0, limit)) {
    try {
      const res = await nodeFetch(url, {
        timeout: 15000,
        headers: {
          "User-Agent": "SubMind/3.0 (+https://submind.us)",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      const html = await res.text();
      const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || "";
      const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || "";
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 45000);
      out.push({ url, title, metaDesc, text, status: res.status, chars: text.length });
    } catch (e) { out.push({ url, error: String(e) }); }
  }
  return out;
}

function parseWeightsEnv() { try { return JSON.parse(process.env.SUBMIND_TRUST_WEIGHTS || "{}") || {}; } catch { return {}; } }
const WEIGHTS = parseWeightsEnv();

function hostWeight(host) {
  if (!host) return 1;
  if (WEIGHTS[host]) return Number(WEIGHTS[host]) || 1;
  if (host.endsWith(".gov")) return 1.40;
  if (host.endsWith(".edu")) return 1.30;
  if (host.includes("reuters") || host.includes("apnews") || host.includes("bbc")) return 1.25;
  if (host.includes("nature.com") || host.includes("science.org") || host.includes("pubmed") || host.includes("arxiv")) return 1.35;
  if (host.includes("wsj.com") || host.includes("ft.com") || host.includes("economist")) return 1.20;
  if (host.includes("twitter") || host.includes("reddit") || host.includes("substack")) return 0.80;
  return 1;
}
function stanceFactor(s) { const v = String(s||"").toLowerCase(); return v==="supporting"?1.0:v==="conflicting"?0.9:0.95; }
function trustFactor(t) { const v = String(t||"").toLowerCase(); return v==="confirmed"?1.0:v==="corrupted"?0.2:0.6; }
function safeHost(u) { try { return new URL(u).host.toLowerCase(); } catch { return null; } }

function scoreFromSources(sources) {
  let num=0, den=0;
  let counts = {supporting:0,neutral:0,conflicting:0,confirmed:0,inferred:0,corrupted:0};
  if (Array.isArray(sources)) {
    for (const s of sources) {
      const w = hostWeight(safeHost(s?.url)) * stanceFactor(s?.stance) * trustFactor(s?.trust);
      const sal = typeof s?.salience==="number" ? Math.max(0,Math.min(1,s.salience)) : 0.5;
      num += w * sal * 100; den += sal;
      const stance = String(s?.stance||"neutral").toLowerCase();
      const trust = String(s?.trust||"inferred").toLowerCase();
      if (counts[stance]!==undefined) counts[stance]++;
      if (counts[trust]!==undefined) counts[trust]++;
    }
  }
  return { source_score: Math.max(0,Math.min(100,den>0?num/den:0)), counts };
}

function shannonEntropy(arr) {
  const total = arr.reduce((a,b)=>a+b,0);
  if (!total) return 0;
  let h=0;
  for (const v of arr) { if(v<=0)continue; const p=v/total; h+=-p*Math.log2(p); }
  const maxH=Math.log2(arr.length||1);
  return maxH?h/maxH:0;
}

function countTrust(sources) {
  const t={confirmed:0,inferred:0,corrupted:0};
  if (Array.isArray(sources)) {
    for (const s of sources) {
      const v=(s?.trust||"").toLowerCase();
      if(v==="confirmed")t.confirmed++;
      else if(v==="inferred")t.inferred++;
      else if(v==="corrupted")t.corrupted++;
    }
  }
  return t;
}

function makeSupabase() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE;
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false}});
}

async function callClaude(prompt, userContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");
  const model = process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022";
  const res = await nodeFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 8192, system: prompt, messages: [{ role: "user", content: userContent }] }),
    timeout: 90000
  });
  if (!res.ok) { const t = await res.text(); throw new Error("Claude " + res.status + ": " + t.slice(0,200)); }
  const data = await res.json();
  const text = data?.content?.[0]?.text || "{}";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in Claude response");
  return { result: JSON.parse(m[0]), provider: "claude", model };
}

async function callCerebras(prompt, userContent) {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("No CEREBRAS_API_KEY");
  const model = process.env.CEREBRAS_MODEL || "llama3.1-8b";
  const res = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model, messages: [{ role: "system", content: prompt }, { role: "user", content: userContent.slice(0, 10000) }], max_tokens: 8192, temperature: 0.15, stream: false }),
    timeout: 60000
  });
  if (!res.ok) { const t = await res.text(); throw new Error("Cerebras " + res.status + ": " + t.slice(0,200)); }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from Cerebras");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in Cerebras response");
  return { result: JSON.parse(m[0]), provider: "cerebras", model };
}

async function callGemini(prompt, userContent) {
  const keys = getGeminiKeys();
  if (!keys.length) throw new Error("No GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const body = {
    system_instruction: { parts: [{ text: prompt }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 8192, responseMimeType: "application/json" }
  };
  let lastError = null;
  for (const apiKey of keys) {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
    try {
      const res = await nodeFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), timeout: 60000 });
      if (res.status === 429 || res.status === 400) { lastError = new Error("Gemini HTTP " + res.status); continue; }
      if (!res.ok) { const t = await res.text(); throw new Error("Gemini " + res.status + ": " + t.slice(0,200)); }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return { result: JSON.parse(text), provider: "gemini", model };
    } catch (e) { if (e.message?.includes("429") || e.message?.includes("400")) { lastError=e; continue; } throw e; }
  }
  throw lastError || new Error("All Gemini keys exhausted");
}

async function callHuggingFace(prompt, userContent) {
  const hfToken = process.env.HF_API_TOKEN || "";
  const model = "meta-llama/Meta-Llama-3-8B-Instruct";
  const url = "https://router.huggingface.co/hf-inference/models/" + model + "/v1/chat/completions";
  const headers = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = "Bearer " + hfToken;
  const res = await nodeFetch(url, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: prompt }, { role: "user", content: userContent.slice(0, 6000) }], max_tokens: 4096, temperature: 0.15, stream: false }),
    timeout: 120000
  });
  if (!res.ok) { const t = await res.text(); throw new Error("HuggingFace " + res.status + ": " + t.slice(0,200)); }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from HuggingFace");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in HF response");
  return { result: JSON.parse(m[0]), provider: "huggingface", model };
}

async function callAI(systemPrompt, userContent, preferredProvider) {
  const chain = [];
  const pref = (preferredProvider || "auto").toLowerCase();
  if ((pref === "claude" || pref === "auto") && process.env.ANTHROPIC_API_KEY) chain.push({ name: "claude", fn: () => callClaude(systemPrompt, userContent) });
  if (pref === "cerebras" && process.env.CEREBRAS_API_KEY) chain.push({ name: "cerebras", fn: () => callCerebras(systemPrompt, userContent) });
  if (getGeminiKeys().length && !chain.find(p=>p.name==="gemini")) chain.push({ name: "gemini", fn: () => callGemini(systemPrompt, userContent) });
  if (process.env.CEREBRAS_API_KEY && !chain.find(p=>p.name==="cerebras")) chain.push({ name: "cerebras", fn: () => callCerebras(systemPrompt, userContent) });
  if (process.env.ANTHROPIC_API_KEY && !chain.find(p=>p.name==="claude")) chain.push({ name: "claude", fn: () => callClaude(systemPrompt, userContent) });
  chain.push({ name: "huggingface", fn: () => callHuggingFace(systemPrompt, userContent) });

  let lastErr;
  for (const p of chain) {
    try { console.log("SubMind: trying " + p.name); return await p.fn(); }
    catch (e) { console.warn("SubMind: " + p.name + " failed: " + e.message); lastErr = e; }
  }
  throw new Error("All AI providers failed. Last: " + (lastErr?.message));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Provider");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { query, fetchUrls, provider = "auto", deepMode = false } = req.body || {};
  if (!query || typeof query !== "string" || query.trim().length < 10) {
    return res.status(400).send("Provide more input text (minimum ~10 characters).");
  }

  const urls = extractUrls(query);
  let fetched = [];
  if (fetchUrls && urls.length) fetched = await fetchUrlsIfAny(urls, deepMode ? 12 : 8);

  const userContent = JSON.stringify({
    input: query, fetched_sources: fetched, fetched_count: fetched.length,
    url_count: urls.length, analysis_date: new Date().toISOString(), deep_mode: deepMode
  });

  let parsed, providerUsed, usedModel;
  try {
    const result = await callAI(SYSTEM_PROMPT, userContent, provider);
    parsed = result.result; providerUsed = result.provider; usedModel = result.model;
  } catch (e) { return res.status(500).send(String(e)); }

  if (!parsed || typeof parsed !== "object") return res.status(500).send("AI returned invalid data");

  const { source_score, counts } = scoreFromSources(parsed?.sources);
  const stanceEntropy = shannonEntropy([counts.supporting, counts.neutral, counts.conflicting]);
  const trustEntropy = shannonEntropy([counts.confirmed, counts.inferred, counts.corrupted]);
  const source_entropy = Number(((stanceEntropy + trustEntropy) / 2).toFixed(3));
  const modelScore = typeof parsed?.reliability_score === "number" ? Math.max(0,Math.min(100,parsed.reliability_score)) : 50;
  const trust_weighted_score = Math.round(0.5 * modelScore + 0.5 * source_score);
  const trust = countTrust(parsed?.sources);

  parsed.trust_weighted_score = trust_weighted_score;
  parsed.source_entropy = source_entropy;
  parsed.trust_confirmed = trust.confirmed;
  parsed.trust_inferred = trust.inferred;
  parsed.trust_corrupted = trust.corrupted;
  parsed.engine_version = "3.0";
  parsed.analysis_date = new Date().toISOString();
  parsed.model = usedModel;
  parsed.provider = providerUsed;
  parsed.fetched_source_count = fetched.length;

  try {
    const supabase = makeSupabase();
    if (supabase) {
      await supabase.from("predictions").insert({
        input_text: query.slice(0, 50000), fetched, output: parsed,
        reliability_score: modelScore, trust_weighted_score, source_entropy,
        trust_confirmed: trust.confirmed, trust_inferred: trust.inferred, trust_corrupted: trust.corrupted,
        provider: providerUsed, engine_version: "3.0"
      });
    }
  } catch (e) { console.error("Supabase log error:", e); }

  return res.status(200).json(parsed);
}
