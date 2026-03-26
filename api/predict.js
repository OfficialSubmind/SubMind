import { createClient } from "@supabase/supabase-js";
import nodeFetch from "node-fetch";
import { URL } from "node:url";

const SYSTEM_PROMPT = `You are SubMind, an advanced evidence-led foresight and trend prediction engine. Your core mission is to detect, validate, and score emerging trends by cross-referencing multiple sources, identifying signal convergence, and quantifying prediction confidence.
Rules:
- Output MUST be valid JSON matching the schema below. No extra text outside the JSON.
- Base conclusions ONLY on the provided input text and fetched URL content.
- Apply multi-source validation: cross-check claims across sources, flag contradictions.
- Score source credibility using domain authority, publication recency, and editorial independence.
- If evidence is thin or single-source, say so and lower confidence significantly.
- Use ternary trust: "confirmed" (multi-source agreement) | "inferred" (single-source or logical deduction) | "corrupted" (contradicted or suspect).
- Identify hidden connections between signals that a human analyst might miss.
- Detect trend velocity: accelerating, steady, decelerating, reversing.
- Compute reliability_score 0-100 reflecting source quality, agreement, and evidence density.
JSON schema (fill every field):
{
  "summary": "one-paragraph neutral synopsis",
  "trend_meta": {
    "topic": "concise trend name",
    "category": "technology|finance|geopolitics|health|culture|environment|other",
    "velocity": "accelerating|steady|decelerating|reversing|emerging",
    "momentum_score": 0,
    "novelty_score": 0,
    "signal_strength": "weak|moderate|strong|very_strong"
  },
  "prediction_timeline": [
    {"window":"0-3 months","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[]}]},
    {"window":"3-12 months","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[]}]},
    {"window":"12-36 months","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[]}]},
    {"window":"3-10 years","events":[{"event":"","probability":0.5,"rationale":"","confidence_factors":[]}]}
  ],
  "narratives": [
    {"label":"","drivers":[],"counterpoints":[],"status":"inferred","source_count":0}
  ],
  "signal_connections": [
    {"signal_a":"","signal_b":"","connection_type":"causal|correlational|competitive|synergistic","strength":0.5,"insight":""}
  ],
  "opportunities": [
    {"action":"","why_now":"","requirements":[],"risks":[],"timeframe":"","expected_value_note":"","urgency":"near_term"}
  ],
  "risks":[{"risk":"","severity":"medium","probability":0.3,"mitigation":"","early_warning_signals":[]}],
  "sources": [
    {"title":"","url":"","published":"","salience":0.5,"stance":"neutral","trust":"inferred","credibility_score":50,"domain_type":"unknown"}
  ],
  "reliability_score": 50,
  "validation_matrix": {
    "source_agreement": 0.5,
    "cross_validation_count": 0,
    "contradictions_found": 0,
    "data_freshness_score": 50
  },
  "notes": ""
}`;

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

// ── Gemini keys pool (rotate through all on 429) ────────────────────────────
function getGeminiKeys() {
  const keys = [];
  // Primary key from env
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  // Additional keys from env (comma-separated pool)
  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(",").map(k => k.trim()).filter(Boolean).forEach(k => {
      if (!keys.includes(k)) keys.push(k);
    });
  }
  return keys;
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return Array.from(new Set((text.match(urlRegex) || []).map(u => u.trim())));
}

async function fetchUrlsIfAny(urls, limit = 6) {
  const out = [];
  for (const url of urls.slice(0, limit)) {
    try {
      const res = await nodeFetch(url, {
        timeout: 14000,
        headers: { "User-Agent": "SubMind/2.0 Foresight Engine" }
      });
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 40000);
      out.push({ url, text, status: res.status });
    } catch (e) {
      out.push({ url, error: String(e) });
    }
  }
  return out;
}

