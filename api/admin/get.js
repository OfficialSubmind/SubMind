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
    const { id } = req.query;
    if (!id) return res.status(400).send("Missing id");
    const supabase = makeSupabase();
    if (!supabase) return res.status(503).send("Database not configured");
    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return res.status(404).send(error.message);
    return res.status(200).json(data);
}
