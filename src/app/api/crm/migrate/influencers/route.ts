import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateInfluencers, migrateAutomationInfluencers, migrateProcedures } from "@/lib/crm/migration";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { source } = await request.json().catch(() => ({ source: "all" }));

    const results: Record<string, unknown> = {};

    if (source === "all" || source === "procedures") {
      results.procedures = await migrateProcedures(supabase);
    }

    if (source === "all" || source === "crm_users") {
      results.crm_users = await migrateInfluencers(supabase);
    }

    if (source === "all" || source === "automation") {
      results.automation = await migrateAutomationInfluencers(supabase);
    }

    return NextResponse.json({ phase: "influencers", results });
  } catch (err) {
    console.error("CRM migrate influencers error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
