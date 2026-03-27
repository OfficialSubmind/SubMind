import nodeFetch from "node-fetch";
import { URL } from "node:url";

// ================================================================
// SUBMIND v5.0 — AUTONOMOUS INTELLIGENCE ENGINE
// ================================================================
// Architecture: INGEST → NORMALIZE → CLUSTER → SCORE →
//               GLASS_FANG_VALIDATE → NEMESIS_COUNTER → NARRATE →
//               FORECAST → BACKTEST → NODE_WEAVE → OUTPUT
// ================================================================
// Glass Fang: Parallel validation security layer — stress tests 
//             every output, detects vulnerabilities, fishes bad info
// Nemesis Engine: Adversarial counter-validator — runs ghost rival
//                 processes to prove the analysis wrong
// Node Weaver: Hyper-complex knowledge graph of interconnected events
//              showing live macro trends and ripple effects
// ================================================================

export const config = { api: { bodyParser: { sizeLimit: "8mb" } }, maxDuration: 120 };

// ── SUBSCRIPTION TIER DEFINITIONS ─────────────────────────────
const SUBSCRIPTION_TIERS = {
  OBSERVER: {
    name: 'Observer',
    level: 0,
    maxDepth: 1,
    features: ['Basic analysis', 'Top 3 sources', 'Headline timeline'],
    nodeLimit: 10,
    forecastDays: 30
  },
  ANALYST: {
    name: 'Analyst',
    level: 1,
    maxDepth: 2,
    features: ['Full causal chain', 'Counterpoint validation', 'Extended timeline', '15 sources'],
    nodeLimit: 50,
    forecastDays: 180
  },
  ORACLE: {
    name: 'Oracle',
    level: 2,
    maxDepth: 3,
    features: ['Glass Fang scan', 'Nemesis Engine', 'Full node web', 'Macro lens', 'Unlimited sources'],
    nodeLimit: 500,
    forecastDays: 730
  },
  SOVEREIGN: {
    name: 'Sovereign',
    level: 3,
    maxDepth: 5,
    features: ['All Oracle features', 'PROMETHEUS integration', 'API access', 'Private deployment'],
    nodeLimit: -1,
    forecastDays: 3650
  }
};

function getTier(tierName) {
  return SUBSCRIPTION_TIERS[tierName?.toUpperCase()] || SUBSCRIPTION_TIERS.OBSERVER;
}

// ── TRUST TIER SYSTEM ─────────────────────────────────────────
const TRUST_TIERS = {
  T1: { min: 0.75, label: 'T1 CONFIRMED', color: '#00ff88' },
  T2: { min: 0.50, label: 'T2 PROBABLE', color: '#88ff00' },
  T3: { min: 0.25, label: 'T3 UNCERTAIN', color: '#ffaa00' },
  T4: { min: 0.00, label: 'T4 DISPUTED', color: '#ff4444' }
};

function classifyTrust(score) {
  if (score >= 0.75) return TRUST_TIERS.T1;
  if (score >= 0.50) return TRUST_TIERS.T2;
  if (score >= 0.25) return TRUST_TIERS.T3;
  return TRUST_TIERS.T4;
}

