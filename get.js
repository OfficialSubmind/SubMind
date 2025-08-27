import { createClient } from "@supabase/supabase-js";
function auth(req){ const token=req.headers["x-admin-token"]; return !!token && token===process.env.ADMIN_TOKEN; }
function makeSupabase(){ const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE; if(!url||!key) return null; return createClient(url, key, { auth:{ persistSession:false } }); }
export default async function handler(req,res){
  if(!auth(req)) return res.status(401).send("Unauthorized");
  const id=req.query?.id; if(!id) return res.status(400).send("Missing id");
  const supabase=makeSupabase(); if(!supabase) return res.status(501).send("Supabase not configured");
  const { data, error } = await supabase.from("predictions").select("*").eq("id", id).single();
  if(error) return res.status(500).send(String(error.message || error));
  return res.status(200).json(data);
}