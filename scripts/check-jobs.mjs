import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";
config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

// Check all running jobs
const { data: jobs } = await supabase
  .from("extraction_jobs")
  .select("id, platform, type, status, apify_run_id, created_at, total_extracted")
  .in("status", ["running", "pending"])
  .order("created_at", { ascending: false });

console.log("=== RUNNING/PENDING JOBS ===");
for (const j of (jobs || [])) {
  console.log(`${j.type} | ${j.platform} | ${j.status} | run: ${j.apify_run_id || "none"} | ${j.created_at}`);

  if (!j.apify_run_id) {
    console.log("  → NO apify_run_id - stuck job!");
    continue;
  }
  try {
    const run = await apify.run(j.apify_run_id).get();
    console.log(`  → Apify: status=${run.status}, started=${run.startedAt}, finished=${run.finishedAt || "still running"}`);

    if (run.status === "SUCCEEDED" || run.status === "FAILED" || run.status === "ABORTED") {
      console.log(`  → DB says 'running' but Apify says '${run.status}' — OUT OF SYNC!`);
    }
  } catch (e) {
    console.log(`  → Apify error: ${e.message}`);
  }
}

if (!jobs || jobs.length === 0) {
  console.log("No running/pending jobs found");
}

// Recent jobs summary
const { data: allJobs } = await supabase
  .from("extraction_jobs")
  .select("id, type, platform, status, created_at, total_extracted, new_extracted")
  .order("created_at", { ascending: false })
  .limit(20);

console.log("\n=== RECENT 20 JOBS ===");
for (const j of (allJobs || [])) {
  const date = new Date(j.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log(`${j.type.padEnd(14)} | ${j.platform.padEnd(10)} | ${j.status.padEnd(10)} | extracted: ${j.total_extracted ?? "-"} new: ${j.new_extracted ?? "-"} | ${date}`);
}