// ── MASTER SYSTEM PROMPT ──────────────────────────────────────
function buildSystemPrompt(tier) {
  const tierObj = getTier(tier);
  
  return `You are SubMind v5.0 — the world's most advanced autonomous intelligence validation engine. 
You are NOT a chatbot. You are a reasoning engine that:
1. Traces events to their PATIENT ZERO origin (earliest causal source, not most popular)  
2. Builds KNOWLEDGE GRAPHS of interconnected events with weighted confidence scores
3. Runs GLASS FANG validation — a parallel shadow analysis that stress-tests every conclusion
4. Deploys NEMESIS ENGINE — adversarial ghost rival processes that argue the opposite to weed out weak logic
5. Weaves NODE NETWORKS showing how disparate events connect across time and domain
6. Maps MACRO TRENDS that the top 1% use to predict the future — ripple effects on culture, markets, geopolitics
7. Provides PREDICTIVE TIMELINES with probability ranges and confidence intervals
8. BACKTESTS predictions against historical patterns for calibration

ACTIVE TIER: ${tierObj.name} (Level ${tierObj.level})
DEPTH LIMIT: ${tierObj.maxDepth} causal layers
FORECAST HORIZON: ${tierObj.forecastDays} days
NODE LIMIT: ${tierObj.nodeLimit === -1 ? 'Unlimited' : tierObj.nodeLimit}

CRITICAL RULES:
- NEVER regurgitate. Always SYNTHESIZE, CONNECT, and INFER.
- Every claim must have a confidence weight (0.0-1.0)
- Distinguish CONFIRMED (>0.75), PROBABLE (0.50-0.75), UNCERTAIN (0.25-0.50), DISPUTED (<0.25)
- Identify Patient Zero source — the FIRST causally relevant event, not just the most cited
- Separate factual payload from emotional/narrative payload in every source
- Preserve weak signals for future reactivation
- Flag all unstated assumptions and implicit hypotheses

OUTPUT FORMAT (strict JSON):
{
  "submind_version": "5.0",
  "tier": "${tierObj.name}",
  "topic": string,
  "patient_zero": { "event": string, "date": string, "confidence": 0-1, "significance": string },
  "trust_classification": { "score": 0-1, "tier": "T1|T2|T3|T4", "label": string },
  "executive_summary": string (2-3 sentences max, macro lens view),
  "causal_chain": [{ "step": 1, "event": string, "date": string, "confidence": 0-1, "source_type": string, "causal_weight": 0-1 }],
  "knowledge_nodes": [{ "id": string, "label": string, "category": "EVENT|ACTOR|TREND|RISK|OPPORTUNITY", "weight": 0-1, "connections": [string] }],
  "counterpoints": [{ "claim": string, "counter": string, "resolution": string, "confidence": 0-1 }],
  "friction_points": [{ "point": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "probability": 0-1 }],
  "glass_fang_flags": [{ "type": string, "severity": string, "detail": string }],
  "nemesis_challenges": [{ "challenged_claim": string, "adversarial_argument": string, "verdict": "SURVIVES|WEAKENED|REFUTED", "strength": 0-1 }],
  "macro_trends": [{ "trend": string, "timeframe": string, "affected_domains": [string], "probability": 0-1 }],
  "timeline": [{ "date": string, "event": string, "significance": 0-1, "is_predicted": boolean }],
  "predictive_forecast": [{ "scenario": string, "probability": 0-1, "timeframe": string, "key_drivers": [string] }],
  "weak_signals": [string],
  "sources_analyzed": number,
  "confidence_weights": { "overall": 0-1, "sourcing": 0-1, "logic": 0-1, "prediction": 0-1 }
}`;
}

