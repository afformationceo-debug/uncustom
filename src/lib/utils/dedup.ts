import type { Tables } from "@/types/database";

type EmailLog = Tables<"email_logs">;

export function filterEligibleInfluencers<T extends { id: string }>(
  influencers: T[],
  existingLogs: Pick<EmailLog, "influencer_id" | "round_number" | "replied_at">[],
  roundNumber: number,
): T[] {
  const alreadySentThisRound = new Set(
    existingLogs
      .filter((l) => l.round_number === roundNumber)
      .map((l) => l.influencer_id)
  );
  const alreadyReplied = new Set(
    existingLogs
      .filter((l) => l.replied_at !== null)
      .map((l) => l.influencer_id)
  );
  return influencers.filter(
    (inf) => !alreadySentThisRound.has(inf.id) && !alreadyReplied.has(inf.id)
  );
}
