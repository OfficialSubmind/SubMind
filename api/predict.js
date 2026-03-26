import OpenAI from "openai";
import nodeFetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
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
  "summary": "one-paragraph neutral synopsis of the topic/trend",
    "trend_meta": {
        "topic": "concise trend name",
            "category": "technology|finance|geopolitics|health|culture|environment|other",
                "velocity": "accelerating|steady|decelerating|reversing|emerging",
                    "momentum_score": 0-100,
                        "novelty_score": 0-100,
                            "signal_strength": "weak|moderate|strong|very_strong"
                              },
                                "prediction_timeline": [
                                    {"window":"0-3 months","events":[{"event":"","probability":0-1,"rationale":"","confidence_factors":[]}]},
                                        {"window":"3-12 months","events":[{"event":"","probability":0-1,"rationale":"","confidence_factors":[]}]},
                                            {"window":"12-36 months","events":[{"event":"","probability":0-1,"rationale":"","confidence_factors":[]}]},
                                                {"window":"3-10 years","events":[{"event":"","probability":0-1,"rationale":"","confidence_factors":[]}]}
                                                  ],
                                                    "narratives": [
                                                        {"label":"","drivers":[],"counterpoints":[],"status":"confirmed|inferred|corrupted","source_count":0}
                                                          ],
                                                            "signal_connections": [
                                                                {"signal_a":"","signal_b":"","connection_type":"causal|correlational|competitive|synergistic","strength":0-1,"insight":""}
                                                                  ],
                                                                    "opportunities": [
                                                                        {"action":"","why_now":"","requirements":[],"risks":[],"timeframe":"","expected_value_note":"","urgency":"immediate|near_term|long_term"}
                                                                          ],
                                                                            "risks":[{"risk":"","severity":"low|medium|high|critical","probability":0-1,"mitigation":"","early_warning_signals":[]}],
                                                                              "sources": [
                                                                                  {"title":"","url":"","published":"","salience":0-1,"stance":"supporting|neutral|conflicting","trust":"confirmed|inferred|corrupted","credibility_score":0-100,"domain_type":"government|academic|news|industry|social|unknown"}
                                                                                    ],
                                                                                      "reliability_score": 0-100,
                                                                                        "validation_matrix": {
                                                                                            "source_agreement": 0-1,
                                                                                                "cross_validation_count": 0,
                                                                                                    "contradictions_found": 0,
                                                                                                        "data_freshness_score": 0-100
                                                                                                          },
                                                                                                            "notes":"assumptions, gaps, methodological limitations, and next evidence to seek"
                                                                                                            }`;

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

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
                            headers: { "User-Agent": "SubMind/2.0 Foresight Engine (+https://submind-blond.vercel.app)" }
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
          const obj = JSON.parse(raw);
          return obj && typeof obj === "object" ? obj : {};
    } catch { return {}; }
}

const WEIGHTS = parseWeightsEnv();

function hostWeight(host) {
    if (!host) return 1;
    if (WEIGHTS[host]) return Number(WEIGHTS[host]) || 1;
    for (const k of Object.keys(WEIGHTS)) {
          if (k.startsWith(".") && host.endsWith(k)) return Number(WEIGHTS[k]) || 1;
    }
    if (host.endsWith(".gov")) return 1.35;
    if (host.endsWith(".edu")) return 1.25;
    if (host.includes("reuters") || host.includes("apnews") || host.includes("bbc")) return 1.20;
    if (host.includes("nature.com") || host.includes("science.org") || host.includes("pubmed")) return 1.30;
    return 1;
}

function stanceFactor(stance) {
    const s = String(stance || "").toLowerCase();
    if (s === "supporting") return 1.0;
    if (s === "neutral") return 0.95;
    if (s === "conflicting") return 0.9;
    return 0.95;
}

function trustFactor(trust) {
    const t = String(trust || "").toLowerCase();
    if (t === "confirmed") return 1.0;
    if (t === "inferred") return 0.6;
    if (t === "corrupted") return 0.2;
    return 0.6;
}

function safeHost(u) {
    try { return new URL(u).host.toLowerCase(); } catch { return null; }
}

function scoreFromSources(sources) {
    let num = 0, den = 0;
    let counts = { supporting: 0, neutral: 0, conflicting: 0, confirmed: 0, inferred: 0, corrupted: 0 };
    if (Array.isArray(sources)) {
          for (const s of sources) {
                  const host = safeHost(s?.url);
                  const w = hostWeight(host) * stanceFactor(s?.stance) * trustFactor(s?.trust);
                  const sal = typeof s?.salience === "number" ? Math.max(0, Math.min(1, s.salience)) : 0.5;
                  num += w * sal * 100;
                  den += sal;
                  const stance = String(s?.stance || "neutral").toLowerCase();
                  const trust = String(s?.trust || "inferred").toLowerCase();
                  if (counts[stance] !== undefined) counts[stance]++;
                  if (counts[trust] !== undefined) counts[trust]++;
          }
    }
    const base = den > 0 ? (num / den) : 0;
    return { source_score: Math.max(0, Math.min(100, base)), counts };
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
    return maxH ? (h / maxH) : 0;
}

function countTrust(sources) {
    const t = { confirmed: 0, inferred: 0, corrupted: 0 };
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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.SUBMIND_MODEL || "gpt-4o-mini";

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify({ input: query, fetched_sources: fetched, analysis_date: new Date().toISOString() }) }
      ];

  let parsed;
    try {
          const completion = await client.chat.completions.create({
                  model,
                  messages,
                  temperature: 0.15,
                  max_tokens: 4000,
                  response_format: { type: "json_object" }
          });
          const json = completion.choices?.[0]?.message?.content || "{}";
          parsed = JSON.parse(json);
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

  parsed.trust_weighted_score = trust_weighted_score;
    parsed.source_entropy = source_entropy;
    parsed.engine_version = "2.0";
    parsed.analysis_date = new Date().toISOString();

  try {
        const supabase = makeSupabase();
        if (supabase) {
                const trust = countTrust(parsed?.sources);
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
