import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { filterEligibleInfluencers } from "@/lib/utils/dedup";
import type { Tables } from "@/types/database";

type EmailTemplate = Tables<"email_templates">;
type Influencer = Tables<"influencers">;
type EmailLog = Tables<"email_logs">;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Direct reply mode
    if (body.reply_to_thread) {
      const { to_email, subject, html, campaign_id, reply_to_thread } = body;

      // Use campaign's most recent template sender or fallback
      let senderName = "Uncustom";
      let senderEmail = "hello@uncustom.com";
      if (campaign_id) {
        const { data: latestTemplate } = await supabase
          .from("email_templates")
          .select("sender_name, sender_email")
          .eq("campaign_id", campaign_id)
          .not("sender_email", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (latestTemplate) {
          senderName = latestTemplate.sender_name ?? senderName;
          senderEmail = latestTemplate.sender_email ?? senderEmail;
        }
      }

      const result = await sendEmail({
        from: `${senderName} <${senderEmail}>`,
        to: to_email,
        subject,
        html,
      });

      // Save message to thread
      await supabase.from("email_messages").insert({
        thread_id: reply_to_thread,
        direction: "outbound",
        from_email: senderEmail,
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
    const { campaign_id, template_id, influencer_ids, round_number } = body;

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

    // Determine the round number: use provided value, or fall back to template's round
    const effectiveRound = round_number ?? template.round_number;

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

    // Fetch existing email_logs for this campaign to check for duplicates and replies
    const { data: existingLogs } = await supabase
      .from("email_logs")
      .select("influencer_id, round_number, replied_at")
      .eq("campaign_id", campaign_id);

    const logsArr = (existingLogs as Pick<EmailLog, "influencer_id" | "round_number" | "replied_at">[]) ?? [];

    // Filter out influencers who have already been sent this round or who have replied
    const eligibleInfluencers = filterEligibleInfluencers(influencers, logsArr, effectiveRound);

    if (eligibleInfluencers.length === 0) {
      return NextResponse.json({
        sent: 0,
        total: influencers.length,
        skipped: influencers.length,
        message: "All influencers have already been sent this round or have replied.",
      });
    }

    let sentCount = 0;
    const senderEmail = template.sender_email ?? "hello@uncustom.com";
    const senderName = template.sender_name ?? "Uncustom";

    for (const inf of eligibleInfluencers) {
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

        // Create email log with the effective round number
        await supabase.from("email_logs").insert({
          campaign_id,
          influencer_id: inf.id,
          template_id,
          round_number: effectiveRound,
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
          round_number: effectiveRound,
          status: "failed",
        });
      }
    }

    return NextResponse.json({
      sent: sentCount,
      total: eligibleInfluencers.length,
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