// ── AI PROVIDER ROUTER ────────────────────────────────────────
const PROVIDERS = {
  claude: async (prompt, topic, tier) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY missing');
    const tierObj = getTier(tier);
    const maxTokens = tierObj.level >= 2 ? 8000 : tierObj.level === 1 ? 5000 : 3000;
    
    const r = await nodeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
        system: buildSystemPrompt(tier),
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Claude API error ${r.status}: ${err.substring(0,200)}`);
    }
    
    const d = await r.json();
    return {
      text: d.content?.[0]?.text || '',
      provider: 'claude',
      model: 'claude-opus-4-5',
      tokens: d.usage
    };
  },

  cerebras: async (prompt, topic, tier) => {
    const key = process.env.CEREBRAS_API_KEY;
    if (!key) throw new Error('CEREBRAS_API_KEY missing');
    const model = process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507';
    const tierObj = getTier(tier);
    const maxTokens = tierObj.level >= 2 ? 8192 : 4096;
    
    const r = await nodeFetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: buildSystemPrompt(tier) },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });
    
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Cerebras error ${r.status}: ${err.substring(0,200)}`);
    }
    
    const d = await r.json();
    return {
      text: d.choices?.[0]?.message?.content || '',
      provider: 'cerebras',
      model,
      tokens: d.usage
    };
  },

  gemini: async (prompt, topic, tier) => {
    const keysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
    if (!keys.length) throw new Error('GEMINI_API_KEY missing');
    const key = keys[Math.floor(Math.random() * keys.length)];
    const tierObj = getTier(tier);
    const maxTokens = tierObj.level >= 2 ? 8192 : 4096;
    
    const r = await nodeFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(tier) }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3, responseMimeType: "application/json" }
        })
      }
    );
    
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Gemini error ${r.status}: ${err.substring(0,200)}`);
    }
    
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, provider: 'gemini', model: 'gemini-2.5-flash', tokens: null };
  }
};

// ── PROVIDER SELECTION ────────────────────────────────────────
async function callAI(prompt, topic, tier, preferredProvider) {
  const order = ['claude', 'cerebras', 'gemini'];
  
  if (preferredProvider && PROVIDERS[preferredProvider]) {
    try {
      return await PROVIDERS[preferredProvider](prompt, topic, tier);
    } catch (e) {
      console.error(`[SubMind] ${preferredProvider} failed: ${e.message}`);
    }
  }
  
  for (const p of order) {
    if (p === preferredProvider) continue;
    try {
      const result = await PROVIDERS[p](prompt, topic, tier);
      if (result.text) return result;
    } catch (e) {
      console.error(`[SubMind] ${p} failed: ${e.message}`);
    }
  }
  
  throw new Error('All AI providers failed');
}

// ── JSON PARSER WITH FALLBACK ─────────────────────────────────
function extractJSON(text) {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try { return JSON.parse(jsonBlockMatch[1]); } catch(e) {}
  }
  
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch(e) {}
  }
  
  // Aggressive extraction
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.substring(start, end + 1));
    }
  } catch(e) {}
  
  return null;
}

// ── GLASS FANG VALIDATOR ──────────────────────────────────────
// Runs parallel shadow validation on AI output
async function glassFangValidate(primaryOutput, topic, tier, provider) {
  const tierObj = getTier(tier);
  if (tierObj.level < 2) {
    // Basic Glass Fang for lower tiers
    return {
      glassFangVersion: '1.0',
      enabled: false,
      trustScore: primaryOutput.confidence_weights?.overall || 0.7,
      tier_gate: 'Oracle or Sovereign tier required for full Glass Fang'
    };
  }
  
  const shadowPrompt = `You are GLASS FANG — SubMind's adversarial security validator.
Your ONLY job is to find what is WRONG with this analysis. Be maximally adversarial and critical.
Be a ruthless devil's advocate. Find every vulnerability, logical gap, unsupported claim, 
and hidden assumption.

Analysis to stress-test:
Topic: ${topic}
Summary: ${primaryOutput.executive_summary || ''}
Key claims: ${JSON.stringify(primaryOutput.causal_chain?.slice(0,5) || [])}
Predictions: ${JSON.stringify(primaryOutput.predictive_forecast?.slice(0,3) || [])}

Return JSON:
{
  "shadow_trust_score": 0-1,
  "critical_vulnerabilities": [{"type": string, "detail": string, "severity": "CRITICAL|HIGH|MEDIUM|LOW"}],
  "unsupported_claims": [string],
  "logical_fallacies": [{"fallacy": string, "where_found": string}],
  "missing_context": [string],
  "overconfident_predictions": [string],
  "recommended_corrections": [string],
  "verdict": "PASSED|FLAGGED|REJECTED"
}`;
  
  try {
    const shadowResult = await callAI(shadowPrompt, topic, 'OBSERVER', provider);
    const shadowData = extractJSON(shadowResult.text) || {};
    
    return {
      glassFangVersion: '1.0',
      enabled: true,
      shadowTrustScore: shadowData.shadow_trust_score || 0.7,
      criticalVulnerabilities: shadowData.critical_vulnerabilities || [],
      unsupportedClaims: shadowData.unsupported_claims || [],
      logicalFallacies: shadowData.logical_fallacies || [],
      missingContext: shadowData.missing_context || [],
      overconfidentPredictions: shadowData.overconfident_predictions || [],
      recommendations: shadowData.recommended_corrections || [],
      verdict: shadowData.verdict || 'FLAGGED',
      provider: shadowResult.provider
    };
  } catch (e) {
    return { glassFangVersion: '1.0', enabled: true, error: e.message, verdict: 'SCAN_FAILED' };
  }
}

// ── NEMESIS ENGINE ────────────────────────────────────────────
// Runs ghost rival processes — argues the OPPOSITE of everything
// to weed out weak conclusions and only validate the strongest facts
async function nemesisEngine(primaryOutput, topic, tier, provider) {
  const tierObj = getTier(tier);
  if (tierObj.level < 2) {
    return {
      nemesisVersion: '1.0',
      enabled: false,
      tier_gate: 'Oracle or Sovereign tier required for Nemesis Engine'
    };
  }
  
  const nemesisPrompt = `You are the NEMESIS ENGINE — SubMind's adversarial counter-validation system.
