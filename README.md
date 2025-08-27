# SubMind v1.1 — Trust weights + Source entropy

Adds:
- **Trust-weighted score**: combines model score with per-domain weights, stance, and trust tags.
- **Source entropy**: measures diversity of evidence (stance + trust), normalized 0–1.
- Backward compatible JSON: fields `trust_weighted_score` and `source_entropy` are added.

Optional environment variable:
- `SUBMIND_TRUST_WEIGHTS` — JSON object. Example:
  `{"nytimes.com":1.2,".gov":1.3,".edu":1.15,"substack.com":0.9}`

DB migration (optional):
```sql
alter table public.predictions add column if not exists trust_weighted_score numeric;
alter table public.predictions add column if not exists source_entropy numeric;
```
Admin list shows new fields when present. Fallback insert is automatic if columns are missing.
