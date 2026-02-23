import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const platforms = ["twitter", "instagram", "tiktok", "youtube"];

for (const platform of platforms) {
  const { data } = await supabase
    .from("influencers")
    .select("username, raw_data")
    .eq("platform", platform)
    .not("raw_data", "is", null)
    .order("follower_count", { ascending: false })
    .limit(3);

  if (!data?.length) {
    console.log(`\n=== ${platform.toUpperCase()} === (데이터 없음)\n`);
    continue;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${platform.toUpperCase()} — raw_data 구조 (${data.length}개 샘플)`);
  console.log(`${"═".repeat(60)}`);

  // Collect all keys across samples
  const allKeys = new Map(); // key -> {type, samples: []}

  for (const row of data) {
    const raw = row.raw_data;
    if (!raw || typeof raw !== "object") continue;

    function collectKeys(obj, prefix = "") {
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (val === null || val === undefined) {
          if (!allKeys.has(fullKey)) allKeys.set(fullKey, { type: "null", sample: "null" });
        } else if (Array.isArray(val)) {
          const existing = allKeys.get(fullKey);
          if (!existing || existing.type === "null") {
            const sample = val.length > 0
              ? (typeof val[0] === "object" ? `Array[${val.length}] of objects` : `Array[${val.length}]: ${JSON.stringify(val.slice(0, 2)).substring(0, 80)}`)
              : "[]";
            allKeys.set(fullKey, { type: "array", sample });
          }
        } else if (typeof val === "object") {
          collectKeys(val, fullKey);
        } else {
          const existing = allKeys.get(fullKey);
          if (!existing || existing.type === "null") {
            allKeys.set(fullKey, { type: typeof val, sample: String(val).substring(0, 80) });
          }
        }
      }
    }
    collectKeys(raw);
  }

  // Sort and print
  const sorted = [...allKeys.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, info] of sorted) {
    // Skip deep nested keys beyond 2 levels for readability
    if (key.split(".").length > 3) continue;
    console.log(`  ${key.padEnd(45)} ${info.type.padEnd(8)} ${info.sample}`);
  }
  console.log(`  Total unique keys: ${sorted.length}`);
}
