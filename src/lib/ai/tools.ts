import type Anthropic from '@anthropic-ai/sdk';

export const AI_TOOLS: Anthropic.Tool[] = [
  // === Search/Query (6) ===
  {
    name: 'search_influencers',
    description: 'Search the master influencer database with complex filters. Returns up to 20 results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'twitter'], description: 'Filter by platform' },
        country: { type: 'string', description: 'Filter by country code (e.g., TW, JP, KR)' },
        min_followers: { type: 'number', description: 'Minimum follower count' },
        max_followers: { type: 'number', description: 'Maximum follower count' },
        min_engagement_rate: { type: 'number', description: 'Minimum engagement rate (0-100)' },
        category: { type: 'string', description: 'Category filter (e.g., beauty, fashion, food)' },
        keyword: { type: 'string', description: 'Search in username, display_name, bio' },
        has_email: { type: 'boolean', description: 'Only influencers with email' },
        is_verified: { type: 'boolean', description: 'Only verified accounts' },
        min_influence_score: { type: 'number', description: 'Minimum influence score (0-100)' },
        sort_by: { type: 'string', enum: ['follower_count', 'engagement_rate', 'influence_score', 'brand_collab_count'], description: 'Sort field' },
        sort_order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_influencer_detail',
    description: 'Get detailed profile for a specific influencer including campaign assignments and links.',
    input_schema: {
      type: 'object' as const,
      properties: {
        influencer_id: { type: 'string', description: 'Influencer UUID' },
      },
      required: ['influencer_id'],
    },
  },
  {
    name: 'get_campaign_influencers',
    description: 'Get all influencers assigned to a campaign with their funnel status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Campaign UUID' },
        funnel_status: { type: 'string', description: 'Filter by funnel status' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_campaigns',
    description: 'Get list of campaigns for the current team.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status (active, completed, paused)' },
      },
      required: [],
    },
  },
  {
    name: 'get_campaign_stats',
    description: 'Get campaign statistics including funnel distribution, country/platform breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'search_brand_intelligence',
    description: 'Search brand accounts and their influencer relationships.',
    input_schema: {
      type: 'object' as const,
      properties: {
        brand_name: { type: 'string', description: 'Search by brand name' },
        industry: { type: 'string', description: 'Filter by industry' },
        platform: { type: 'string', description: 'Filter by platform' },
      },
      required: [],
    },
  },
  // === Analysis (5) ===
  {
    name: 'analyze_influencer_quality',
    description: 'Analyze quality signals for an influencer (engagement authenticity, follower quality, content consistency).',
    input_schema: {
      type: 'object' as const,
      properties: {
        influencer_id: { type: 'string', description: 'Influencer UUID' },
      },
      required: ['influencer_id'],
    },
  },
  {
    name: 'compare_influencers',
    description: 'Compare multiple influencers side by side on key metrics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        influencer_ids: { type: 'array', items: { type: 'string' }, description: 'List of influencer UUIDs to compare (2-5)' },
      },
      required: ['influencer_ids'],
    },
  },
  {
    name: 'get_funnel_summary',
    description: 'Get funnel stage distribution and identify bottlenecks for a campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_email_analytics',
    description: 'Get email send/open/click analytics for a campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'aggregate_platform_stats',
    description: 'Get aggregated statistics across all influencers, grouped by platform.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_by: { type: 'string', enum: ['platform', 'country', 'category'], description: 'Grouping dimension' },
      },
      required: ['group_by'],
    },
  },
  // === Prediction/Recommendation (4) ===
  {
    name: 'estimate_extraction_cost',
    description: 'Estimate the Apify cost for a planned extraction job.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'twitter'] },
        job_type: { type: 'string', enum: ['keyword', 'tagged', 'brand_profile', 'brand_tagged_content', 'deep_profile', 'ecommerce_scan'] },
        estimated_results: { type: 'number', description: 'Expected number of results' },
      },
      required: ['platform', 'job_type'],
    },
  },
  {
    name: 'score_influencer_fit',
    description: 'Score how well an influencer fits a specific campaign based on campaign requirements and influencer profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        influencer_id: { type: 'string' },
        campaign_id: { type: 'string' },
      },
      required: ['influencer_id', 'campaign_id'],
    },
  },
  {
    name: 'predict_campaign_performance',
    description: 'Predict campaign performance metrics based on current influencer roster and historical data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'suggest_outreach_strategy',
    description: 'Suggest outreach approach based on influencer characteristics and campaign type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string' },
        influencer_ids: { type: 'array', items: { type: 'string' }, description: 'Target influencer IDs' },
      },
      required: ['campaign_id'],
    },
  },
  // === Action Proposals (5) — require user approval ===
  {
    name: 'propose_campaign_assignment',
    description: 'Propose assigning influencers to a campaign. Creates an action that requires user approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string' },
        influencer_ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string', description: 'Why these influencers are recommended' },
      },
      required: ['campaign_id', 'influencer_ids', 'reason'],
    },
  },
  {
    name: 'propose_email_send',
    description: 'Propose sending emails to influencers. Creates an action that requires user approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string' },
        template_id: { type: 'string' },
        influencer_ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
      },
      required: ['campaign_id', 'influencer_ids', 'reason'],
    },
  },
  {
    name: 'propose_status_update',
    description: 'Propose updating funnel status for influencers. Creates an action that requires user approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string' },
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              influencer_id: { type: 'string' },
              new_status: { type: 'string' },
            },
            required: ['influencer_id', 'new_status'],
          },
        },
        reason: { type: 'string' },
      },
      required: ['campaign_id', 'updates', 'reason'],
    },
  },
  {
    name: 'generate_message_draft',
    description: 'Generate a personalized outreach message draft for an influencer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        influencer_id: { type: 'string' },
        campaign_id: { type: 'string' },
        message_type: { type: 'string', enum: ['dm', 'email'] },
        tone: { type: 'string', enum: ['formal', 'casual', 'friendly'] },
        language: { type: 'string', description: 'Message language (ko, en, ja, zh, etc.)' },
      },
      required: ['influencer_id', 'campaign_id', 'message_type'],
    },
  },
  {
    name: 'propose_extraction',
    description: 'Propose starting a new extraction job. Creates an action that requires user approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'twitter'] },
        job_type: { type: 'string', enum: ['keyword', 'tagged', 'brand_profile', 'brand_tagged_content'] },
        keywords: { type: 'array', items: { type: 'string' } },
        results_limit: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['platform', 'job_type', 'reason'],
    },
  },
];
