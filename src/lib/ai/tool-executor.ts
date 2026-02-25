import { createClient } from '@/lib/supabase/server';
import type { AIToolCall } from './types';

export async function executeTool(
  toolCall: AIToolCall,
  teamId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();
  const { name, input } = toolCall;

  try {
    switch (name) {
      case 'search_influencers':
        return await searchInfluencers(supabase, input);
      case 'get_influencer_detail':
        return await getInfluencerDetail(supabase, input.influencer_id as string);
      case 'get_campaign_influencers':
        return await getCampaignInfluencers(supabase, input);
      case 'get_campaigns':
        return await getCampaigns(supabase, teamId, input);
      case 'get_campaign_stats':
        return await getCampaignStats(supabase, input.campaign_id as string);
      case 'search_brand_intelligence':
        return await searchBrandIntelligence(supabase, teamId, input);
      case 'analyze_influencer_quality':
        return await analyzeInfluencerQuality(supabase, input.influencer_id as string);
      case 'compare_influencers':
        return await compareInfluencers(supabase, input.influencer_ids as string[]);
      case 'get_funnel_summary':
        return await getFunnelSummary(supabase, input.campaign_id as string);
      case 'get_email_analytics':
        return await getEmailAnalytics(supabase, input.campaign_id as string);
      case 'aggregate_platform_stats':
        return await aggregatePlatformStats(supabase, input.group_by as string);
      case 'estimate_extraction_cost':
        return estimateExtractionCost(input);
      case 'score_influencer_fit':
        return await scoreInfluencerFit(supabase, input.influencer_id as string, input.campaign_id as string);
      case 'predict_campaign_performance':
        return await predictCampaignPerformance(supabase, input.campaign_id as string);
      case 'suggest_outreach_strategy':
        return await suggestOutreachStrategy(supabase, input);
      case 'propose_campaign_assignment':
        return await proposeAction(supabase, teamId, userId, 'assign_campaign', input);
      case 'propose_email_send':
        return await proposeAction(supabase, teamId, userId, 'send_email', input);
      case 'propose_status_update':
        return await proposeAction(supabase, teamId, userId, 'update_status', input);
      case 'generate_message_draft':
        return await generateMessageDraft(supabase, input);
      case 'propose_extraction':
        return await proposeAction(supabase, teamId, userId, 'start_extraction', input);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({ error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchInfluencers(supabase: any, input: Record<string, unknown>): Promise<string> {
  let query = supabase.from('influencers').select('id, username, display_name, platform, platform_id, profile_image_url, follower_count, engagement_rate, country, category, email, is_verified, influence_score, content_quality_score, brand_collab_count');

  if (input.platform) query = query.eq('platform', input.platform);
  if (input.country) query = query.eq('country', input.country);
  if (input.min_followers) query = query.gte('follower_count', input.min_followers);
  if (input.max_followers) query = query.lte('follower_count', input.max_followers);
  if (input.min_engagement_rate) query = query.gte('engagement_rate', input.min_engagement_rate);
  if (input.category) query = query.ilike('category', `%${input.category}%`);
  if (input.keyword) query = query.or(`username.ilike.%${input.keyword}%,display_name.ilike.%${input.keyword}%,bio.ilike.%${input.keyword}%`);
  if (input.has_email) query = query.not('email', 'is', null);
  if (input.is_verified) query = query.eq('is_verified', true);
  if (input.min_influence_score) query = query.gte('influence_score', input.min_influence_score);

  const sortBy = (input.sort_by as string) || 'follower_count';
  const sortOrder = input.sort_order === 'asc';
  query = query.order(sortBy, { ascending: sortOrder, nullsFirst: false });

  const limit = Math.min((input.limit as number) || 20, 50);
  query = query.limit(limit);

  const { data, error, count } = await query;
  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({
    results: data || [],
    count: data?.length || 0,
    total_hint: count,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getInfluencerDetail(supabase: any, influencerId: string): Promise<string> {
  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .single();

  if (error) return JSON.stringify({ error: error.message });

  // Get campaign assignments
  const { data: assignments } = await supabase
    .from('campaign_influencers')
    .select('campaign_id, funnel_status, created_at, campaigns(name)')
    .eq('influencer_id', influencerId);

  // Strip raw_data to keep context small
  if (data) {
    delete data.raw_data;
    delete data.source_content_media;
  }

  return JSON.stringify({ influencer: data, campaign_assignments: assignments || [] });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCampaignInfluencers(supabase: any, input: Record<string, unknown>): Promise<string> {
  let query = supabase
    .from('campaign_influencers')
    .select('id, influencer_id, funnel_status, outreach_round, last_outreach_at, reply_date, visit_scheduled_date, upload_url, influencers(username, display_name, platform, follower_count, country, profile_image_url)')
    .eq('campaign_id', input.campaign_id);

  if (input.funnel_status) query = query.eq('funnel_status', input.funnel_status);

  const limit = Math.min((input.limit as number) || 20, 50);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({ results: data || [], count: data?.length || 0 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCampaigns(supabase: any, teamId: string, input: Record<string, unknown>): Promise<string> {
  let query = supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, target_countries, target_platforms, created_at')
    .eq('team_id', teamId);

  if (input.status) query = query.eq('status', input.status);
  query = query.order('created_at', { ascending: false }).limit(20);

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({ campaigns: data || [] });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCampaignStats(supabase: any, campaignId: string): Promise<string> {
  const { data: influencers, error } = await supabase
    .from('campaign_influencers')
    .select('funnel_status, influencers(platform, country)')
    .eq('campaign_id', campaignId);

  if (error) return JSON.stringify({ error: error.message });

  const funnelDist: Record<string, number> = {};
  const platformDist: Record<string, number> = {};
  const countryDist: Record<string, number> = {};

  for (const item of influencers || []) {
    const status = item.funnel_status || 'unknown';
    funnelDist[status] = (funnelDist[status] || 0) + 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inf = item.influencers as any;
    if (inf?.platform) platformDist[inf.platform] = (platformDist[inf.platform] || 0) + 1;
    if (inf?.country) countryDist[inf.country] = (countryDist[inf.country] || 0) + 1;
  }

  return JSON.stringify({
    total_influencers: influencers?.length || 0,
    funnel_distribution: funnelDist,
    platform_distribution: platformDist,
    country_distribution: countryDist,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchBrandIntelligence(supabase: any, teamId: string, input: Record<string, unknown>): Promise<string> {
  let query = supabase
    .from('brand_accounts')
    .select('id, brand_name, username, platform, industry, follower_count, engagement_rate, last_analyzed_at')
    .eq('team_id', teamId);

  if (input.brand_name) query = query.ilike('brand_name', `%${input.brand_name}%`);
  if (input.industry) query = query.eq('industry', input.industry);
  if (input.platform) query = query.eq('platform', input.platform);

  query = query.limit(20);

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({ brands: data || [] });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function analyzeInfluencerQuality(supabase: any, influencerId: string): Promise<string> {
  const { data, error } = await supabase
    .from('influencers')
    .select('username, platform, follower_count, following_count, engagement_rate, post_count, is_verified, avg_likes, avg_comments, avg_views, influence_score, content_quality_score, audience_authenticity_score')
    .eq('id', influencerId)
    .single();

  if (error) return JSON.stringify({ error: error.message });

  const followRatio = data.following_count && data.follower_count
    ? data.following_count / data.follower_count
    : null;

  return JSON.stringify({
    profile: data,
    quality_signals: {
      follow_ratio: followRatio,
      follow_ratio_assessment: followRatio && followRatio > 2 ? 'suspicious' : followRatio && followRatio > 1 ? 'moderate' : 'healthy',
      engagement_assessment: data.engagement_rate > 5 ? 'high' : data.engagement_rate > 2 ? 'average' : data.engagement_rate > 0.5 ? 'low' : 'very_low',
      post_frequency: data.post_count ? 'active' : 'unknown',
      verification: data.is_verified ? 'verified' : 'unverified',
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function compareInfluencers(supabase: any, ids: string[]): Promise<string> {
  const limitedIds = ids.slice(0, 5);
  const { data, error } = await supabase
    .from('influencers')
    .select('id, username, display_name, platform, follower_count, engagement_rate, country, category, avg_likes, avg_comments, avg_views, influence_score, content_quality_score, brand_collab_count')
    .in('id', limitedIds);

  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({ influencers: data || [] });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFunnelSummary(supabase: any, campaignId: string): Promise<string> {
  const { data, error } = await supabase
    .from('campaign_influencers')
    .select('funnel_status, last_outreach_at, reply_date, created_at')
    .eq('campaign_id', campaignId);

  if (error) return JSON.stringify({ error: error.message });

  const now = new Date();
  const stages: Record<string, { count: number; stuck_7d: number }> = {};

  for (const item of data || []) {
    const status = item.funnel_status || 'unknown';
    if (!stages[status]) stages[status] = { count: 0, stuck_7d: 0 };
    stages[status].count++;

    const lastActivity = item.reply_date || item.last_outreach_at || item.created_at;
    if (lastActivity) {
      const daysSince = (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) stages[status].stuck_7d++;
    }
  }

  return JSON.stringify({
    total: data?.length || 0,
    stages,
    bottleneck: Object.entries(stages).sort((a, b) => b[1].stuck_7d - a[1].stuck_7d)[0],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEmailAnalytics(supabase: any, campaignId: string): Promise<string> {
  const { data, error } = await supabase
    .from('email_logs')
    .select('status, sent_at, opened_at, clicked_at, replied_at')
    .eq('campaign_id', campaignId);

  if (error) return JSON.stringify({ error: error.message });

  const total = data?.length || 0;
  const sent = data?.filter((e: Record<string, unknown>) => e.sent_at).length || 0;
  const opened = data?.filter((e: Record<string, unknown>) => e.opened_at).length || 0;
  const clicked = data?.filter((e: Record<string, unknown>) => e.clicked_at).length || 0;
  const replied = data?.filter((e: Record<string, unknown>) => e.replied_at).length || 0;

  return JSON.stringify({
    total,
    sent,
    opened,
    clicked,
    replied,
    open_rate: sent > 0 ? ((opened / sent) * 100).toFixed(1) + '%' : 'N/A',
    click_rate: opened > 0 ? ((clicked / opened) * 100).toFixed(1) + '%' : 'N/A',
    reply_rate: sent > 0 ? ((replied / sent) * 100).toFixed(1) + '%' : 'N/A',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aggregatePlatformStats(supabase: any, groupBy: string): Promise<string> {
  const validColumns = ['platform', 'country', 'category'];
  if (!validColumns.includes(groupBy)) {
    return JSON.stringify({ error: `Invalid group_by: ${groupBy}. Must be one of: ${validColumns.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('influencers')
    .select(`${groupBy}, follower_count, engagement_rate`)
    .not(groupBy, 'is', null);

  if (error) return JSON.stringify({ error: error.message });

  const groups: Record<string, { count: number; total_followers: number; avg_engagement: number }> = {};

  for (const item of data || []) {
    const key = (item as Record<string, unknown>)[groupBy] as string;
    if (!key) continue;
    if (!groups[key]) groups[key] = { count: 0, total_followers: 0, avg_engagement: 0 };
    groups[key].count++;
    groups[key].total_followers += (item.follower_count as number) || 0;
    groups[key].avg_engagement += (item.engagement_rate as number) || 0;
  }

  for (const key of Object.keys(groups)) {
    if (groups[key].count > 0) {
      groups[key].avg_engagement = Number((groups[key].avg_engagement / groups[key].count).toFixed(2));
    }
  }

  return JSON.stringify({ group_by: groupBy, groups });
}

function estimateExtractionCost(input: Record<string, unknown>): string {
  const costMap: Record<string, Record<string, number>> = {
    instagram: { keyword: 0.81, tagged: 0.81, brand_profile: 0.013, brand_tagged_content: 0.81, deep_profile: 0.013, ecommerce_scan: 0 },
    tiktok: { keyword: 0.50, tagged: 0.50, brand_profile: 0.012, brand_tagged_content: 0.50, deep_profile: 0.012, ecommerce_scan: 0.005 },
    youtube: { keyword: 0.50, tagged: 0.50, brand_profile: 0.014, brand_tagged_content: 0.50, deep_profile: 0.014, ecommerce_scan: 0 },
    twitter: { keyword: 0.50, tagged: 0.50, brand_profile: 0.013, brand_tagged_content: 0.50, deep_profile: 0.013, ecommerce_scan: 0 },
  };

  const platform = input.platform as string;
  const jobType = input.job_type as string;
  const baseCost = costMap[platform]?.[jobType] || 0;
  const results = (input.estimated_results as number) || 200;
  const multiplier = results > 200 ? results / 200 : 1;

  return JSON.stringify({
    platform,
    job_type: jobType,
    estimated_results: results,
    estimated_cost_usd: Number((baseCost * multiplier).toFixed(3)),
    note: 'Costs are estimates and may vary based on actual Apify usage.',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scoreInfluencerFit(supabase: any, influencerId: string, campaignId: string): Promise<string> {
  const [{ data: inf }, { data: campaign }] = await Promise.all([
    supabase.from('influencers').select('platform, country, follower_count, engagement_rate, category, influence_score').eq('id', influencerId).single(),
    supabase.from('campaigns').select('target_countries, target_platforms, campaign_type').eq('id', campaignId).single(),
  ]);

  if (!inf || !campaign) return JSON.stringify({ error: 'Influencer or campaign not found' });

  let score = 50;
  const reasons: string[] = [];

  if (campaign.target_platforms?.includes(inf.platform)) { score += 15; reasons.push('Platform match'); }
  else { score -= 10; reasons.push('Platform mismatch'); }

  if (campaign.target_countries?.includes(inf.country)) { score += 15; reasons.push('Country match'); }
  else if (inf.country) { score -= 5; reasons.push('Country mismatch'); }

  if (inf.engagement_rate > 3) { score += 10; reasons.push('Good engagement'); }
  if (inf.influence_score && inf.influence_score > 70) { score += 10; reasons.push('High influence score'); }

  return JSON.stringify({ score: Math.min(100, Math.max(0, score)), reasons, influencer: inf, campaign });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function predictCampaignPerformance(supabase: any, campaignId: string): Promise<string> {
  const { data: influencers } = await supabase
    .from('campaign_influencers')
    .select('funnel_status, influencers(follower_count, engagement_rate)')
    .eq('campaign_id', campaignId);

  if (!influencers?.length) return JSON.stringify({ error: 'No influencers in campaign' });

  const totalFollowers = influencers.reduce((sum: number, i: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inf = i.influencers as any;
    return sum + (inf?.follower_count || 0);
  }, 0);

  const avgEngagement = influencers.reduce((sum: number, i: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inf = i.influencers as any;
    return sum + (inf?.engagement_rate || 0);
  }, 0) / influencers.length;

  return JSON.stringify({
    total_influencers: influencers.length,
    total_reach: totalFollowers,
    avg_engagement_rate: Number(avgEngagement.toFixed(2)),
    estimated_impressions: Math.round(totalFollowers * 0.3),
    estimated_engagements: Math.round(totalFollowers * (avgEngagement / 100)),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function suggestOutreachStrategy(supabase: any, input: Record<string, unknown>): Promise<string> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name, campaign_type, target_platforms')
    .eq('id', input.campaign_id)
    .single();

  if (!campaign) return JSON.stringify({ error: 'Campaign not found' });

  return JSON.stringify({
    campaign: campaign.name,
    suggestions: [
      { step: 1, action: 'Send initial DM/email with personalized proposal link', timing: 'Immediately' },
      { step: 2, action: 'Follow up with non-responders', timing: 'After 3-5 days' },
      { step: 3, action: 'Second follow-up with adjusted offer', timing: 'After 7 days' },
      { step: 4, action: 'Final outreach or move to next batch', timing: 'After 14 days' },
    ],
    tips: [
      'Personalize each message with influencer name and recent content reference',
      `For ${campaign.campaign_type} campaigns, emphasize the unique experience`,
      'Include clear CTA and proposal link in first message',
    ],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function proposeAction(supabase: any, teamId: string, userId: string, actionType: string, input: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase
    .from('ai_actions')
    .insert({
      team_id: teamId,
      action_type: actionType,
      action_payload: input,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({
    action_created: true,
    action_id: data.id,
    action_type: actionType,
    status: 'pending',
    message: 'Action has been proposed and is awaiting user approval.',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateMessageDraft(supabase: any, input: Record<string, unknown>): Promise<string> {
  const { data: inf } = await supabase
    .from('influencers')
    .select('username, display_name, platform, country')
    .eq('id', input.influencer_id)
    .single();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name')
    .eq('id', input.campaign_id)
    .single();

  if (!inf || !campaign) return JSON.stringify({ error: 'Influencer or campaign not found' });

  return JSON.stringify({
    draft: {
      type: input.message_type,
      to: inf.display_name || inf.username,
      subject: input.message_type === 'email' ? `Collaboration Opportunity - ${campaign.name}` : undefined,
      body: `Hi ${inf.display_name || inf.username}! We love your content and would like to invite you to collaborate with us on ${campaign.name}. Check out the details: {{proposal_link}}`,
      personalization_tags_used: ['display_name', 'campaign_name', 'proposal_link'],
    },
    note: 'This is an AI-generated draft. Please review and customize before sending.',
  });
}
