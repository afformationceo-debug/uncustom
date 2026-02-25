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
        // Top countries
        const { data: countryData } = await supabase
          .from('influencers')
          .select('country')
          .not('country', 'is', null)
          .limit(5000);
        const countryCounts: Record<string, number> = {};
        countryData?.forEach((r) => {
          if (r.country) countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
        });
        const topCountries = Object.entries(countryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([country, cnt]) => ({ country, count: cnt }));

        // Recent extractions
        const { count: recentExtractions } = await supabase
          .from('extraction_jobs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

        // Email coverage
        const { count: withEmail } = await supabase
          .from('influencers')
          .select('*', { count: 'exact', head: true })
          .not('email', 'is', null);

        context.stats = {
          total_influencers: count || 0,
          with_email: withEmail || 0,
          email_coverage_pct: count ? Math.round(((withEmail || 0) / count) * 100) : 0,
          top_countries: topCountries,
          recent_extractions_7d: recentExtractions || 0,
        };
        break;
      }
      case 'campaigns': {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, name, status, campaign_type')
          .eq('team_id', teamId)
          .limit(20);
        const active = campaigns?.filter((c) => c.status === 'active').length || 0;
        const total = campaigns?.length || 0;
        context.stats = {
          campaigns: campaigns || [],
          total_campaigns: total,
          active_campaigns: active,
        };
        break;
      }
      case 'manage': {
        if (campaignId) {
          const { data: funnelData } = await supabase
            .from('campaign_influencers')
            .select('funnel_status')
            .eq('campaign_id', campaignId);
          const funnelCounts: Record<string, number> = {};
          funnelData?.forEach((r) => {
            const s = r.funnel_status || 'extracted';
            funnelCounts[s] = (funnelCounts[s] || 0) + 1;
          });
          const totalCi = funnelData?.length || 0;

          // Identify bottlenecks (stale > 7 days)
          const { count: staleCount } = await supabase
            .from('campaign_influencers')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .lt('updated_at', new Date(Date.now() - 7 * 86400000).toISOString())
            .not('funnel_status', 'in', '("completed","settled","declined","dropped")');

          context.stats = {
            campaign_influencer_count: totalCi,
            funnel_distribution: funnelCounts,
            stale_over_7_days: staleCount || 0,
          };
        }
        break;
      }
      case 'brands': {
        const { count } = await supabase
          .from('brand_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);
        const { count: analyzed } = await supabase
          .from('brand_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .not('last_analyzed_at', 'is', null);
        const { count: contentCount } = await supabase
          .from('brand_influencer_contents')
          .select('*', { count: 'exact', head: true });
        const { count: relCount } = await supabase
          .from('brand_influencer_relationships')
          .select('*', { count: 'exact', head: true });
        context.stats = {
          total_brands: count || 0,
          analyzed_brands: analyzed || 0,
          analysis_coverage_pct: count ? Math.round(((analyzed || 0) / (count || 1)) * 100) : 0,
          discovered_contents: contentCount || 0,
          influencer_relationships: relCount || 0,
        };
        break;
      }
      case 'commerce': {
        const { data: commerceData } = await supabase
          .from('influencer_commerce')
          .select('total_revenue, roas, total_orders');
        const totalRevenue = commerceData?.reduce((s, c) => s + (c.total_revenue || 0), 0) || 0;
        const avgRoas = commerceData?.length
          ? commerceData.reduce((s, c) => s + (c.roas || 0), 0) / commerceData.length
          : 0;
        const totalOrders = commerceData?.reduce((s, c) => s + (c.total_orders || 0), 0) || 0;
        context.stats = {
          total_commerce_records: commerceData?.length || 0,
          total_revenue: totalRevenue,
          avg_roas: Math.round(avgRoas * 10) / 10,
          total_orders: totalOrders,
        };
        break;
      }
      case 'content-analysis': {
        const { count } = await supabase
          .from('brand_influencer_contents')
          .select('*', { count: 'exact', head: true });
        const { count: sponsored } = await supabase
          .from('brand_influencer_contents')
          .select('*', { count: 'exact', head: true })
          .eq('is_sponsored', true);
        context.stats = {
          total_contents: count || 0,
          sponsored_count: sponsored || 0,
          organic_count: (count || 0) - (sponsored || 0),
        };
        break;
      }
      case 'home': {
        const { count: campaignCount } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('status', 'active');
        const { count: influencerCount } = await supabase
          .from('influencers')
          .select('*', { count: 'exact', head: true });
        const { count: emailCount } = await supabase
          .from('email_logs')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);
        context.stats = {
          active_campaigns: campaignCount || 0,
          total_influencers: influencerCount || 0,
          total_emails_sent: emailCount || 0,
        };
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
