import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyMigration } from "@/lib/crm/migration";

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await verifyMigration(supabase);

    return NextResponse.json({ verification: result });
  } catch (err) {
    console.error("CRM verify error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
