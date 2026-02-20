import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import type { Tables } from "@/types/database";

type EmailTemplate = Tables<"email_templates">;
type Influencer = Tables<"influencers">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Direct reply mode
    if (body.reply_to_thread) {
      const { to_email, subject, html, campaign_id, reply_to_thread } = body;

      const result = await sendEmail({
        from: "Uncustom <hello@uncustom.com>",
        to: to_email,
        subject,
        html,
      });

      // Save message to thread
      await supabase.from("email_messages").insert({
        thread_id: reply_to_thread,
        direction: "outbound",
        from_email: "hello@uncustom.com",
        to_email,
        subject,
        body_html: html,
        resend_message_id: result?.id,
      });

      // Update thread last_message_at
      await supabase
        .from("email_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", reply_to_thread);

      return NextResponse.json({ success: true, sent: 1 });
    }

    // Batch send mode
    const { campaign_id, template_id, influencer_ids } = body;

    if (!campaign_id || !template_id || !influencer_ids?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get template
    const { data: templateData } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    const template = templateData as EmailTemplate | null;

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get influencers
    const { data: influencerData } = await supabase
      .from("influencers")
      .select("*")
      .in("id", influencer_ids)
      .not("email", "is", null);

    const influencers = influencerData as Influencer[] | null;

    if (!influencers || influencers.length === 0) {
      return NextResponse.json({ error: "No influencers with email found" }, { status: 400 });
    }

    let sentCount = 0;
    const senderEmail = template.sender_email ?? "hello@uncustom.com";
    const senderName = template.sender_name ?? "Uncustom";

    for (const inf of influencers) {
      if (!inf.email) continue;

      // Replace template variables
      let htmlBody = template.body_html;
      htmlBody = htmlBody.replace(/\{\{name\}\}/g, inf.display_name ?? inf.username ?? "");
      htmlBody = htmlBody.replace(/\{\{username\}\}/g, inf.username ?? "");
      htmlBody = htmlBody.replace(/\{\{email\}\}/g, inf.email ?? "");

      let subject = template.subject;
      subject = subject.replace(/\{\{name\}\}/g, inf.display_name ?? inf.username ?? "");

      try {
        const result = await sendEmail({
          from: `${senderName} <${senderEmail}>`,
          to: inf.email,
          subject,
          html: htmlBody,
          tags: [
            { name: "campaign_id", value: campaign_id },
            { name: "influencer_id", value: inf.id },
          ],
        });

        // Create email log
        await supabase.from("email_logs").insert({
          campaign_id,
          influencer_id: inf.id,
          template_id,
          round_number: template.round_number,
          resend_message_id: result?.id,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // Update campaign_influencer status
        await supabase
          .from("campaign_influencers")
          .update({ status: "contacted" })
          .eq("campaign_id", campaign_id)
          .eq("influencer_id", inf.id)
          .eq("status", "extracted");

        // Create or update email thread
        await supabase
          .from("email_threads")
          .upsert(
            {
              campaign_id,
              influencer_id: inf.id,
              subject,
              last_message_at: new Date().toISOString(),
            },
            { onConflict: "campaign_id,influencer_id" }
          );

        sentCount++;
      } catch (emailErr) {
        // Log failed send
        await supabase.from("email_logs").insert({
          campaign_id,
          influencer_id: inf.id,
          template_id,
          round_number: template.round_number,
          status: "failed",
        });
      }
    }

    return NextResponse.json({ sent: sentCount, total: influencers.length });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
