import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUpdatePayload, type WebhookEventType } from "@/lib/resend/tracking";

export async function POST(request: Request) {
  try {
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 401 });
      }

      // Timestamp replay protection (5 min tolerance)
      const timestamp = parseInt(svixTimestamp);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return NextResponse.json({ error: "Webhook timestamp too old" }, { status: 401 });
      }
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const messageId = data.email_id ?? data.id;

    if (!messageId) {
      return NextResponse.json({ received: true });
    }

    const payload = getUpdatePayload(type as WebhookEventType, data);

    if (payload) {
      await supabase
        .from("email_logs")
        .update(payload)
        .eq("resend_message_id", messageId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
