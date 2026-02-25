import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateReservations } from "@/lib/crm/migration";

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await migrateReservations(supabase);

    return NextResponse.json({
      phase: "reservations",
      ...result,
      total: result.created + result.updated + result.skipped,
    });
  } catch (err) {
    console.error("CRM migrate reservations error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
