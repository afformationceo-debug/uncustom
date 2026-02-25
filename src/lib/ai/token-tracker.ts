import { createClient } from '@/lib/supabase/server';
import { calculateCost } from './client';

export async function trackTokenUsage(params: {
  teamId: string;
  userId: string;
  conversationId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  endpoint: string;
}): Promise<void> {
  const supabase = await createClient();
  const costUsd = calculateCost(params.modelId, params.inputTokens, params.outputTokens);

  await supabase.from('ai_token_usage').insert({
    team_id: params.teamId,
    user_id: params.userId,
    conversation_id: params.conversationId,
    model_id: params.modelId,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: costUsd,
    endpoint: params.endpoint,
  });

  // Also update conversation totals if conversationId provided
  if (params.conversationId) {
    // Fetch current totals and increment
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('total_input_tokens, total_output_tokens, total_cost_usd')
      .eq('id', params.conversationId)
      .single();

    if (conv) {
      const row = conv as { total_input_tokens: number; total_output_tokens: number; total_cost_usd: number };
      await supabase
        .from('ai_conversations')
        .update({
          total_input_tokens: (row.total_input_tokens || 0) + params.inputTokens,
          total_output_tokens: (row.total_output_tokens || 0) + params.outputTokens,
          total_cost_usd: (row.total_cost_usd || 0) + costUsd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.conversationId);
    }
  }
}

export async function getTeamUsageSummary(teamId: string, daysBack: number = 30) {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data, error } = await supabase
    .from('ai_token_usage')
    .select('input_tokens, output_tokens, cost_usd, created_at')
    .eq('team_id', teamId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  const totals = (data || []).reduce(
    (acc, row) => ({
      input_tokens: acc.input_tokens + row.input_tokens,
      output_tokens: acc.output_tokens + row.output_tokens,
      cost_usd: acc.cost_usd + row.cost_usd,
      request_count: acc.request_count + 1,
    }),
    { input_tokens: 0, output_tokens: 0, cost_usd: 0, request_count: 0 }
  );

  return { ...totals, period_days: daysBack };
}
