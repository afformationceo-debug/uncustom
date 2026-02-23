import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH = 5000;
let totalDeleted = 0;

while (true) {
  const { data, error } = await supabase
    .from("influencers")
    .select("id")
    .limit(BATCH);

  if (error) { console.error("Select error:", error.message); break; }
  if (!data || data.length === 0) break;

  // Delete in smaller sub-batches to avoid URL length limits
  const ids = data.map((r) => r.id);
  const SUB = 500;
  for (let i = 0; i < ids.length; i += SUB) {
    const chunk = ids.slice(i, i + SUB);
    const { error: delErr } = await supabase
      .from("influencers")
      .delete()
      .in("id", chunk);
    if (delErr) { console.error("Delete error:", delErr.message); }
  }
  totalDeleted += ids.length;
  process.stdout.write(`  Deleted ${totalDeleted}...\r`);
}

console.log(`\nTotal deleted: ${totalDeleted}`);

const { count } = await supabase
  .from("influencers")
  .select("id", { count: "exact", head: true });
console.log("Remaining influencers:", count);
