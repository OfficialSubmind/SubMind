import OpenAI from "openai";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { URL } from "node:url";

const SYSTEM_PROMPT = `You are SubMind, an evidence-led foresight engine.
Rules:
- Output MUST be valid JSON matching the schema below. No extra text.
- Base conclusions ONLY on the provided input text and any fetched URLs content.
- If evidence is thin, say so and lower confidence. Do not speculate.
- Use ternary trust: "confirmed" | "inferred" | "corrupted".
- Compute a reliability score 0-100 that reflects source quality and agreement.

JSON schema (fill every field):
{
  "summary": "one-paragraph neutral synopsis of the input topic",
  "prediction_timeline": [
    {"window":"0-3 months","events":[{"event":"","probability":0-1,"rationale":""}]},
    {"window":"3-12 months","events":[{"event":"","probability":0-1,"rationale":""}]},
    {"window":"12-36 months","events":[{"event":"","probability":0-1,"rationale":""}]}
  ],
  "narratives": [
    {"label":"","drivers":[],"counterpoints":[],"status":"confirmed|inferred|corrupted"}
  ],
  "opportunities": [
    {"action":"","why_now":"","requirements":[],"risks":[],"timeframe":"<window>", "expected_value_note":""}
  ],
  "risks":[{"risk":"","mitigation":""}],
  "sources": [
    {"title":"","url":"","published":"","salience":0-1,"stance":"supporting|neutral|conflicting","trust":"confirmed|inferred|corrupted"}
  ],
  "reliability_score": 0-100,
  "notes":"assumptions, gaps, and next evidence to seek"
}`;

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

function extractUrls(text){
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = Array.from(new Set((text.match(urlRegex) || []).map(u => u.trim())));
  return urls;
}
async function fetchUrlsIfAny(urls, limit=5){
  const out = [];
  for(const url of urls.slice(0, limit)){
    try{
      const res = await fetch(url, { timeout: 12000, headers: { "User-Agent": "SubMind/1.1" } });
      const html = await res.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0, 40000);
      out.push({ url, text });
    }catch(e){
      out.push({ url, error: String(e) });
    }
  }
  return out;
}
// ---- Trust weights
function parseWeightsEnv(){
  try{ const raw = process.env.SUBMIND_TRUST_WEIGHTS; if(!raw) return {}; const obj = JSON.parse(raw); return obj && typeof obj === "object" ? obj : {}; }catch{ return {}; }
}
const WEIGHTS = parseWeightsEnv();
function hostWeight(host){
  if(!host) return 1;
  if(WEIGHTS[host]) return Number(WEIGHTS[host]) || 1;
  for(const k of Object.keys(WEIGHTS)){ if(k.startsWith(".") && host.endsWith(k)) return Number(WEIGHTS[k]) || 1; }
  if(host.endsWith(".gov")) return 1.25;
  if(host.endsWith(".edu")) return 1.15;
  return 1;
}
function stanceFactor(stance){ const s = String(stance||"").toLowerCase(); if(s==="supporting")return 1.0; if(s==="neutral")return 0.95; if(s==="conflicting")return 0.9; return 0.95; }
function trustFactor(trust){ const t = String(trust||"").toLowerCase(); if(t==="confirmed")return 1.0; if(t==="inferred")return 0.6; if(t==="corrupted")return 0.2; return 0.6; }
function safeHost(u){ try{ return new URL(u).host.toLowerCase(); }catch{ return null; } }
function scoreFromSources(sources){
  let num=0, den=0; let counts={supporting:0,neutral:0,conflicting:0,confirmed:0,inferred:0,corrupted:0};
  if(Array.isArray(sources)){
    for(const s of sources){
      const host=safeHost(s?.url); const w = hostWeight(host) * stanceFactor(s?.stance) * trustFactor(s?.trust);
      const sal = typeof s?.salience==="number" ? Math.max(0, Math.min(1, s.salience)) : 0.5;
      num += w*sal*100; den += sal;
      counts[String(s?.stance||"neutral").toLowerCase()]++; counts[String(s?.trust||"inferred").toLowerCase()]++;
    }
  }
  const base = den>0 ? (num/den) : 0; const clamped = Math.max(0, Math.min(100, base));
  return { source_score: clamped, counts };
}
function shannonEntropy(arr){ const total=arr.reduce((a,b)=>a+b,0); if(total===0) return 0; let h=0; for(const v of arr){ if(v<=0) continue; const p=v/total; h += -p*Math.log2(p);} const maxH=Math.log2(arr.length||1); return maxH ? (h/maxH) : 0; }
function countTrust(sources){ const t={confirmed:0,inferred:0,corrupted:0}; if(Array.isArray(sources)){ for(const s of sources){ const v=(s?.trust||"").toLowerCase(); if(v==="confirmed") t.confirmed++; else if(v==="inferred") t.inferred++; else if(v==="corrupted") t.corrupted++; } } return t; }
function makeSupabase(){ const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE; if(!url||!key) return null; return createClient(url, key, { auth: { persistSession: false } }); }

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).send("Method not allowed");
  const { query, fetchUrls } = req.body || {};
  if(!query || typeof query!=="string" || query.trim().length<10){ return res.status(400).send("Provide more input text. Minimum ~10 characters."); }

  const urls = extractUrls(query); let fetched=[]; if(fetchUrls && urls.length){ fetched = await fetchUrlsIfAny(urls); }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [{ role:"system", content: SYSTEM_PROMPT }, { role:"user", content: JSON.stringify({ input: query, fetched }) }];

  let parsed;
  try{
    const completion = await client.chat.completions.create({ model: process.env.SUBMIND_MODEL || "gpt-4o-mini", messages, temperature: 0.2, response_format: { type: "json_object" } });
    const json = completion.choices?.[0]?.message?.content || "{}"; parsed = JSON.parse(json);
  }catch(e){ return res.status(500).send(String(e)); }

  const { source_score, counts } = scoreFromSources(parsed?.sources);
  const stanceEntropy = shannonEntropy([counts.supporting, counts.neutral, counts.conflicting]);
  const trustEntropy  = shannonEntropy([counts.confirmed, counts.inferred, counts.corrupted]);
  const source_entropy = Number(((stanceEntropy + trustEntropy)/2).toFixed(3));
  const modelScore = typeof parsed?.reliability_score==="number" ? Math.max(0, Math.min(100, parsed.reliability_score)) : 50;
  const trust_weighted_score = Math.round(0.5*modelScore + 0.5*source_score);
  parsed.trust_weighted_score = trust_weighted_score; parsed.source_entropy = source_entropy;

  try{
    const supabase = makeSupabase();
    if(supabase){
      const trust = countTrust(parsed?.sources);
      const baseRow = { input_text: query.slice(0,50000), fetched, output: parsed, reliability_score: modelScore, trust_confirmed: trust.confirmed, trust_inferred: trust.inferred, trust_corrupted: trust.corrupted };
      const extended = { ...baseRow, trust_weighted_score, source_entropy };
      let resp = await supabase.from("predictions").insert(extended); if(resp.error){ await supabase.from("predictions").insert(baseRow); }
    }
  }catch(e){ console.error("log error", e); }

  return res.status(200).json(parsed);
}