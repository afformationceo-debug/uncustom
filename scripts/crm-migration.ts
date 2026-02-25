#!/usr/bin/env npx tsx
/**
 * CRM MySQL → Uncustom 마이그레이션 CLI 스크립트
 *
 * Usage:
 *   npx tsx scripts/crm-migration.ts [phase]
 *
 * Phases:
 *   all          - 전체 Phase 순차 실행
 *   hospitals    - Phase 1: hospitals → campaigns
 *   procedures   - Phase 2: procedures → crm_procedures
 *   influencers  - Phase 3: users + automation.influencer → influencers
 *   reservations - Phase 4: reservations → campaign_influencers
 *   automation   - Phase 5: keywords, templates, dm_history
 *   verify       - Phase 6: 데이터 정합성 검증
 *   test         - MySQL 연결 테스트
 */

// Load env FIRST before any other imports that use process.env
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import {
  migrateHospitals,
  migrateProcedures,
  migrateInfluencers,
  migrateCustomers,
  migrateAllReservationCustomers,
  migrateAutomationInfluencers,
  migrateReservations,
  migrateAutomationData,
  migrateInfluencerLinks,
  migrateReservationPayments,
  verifyMigration,
} from "../src/lib/crm/migration";
import { testConnection } from "../src/lib/crm/mysql-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Get team_id from first team (admin context)
async function getTeamId(): Promise<string> {
  const { data, error } = await supabase.from("teams").select("id").limit(1).single();
  if (error || !data) throw new Error("No team found: " + error?.message);
  return data.id;
}

function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

function logResult(label: string, result: { created?: number; matched?: number; updated?: number; skipped?: number; errors?: string[] }) {
  log("📊", `${label}:`);
  if (result.created !== undefined) log("  ✅", `Created: ${result.created}`);
  if (result.matched !== undefined) log("  🔗", `Matched: ${result.matched}`);
  if (result.updated !== undefined) log("  🔄", `Updated: ${result.updated}`);
  if (result.skipped !== undefined) log("  ⏭️", `Skipped: ${result.skipped}`);
  if (result.errors && result.errors.length > 0) {
    log("  ❌", `Errors: ${result.errors.length}`);
    for (const err of result.errors.slice(0, 5)) {
      log("    ", err);
    }
    if (result.errors.length > 5) {
      log("    ", `... and ${result.errors.length - 5} more`);
    }
  }
}