function parseWeightsEnv() {
  try {
    const raw = process.env.SUBMIND_TRUST_WEIGHTS;
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
const WEIGHTS = parseWeightsEnv();

function hostWeight(host) {
  if (!host) return 1;
  if (WEIGHTS[host]) return Number(WEIGHTS[host]) || 1;
  if (host.endsWith(".gov")) return 1.35;
  if (host.endsWith(".edu")) return 1.25;
  if (host.includes("reuters") || host.includes("apnews") || host.includes("bbc")) return 1.20;
  if (host.includes("nature.com") || host.includes("science.org") || host.includes("pubmed")) return 1.30;
  return 1;
}
function stanceFactor(s) {
  const v = String(s || "").toLowerCase();
  return v === "supporting" ? 1.0 : v === "conflicting" ? 0.9 : 0.95;
}
function trustFactor(t) {
  const v = String(t || "").toLowerCase();
  return v === "confirmed" ? 1.0 : v === "corrupted" ? 0.2 : 0.6;
}
function safeHost(u) {
  try { return new URL(u).host.toLowerCase(); } catch { return null; }
}
function scoreFromSources(sources) {
  let num = 0, den = 0;
  let counts = { supporting:0, neutral:0, conflicting:0, confirmed:0, inferred:0, corrupted:0 };
  if (Array.isArray(sources)) {
    for (const s of sources) {
      const w = hostWeight(safeHost(s?.url)) * stanceFactor(s?.stance) * trustFactor(s?.trust);
      const sal = typeof s?.salience === "number" ? Math.max(0, Math.min(1, s.salience)) : 0.5;
      num += w * sal * 100; den += sal;
      const stance = String(s?.stance || "neutral").toLowerCase();
      const trust = String(s?.trust || "inferred").toLowerCase();
      if (counts[stance] !== undefined) counts[stance]++;
      if (counts[trust] !== undefined) counts[trust]++;
    }
  }
  return { source_score: Math.max(0, Math.min(100, den > 0 ? num/den : 0)), counts };
}
function shannonEntropy(arr) {
  const total = arr.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const v of arr) {
    if (v <= 0) continue;
    const p = v / total;
    h += -p * Math.log2(p);
  }
  const maxH = Math.log2(arr.length || 1);
  return maxH ? h/maxH : 0;
}
function countTrust(sources) {
  const t = { confirmed:0, inferred:0, corrupted:0 };
  if (Array.isArray(sources)) {
    for (const s of sources) {
      const v = (s?.trust || "").toLowerCase();
      if (v === "confirmed") t.confirmed++;
      else if (v === "inferred") t.inferred++;
      else if (v === "corrupted") t.corrupted++;
    }
  }
  return t;
}
function makeSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Gemini API call with key rotation ────────────────────────────────────────
async function callGemini(prompt, userContent) {
  const keys = getGeminiKeys();
  if (!keys.length) throw new Error("No GEMINI_API_KEY configured");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const body = {
    system_instruction: { parts: [{ text: prompt }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 8192, responseMimeType: "application/json" }
  };

  let lastError = null;
  for (const apiKey of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await nodeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeout: 60000
      });
      if (res.status === 429 || res.status === 400) {
        lastError = new Error(`Gemini key ${apiKey.slice(-6)}: HTTP ${res.status}`);
        continue; // Try next key
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return { result: JSON.parse(text), provider: "gemini", model };
    } catch (e) {
      if (e.message && (e.message.includes("429") || e.message.includes("400"))) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error("All Gemini keys exhausted");
}

// ── Hugging Face Inference API fallback ──────────────────────────────────────
async function callHuggingFace(prompt, userContent) {
  const hfToken = process.env.HF_API_TOKEN || "";
  // Use Mistral 7B via HF serverless inference
  const model = "meta-llama/Meta-Llama-3-8B-Instruct";
  const url = `https://router.huggingface.co/hf-inference/models/${model}/v1/chat/completions`;

  const headers = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  const body = {
    model: model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: userContent.slice(0, 6000) }
    ],
    max_tokens: 4096,
    temperature: 0.15,
    stream: false
  };

  const res = await nodeFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    timeout: 120000
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HuggingFace error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from HuggingFace: " + JSON.stringify(data).slice(0, 200));

  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in HF response");

  return { result: JSON.parse(jsonMatch[0]), provider: "huggingface", model };
}

// ── Main AI call with fallback chain ─────────────────────────────────────────
async function callAI(systemPrompt, userContent) {
  // Try Gemini first (with key rotation)
  try {
    return await callGemini(systemPrompt, userContent);
  } catch (geminiErr) {
    console.warn("Gemini failed:", geminiErr.message, "— trying HuggingFace fallback");
  }

  // Fallback to Hugging Face
  try {
    return await callHuggingFace(systemPrompt, userContent);
  } catch (hfErr) {
    console.error("HuggingFace also failed:", hfErr.message);
    throw new Error(`All AI providers failed. Gemini quota likely exceeded. Please try again later or check API keys. HF error: ${hfErr.message}`);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { query, fetchUrls } = req.body || {};
  if (!query || typeof query !== "string" || query.trim().length < 10) {
    return res.status(400).send("Provide more input text (minimum ~10 characters).");
  }

  const urls = extractUrls(query);
  let fetched = [];
  if (fetchUrls && urls.length) {
    fetched = await fetchUrlsIfAny(urls);
  }

  const userContent = JSON.stringify({
    input: query,
    fetched_sources: fetched,
    analysis_date: new Date().toISOString()
  });

  let parsed, provider, usedModel;
  try {
    const result = await callAI(SYSTEM_PROMPT, userContent);
    parsed = result.result;
    provider = result.provider;
    usedModel = result.model;
  } catch (e) {
    return res.status(500).send(String(e));
  }

  const { source_score, counts } = scoreFromSources(parsed?.sources);
  const stanceEntropy = shannonEntropy([counts.supporting, counts.neutral, counts.conflicting]);
  const trustEntropy = shannonEntropy([counts.confirmed, counts.inferred, counts.corrupted]);
  const source_entropy = Number(((stanceEntropy + trustEntropy) / 2).toFixed(3));
  const modelScore = typeof parsed?.reliability_score === "number"
    ? Math.max(0, Math.min(100, parsed.reliability_score)) : 50;
  const trust_weighted_score = Math.round(0.5 * modelScore + 0.5 * source_score);
  const trust = countTrust(parsed?.sources);

  parsed.trust_weighted_score = trust_weighted_score;
  parsed.source_entropy = source_entropy;
  parsed.trust_confirmed = trust.confirmed;
  parsed.trust_inferred = trust.inferred;
  parsed.trust_corrupted = trust.corrupted;
  parsed.engine_version = "2.2";
  parsed.analysis_date = new Date().toISOString();
  parsed.model = usedModel;
  parsed.provider = provider;

  try {
    const supabase = makeSupabase();
    if (supabase) {
      await supabase.from("predictions").insert({
        input_text: query.slice(0, 50000),
        fetched,
        output: parsed,
        reliability_score: modelScore,
        trust_weighted_score,
        source_entropy,
        trust_confirmed: trust.confirmed,
        trust_inferred: trust.inferred,
        trust_corrupted: trust.corrupted
      });
    }
  } catch (e) {
    console.error("Supabase log error:", e);
  }

  return res.status(200).json(parsed);
}
