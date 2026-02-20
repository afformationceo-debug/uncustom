import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
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

    const now = new Date().toISOString();

    switch (type) {
      case "email.sent":
        await supabase
          .from("email_logs")
          .update({ status: "sent", sent_at: now })
          .eq("resend_message_id", messageId);
        break;

      case "email.delivered":
        await supabase
          .from("email_logs")
          .update({ status: "delivered" })
          .eq("resend_message_id", messageId);
        break;

      case "email.opened":
        await supabase
          .from("email_logs")
          .update({ status: "opened", opened_at: now })
          .eq("resend_message_id", messageId);
        break;

      case "email.clicked":
        await supabase
          .from("email_logs")
          .update({ status: "clicked", clicked_at: now })
          .eq("resend_message_id", messageId);
        break;

      case "email.bounced":
        await supabase
          .from("email_logs")
          .update({ status: "bounced" })
          .eq("resend_message_id", messageId);
        break;

      case "email.complained":
        await supabase
          .from("email_logs")
          .update({ status: "failed" })
          .eq("resend_message_id", messageId);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