async function runPhase(phase: string) {
  const teamId = await getTeamId();
  const start = Date.now();

  switch (phase) {
    case "test": {
      log("🔌", "Testing MySQL connection...");
      const result = await testConnection();
      if (result.connected) {
        log("✅", `Connected to MySQL ${result.version}`);
      } else {
        log("❌", `Connection failed: ${result.error}`);
      }
      break;
    }

    case "hospitals": {
      log("🏥", "Phase 1: hospitals → campaigns");
      const result = await migrateHospitals(supabase, teamId);
      logResult("Hospitals", result);
      break;
    }

    case "procedures": {
      log("💉", "Phase 2: procedures → crm_procedures");
      const result = await migrateProcedures(supabase);
      logResult("Procedures", result);
      break;
    }

    case "influencers": {
      log("👤", "Phase 3a: CRM users (role=influencer) → influencers");
      const result1 = await migrateInfluencers(supabase);
      logResult("CRM Users (influencer)", result1);

      log("👥", "Phase 3a-2: CRM users (role=customer with reservations) → influencers");
      const result1b = await migrateCustomers(supabase);
      logResult("CRM Customers", result1b);

      log("🤖", "Phase 3b: automation.influencer → influencers");
      const result2 = await migrateAutomationInfluencers(supabase);
      logResult("Automation Influencers", result2);
      break;
    }

    case "customers": {
      log("👥", "Phase 3a-2: CRM customers with reservations → influencers");
      const result = await migrateCustomers(supabase);
      logResult("CRM Customers", result);
      break;
    }

    case "force-customers": {
      log("🔧", "Force: All reservation customers → influencers");
      const result = await migrateAllReservationCustomers(supabase);
      logResult("Force Customers", result);
      break;
    }

    case "reservations": {
      log("📅", "Phase 4: reservations → campaign_influencers");
      const result = await migrateReservations(supabase);
      logResult("Reservations", result);
      break;
    }

    case "automation": {
      log("⚙️", "Phase 5: automation data (keywords, templates, DM history)");

      // Get first campaign as default for DM accounts/templates
      const { data: firstCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .not("crm_hospital_id", "is", null)
        .limit(1)
        .single();

      if (!firstCampaign) {
        log("❌", "No CRM-linked campaign found. Run hospitals phase first.");
        break;
      }

      const result = await migrateAutomationData(supabase, teamId, firstCampaign.id);
      log("📊", "Automation Data:");
      log("  🔑", `Keywords: ${result.keywords}`);
      log("  📝", `Templates: ${result.templates}`);
      log("  💬", `DM History: ${result.dmHistory}`);
      log("  📱", `SNS Accounts: ${result.snsAccounts}`);
      if (result.errors.length > 0) {
        log("  ❌", `Errors: ${result.errors.length}`);
        for (const err of result.errors) log("    ", err);
      }
      break;
    }

    case "links": {
      log("🔗", "Phase 7: influencer_links → profile_url/username + Supabase links");
      const result = await migrateInfluencerLinks(supabase);
      log("📊", "Influencer Links:");
      log("  ✅", `Created (new from links): ${result.created}`);
      log("  🔄", `Updated profile_url/username: ${result.updated}`);
      log("  🔗", `Links stored: ${result.linksCreated}`);
      log("  ⏭️", `Skipped: ${result.skipped}`);
      if (result.errors.length > 0) {
        log("  ❌", `Errors: ${result.errors.length}`);
        for (const err of result.errors.slice(0, 10)) log("    ", err);
      }
      break;
    }

    case "payments": {
      log("💰", "Phase 8: reservation_payments → campaign_influencers payment data");
      const result = await migrateReservationPayments(supabase);
      log("📊", "Reservation Payments:");
      log("  🔄", `Updated: ${result.updated}`);
      log("  ⏭️", `Skipped: ${result.skipped}`);
      if (result.errors.length > 0) {
        log("  ❌", `Errors: ${result.errors.length}`);
        for (const err of result.errors.slice(0, 10)) log("    ", err);
      }
      break;
    }

    case "verify": {
      log("🔍", "Phase 6: Verification");
      const result = await verifyMigration(supabase);

      log("📊", "CRM (MySQL):");
      for (const [key, val] of Object.entries(result.crm)) {
        log("  ", `${key}: ${val}`);
      }

      log("📊", "Uncustom (Supabase):");
      for (const [key, val] of Object.entries(result.uncustom)) {
        log("  ", `${key}: ${val}`);
      }

      log("📊", "Sync Log:");
      for (const [key, val] of Object.entries(result.syncLog)) {
        log("  ", `${key}: ${val}`);
      }
      break;
    }

    case "all": {
      log("🚀", "Starting full migration...\n");

      await runPhase("test");
      console.log();

      await runPhase("hospitals");
      console.log();

      await runPhase("procedures");
      console.log();

      await runPhase("influencers");
      console.log();

      await runPhase("reservations");
      console.log();

      await runPhase("automation");
      console.log();

      await runPhase("verify");
      break;
    }

    default:
      console.error(`Unknown phase: ${phase}`);
      console.error("Available: test, hospitals, procedures, influencers, reservations, automation, verify, all");
      process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log("⏱️", `${phase} completed in ${elapsed}s`);
}

// Main
const phase = process.argv[2] ?? "all";
runPhase(phase)
  .then(() => {
    log("✅", "Migration complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });
