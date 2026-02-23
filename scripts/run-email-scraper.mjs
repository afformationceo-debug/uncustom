import { config } from "dotenv";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ACTOR_ID = "chitosibug3/social-media-email-scraper-2026";

console.log("📧 Social Email Scraper 시작\n");

// email이 null인 Twitter 인플루언서 최대 200명
const { data: targets } = await supabase
  .from("influencers")
  .select("id, platform, platform_id, username")
  .eq("platform", "twitter")
  .is("email", null)
  .limit(200);

if (!targets?.length) {
  console.log("이메일 미보유 Twitter 인플루언서 없음");
  process.exit(0);
}

console.log(`대상: ${targets.length}명`);

// Build influencer map for matching results back
const infMap = {};
for (const t of targets) {
  if (t.username) infMap[t.username.toLowerCase()] = t.id;
  if (t.platform_id) infMap[t.platform_id] = t.id;
}

// Actor accepts individual items with platform + user_id
// Run one at a time won't work for 100+ users. Try batch format.
// Based on error: "Field input.platform is required" - the actor wants top-level platform
// Likely format: { platform: "twitter", user_id: "username" } for single, or items array for batch
// Try with items array but also include platform at top level
const lookupItems = targets.map(t => ({
  platform: "twitter",
  user_id: t.username || t.platform_id || "",
})).filter(item => item.user_id !== "");

console.log(`조회 항목: ${lookupItems.length}개`);
console.log("Apify Actor 시작...");

let run;
try {
  // Try batch format with items array
  run = await apify.actor(ACTOR_ID).start({
    platform: "twitter",
    items: lookupItems,
  });
} catch (e1) {
  console.log("items 형식 실패, startUrls 형식 시도...");
  try {
    // Try alternative format
    run = await apify.actor(ACTOR_ID).start({
      platform: "twitter",
      user_ids: lookupItems.map(i => i.user_id),
    });
  } catch (e2) {
    console.log("user_ids 형식도 실패, 개별 실행 모드...");
    // Last resort: run individually for first 50
    const subset = lookupItems.slice(0, 50);
    let totalFound = 0;
    for (let i = 0; i < subset.length; i++) {
      try {
        process.stdout.write(`  ${i + 1}/${subset.length} @${subset[i].user_id}...\r`);
        const singleRun = await apify.actor(ACTOR_ID).call({
          platform: "twitter",
          user_id: subset[i].user_id,
        }, { waitSecs: 30 });

        if (singleRun.defaultDatasetId) {
          const { items: results } = await apify.dataset(singleRun.defaultDatasetId).listItems();
          for (const r of results) {
            const email = r.email || r.emails?.[0];
            if (!email) continue;
            const infId = infMap[subset[i].user_id.toLowerCase()] || infMap[subset[i].user_id];
            if (infId) {
              await supabase
                .from("influencers")
                .update({ email, email_source: "social-scraper:twitter" })
                .eq("id", infId);
              totalFound++;
              console.log(`  ✅ @${subset[i].user_id} → ${email}`);
            }
          }
        }
      } catch (e3) {
        // Skip failures silently
      }
    }
    console.log(`\n\n✅ 개별 실행 완료: ${totalFound}명 이메일 발견`);
    const { count } = await supabase
      .from("influencers")
      .select("*", { count: "exact", head: true })
      .eq("platform", "twitter")
      .not("email", "is", null);
    console.log(`Twitter 이메일 보유 총: ${count}명`);
    process.exit(0);
  }
}

console.log(`Run ID: ${run.id}`);

// 폴링
let status;
let elapsed = 0;
do {
  await new Promise(r => setTimeout(r, 5000));
  elapsed += 5;
  status = await apify.run(run.id).get();
  process.stdout.write(`  ${elapsed}초... (${status.status})\r`);
} while (status.status === "RUNNING" || status.status === "READY");
console.log(`\n완료! 상태: ${status.status}`);

if (status.status !== "SUCCEEDED") {
  console.error("❌ 실패:", status.status);
  process.exit(1);
}

// 결과 처리
const { items: results } = await apify.dataset(status.defaultDatasetId).listItems();
console.log(`결과: ${results.length}개`);

let updated = 0;
for (const result of results) {
  const email = result.email || result.emails?.[0];
  if (!email) continue;

  const userId = (result.user_id || result.username || "").toLowerCase();
  const infId = infMap[userId];
  if (infId) {
    const { error } = await supabase
      .from("influencers")
      .update({ email, email_source: "social-scraper:twitter" })
      .eq("id", infId);
    if (!error) updated++;
  }
}

console.log(`\n✅ ${updated}명 이메일 업데이트 완료`);

const { count } = await supabase
  .from("influencers")
  .select("*", { count: "exact", head: true })
  .eq("platform", "twitter")
  .not("email", "is", null);
console.log(`Twitter 이메일 보유 총: ${count}명`);
