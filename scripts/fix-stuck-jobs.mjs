import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Fix stuck email_social jobs (no apify_run_id)
const { data, error } = await supabase
  .from("extraction_jobs")
  .update({ status: "failed", completed_at: new Date().toISOString() })
  .eq("type", "email_social")
  .is("apify_run_id", null)
  .eq("status", "running")
  .select("id, platform");

console.log("Fixed stuck email_social jobs:", data?.length, data?.map(j => j.platform).join(", "));
if (error) console.error("Error:", error.message);
