import { createClient } from "@supabase/supabase-js";

function makeSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");
    const token = req.headers["x-admin-token"] || req.query.token;
    if (!token || token !== process.env.ADMIN_TOKEN) {
          return res.status(401).send("Unauthorized");
    }
    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const supabase = makeSupabase();
    if (!supabase) return res.status(503).send("Database not configured");
    const { data, error } = await supabase
      .from("predictions")
      .select("id, created_at, reliability_score, trust_weighted_score, source_entropy, trust_confirmed, trust_inferred, trust_corrupted, output->summary, output->trend_meta")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return res.status(500).send(error.message);
    const rows = (data || []).map(r => ({
          id: r.id,
          created_at: r.created_at,
          reliability_score: r.reliability_score,
          trust_weighted_score: r.trust_weighted_score,
          source_entropy: r.source_entropy,
          trust_confirmed: r.trust_confirmed,
          trust_inferred: r.trust_inferred,
          trust_corrupted: r.trust_corrupted,
          summary: r.summary,
          trend_meta: r.trend_meta
    }));
    return res.status(200).json(rows);
}
