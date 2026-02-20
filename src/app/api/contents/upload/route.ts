import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { content_id, campaign_id, target_platform, sns_account_id, caption, title, tags } = body;

    if (!content_id || !campaign_id || !target_platform) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create upload record
    const { data, error } = await supabase
      .from("multi_channel_uploads")
      .insert({
        content_id,
        campaign_id,
        target_platform,
        sns_account_id,
        caption,
        title,
        tags,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // TODO: Implement actual platform upload via SNS APIs
    // For now, just return the upload record

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
