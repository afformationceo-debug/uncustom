/**
 * CRM MySQL → Uncustom 마이그레이션 핵심 로직
 * hospitals → campaigns, users → influencers, reservations → campaign_influencers
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { crmPool, automationPool } from "./mysql-client";
import type { RowDataPacket } from "mysql2";

// ============================================================
// Type Definitions for MySQL CRM tables
// ============================================================

interface CrmHospital extends RowDataPacket {
  id: number;
  name: string;
  hospital_code: string | null;
  business_number: string | null;
  commission_rate: number | null;
  address: string | null;
  phone_number: string | null;
  tax_invoice_email: string | null;
  ceo_name: string | null;
  operating_hours: string | null;
  channeltalk_apikey: string | null;
  channeltalk_secret: string | null;
  created_at: string | null;
}

interface CrmUser extends RowDataPacket {
  id: number;
  full_name: string | null;
  name_kr: string | null;
  email: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  country_code: string | null;
  gender: string | null;
  line_id: string | null;
  role: string;
  created_at: string | null;
}

interface CrmInfluencerLink extends RowDataPacket {
  id: number;
  user_id: number;
  url: string;
  platform: string | null;
}

interface CrmReservation extends RowDataPacket {
  id: number;
  hospital_id: number;
  customer_id: number;
  visit_date: string | null;
  visit_status: string;
  schedule_confirm: string | null;
  sponsored_procedure: string | null;
  requested_procedure: string | null;
  interpreter_id: number | null;
  interpreter_required: number;
  memo: string | null;
  channel: string | null;
  channeltalk_chat_id: string | null;
  referral_source: string | null;
  created_at: string | null;
}

interface CrmReview extends RowDataPacket {
  id: number;
  reservation_id: number;
  review_link: string | null;
  review_upload_date: string | null;
  review_submission_deadline: string | null;
  is_guideline_sent: number;
  is_review_confirmed: number;
  review_fee_for_influencer: number | null;
  review_fee_for_hospital: number | null;
  settlement_status_for_influencer: string | null;
  settlement_status_for_hospital: string | null;
  settlement_for_influencer_completed_at: string | null;
  settlement_for_hospital_completed_at: string | null;
}

interface CrmPayment extends RowDataPacket {
  id: number;
  reservation_id: number;
  payment_amount: number | null;
  commission_rate: number | null;
  prepayment_amount: number | null;
}

interface CrmProcedure extends RowDataPacket {
  id: number;
  hospital_id: number;
  name: string;
  description: string | null;
  price: number | null;
  fee_rate: number | null;
  is_sponsored: number;
}

interface CrmPartnerProfile extends RowDataPacket {
  user_id: number;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  swift_code: string | null;
  paypal_account: string | null;
  settlement_method: string | null;
}

interface AutoInfluencer extends RowDataPacket {
  id: number;
  account_uid: string | null;
  account_title: string | null;
  channel: string | null;
  channel_url: string | null;
  follower_count: number | null;
  post_count: number | null;
  engagement_rate: number | null;
  email: string | null;
  country: string | null;
  bio: string | null;
  keywords: string | null;
}

interface AutoKeyword extends RowDataPacket {
  id: number;
  keyword: string;
  channel: string | null;
}

interface AutoDmAccount extends RowDataPacket {
  id: number;
  platform: string | null;
  account_name: string | null;
  api_key: string | null;
  api_secret: string | null;
}

interface AutoTemplate extends RowDataPacket {
  id: number;
  name: string | null;
  content: string | null;
  type: string | null;
}

interface AutoDmHistory extends RowDataPacket {
  id: number;
  influencer_id: number | null;
  account_id: number | null;
  template_id: number | null;
  status: string | null;
  sent_at: string | null;
  message: string | null;
}

// ============================================================
// Utility Functions
// ============================================================

/** Fetch ALL rows from a Supabase table, paginating to avoid 1000-row limit */
async function fetchAll<T>(
  supabase: SupabaseClient<Database>,
  table: string,
  select: string,
  filter?: { column: string; op: string; value: unknown }
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filter) {
      if (filter.op === "not.is.null") {
        query = query.not(filter.column, "is", null);
      }
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/** Convert MySQL Date object or string to ISO date string (YYYY-MM-DD) */
function toDateStr(val: unknown): string | null {
  if (!val) return null;
  try {
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return val.toISOString().split("T")[0];
    }
    if (typeof val === "string") return val.split("T")[0].split(" ")[0];
  } catch { return null; }
  return null;
}

/** Convert MySQL Date object or string to full ISO timestamp */
function toTimestamp(val: unknown): string | null {
  if (!val) return null;
  try {
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return val.toISOString();
    }
    if (typeof val === "string") return val;
  } catch { return null; }
  return null;
}

