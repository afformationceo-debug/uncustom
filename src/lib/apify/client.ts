import { ApifyClient } from "apify-client";

let client: ApifyClient | null = null;

export function getApifyClient(): ApifyClient {
  if (!client) {
    client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN!,
    });
  }
  return client;
}

export async function runActor(actorId: string, input: Record<string, unknown>) {
  const client = getApifyClient();
  const run = await client.actor(actorId).call(input);
  return run;
}

export async function getDatasetItems(datasetId: string) {
  const client = getApifyClient();
  const { items } = await client.dataset(datasetId).listItems();
  return items;
}

export async function getRunStatus(runId: string) {
  const client = getApifyClient();
  const run = await client.run(runId).get();
  return run;
}
