import { createClient } from '@/lib/supabase/server';
import type { PageContext, AIContextData } from './types';

export async function buildContextData(
  pageContext: PageContext,
  teamId: string,
  campaignId?: string
): Promise<AIContextData> {
  const supabase = await createClient();
  const context: AIContextData = { page: pageContext, teamId, campaignId };

  try {
    switch (pageContext) {
      case 'master': {
        const { count } = await supabase.from('influencers').select('*', { count: 'exact', head: true });
        const { data: platformCounts } = await supabase.rpc('get_influencer_platform_counts').select();
        context.stats = {
          total_influencers: count || 0,
          platforms: platformCounts || 'Query via search tool for details',
        };
        break;
      }
      case 'campaigns': {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, name, status')
          .eq('team_id', teamId)
          .limit(20);
        context.stats = { campaigns: campaigns || [] };
        break;
      }
      case 'manage': {
        if (campaignId) {
          const { count } = await supabase
            .from('campaign_influencers')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId);
          context.stats = { campaign_influencer_count: count || 0 };
        }
        break;
      }
      case 'brands': {
        const { count } = await supabase
          .from('brand_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);
        context.stats = { total_brands: count || 0 };
        break;
      }
      default:
        break;
    }
  } catch {
    // Context building is best-effort
  }

  return context;
}
