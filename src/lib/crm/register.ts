/**
 * Uncustom → CRM 양방향 연동
 * Uncustom에서 "CRM 등록" 시 MySQL CRM에 예약 자동 생성
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { crmPool } from "./mysql-client";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ============================================================
// CRM 예약 등록 (Uncustom → CRM)
// ============================================================

export async function registerToCrm(
  supabase: SupabaseClient<Database>,
  campaignInfluencerId: string
): Promise<{
  success: boolean;
  crmReservationId?: number;
  error?: string;
}> {
  // 1. Get campaign_influencer with joins
  const { data: ci, error: ciError } = await supabase
    .from("campaign_influencers")
    .select(`*,
      influencer:influencers!inner(id, username, display_name, email, phone, crm_user_id, real_name, country, platform),
      campaign:campaigns!campaign_id(id, name, crm_hospital_id, crm_hospital_code)
    `)
    .eq("id", campaignInfluencerId)
    .single();

  if (ciError || !ci) {
    return { success: false, error: "Campaign influencer not found" };
  }

  const record = ci as unknown as {
    id: string;
    campaign_id: string;
    influencer_id: string;
    visit_scheduled_date: string | null;
    crm_procedure: string | null;
    crm_requested_procedure: string | null;
    interpreter_needed: boolean;
    interpreter_name: string | null;
    notes: string | null;
    crm_reservation_id: number | null;
    influencer: {
      id: string;
      username: string | null;
      display_name: string | null;
      email: string | null;
      phone: string | null;
      crm_user_id: number | null;
      real_name: string | null;
      country: string | null;
      platform: string;
    };
    campaign: {
      id: string;
      name: string;
      crm_hospital_id: number | null;
      crm_hospital_code: string | null;
    };
  };

  // 2. Validate hospital mapping
  if (!record.campaign.crm_hospital_id) {
    return { success: false, error: "Campaign has no CRM hospital mapping" };
  }

  // 3. Check if already registered
  if (record.crm_reservation_id) {
    return { success: false, error: `Already registered as CRM reservation #${record.crm_reservation_id}` };
  }

  // 4. Ensure CRM user exists
  let crmUserId = record.influencer.crm_user_id;

  if (!crmUserId) {
    // Check for existing CRM user by email first (prevent duplicates)
    if (record.influencer.email) {
      const [existing] = await crmPool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [record.influencer.email]
      );
      if (existing.length > 0) {
        crmUserId = existing[0].id as number;
        // Save mapping back
        await supabase
          .from("influencers")
          .update({ crm_user_id: crmUserId })
          .eq("id", record.influencer.id);
      }
    }
  }

  if (!crmUserId) {
    // Create user in MySQL CRM
    const [result] = await crmPool.query<ResultSetHeader>(
      `INSERT INTO users (full_name, name_kr, email, phone_number, country_code, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', NOW(), NOW())`,
      [
        record.influencer.display_name ?? record.influencer.username,
        record.influencer.real_name,
        record.influencer.email,
        record.influencer.phone,
        record.influencer.country,
      ]
    );
    crmUserId = result.insertId;

    // Save crm_user_id back to Uncustom
    await supabase
      .from("influencers")
      .update({ crm_user_id: crmUserId })
      .eq("id", record.influencer.id);
  }

  // 5. Create reservation in MySQL
  const [reservationResult] = await crmPool.query<ResultSetHeader>(
    `INSERT INTO reservations
     (hospital_id, customer_id, visit_date, visit_status, sponsored_procedure, requested_procedure,
      interpreter_required, memo, channel, referral_source, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, 'homepage', 'uncustom', NOW(), NOW())`,
    [
      record.campaign.crm_hospital_id,
      crmUserId,
      record.visit_scheduled_date ?? null,
      record.crm_procedure ?? null,
      record.crm_requested_procedure ?? null,
      record.interpreter_needed ? 1 : 0,
      record.notes ?? null,
    ]
  );

  const crmReservationId = reservationResult.insertId;

  // 6. Update Uncustom record
  await supabase
    .from("campaign_influencers")
    .update({
      crm_reservation_id: crmReservationId,
      crm_registered: true,
      crm_registered_at: new Date().toISOString(),
    })
    .eq("id", campaignInfluencerId);

  // 7. Log sync
  await supabase.from("crm_sync_log").insert({
    direction: "uncustom_to_crm",
    entity_type: "reservation",
    crm_id: crmReservationId,
    uncustom_id: campaignInfluencerId,
    action: "created",
    details: {
      hospital_id: record.campaign.crm_hospital_id,
      customer_id: crmUserId,
    } as unknown as Json,
  });

  return { success: true, crmReservationId };
}

// ============================================================
// 상태 동기화 (Uncustom → CRM)
// ============================================================

export async function syncStatusToCrm(
  supabase: SupabaseClient<Database>,
  campaignInfluencerId: string,
  field: "visit_completed" | "upload_url" | "influencer_payment_status" | "client_payment_status" | "guideline_sent" | "notes" | "crm_procedure" | "interpreter_needed",
  value: unknown
): Promise<{ success: boolean; error?: string }> {
  // Get the record
  const { data: ci } = await supabase
    .from("campaign_influencers")
    .select("crm_reservation_id")
    .eq("id", campaignInfluencerId)
    .single();

  if (!ci?.crm_reservation_id) {
    return { success: false, error: "No CRM reservation linked" };
  }

  try {
    switch (field) {
      case "visit_completed": {
        const visitStatus = value ? "visited" : "pending";
        await crmPool.query(
          "UPDATE reservations SET visit_status = ?, updated_at = NOW() WHERE id = ?",
          [visitStatus, ci.crm_reservation_id]
        );
        break;
      }
      case "upload_url": {
        // Check if review record exists
        const [existing] = await crmPool.query<RowDataPacket[]>(
          "SELECT id FROM reservation_reviews WHERE reservation_id = ?",
          [ci.crm_reservation_id]
        );
        if (existing.length > 0) {
          await crmPool.query(
            "UPDATE reservation_reviews SET review_link = ?, review_upload_date = NOW(), updated_at = NOW() WHERE reservation_id = ?",
            [value, ci.crm_reservation_id]
          );
        } else {
          await crmPool.query(
            `INSERT INTO reservation_reviews (reservation_id, review_link, review_upload_date, created_at, updated_at)
             VALUES (?, ?, NOW(), NOW(), NOW())`,
            [ci.crm_reservation_id, value]
          );
        }
        break;
      }
      case "influencer_payment_status": {
        const crmStatus = value === "paid" ? "completed" : "pending";
        await crmPool.query(
          `UPDATE reservation_reviews SET settlement_status_for_influencer = ?,
           settlement_for_influencer_completed_at = IF(? = 'completed', NOW(), NULL),
           updated_at = NOW()
           WHERE reservation_id = ?`,
          [crmStatus, crmStatus, ci.crm_reservation_id]
        );
        break;
      }
      case "client_payment_status": {
        const crmStatus = value === "paid" ? "completed" : "pending";
        await crmPool.query(
          `UPDATE reservation_reviews SET settlement_status_for_hospital = ?,
           settlement_for_hospital_completed_at = IF(? = 'completed', NOW(), NULL),
           updated_at = NOW()
           WHERE reservation_id = ?`,
          [crmStatus, crmStatus, ci.crm_reservation_id]
        );
        break;
      }
      case "guideline_sent": {
        // Ensure review record exists
        const [existing] = await crmPool.query<RowDataPacket[]>(
          "SELECT id FROM reservation_reviews WHERE reservation_id = ?",
          [ci.crm_reservation_id]
        );
        if (existing.length > 0) {
          await crmPool.query(
            "UPDATE reservation_reviews SET is_guideline_sent = ?, updated_at = NOW() WHERE reservation_id = ?",
            [value ? 1 : 0, ci.crm_reservation_id]
          );
        } else {
          await crmPool.query(
            `INSERT INTO reservation_reviews (reservation_id, is_guideline_sent, created_at, updated_at)
             VALUES (?, ?, NOW(), NOW())`,
            [ci.crm_reservation_id, value ? 1 : 0]
          );
        }
        break;
      }
      case "notes": {
        await crmPool.query(
          "UPDATE reservations SET memo = ?, updated_at = NOW() WHERE id = ?",
          [value ?? null, ci.crm_reservation_id]
        );
        break;
      }
      case "crm_procedure": {
        await crmPool.query(
          "UPDATE reservations SET sponsored_procedure = ?, updated_at = NOW() WHERE id = ?",
          [value ?? null, ci.crm_reservation_id]
        );
        break;
      }
      case "interpreter_needed": {
        await crmPool.query(
          "UPDATE reservations SET interpreter_required = ?, updated_at = NOW() WHERE id = ?",
          [value ? 1 : 0, ci.crm_reservation_id]
        );
        break;
      }
    }

    // Log sync
    await supabase.from("crm_sync_log").insert({
      direction: "uncustom_to_crm",
      entity_type: "reservation",
      crm_id: ci.crm_reservation_id,
      uncustom_id: campaignInfluencerId,
      action: "updated",
      details: { field, value } as unknown as Json,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
