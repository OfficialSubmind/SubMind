import { createClient } from "@supabase/supabase-js";
function auth(req){ const token=req.headers["x-admin-token"]; return !!token && token===process.env.ADMIN_TOKEN; }
function makeSupabase(){ const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE; if(!url||!key) return null; return createClient(url, key, { auth:{ persistSession:false } }); }
export default async function handler(req,res){
  if(!auth(req)) return res.status(401).send("Unauthorized");
  const limit = Math.max(1, Math.min(parseInt(req.query?.limit || "25", 10), 200));
  const supabase = makeSupabase(); if(!supabase) return res.status(501).send("Supabase not configured");
  const { data, error } = await supabase.from("predictions")
    .select("id, created_at, reliability_score, trust_weighted_score, source_entropy, trust_confirmed, trust_inferred, trust_corrupted, output->>summary")
    .order("created_at", { ascending:false }).limit(limit);
  if(error) return res.status(500).send(String(error.message || error));
  const rows = (data||[]).map(r => ({ id:r.id, created_at:r.created_at, reliability_score:r.reliability_score, trust_weighted_score:r.trust_weighted_score ?? null, source_entropy:r.source_entropy ?? null, trust_confirmed:r.trust_confirmed, trust_inferred:r.trust_inferred, trust_corrupted:r.trust_corrupted, summary:r["output->>summary"] || null }));
  return res.status(200).json(rows);
}