-- tagged_accounts: add target_country for multi-platform tagged extraction
ALTER TABLE tagged_accounts ADD COLUMN IF NOT EXISTS target_country TEXT DEFAULT 'ALL';

-- campaigns: add target countries/platforms for auto-filtering during assignment
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_platforms TEXT[] DEFAULT '{}';
