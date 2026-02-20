const CTA_URL_PATTERNS = [
  "line.me",
  "wa.me",
  "api.whatsapp.com",
];

export function isCTALink(url: string): boolean {
  const lowered = url.toLowerCase();
  return CTA_URL_PATTERNS.some((pattern) => lowered.includes(pattern));
}

export type WebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained";

export function getUpdatePayload(
  type: WebhookEventType,
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  const now = new Date().toISOString();

  switch (type) {
    case "email.sent":
      return { status: "sent", sent_at: now };
    case "email.delivered":
      return { status: "delivered" };
    case "email.opened":
      return { status: "opened", opened_at: now };
    case "email.clicked": {
      const payload: Record<string, unknown> = { status: "clicked", clicked_at: now };
      const clickedLink = (data.click as Record<string, unknown>)?.link as string | undefined;
      if (clickedLink && isCTALink(clickedLink)) {
        payload.cta_clicked = true;
        payload.cta_clicked_at = now;
      }
      return payload;
    }
    case "email.bounced":
      return { status: "bounced" };
    case "email.complained":
      return { status: "failed" };
    default:
      return null;
  }
}
