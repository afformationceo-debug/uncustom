-- Add outreach_type (email/dm distinction) and reply_channel_url to campaign_influencers
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS outreach_type TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS reply_channel_url TEXT;

-- Comment
COMMENT ON COLUMN campaign_influencers.outreach_type IS 'email or dm - type of outreach sent';
COMMENT ON COLUMN campaign_influencers.reply_channel_url IS 'URL/link for the reply channel thread (e.g. DM thread link, email thread)';
