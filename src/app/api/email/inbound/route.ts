import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { from, to, subject, html, text } = body;

    if (!from) {
      return NextResponse.json({ error: "Missing from field" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Find influencer by email
    const { data: influencer } = await supabase
      .from("influencers")
      .select("id")
      .eq("email", from)
      .single();

    if (!influencer) {
      // Unknown sender, still log it
      return NextResponse.json({ received: true, matched: false });
    }

    // Find existing threads for this influencer
    const { data: threads } = await supabase
      .from("email_threads")
      .select("id, campaign_id")
      .eq("influencer_id", influencer.id)
      .order("last_message_at", { ascending: false });

    if (!threads || threads.length === 0) {
      return NextResponse.json({ received: true, matched: false });
    }

    // Add message to the most recent thread
    const thread = threads[0];

    await supabase.from("email_messages").insert({
      thread_id: thread.id,
      direction: "inbound",
      from_email: from,
      to_email: Array.isArray(to) ? to[0] : to,
      subject,
      body_html: html,
      body_text: text,
    });

    // Update thread
    await supabase
      .from("email_threads")
      .update({
        unread: true,
        last_message_at: new Date().toISOString(),
        subject: subject ?? undefined,
      })
      .eq("id", thread.id);

    // Update campaign_influencer status to "replied" (both legacy + funnel)
    await supabase
      .from("campaign_influencers")
      .update({
        status: "replied",
        funnel_status: "interested",
        reply_date: new Date().toISOString(),
        reply_channel: "email",
      })
      .eq("campaign_id", thread.campaign_id)
      .eq("influencer_id", influencer.id)
      .in("funnel_status", ["extracted", "contacted"]);

    // Update email_log replied_at
    await supabase
      .from("email_logs")
      .update({ replied_at: new Date().toISOString() })
      .eq("campaign_id", thread.campaign_id)
      .eq("influencer_id", influencer.id)
      .is("replied_at", null);

    return NextResponse.json({ received: true, matched: true, thread_id: thread.id });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