/** Parse username from a social media URL */
export function parseUsernameFromUrl(url: string): { platform: string; username: string } | null {
  try {
    const cleaned = url.trim().toLowerCase().replace(/\/$/, "");
    if (cleaned.includes("instagram.com")) {
      const match = cleaned.match(/instagram\.com\/([^/?#]+)/);
      if (match) return { platform: "instagram", username: match[1].replace("@", "") };
    }
    if (cleaned.includes("tiktok.com")) {
      const match = cleaned.match(/tiktok\.com\/@?([^/?#]+)/);
      if (match) return { platform: "tiktok", username: match[1].replace("@", "") };
    }
    if (cleaned.includes("youtube.com") || cleaned.includes("youtu.be")) {
      const match = cleaned.match(/youtube\.com\/@?([^/?#]+)/);
      if (match) return { platform: "youtube", username: match[1].replace("@", "") };
    }
    if (cleaned.includes("twitter.com") || cleaned.includes("x.com")) {
      const match = cleaned.match(/(?:twitter|x)\.com\/([^/?#]+)/);
      if (match) return { platform: "twitter", username: match[1].replace("@", "") };
    }
    return null;
  } catch {
    return null;
  }
}

/** Map CRM visit_status to Uncustom funnel_status */
export function mapVisitStatusToFunnel(
  visitStatus: string,
  review: CrmReview | null,
  scheduleConfirm: string | null,
  visitDate: string | null
): {
  funnel_status: string;
  visit_completed: boolean;
  final_confirmed: boolean;
} {
  if (visitStatus === "canceled" || visitStatus === "pending-cancellation") {
    return { funnel_status: "declined", visit_completed: false, final_confirmed: false };
  }

  if (visitStatus === "no-show") {
    return { funnel_status: "visited", visit_completed: false, final_confirmed: true };
  }

  if (visitStatus === "visited") {
    // Check review status
    if (review) {
      const bothSettled =
        review.settlement_status_for_influencer === "completed" &&
        review.settlement_status_for_hospital === "completed";
      if (bothSettled) return { funnel_status: "settled", visit_completed: true, final_confirmed: true };
      if (review.is_review_confirmed) return { funnel_status: "completed", visit_completed: true, final_confirmed: true };
      if (review.review_link) return { funnel_status: "uploaded", visit_completed: true, final_confirmed: true };
    }
    return { funnel_status: "visited", visit_completed: true, final_confirmed: true };
  }

  // pending status
  if (scheduleConfirm === "confirmed" && visitDate) {
    return { funnel_status: "visit_scheduled", visit_completed: false, final_confirmed: true };
  }
  if (visitDate) {
    return { funnel_status: "visit_scheduled", visit_completed: false, final_confirmed: false };
  }
  return { funnel_status: "crm_registered", visit_completed: false, final_confirmed: false };
}

/** Map CRM channel to platform normalizer */
function normalizePlatform(channel: string | null): string {
  if (!channel) return "instagram";
  const c = channel.toLowerCase();
  if (c === "youtube" || c === "yt") return "youtube";
  if (c === "tiktok" || c === "tt") return "tiktok";
  if (c === "twitter" || c === "x") return "twitter";
  if (c === "instagram" || c === "ig") return "instagram";
  return c;
}

/** Map referral_source to outreach_type */
function mapOutreachType(source: string | null): string {
  if (!source) return "dm";
  const s = source.toLowerCase();
  if (s.includes("라인") || s.includes("line") || s.includes("디엠") || s.includes("dm")) return "dm";
  if (s.includes("이메일") || s.includes("email")) return "email";
  return "dm";
}

/** Map payment settlement_status */
function mapPaymentStatus(status: string | null): string {
  if (!status) return "unpaid";
  if (status === "completed") return "paid";
  if (status === "pending") return "pending";
  return "unpaid";
}

function mapClientPaymentStatus(status: string | null): string {
  if (!status) return "uninvoiced";
  if (status === "completed") return "paid";
  if (status === "pending") return "invoiced";
  return "uninvoiced";
}

// ============================================================
// Phase 1: hospitals → campaigns
// ============================================================

export async function migrateHospitals(
  supabase: SupabaseClient<Database>,
  teamId: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const [rows] = await crmPool.query<CrmHospital[]>(
    "SELECT * FROM hospitals ORDER BY id"
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const h of rows) {
    // Check if already migrated
    const { data: existing } = await supabase
      .from("campaigns")
      .select("id")
      .eq("crm_hospital_id", h.id)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Determine target_countries from reservations
    const [countryRows] = await crmPool.query<RowDataPacket[]>(
      `SELECT DISTINCT u.country_code FROM reservations r
       JOIN users u ON u.id = r.customer_id
       WHERE r.hospital_id = ? AND u.country_code IS NOT NULL`,
      [h.id]
    );
    const countries = countryRows
      .map((r) => (r.country_code as string)?.toUpperCase())
      .filter(Boolean);

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        team_id: teamId,
        name: h.name,
        campaign_type: "visit",
        status: "active",
        target_countries: countries.length > 0 ? countries : ["TW", "JP"],
        target_platforms: ["instagram"],
        crm_hospital_id: h.id,
        crm_hospital_code: h.hospital_code,
        business_number: h.business_number,
        commission_rate: h.commission_rate,
        address: h.address,
        phone_number: h.phone_number,
        tax_invoice_email: h.tax_invoice_email,
        ceo_name: h.ceo_name,
        operating_hours: h.operating_hours,
        crm_config: (h.channeltalk_apikey
          ? {
              channeltalk_apikey: h.channeltalk_apikey,
              channeltalk_secret: h.channeltalk_secret,
            }
          : {}) as Json,
      })
      .select("id")
      .single();

    if (error) {
      errors.push(`Hospital ${h.id} (${h.name}): ${error.message}`);
      // Log error
      await supabase.from("crm_sync_log").insert({
        direction: "crm_to_uncustom",
        entity_type: "hospital",
        crm_id: h.id,
        action: "error",
        details: { error: error.message, hospital_name: h.name } as unknown as Json,
      });
    } else {
      created++;
      await supabase.from("crm_sync_log").insert({
        direction: "crm_to_uncustom",
        entity_type: "hospital",
        crm_id: h.id,
        uncustom_id: data.id,
        action: "created",
        details: { name: h.name, countries } as unknown as Json,
      });
    }
  }

  return { created, skipped, errors };
}

// ============================================================
// Phase 2: procedures → crm_procedures
// ============================================================

export async function migrateProcedures(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const [rows] = await crmPool.query<CrmProcedure[]>(
    "SELECT * FROM procedures ORDER BY id"
  );

  // Get hospital→campaign mapping
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, crm_hospital_id")
    .not("crm_hospital_id", "is", null);
  const hospitalMap = new Map<number, string>();
  for (const c of campaigns ?? []) {
    if (c.crm_hospital_id) hospitalMap.set(c.crm_hospital_id, c.id);
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 500;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const inserts = [];

    for (const p of batch) {
      const campaignId = hospitalMap.get(p.hospital_id);
      if (!campaignId) {
        skipped++;
        continue;
      }

      inserts.push({
        campaign_id: campaignId,
        crm_procedure_id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        fee_rate: p.fee_rate,
        is_sponsorable: p.is_sponsored === 1,
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("crm_procedures").insert(inserts);
      if (error) {
        errors.push(`Procedures batch ${i}: ${error.message}`);
      } else {
        created += inserts.length;
      }
    }
  }

  return { created, skipped, errors };
}

// ============================================================
// Phase 3: users (influencers) → influencers
// ============================================================

export async function migrateInfluencers(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; matched: number; skipped: number; errors: string[] }> {
  // 3a. Get CRM users with role=influencer
  const [users] = await crmPool.query<CrmUser[]>(
    "SELECT * FROM users WHERE role = 'influencer' ORDER BY id"
  );

  // 3b. Get all influencer_links
  const [links] = await crmPool.query<CrmInfluencerLink[]>(
    "SELECT * FROM influencer_links ORDER BY user_id"
  );
  const linksByUser = new Map<number, CrmInfluencerLink[]>();
  for (const link of links) {
    const existing = linksByUser.get(link.user_id) ?? [];
    existing.push(link);
    linksByUser.set(link.user_id, existing);
  }

  // 3c. Get partner_profiles for settlement info
  const [profiles] = await crmPool.query<CrmPartnerProfile[]>(
    "SELECT * FROM partner_profiles"
  );
  const profileMap = new Map<number, CrmPartnerProfile>();
  for (const p of profiles) {
    profileMap.set(p.user_id, p);
  }

  let created = 0;
  let matched = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      const userLinks = linksByUser.get(user.id) ?? [];
      const profile = profileMap.get(user.id);

      // Determine primary platform from links
      let primaryPlatform = "instagram";
      let primaryUsername: string | null = null;
      let profileUrl: string | null = null;

      for (const link of userLinks) {
        const parsed = parseUsernameFromUrl(link.url);
        if (parsed) {
          primaryPlatform = parsed.platform;
          primaryUsername = parsed.username;
          profileUrl = link.url;
          break; // Use first parseable link
        }
      }

      // Build settlement_info
      const settlementInfo = profile
        ? {
            bank_name: profile.bank_name,
            account_number: profile.account_number,
            account_holder: profile.account_holder,
            swift_code: profile.swift_code,
            paypal_email: profile.paypal_account,
            method: profile.settlement_method ?? "bank_transfer",
          }
        : null;

      // Check if already migrated by crm_user_id
      const { data: existingByCrm } = await supabase
        .from("influencers")
        .select("id")
        .eq("crm_user_id", user.id)
        .maybeSingle();

      if (existingByCrm) {
        skipped++;
        continue;
      }

      // Try to match by (platform, username) in Uncustom
      let matchedId: string | null = null;
      if (primaryUsername) {
        const { data: existingByUsername } = await supabase
          .from("influencers")
          .select("id")
          .eq("platform", primaryPlatform)
          .eq("username", primaryUsername)
          .maybeSingle();
        if (existingByUsername) matchedId = existingByUsername.id;
      }

      // Try email match if no username match
      if (!matchedId && user.email) {
        const { data: existingByEmail } = await supabase
          .from("influencers")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();
        if (existingByEmail) matchedId = existingByEmail.id;
      }

      if (matchedId) {
        // Update existing: set crm_user_id + fill empty fields
        const updateData: Record<string, unknown> = { crm_user_id: user.id };
        if (user.full_name) updateData.display_name = user.full_name;
        if (user.name_kr) updateData.real_name = user.name_kr;
        if (user.phone_number) updateData.phone = user.phone_number;
        if (user.date_of_birth) updateData.birth_date = user.date_of_birth;
        if (user.gender) updateData.gender = user.gender;
        if (user.line_id) updateData.line_id = user.line_id;
        if (user.country_code) updateData.country = user.country_code.toUpperCase();
        if (settlementInfo) updateData.default_settlement_info = settlementInfo as unknown as Json;

        await supabase.from("influencers").update(updateData).eq("id", matchedId);
        matched++;

        await supabase.from("crm_sync_log").insert({
          direction: "crm_to_uncustom",
          entity_type: "influencer",
          crm_id: user.id,
          uncustom_id: matchedId,
          action: "matched",
          details: { name: user.full_name, platform: primaryPlatform, username: primaryUsername } as unknown as Json,
        });
      } else {
        // Create new influencer
        const { data, error } = await supabase
          .from("influencers")
          .insert({
            platform: primaryPlatform,
            username: primaryUsername,
            display_name: user.full_name,
            real_name: user.name_kr,
            email: user.email,
            phone: user.phone_number,
            birth_date: user.date_of_birth,
            country: user.country_code?.toUpperCase() ?? null,
            gender: user.gender,
            line_id: user.line_id,
            profile_url: profileUrl,
            crm_user_id: user.id,
            import_source: "crm",
            default_settlement_info: settlementInfo as unknown as Json,
          })
          .select("id")
          .single();

        if (error) {
          errors.push(`User ${user.id} (${user.full_name}): ${error.message}`);
        } else {
          created++;
          await supabase.from("crm_sync_log").insert({
            direction: "crm_to_uncustom",
            entity_type: "influencer",
            crm_id: user.id,
            uncustom_id: data.id,
            action: "created",
            details: { name: user.full_name, platform: primaryPlatform } as unknown as Json,
          });
        }
      }
    } catch (err) {
      errors.push(`User ${user.id}: ${(err as Error).message}`);
    }
  }

  return { created, matched, skipped, errors };
}

// ============================================================
// Phase 3a-2: CRM customers with reservations → influencers
// ============================================================

export async function migrateCustomers(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; matched: number; skipped: number; errors: string[] }> {
  // Get CRM users with role='customer' who have at least one reservation
  const [users] = await crmPool.query<CrmUser[]>(
    `SELECT DISTINCT u.* FROM users u
     INNER JOIN reservations r ON r.customer_id = u.id
     WHERE u.role = 'customer'
     ORDER BY u.id`
  );

  // Get all influencer_links
  const [links] = await crmPool.query<CrmInfluencerLink[]>(
    "SELECT * FROM influencer_links ORDER BY user_id"
  );
  const linksByUser = new Map<number, CrmInfluencerLink[]>();
  for (const link of links) {
    const existing = linksByUser.get(link.user_id) ?? [];
    existing.push(link);
    linksByUser.set(link.user_id, existing);
  }

  // Get partner_profiles
  const [profiles] = await crmPool.query<CrmPartnerProfile[]>(
    "SELECT * FROM partner_profiles"
  );
  const profileMap = new Map<number, CrmPartnerProfile>();
  for (const p of profiles) profileMap.set(p.user_id, p);

  let created = 0;
  let matched = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      // Already migrated?
      const { data: existingByCrm } = await supabase
        .from("influencers")
        .select("id")
        .eq("crm_user_id", user.id)
        .maybeSingle();

      if (existingByCrm) {
        skipped++;
        continue;
      }

      const userLinks = linksByUser.get(user.id) ?? [];
      const profile = profileMap.get(user.id);

      let primaryPlatform = "instagram";
      let primaryUsername: string | null = null;
      let profileUrl: string | null = null;

      for (const link of userLinks) {
        const parsed = parseUsernameFromUrl(link.url);
        if (parsed) {
          primaryPlatform = parsed.platform;
          primaryUsername = parsed.username;
          profileUrl = link.url;
          break;
        }
      }

      const settlementInfo = profile
        ? {
            bank_name: profile.bank_name,
            account_number: profile.account_number,
            account_holder: profile.account_holder,
            swift_code: profile.swift_code,
            paypal_email: profile.paypal_account,
            method: profile.settlement_method ?? "bank_transfer",
          }
        : null;

      // Try match by (platform, username)
      let matchedId: string | null = null;
      if (primaryUsername) {
        const { data } = await supabase
          .from("influencers")
          .select("id")
          .eq("platform", primaryPlatform)
          .eq("username", primaryUsername)
          .maybeSingle();
        if (data) matchedId = data.id;
      }

      // Try email match
      if (!matchedId && user.email) {
        const { data } = await supabase
          .from("influencers")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();
        if (data) matchedId = data.id;
      }

      if (matchedId) {
        const updateData: Record<string, unknown> = { crm_user_id: user.id };
        if (user.full_name) updateData.display_name = user.full_name;
        if (user.name_kr) updateData.real_name = user.name_kr;
        if (user.phone_number) updateData.phone = user.phone_number;
        if (user.date_of_birth) updateData.birth_date = toDateStr(user.date_of_birth);
        if (user.gender) updateData.gender = user.gender;
        if (user.line_id) updateData.line_id = user.line_id;
        if (user.country_code) updateData.country = user.country_code.toUpperCase();
        if (settlementInfo) updateData.default_settlement_info = settlementInfo as unknown as Json;

        await supabase.from("influencers").update(updateData).eq("id", matchedId);
        matched++;
      } else {
        // Create new influencer from customer
        const displayName = user.full_name || user.name_kr || `Customer #${user.id}`;
        const { error } = await supabase.from("influencers").insert({
          platform: primaryPlatform,
          username: primaryUsername,
          display_name: displayName,
          real_name: user.name_kr,
          email: user.email,
          phone: user.phone_number,
          birth_date: toDateStr(user.date_of_birth),
          country: user.country_code?.toUpperCase() ?? null,
          gender: user.gender,
          line_id: user.line_id,
          profile_url: profileUrl,
          crm_user_id: user.id,
          import_source: "crm_customer",
          default_settlement_info: settlementInfo as unknown as Json,
        });

        if (error) {
          errors.push(`Customer ${user.id} (${displayName}): ${error.message}`);
        } else {
          created++;
        }
      }
    } catch (err) {
      errors.push(`Customer ${user.id}: ${(err as Error).message}`);
    }
  }

  return { created, matched, skipped, errors };
}

// ============================================================
// Phase 3a-3: Force-create all reservation customers missing from influencers
// ============================================================

export async function migrateAllReservationCustomers(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; skipped: number; errors: string[] }> {
  // Get ALL unique customer_ids from reservations
  const [reservations] = await crmPool.query<RowDataPacket[]>(
    "SELECT DISTINCT customer_id FROM reservations"
  );

  // Get existing crm_user_ids in Supabase (paginated)
  const existingInf = await fetchAll<{ crm_user_id: number }>(
    supabase, "influencers", "crm_user_id",
    { column: "crm_user_id", op: "not.is.null", value: null }
  );
  const existingSet = new Set(existingInf.map(r => r.crm_user_id));

  // Find missing customer_ids
  const missingIds = reservations
    .map(r => r.customer_id as number)
    .filter(id => !existingSet.has(id));

  if (missingIds.length === 0) {
    return { created: 0, skipped: reservations.length, errors: [] };
  }

  // Batch-load users and links for missing IDs
  const CHUNK = 500;
  let created = 0;
  let skipped = existingSet.size;
  const errors: string[] = [];

  for (let i = 0; i < missingIds.length; i += CHUNK) {
    const chunk = missingIds.slice(i, i + CHUNK);

    const [users] = await crmPool.query<CrmUser[]>(
      `SELECT * FROM users WHERE id IN (${chunk.map(() => "?").join(",")})`,
      chunk
    );

    const [links] = await crmPool.query<CrmInfluencerLink[]>(
      `SELECT * FROM influencer_links WHERE user_id IN (${chunk.map(() => "?").join(",")})`,
      chunk
    );
    const linksByUser = new Map<number, CrmInfluencerLink[]>();
    for (const link of links) {
      const existing = linksByUser.get(link.user_id) ?? [];
      existing.push(link);
      linksByUser.set(link.user_id, existing);
    }

    const [profiles] = await crmPool.query<CrmPartnerProfile[]>(
      `SELECT * FROM partner_profiles WHERE user_id IN (${chunk.map(() => "?").join(",")})`,
      chunk
    );
    const profileMap = new Map<number, CrmPartnerProfile>();
    for (const p of profiles) profileMap.set(p.user_id, p);

    for (const user of users) {
      try {
        const userLinks = linksByUser.get(user.id) ?? [];
        const profile = profileMap.get(user.id);

        let primaryPlatform = "instagram";
        let primaryUsername: string | null = null;
        let profileUrl: string | null = null;

        for (const link of userLinks) {
          const parsed = parseUsernameFromUrl(link.url);
          if (parsed) {
            primaryPlatform = parsed.platform;
            primaryUsername = parsed.username;
            profileUrl = link.url;
            break;
          }
        }

        const settlementInfo = profile
          ? {
              bank_name: profile.bank_name,
              account_number: profile.account_number,
              account_holder: profile.account_holder,
              swift_code: profile.swift_code,
              paypal_email: profile.paypal_account,
              method: profile.settlement_method ?? "bank_transfer",
            }
          : null;

        // Try match by username first
        let matchedId: string | null = null;
        if (primaryUsername) {
          const { data } = await supabase
            .from("influencers")
            .select("id")
            .eq("platform", primaryPlatform)
            .eq("username", primaryUsername)
            .maybeSingle();
          if (data) matchedId = data.id;
        }

        if (matchedId) {
          // Update existing with crm_user_id
          await supabase.from("influencers").update({ crm_user_id: user.id }).eq("id", matchedId);
          created++;
        } else {
          const displayName = user.full_name || user.name_kr || `User #${user.id}`;
          const { error } = await supabase.from("influencers").insert({
            platform: primaryPlatform,
            username: primaryUsername,
            display_name: displayName,
            real_name: user.name_kr,
            email: user.email,
            phone: user.phone_number,
            birth_date: toDateStr(user.date_of_birth),
            country: user.country_code?.toUpperCase() ?? null,
            gender: user.gender,
            line_id: user.line_id,
            profile_url: profileUrl,
            crm_user_id: user.id,
            import_source: "crm_reservation",
            default_settlement_info: settlementInfo as unknown as Json,
          });

          if (error) {
            errors.push(`User ${user.id} (${displayName}): ${error.message}`);
          } else {
            created++;
          }
        }
      } catch (err) {
        errors.push(`User ${user.id}: ${(err as Error).message}`);
      }
    }
  }

  return { created, skipped, errors };
}

// ============================================================
// Phase 3b: automation.influencer → influencers
// ============================================================

export async function migrateAutomationInfluencers(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; matched: number; skipped: number; errors: string[] }> {
  const [rows] = await automationPool.query<AutoInfluencer[]>(
    "SELECT * FROM influencer ORDER BY id"
  );

  let created = 0;
  let matched = 0;
  let skipped = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 200;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const inf of batch) {
      try {
        const platform = normalizePlatform(inf.channel);
        const username = inf.account_title?.trim() || null;
        const platformId = inf.account_uid?.trim() || null;

        if (!username && !platformId) {
          skipped++;
          continue;
        }

        // Try match by (platform, platform_id)
        let matchedId: string | null = null;
        if (platformId) {
          const { data } = await supabase
            .from("influencers")
            .select("id")
            .eq("platform", platform)
            .eq("platform_id", platformId)
            .maybeSingle();
          if (data) matchedId = data.id;
        }

        // Try match by (platform, username)
        if (!matchedId && username) {
          const { data } = await supabase
            .from("influencers")
            .select("id")
            .eq("platform", platform)
            .eq("username", username)
            .maybeSingle();
          if (data) matchedId = data.id;
        }

        if (matchedId) {
          // Enrich empty fields only
          const enrichData: Record<string, unknown> = {};
          if (inf.follower_count) enrichData.follower_count = inf.follower_count;
          if (inf.post_count) enrichData.post_count = inf.post_count;
          if (inf.engagement_rate) enrichData.engagement_rate = inf.engagement_rate;
          if (inf.email) enrichData.email = inf.email;
          if (inf.country) enrichData.country = inf.country.toUpperCase();
          if (inf.bio) enrichData.bio = inf.bio;
          if (inf.channel_url) enrichData.profile_url = inf.channel_url;
          if (inf.keywords) {
            enrichData.extracted_keywords = inf.keywords
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean);
          }

          if (Object.keys(enrichData).length > 0) {
            await supabase.from("influencers").update(enrichData).eq("id", matchedId);
          }
          matched++;
        } else {
          // Create new
          const { error } = await supabase.from("influencers").insert({
            platform,
            platform_id: platformId,
            username,
            profile_url: inf.channel_url,
            follower_count: inf.follower_count,
            post_count: inf.post_count,
            engagement_rate: inf.engagement_rate,
            email: inf.email,
            country: inf.country?.toUpperCase() ?? null,
            bio: inf.bio,
            extracted_keywords: inf.keywords
              ? inf.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
              : null,
            import_source: "crm_automation",
          });

          if (error) {
            // Likely duplicate — skip
            if (error.message.includes("duplicate") || error.message.includes("unique")) {
              skipped++;
            } else {
              errors.push(`Auto-influencer ${inf.id}: ${error.message}`);
            }
          } else {
            created++;
          }
        }
      } catch (err) {
        errors.push(`Auto-influencer ${inf.id}: ${(err as Error).message}`);
      }
    }
  }

  return { created, matched, skipped, errors };
}

// ============================================================
// Phase 4: reservations → campaign_influencers
// ============================================================

export async function migrateReservations(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  // Load all reservations with reviews and payments
  const [reservations] = await crmPool.query<CrmReservation[]>(
    "SELECT * FROM reservations ORDER BY id"
  );

  const [reviews] = await crmPool.query<CrmReview[]>(
    "SELECT * FROM reservation_reviews"
  );
  const reviewMap = new Map<number, CrmReview>();
  for (const r of reviews) reviewMap.set(r.reservation_id, r);

  const [payments] = await crmPool.query<CrmPayment[]>(
    "SELECT * FROM reservation_payments"
  );
  const paymentMap = new Map<number, CrmPayment>();
  for (const p of payments) paymentMap.set(p.reservation_id, p);

  // Get interpreter names
  const [interpreters] = await crmPool.query<RowDataPacket[]>(
    "SELECT id, full_name FROM users WHERE role = 'interpreter'"
  );
  const interpreterMap = new Map<number, string>();
  for (const i of interpreters) interpreterMap.set(i.id as number, i.full_name as string);

  // Get hospital→campaign mapping
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, crm_hospital_id")
    .not("crm_hospital_id", "is", null);
  const hospitalToCampaign = new Map<number, string>();
  for (const c of campaigns ?? []) {
    if (c.crm_hospital_id) hospitalToCampaign.set(c.crm_hospital_id, c.id);
  }

  // Get crm_user_id → influencer_id mapping (paginated to avoid 1000-row limit)
  const allInfluencers = await fetchAll<{ id: string; crm_user_id: number }>(
    supabase, "influencers", "id, crm_user_id",
    { column: "crm_user_id", op: "not.is.null", value: null }
  );
  const userToInfluencer = new Map<number, string>();
  for (const inf of allInfluencers) {
    if (inf.crm_user_id) userToInfluencer.set(inf.crm_user_id, inf.id);
  }
  console.log(`  📊 Loaded ${userToInfluencer.size} influencer↔crm_user_id mappings`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const res of reservations) {
    try {
      const campaignId = hospitalToCampaign.get(res.hospital_id);
      const influencerId = userToInfluencer.get(res.customer_id);

      if (!campaignId || !influencerId) {
        skipped++;
        continue;
      }

      // Check if already migrated
      const { data: existing } = await supabase
        .from("campaign_influencers")
        .select("id")
        .eq("crm_reservation_id", res.id)
        .maybeSingle();

      if (existing) {
        updated++;
        continue;
      }

      // Check if (campaign_id, influencer_id) already exists
      const { data: existingPair } = await supabase
        .from("campaign_influencers")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("influencer_id", influencerId)
        .maybeSingle();

      const review = reviewMap.get(res.id) ?? null;
      const payment = paymentMap.get(res.id) ?? null;

      const { funnel_status, visit_completed, final_confirmed } = mapVisitStatusToFunnel(
        res.visit_status,
        review,
        res.schedule_confirm,
        toDateStr(res.visit_date)
      );

      // Build legacy status mapping
      const legacyStatusMap: Record<string, string> = {
        extracted: "extracted",
        contacted: "contacted",
        interested: "replied",
        client_approved: "confirmed",
        confirmed: "confirmed",
        guideline_sent: "confirmed",
        crm_registered: "confirmed",
        visit_scheduled: "confirmed",
        visited: "visited",
        upload_pending: "visited",
        uploaded: "uploaded",
        completed: "completed",
        settled: "completed",
        declined: "extracted",
        dropped: "extracted",
      };

      const interpreterName = res.interpreter_id
        ? interpreterMap.get(res.interpreter_id) ?? null
        : null;

      const notes = [
        res.memo,
        res.visit_status === "no-show" ? "no-show" : null,
        res.visit_status === "pending-cancellation" ? "취소 요청중" : null,
      ]
        .filter(Boolean)
        .join(" | ") || null;

      // Build crm_data JSONB
      const crmData: Record<string, unknown> = {};
      if (payment) {
        crmData.payment_amount = payment.payment_amount;
        crmData.commission_rate = payment.commission_rate;
        crmData.prepayment_amount = payment.prepayment_amount;
      }
      crmData.visit_status = res.visit_status;
      crmData.referral_source = res.referral_source;
      crmData.channel = res.channel;
      if (res.channeltalk_chat_id) crmData.channeltalk_chat_id = res.channeltalk_chat_id;

      const insertData = {
        campaign_id: campaignId,
        influencer_id: influencerId,
        crm_reservation_id: res.id,
        funnel_status,
        status: legacyStatusMap[funnel_status] ?? "extracted",
        crm_registered: true,
        crm_registered_at: toTimestamp(res.created_at) ?? new Date().toISOString(),
        visit_scheduled_date: toDateStr(res.visit_date),
        visit_completed,
        visit_completed_at: visit_completed && res.visit_date ? toTimestamp(res.visit_date) : null,
        final_confirmed,
        final_confirmed_at: final_confirmed && res.created_at ? toTimestamp(res.created_at) : null,
        interpreter_needed: res.interpreter_required === 1,
        interpreter_name: interpreterName,
        notes,
        outreach_type: mapOutreachType(res.referral_source),
        reply_channel: res.channel === "channeltalk" ? "other" : null,
        reply_channel_url: res.channeltalk_chat_id
          ? `https://app.channel.io/chat/${res.channeltalk_chat_id}`
          : null,
        crm_procedure: res.sponsored_procedure,
        crm_requested_procedure: res.requested_procedure,
        crm_data: crmData as unknown as Json,
        created_at: toTimestamp(res.created_at) ?? new Date().toISOString(),
        // Review fields
        upload_url: review?.review_link ?? null,
        actual_upload_date: toDateStr(review?.review_upload_date),
        upload_deadline: toDateStr(review?.review_submission_deadline),
        guideline_sent: review ? review.is_guideline_sent === 1 : false,
        guideline_sent_at: review?.is_guideline_sent === 1 ? toTimestamp(res.created_at) : null,
        // Payment fields
        payment_amount: review?.review_fee_for_influencer ?? null,
        invoice_amount: review?.review_fee_for_hospital ?? null,
        influencer_payment_status: review
          ? mapPaymentStatus(review.settlement_status_for_influencer)
          : "unpaid",
        influencer_paid_at: toTimestamp(review?.settlement_for_influencer_completed_at),
        influencer_paid_amount:
          review?.settlement_status_for_influencer === "completed"
            ? review.review_fee_for_influencer
            : null,
        client_payment_status: review
          ? mapClientPaymentStatus(review.settlement_status_for_hospital)
          : "uninvoiced",
        client_paid_at: toTimestamp(review?.settlement_for_hospital_completed_at),
        client_paid_amount:
          review?.settlement_status_for_hospital === "completed"
            ? review.review_fee_for_hospital
            : null,
      };

      if (existingPair) {
        // Update existing (campaign_id, influencer_id) pair
        const { error } = await supabase
          .from("campaign_influencers")
          .update(insertData)
          .eq("id", existingPair.id);

        if (error) {
          errors.push(`Reservation ${res.id}: update failed — ${error.message}`);
        } else {
          updated++;
        }
      } else {
        const { error } = await supabase
          .from("campaign_influencers")
          .insert(insertData);

        if (error) {
          errors.push(`Reservation ${res.id}: ${error.message}`);
          await supabase.from("crm_sync_log").insert({
            direction: "crm_to_uncustom",
            entity_type: "reservation",
            crm_id: res.id,
            action: "error",
            details: { error: error.message } as unknown as Json,
          });
        } else {
          created++;
          await supabase.from("crm_sync_log").insert({
            direction: "crm_to_uncustom",
            entity_type: "reservation",
            crm_id: res.id,
            action: "created",
            details: { funnel_status, hospital_id: res.hospital_id } as unknown as Json,
          });
        }
      }
    } catch (err) {
      errors.push(`Reservation ${res.id}: ${(err as Error).message}`);
    }
  }

  return { created, updated, skipped, errors };
}

// ============================================================
// Phase 5: automation data → keywords, templates, dm_history
// ============================================================

export async function migrateAutomationData(
  supabase: SupabaseClient<Database>,
  teamId: string,
  defaultCampaignId: string
): Promise<{
  keywords: number;
  templates: number;
  dmHistory: number;
  snsAccounts: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let keywordCount = 0;
  let templateCount = 0;
  let dmHistoryCount = 0;
  let snsAccountCount = 0;

  // Keywords
  try {
    const [keywords] = await automationPool.query<AutoKeyword[]>("SELECT * FROM keyword");
    for (const kw of keywords) {
      const platform = normalizePlatform(kw.channel);
      const { error } = await supabase.from("keywords").insert({
        campaign_id: null, // Global keyword
        keyword: kw.keyword,
        platform,
      });
      if (!error) keywordCount++;
    }
  } catch (err) {
    errors.push(`Keywords: ${(err as Error).message}`);
  }

  // DM Accounts → campaign_sns_accounts
  try {
    const [accounts] = await automationPool.query<AutoDmAccount[]>("SELECT * FROM dm_account");
    for (const acc of accounts) {
      const { error } = await supabase.from("campaign_sns_accounts").insert({
        campaign_id: defaultCampaignId,
        platform: normalizePlatform(acc.platform),
        account_name: acc.account_name,
        api_key: acc.api_key,
        api_secret: acc.api_secret,
        connected: true,
      });
      if (!error) snsAccountCount++;
    }
  } catch (err) {
    errors.push(`DM Accounts: ${(err as Error).message}`);
  }

  // Contact Templates → email_templates
  try {
    const [templates] = await automationPool.query<AutoTemplate[]>("SELECT * FROM contact_template");
    for (const tpl of templates) {
      const { error } = await supabase.from("email_templates").insert({
        campaign_id: defaultCampaignId,
        type: "dm",
        name: tpl.name ?? "CRM Template",
        subject: tpl.name ?? "DM Template",
        body_html: "",
        dm_body: tpl.content,
      });
      if (!error) templateCount++;
    }
  } catch (err) {
    errors.push(`Templates: ${(err as Error).message}`);
  }

  // DM History → email_logs
  try {
    const [history] = await automationPool.query<AutoDmHistory[]>(
      "SELECT * FROM dm_history ORDER BY id"
    );

    // Get automation influencer → uncustom influencer mapping
    // We need to map by account_uid/account_title since automation.influencer doesn't have crm_user_id
    for (const dm of history) {
      if (!dm.influencer_id) continue;

      // Get automation influencer info
      const [infRows] = await automationPool.query<AutoInfluencer[]>(
        "SELECT * FROM influencer WHERE id = ?",
        [dm.influencer_id]
      );
      if (infRows.length === 0) continue;

      const autoInf = infRows[0];
      const platform = normalizePlatform(autoInf.channel);
      const username = autoInf.account_title?.trim();
      if (!username) continue;

      // Find matching Uncustom influencer
      const { data: uncustomInf } = await supabase
        .from("influencers")
        .select("id")
        .eq("platform", platform)
        .eq("username", username)
        .maybeSingle();

      if (!uncustomInf) continue;

      const { error } = await supabase.from("email_logs").insert({
        campaign_id: defaultCampaignId,
        influencer_id: uncustomInf.id,
        status: dm.status === "sent" ? "sent" : dm.status === "error" ? "failed" : "sent",
        sent_at: dm.sent_at,
      });
      if (!error) dmHistoryCount++;
    }
  } catch (err) {
    errors.push(`DM History: ${(err as Error).message}`);
  }

  return { keywords: keywordCount, templates: templateCount, dmHistory: dmHistoryCount, snsAccounts: snsAccountCount, errors };
}

// ============================================================
// Verification
// ============================================================

export async function verifyMigration(
  supabase: SupabaseClient<Database>
): Promise<{
  crm: Record<string, number>;
  uncustom: Record<string, number>;
  syncLog: Record<string, number>;
}> {
  // CRM counts
  const [hospitalCount] = await crmPool.query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM hospitals");
  const [userCount] = await crmPool.query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM users WHERE role = 'influencer'");
  const [resCount] = await crmPool.query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM reservations");
  const [procCount] = await crmPool.query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM procedures");
  const [autoInfCount] = await automationPool.query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM influencer");

  // Uncustom counts
  const { count: campaignCrmCount } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .not("crm_hospital_id", "is", null);

  const { count: influencerCrmCount } = await supabase
    .from("influencers")
    .select("*", { count: "exact", head: true })
    .not("crm_user_id", "is", null);

  const { count: ciCrmCount } = await supabase
    .from("campaign_influencers")
    .select("*", { count: "exact", head: true })
    .not("crm_reservation_id", "is", null);

  const { count: procUncustomCount } = await supabase
    .from("crm_procedures")
    .select("*", { count: "exact", head: true });

  // Sync log summary
  const { data: logSummary } = await supabase
    .from("crm_sync_log")
    .select("entity_type, action");

  const syncLog: Record<string, number> = {};
  for (const row of logSummary ?? []) {
    const key = `${row.entity_type}_${row.action}`;
    syncLog[key] = (syncLog[key] ?? 0) + 1;
  }

  return {
    crm: {
      hospitals: (hospitalCount[0] as RowDataPacket).cnt,
      influencer_users: (userCount[0] as RowDataPacket).cnt,
      reservations: (resCount[0] as RowDataPacket).cnt,
      procedures: (procCount[0] as RowDataPacket).cnt,
      automation_influencers: (autoInfCount[0] as RowDataPacket).cnt,
    },
    uncustom: {
      campaigns_with_crm: campaignCrmCount ?? 0,
      influencers_with_crm: influencerCrmCount ?? 0,
      campaign_influencers_with_crm: ciCrmCount ?? 0,
      crm_procedures: procUncustomCount ?? 0,
    },
    syncLog,
  };
}

// ============================================================
// Phase 7: Backfill influencer_links → profile_url / username
// ============================================================

/**
 * CRM influencer_links 테이블에서 SNS 프로필 URL을 가져와
 * Supabase influencers 테이블의 profile_url, username을 업데이트하고,
 * Supabase influencer_links 테이블에도 저장합니다.
 */
export async function migrateInfluencerLinks(
  supabase: SupabaseClient<Database>
): Promise<{ created: number; updated: number; linksCreated: number; skipped: number; errors: string[] }> {
  // Get all CRM influencer_links with valid URLs
  const [crmLinks] = await crmPool.query<CrmInfluencerLink[]>(
    "SELECT * FROM influencer_links WHERE url LIKE 'http%' ORDER BY user_id"
  );

  // Build user → links map
  const linksByUser = new Map<number, CrmInfluencerLink[]>();
  for (const link of crmLinks) {
    const existing = linksByUser.get(link.user_id) ?? [];
    existing.push(link);
    linksByUser.set(link.user_id, existing);
  }

  // Get CRM users info for creating new influencer records
  const [crmUsers] = await crmPool.query<CrmUser[]>("SELECT * FROM users ORDER BY id");
  const crmUserMap = new Map<number, CrmUser>();
  for (const u of crmUsers) crmUserMap.set(u.id, u);

  // Get partner_profiles for settlement info
  const [profiles] = await crmPool.query<CrmPartnerProfile[]>("SELECT * FROM partner_profiles");
  const profileMap = new Map<number, CrmPartnerProfile>();
  for (const p of profiles) profileMap.set(p.user_id, p);

  // Get crm_user_id → influencer mapping (paginated)
  const allInfluencers = await fetchAll<{
    id: string;
    crm_user_id: number;
    username: string | null;
    profile_url: string | null;
    platform: string;
  }>(
    supabase, "influencers", "id, crm_user_id, username, profile_url, platform",
    { column: "crm_user_id", op: "not.is.null", value: null }
  );

  const crmToInf = new Map<number, typeof allInfluencers[0]>();
  for (const inf of allInfluencers) {
    if (inf.crm_user_id) crmToInf.set(inf.crm_user_id, inf);
  }

  // Also build username index for matching
  const allByUsername = await fetchAll<{ id: string; platform: string; username: string }>(
    supabase, "influencers", "id, platform, username",
    { column: "username", op: "not.is.null", value: null }
  );
  const usernameIndex = new Map<string, string>();
  for (const inf of allByUsername) {
    if (inf.username) usernameIndex.set(`${inf.platform}:${inf.username.toLowerCase()}`, inf.id);
  }

  console.log(`  📊 Loaded ${crmToInf.size} CRM influencers, ${usernameIndex.size} username index, ${crmLinks.length} links to process`);

  let created = 0;
  let updated = 0;
  let linksCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [userId, links] of linksByUser) {
    // Parse all links to find the best primary SNS link
    let bestParsed: { platform: string; username: string } | null = null;
    let bestUrl: string | null = null;
    const allParsed: { platform: string; username: string; url: string }[] = [];

    for (const link of links) {
      const parsed = parseUsernameFromUrl(link.url);
      if (parsed) {
        allParsed.push({ ...parsed, url: link.url });
        if (!bestParsed || parsed.platform === "instagram") {
          bestParsed = parsed;
          bestUrl = link.url;
        }
      }
    }

    let inf = crmToInf.get(userId);

    // If not in Supabase by crm_user_id, try matching by username from links
    if (!inf && bestParsed) {
      const key = `${bestParsed.platform}:${bestParsed.username.toLowerCase()}`;
      const matchedId = usernameIndex.get(key);
      if (matchedId) {
        // Link this CRM user to existing influencer
        await supabase.from("influencers").update({ crm_user_id: userId }).eq("id", matchedId);
        inf = { id: matchedId, crm_user_id: userId, username: bestParsed.username, profile_url: bestUrl, platform: bestParsed.platform };
        crmToInf.set(userId, inf);
        updated++;
      }
    }

    // If still not found, create new influencer record from CRM user + links
    if (!inf && bestParsed) {
      const user = crmUserMap.get(userId);
      const profile = profileMap.get(userId);

      const settlementInfo = profile
        ? {
            bank_name: profile.bank_name,
            account_number: profile.account_number,
            account_holder: profile.account_holder,
            swift_code: profile.swift_code,
            paypal_email: profile.paypal_account,
            method: profile.settlement_method ?? "bank_transfer",
          }
        : null;

      const { data: newInf, error: insertErr } = await supabase
        .from("influencers")
        .insert({
          platform: bestParsed.platform,
          username: bestParsed.username,
          display_name: user?.full_name ?? null,
          real_name: user?.name_kr ?? null,
          email: user?.email ?? null,
          phone: user?.phone_number ?? null,
          birth_date: user?.date_of_birth ?? null,
          country: user?.country_code?.toUpperCase() ?? null,
          gender: user?.gender ?? null,
          line_id: user?.line_id ?? null,
          profile_url: bestUrl,
          crm_user_id: userId,
          import_source: "crm_links",
          default_settlement_info: settlementInfo as unknown as Json,
        })
        .select("id")
        .single();

      if (insertErr) {
        errors.push(`Create user ${userId}: ${insertErr.message}`);
        skipped++;
        continue;
      }

      inf = {
        id: newInf.id,
        crm_user_id: userId,
        username: bestParsed.username,
        profile_url: bestUrl,
        platform: bestParsed.platform,
      };
      crmToInf.set(userId, inf);
      created++;
    }

    if (!inf) {
      // No parseable SNS links and not in Supabase — skip
      skipped++;
      continue;
    }

    // Update influencer if profile_url or username is missing
    if (bestParsed && (!inf.username || !inf.profile_url)) {
      const updateData: Record<string, unknown> = {};
      if (!inf.username && bestParsed.username) updateData.username = bestParsed.username;
      if (!inf.profile_url && bestUrl) updateData.profile_url = bestUrl;
      if (inf.platform === "instagram" && bestParsed.platform !== "instagram" && !inf.username) {
        updateData.platform = bestParsed.platform;
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from("influencers").update(updateData).eq("id", inf.id);
        if (error) {
          errors.push(`Update ${inf.id}: ${error.message}`);
        } else {
          updated++;
        }
      }
    }

    // Store all links in Supabase influencer_links table
    for (const link of links) {
      const { error } = await supabase.from("influencer_links").upsert(
        {
          influencer_id: inf.id,
          url: link.url.trim(),
          scraped: false,
        },
        { onConflict: "influencer_id,url" }
      );
      if (!error) linksCreated++;
    }
  }

  return { created, updated, linksCreated, skipped, errors };
}

// ============================================================
// Phase 8: Backfill reservation_payments → campaign_influencers
// ============================================================

interface CrmReservationPayment extends RowDataPacket {
  id: number;
  reservation_id: number;
  payment_status: string;
  payment_amount: number | null;
  payment_completed_at: Date | null;
  settlement_completed_at: Date | null;
  settlement_status: string;
  commission_rate: string | null;
  referral_settlement_status: string;
  referral_settlement_completed_at: Date | null;
  referral_commission_rate: string | null;
  prepayment_amount: number | null;
  prepayment_receiver: string | null;
}

/**
 * reservation_payments 테이블의 시술 결제 금액을 campaign_influencers에 반영합니다.
 * 기존 crm_data JSONB에 이미 일부 저장되어 있지만,
 * payment_amount, payment_currency, invoice_amount 등 주요 필드에 실제 값이 누락된 경우 보강합니다.
 */
export async function migrateReservationPayments(
  supabase: SupabaseClient<Database>
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const [payments] = await crmPool.query<CrmReservationPayment[]>(
    "SELECT * FROM reservation_payments WHERE payment_amount IS NOT NULL AND payment_amount > 0"
  );

  // Get reservation_id → campaign_influencer mapping
  const allCi = await fetchAll<{ id: string; crm_reservation_id: number; payment_amount: number | null; invoice_amount: number | null }>(
    supabase, "campaign_influencers", "id, crm_reservation_id, payment_amount, invoice_amount",
    { column: "crm_reservation_id", op: "not.is.null", value: null }
  );

  const resToCi = new Map<number, typeof allCi[0]>();
  for (const ci of allCi) {
    if (ci.crm_reservation_id) resToCi.set(ci.crm_reservation_id, ci);
  }
  console.log(`  📊 ${payments.length} payments to process, ${resToCi.size} reservation mappings`);

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const pay of payments) {
    const ci = resToCi.get(pay.reservation_id);
    if (!ci) { skipped++; continue; }

    // Only update if invoice_amount is not yet set (avoid overwriting review-based amounts)
    const updateData: Record<string, unknown> = {};

    // Use payment_amount as the procedure cost (invoice_amount) if not set
    if (!ci.invoice_amount && pay.payment_amount) {
      updateData.invoice_amount = pay.payment_amount;
    }

    // Store payment_currency as KRW (CRM is Korea-based)
    updateData.payment_currency = "KRW";

    // Enhanced crm_data with payment details
    updateData.crm_data = {
      payment_id: pay.id,
      payment_amount: pay.payment_amount,
      payment_status: pay.payment_status,
      payment_completed_at: toTimestamp(pay.payment_completed_at),
      settlement_status: pay.settlement_status,
      settlement_completed_at: toTimestamp(pay.settlement_completed_at),
      commission_rate: pay.commission_rate,
      prepayment_amount: pay.prepayment_amount,
      prepayment_receiver: pay.prepayment_receiver,
    };

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from("campaign_influencers")
        .update(updateData)
        .eq("id", ci.id);
      if (error) {
        errors.push(`Payment ${pay.id}: ${error.message}`);
      } else {
        updated++;
      }
    }
  }

  return { updated, skipped, errors };
}