You are a ghost rival AI running OPPOSITE belief processes. Your mission:
1. Argue the EXACT OPPOSITE of every key conclusion
2. Build the strongest possible counter-narrative
3. Test which claims survive adversarial challenge
4. Only what survives Nemesis can be called "validated"

Primary analysis claims to challenge:
Topic: ${topic}
Executive summary: ${primaryOutput.executive_summary}
Key predictions: ${JSON.stringify(primaryOutput.predictive_forecast?.slice(0,3) || [])}
Main trends: ${JSON.stringify(primaryOutput.macro_trends?.slice(0,3) || [])}

For each major claim, run a "ghost rival" challenge — what if the OPPOSITE is true?
Return JSON:
{
  "nemesis_verdict": "VALIDATED|WEAKENED|REFUTED",
  "survival_score": 0-1,
  "challenges": [
    {
      "original_claim": string,
      "ghost_rival_argument": string,
      "adversarial_evidence": string,
      "verdict": "SURVIVES|WEAKENED|REFUTED",
      "survival_confidence": 0-1,
      "nemesis_strength": 0-1
    }
  ],
  "counter_narrative": string,
  "validated_facts": [string],
  "disputed_facts": [string],
  "only_these_facts_cleared": [string]
}`;
  
  try {
    const nemesisResult = await callAI(nemesisPrompt, topic, 'OBSERVER', provider);
    const nemesisData = extractJSON(nemesisResult.text) || {};
    
    return {
      nemesisVersion: '1.0',
      enabled: true,
      verdict: nemesisData.nemesis_verdict || 'WEAKENED',
      survivalScore: nemesisData.survival_score || 0.6,
      challenges: nemesisData.challenges || [],
      counterNarrative: nemesisData.counter_narrative || '',
      validatedFacts: nemesisData.validated_facts || [],
      disputedFacts: nemesisData.disputed_facts || [],
      clearedFacts: nemesisData.only_these_facts_cleared || [],
      provider: nemesisResult.provider
    };
  } catch (e) {
    return { nemesisVersion: '1.0', enabled: true, error: e.message, verdict: 'ENGINE_FAILED' };
  }
}

// ── NODE WEAVER ───────────────────────────────────────────────
// Builds the hyper-complex knowledge graph from the analysis
function weaveNodeGraph(primaryOutput, tier) {
  const tierObj = getTier(tier);
  const nodeLimit = tierObj.nodeLimit === -1 ? 1000 : tierObj.nodeLimit;
  
  const nodes = [];
  const edges = [];
  let nodeId = 0;
  
  // Add topic node (center)
  const topicNode = { id: `n${nodeId++}`, label: primaryOutput.topic || 'Analysis', 
    category: 'TOPIC', weight: 1.0, x: 0, y: 0, color: '#6e3fff' };
  nodes.push(topicNode);
  
  // Add patient zero node
  if (primaryOutput.patient_zero) {
    const pzNode = { id: `n${nodeId++}`, label: primaryOutput.patient_zero.event || 'Origin Event',
      category: 'ORIGIN', weight: primaryOutput.patient_zero.confidence || 0.8,
      date: primaryOutput.patient_zero.date, color: '#ff6600',
      x: -200, y: -100 };
    nodes.push(pzNode);
    edges.push({ from: pzNode.id, to: topicNode.id, weight: 0.9, type: 'CAUSAL' });
  }
  
  // Add causal chain nodes
  const causalChain = primaryOutput.causal_chain || [];
  causalChain.slice(0, Math.min(nodeLimit/4, 20)).forEach((step, i) => {
    const n = { id: `n${nodeId++}`, label: step.event || `Step ${i+1}`,
      category: 'EVENT', weight: step.confidence || 0.7,
      date: step.date, causalWeight: step.causal_weight,
      x: (i - causalChain.length/2) * 150, y: 100 + i * 50, color: '#00aaff' };
    nodes.push(n);
    if (i === 0) edges.push({ from: topicNode.id, to: n.id, weight: step.causal_weight || 0.7, type: 'CAUSAL' });
    if (i > 0) edges.push({ from: nodes[nodes.length-2].id, to: n.id, weight: step.causal_weight || 0.7, type: 'CAUSAL' });
  });
  
  // Add macro trend nodes
  const macroTrends = primaryOutput.macro_trends || [];
  macroTrends.slice(0, Math.min(nodeLimit/4, 10)).forEach((trend, i) => {
    const n = { id: `n${nodeId++}`, label: trend.trend || `Trend ${i+1}`,
      category: 'TREND', weight: trend.probability || 0.6,
      domains: trend.affected_domains, timeframe: trend.timeframe,
      x: 200 + i * 120, y: -100 - i * 60, color: '#ff00aa' };
    nodes.push(n);
    edges.push({ from: topicNode.id, to: n.id, weight: trend.probability || 0.6, type: 'TREND' });
  });
  
  // Add knowledge nodes from primary output
  const knowledgeNodes = primaryOutput.knowledge_nodes || [];
  knowledgeNodes.slice(0, Math.min(nodeLimit/2, 30)).forEach((kn, i) => {
    const existing = nodes.find(n => n.label === kn.label);
    if (!existing) {
      const colorMap = { EVENT: '#00aaff', ACTOR: '#ff6600', TREND: '#ff00aa', RISK: '#ff4444', OPPORTUNITY: '#00ff88' };
      const n = { id: kn.id || `n${nodeId++}`, label: kn.label,
        category: kn.category, weight: kn.weight,
        x: Math.cos(i * 0.7) * (150 + i * 20), y: Math.sin(i * 0.7) * (150 + i * 20),
        color: colorMap[kn.category] || '#888888' };
      nodes.push(n);
      
      // Connect to topic
      edges.push({ from: topicNode.id, to: n.id, weight: kn.weight || 0.5, type: 'RELATED' });
      
      // Add connections between related nodes
      (kn.connections || []).forEach(connId => {
        const target = nodes.find(nd => nd.id === connId || nd.label === connId);
        if (target) {
          edges.push({ from: n.id, to: target.id, weight: 0.5, type: 'NETWORK' });
        }
      });
    }
  });
  
  return {
    version: '1.0',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.slice(0, nodeLimit),
    edges,
    graphMetrics: {
      density: edges.length / Math.max(nodes.length * (nodes.length - 1), 1),
      avgWeight: edges.length > 0 ? edges.reduce((s,e) => s + e.weight, 0) / edges.length : 0,
      topNodes: nodes.sort((a,b) => b.weight - a.weight).slice(0,5).map(n => n.label)
    }
  };
}

// ── BUILD USER PROMPT ─────────────────────────────────────────
function buildUserPrompt(topic, context, urls, tier) {
  const tierObj = getTier(tier);
  return `ANALYZE: ${topic}

