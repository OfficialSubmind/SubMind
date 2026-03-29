# SubMind v11.0 — Deep Intelligence Research Engine

> Intelligence that traces truth to its source. Every claim verified. Every link validated. SubMind traces information from origin to prediction with source-level precision.

**Live:** [submind-blond.vercel.app](https://submind-blond.vercel.app)

---

## Architecture

SubMind is a multi-stage intelligence pipeline that takes a research query and produces an institutional-grade briefing with verified sources, behavioral divergence analysis, predictions, and risk assessment.

### 10-Stage Pipeline

1. **Query Preprocessing** — Domain classification, entity detection, abbreviation expansion, temporal context analysis, search angle generation
2. **Parallel Source Gathering** — 3-way concurrent search via Gemini Grounded Search + Gemini Deep Source Discovery + OpenAI context enrichment
3. **Intelligence Briefing** — Cerebras (Llama 4 Scout) generates structured JSON briefing with timeline, findings, predictions, reasoning chain
4. **Source Merge & Dedup** — Combines grounded, deep, and AI-referenced sources; deduplicates by URL
5. **URL Verification** — HEAD/GET requests to verify every source URL; broken links get smart search fallbacks
6. **Source Provenance** — 5-tier classification (Primary Document → Official → Reputable → Industry → Secondary)
7. **Semantic Clustering** — Groups sources by domain to detect diversity or echo-chamber concentration
8. **Behavioral Divergence** — Identifies gaps between mainstream narrative and raw data reality
9. **Glass Fang Validation** — 16-metric composite scoring (source depth, provenance, reasoning quality, divergence detection, etc.)
10. **Nemesis Adversarial Engine** — Challenges the briefing for weak predictions, unsourced claims, missing evidence

### Intelligence Modules

- **Dark Matter Void Engine** — Detects "void signals": underreported findings, prediction clusters, consensus-confidence gaps
- **Glass Fang** — 16-dimensional trust scoring with weighted composite (0-100)
- **Nemesis** — Adversarial quality checker that flags issues with severity ratings
- **Query Intelligence** — Preprocesses queries with domain classification, entity detection, search angle generation
- **Source Provenance** — 5-tier trust classification with domain-specific weight assignments

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Canvas API animations |
| API | Vercel Serverless Functions (Node.js) |
| AI Models | Cerebras (Llama 4 Scout), Gemini 2.0 Flash, GPT-4o-mini |
| Search | Gemini Grounded Search (Google Search integration) |
| Database | Supabase (PostgreSQL) — prediction persistence |
| Cache | Upstash Redis — query result caching (1hr TTL) |
| Hosting | Vercel (Hobby tier) |
| Admin | Intelligence Operations Dashboard (/admin) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CEREBRAS_API_KEY` | Yes | Cerebras API key for Llama 4 Scout |
| `GEMINI_API_KEY` | Yes | Google AI Studio key for Gemini 2.0 Flash |
| `GEMINI_API_KEYS` | No | Comma-separated Gemini keys for load balancing |
| `OPENAI_API_KEY` | Yes | OpenAI key for GPT-4o-mini context enrichment |
| `SUPABASE_URL` | No | Supabase project URL for prediction persistence |
| `SUPABASE_SERVICE_ROLE` | No | Supabase service role key |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for query caching |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis auth token |

## Source Provenance Tiers

| Tier | Label | Trust Weight | Examples |
|------|-------|-------------|----------|
| TIER_1 | Primary Document | 1.0 | .gov, SEC, arxiv.org, patents |
| TIER_2 | Official Source | 0.9 | Reuters, AP, BBC, Bloomberg, Nature |
| TIER_3 | Reputable Analysis | 0.75 | NYT, WaPo, Brookings, .edu, .org |
| TIER_4 | Industry/Trade | 0.6 | TechCrunch, Ars Technica, The Verge |
| TIER_5 | Secondary/Opinion | 0.4 | Everything else |

## Glass Fang Metrics (16)

Source Depth, Source Diversity, Temporal Coverage, Specificity, Prediction Quality, Evidence Chain, Cross-Reference Density, Pattern Depth, Investment Relevance, Timeline Depth, Confidence Calibration, Source Verification, Provenance Quality, Cluster Health, Reasoning Quality, Divergence Detection

## API

**POST** `/api/predict`

Request:
```json
{ "query": "your research topic" }
```

Response includes: `briefing`, `validation` (glass_fang, nemesis), `intelligence` (behavioral_divergence, query_intelligence, source_clusters, provenance_summary), `meta`

**GET** `/api/predict` — Returns healthcheck with 5 self-tests

## Admin Dashboard

Access at `/admin` — Shows system health, pipeline architecture, source provenance reference, and prediction history (requires Supabase).

## Deployment

1. Fork this repo
2. Import to Vercel
3. Add environment variables
4. Deploy — auto-deploys on every push to main

---

Built with relentless attention to source verification and analytical depth.