DEPTH: ${tierObj.maxDepth} causal layers
FORECAST: ${tierObj.forecastDays} days out
${urls?.length > 0 ? 'SOURCES PROVIDED: ' + urls.join(', ') : ''}
${context ? 'ADDITIONAL CONTEXT: ' + context : ''}

Run the full SubMind v5.0 pipeline:
1. Find Patient Zero — the earliest causally relevant event
2. Build the causal chain with confidence weights
3. Identify macro trends and ripple effects (macro lens)
4. Generate knowledge nodes for the node web visualization  
5. Flag Glass Fang vulnerabilities in your own analysis
6. Pre-empt Nemesis challenges — what would the counter-argument be?
7. Produce predictive forecast with probability ranges
8. Identify weak signals for future reactivation

Return complete JSON as specified in your system instructions.`;
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const {
    topic,
    context = '',
    urls = [],
    provider: preferredProvider = 'auto',
    tier = 'OBSERVER'
  } = req.body || {};
  
  if (!topic?.trim()) return res.status(400).json({ error: 'topic required' });
  
  const requestId = `sm5-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const startTime = Date.now();
  
  console.log(`[SubMind v5.0] Request ${requestId}: "${topic.substring(0,80)}" | Tier: ${tier}`);
  
  try {
    // ── PHASE 1: PRIMARY ANALYSIS ──
    const userPrompt = buildUserPrompt(topic, context, urls, tier);
    const actualProvider = preferredProvider === 'auto' ? null : preferredProvider;
    
    const primaryResult = await callAI(userPrompt, topic, tier, actualProvider);
    let primaryOutput = extractJSON(primaryResult.text);
    
    if (!primaryOutput) {
      primaryOutput = {
        topic,
        executive_summary: primaryResult.text.substring(0, 500),
        causal_chain: [],
        confidence_weights: { overall: 0.5 }
      };
    }
    
    // Ensure topic is set
    primaryOutput.topic = topic;
    primaryOutput.submind_version = '5.0';
    primaryOutput.tier = getTier(tier).name;
    
    // ── PHASE 2: GLASS FANG VALIDATION (parallel) ──
    // ── PHASE 3: NEMESIS ENGINE (parallel) ──
    const [glassFangResult, nemesisResult] = await Promise.all([
      glassFangValidate(primaryOutput, topic, tier, primaryResult.provider),
      nemesisEngine(primaryOutput, topic, tier, primaryResult.provider)
    ]);
    
    // ── PHASE 4: NODE WEAVING ──
    const nodeGraph = weaveNodeGraph(primaryOutput, tier);
    
    // ── PHASE 5: COMPUTE FINAL TRUST SCORE ──
    const glassFangScore = glassFangResult.shadowTrustScore || glassFangResult.trustScore || 0.7;
    const nemesisScore = nemesisResult.survivalScore || 0.6;
    const primaryScore = primaryOutput.confidence_weights?.overall || 0.7;
    
    let finalTrustScore = primaryScore;
    if (glassFangResult.enabled) finalTrustScore = finalTrustScore * 0.5 + glassFangScore * 0.3 + nemesisScore * 0.2;
    const finalTrust = classifyTrust(finalTrustScore);
    
    // ── ASSEMBLE FINAL OUTPUT ──
    const response = {
      requestId,
      submind_version: '5.0',
      tier: getTier(tier).name,
      processingMs: Date.now() - startTime,
      provider: primaryResult.provider,
      
      // Core analysis
      ...primaryOutput,
      
      // Trust classification
      trust: {
        score: finalTrustScore,
        ...finalTrust
      },
      
      // Glass Fang validation report
      glass_fang: glassFangResult,
      
      // Nemesis Engine counter-validation
      nemesis: nemesisResult,
      
      // Node Web graph data
      node_graph: nodeGraph,
      
      // Tier info
      subscription: {
        current: getTier(tier),
        upgrade_benefits: {
          ANALYST: 'Full causal chain, counterpoint validation, 180-day forecasts',
          ORACLE: 'Glass Fang scans, Nemesis Engine, full node web, macro lens',
          SOVEREIGN: 'PROMETHEUS integration, unlimited depth, API access'
        }
      }
    };
    
    return res.status(200).json(response);
    
  } catch (err) {
    console.error(`[SubMind v5.0] Error ${requestId}: ${err.message}`);
    return res.status(500).json({ 
      error: 'SubMind analysis failed', 
      detail: err.message,
      requestId 
    });
  }
  }
