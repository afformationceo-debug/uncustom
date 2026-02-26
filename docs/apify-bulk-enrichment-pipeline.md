# Apify Bulk Enrichment Pipeline

## Overview

Instagram Hashtag Scraper (`apify/instagram-hashtag-scraper`)의 1,231건 SUCCEEDED runs에서 추출한 인플루언서를 정제하고, Profile Scraper로 보강한 뒤 Supabase DB에 upsert하는 파이프라인.

## Pipeline Flow

```
1. Bulk Export (311,396 raw items)
   → ownerUsername dedup (147,726)
   → videoPlayCount >= 10,000 필터 (41,286)
   → ownerUsername 재dedup (20,100)

2. Caption Language Fix
   → caption 텍스트로 국가 재판정 (3,438건 수정)
   → 브랜드/비인플루언서 제거 (1,037건)
   → 최종: 19,063명

3. Profile Enrichment (국가별 배치)
   → Instagram Profile Scraper 실행 (100명/배치, 5 concurrent)
   → follower_count, bio, email, engagement_rate 등 채움
   → 결과: enriched JSON + CSV

4. Supabase DB Upsert (국가별)
   → influencers 테이블 48개 컬럼 매핑
   → UNIQUE(platform, platform_id) 기준 upsert
   → bio links → influencer_links 테이블

5. Email Extraction (이메일 없고 유효 링크 있는 인플루언서)
   → vdrmota/contact-info-scraper (maxRequestsPerStartUrl: 2)
   → SNS/메신저 URL 제외
   → 이메일 발견 시 influencers.email 업데이트 (email_source: "domain:url")
```

## Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `apify-bulk-export.ts` | 1,231 runs bulk download + dedup | `/tmp/apify-bulk-export.ts` |
| `apify-enrich-profiles.ts` | Profile Scraper batch enrichment | `/tmp/apify-enrich-profiles.ts` |
| `apify-upsert-to-supabase.ts` | Supabase DB upsert (48 columns) | `/tmp/apify-upsert-to-supabase.ts` |
| `apify-email-extract.ts` | Bio link email extraction | `/tmp/apify-email-extract.ts` |

## Usage

```bash
# 1. Profile enrichment (country별)
npx tsx /tmp/apify-enrich-profiles.ts CN
npx tsx /tmp/apify-enrich-profiles.ts TW
npx tsx /tmp/apify-enrich-profiles.ts KR
npx tsx /tmp/apify-enrich-profiles.ts JP
npx tsx /tmp/apify-enrich-profiles.ts US
npx tsx /tmp/apify-enrich-profiles.ts VN
npx tsx /tmp/apify-enrich-profiles.ts TH

# 2. Supabase upsert (country별)
npx tsx /tmp/apify-upsert-to-supabase.ts CN
npx tsx /tmp/apify-upsert-to-supabase.ts TW
# ... etc

# 3. Email extraction (country별)
npx tsx /tmp/apify-email-extract.ts CN
npx tsx /tmp/apify-email-extract.ts TW
# ... etc
```

## Country Distribution (Final 19,063)

| Country | Count | Profile Cost | Email Cost (est) |
|---------|-------|-------------|-----------------|
| KR | 6,908 | ~$21.6 | ~$4.0 |
| US | 5,677 | ~$17.6 | ~$3.3 |
| JP | 3,066 | ~$9.5 | ~$1.8 |
| TW | 2,180 | ~$6.7 | ~$1.3 |
| CN | 796 | ~$2.5 | ~$0.6 |
| VN | 391 | ~$1.2 | ~$0.3 |
| TH | 45 | ~$0.2 | ~$0.03 |
| **Total** | **19,063** | **~$59.3** | **~$11.3** |

## DB Schema Mapping

### Profile Scraper → influencers 테이블

| Profile Scraper Field | DB Column | Notes |
|----------------------|-----------|-------|
| id | platform_id | Unique per platform |
| username | username | @handle |
| fullName | display_name | |
| profilePicUrlHD | profile_image_url | HD > regular |
| biography | bio | |
| followersCount | follower_count | |
| followsCount | following_count | |
| postsCount | post_count | |
| isVerified | is_verified | |
| isBusinessAccount | is_business | |
| businessCategoryName | category | |
| businessEmail | email | Priority: businessEmail > bio regex |
| externalUrl | external_url | |
| bioLinks | → influencer_links | SNS/메신저 URL 제외 |
| latestPosts | → engagement_rate, avg_likes, avg_comments | Top 12 posts 기준 계산 |
| isPrivate | is_private | |

### Email Extraction → influencers 테이블

| Source | email_source format | Example |
|--------|-------------------|---------|
| businessEmail | `business` | Instagram business email |
| Bio regex | `bio` | Email in biography text |
| Web scraper | `domain:url` | `linktr.ee:https://linktr.ee/user` |

## Cost Management Rules

1. **Profile Scraper**: 100명/배치, 5 concurrent runs
2. **Email Scraper**: maxRequestsPerStartUrl=2 (NOT 5 — 비용 2.5x 차이)
3. **Email Scraper**: sameDomain=true, maxDepth=1
4. **Skip domains**: instagram, tiktok, youtube, twitter, facebook, telegram, whatsapp, line, kakao, naver, xiaohongshu
5. **Scope**: 이번 enrichment 대상만 (전체 DB scan 금지)

## Progress Tracking

| Country | Profile | DB Upsert | Email Extract | Status |
|---------|---------|-----------|---------------|--------|
| CN (796) | Done (796/796) | Done (796/0 err, 317 links) | Done (263 links → 1 email) | Complete |
| TW (2,180) | Done (2,180/2,180) | Done (2,180/0 err, 1,173 links) | Done (863 links → 1 email) | Complete |
| KR (6,908) | In Progress | Pending | SKIP | - |
| US (5,677) | Pending | Pending | SKIP | - |
| JP (3,066) | Done (3,066/3,066) | Done (3,066/0 err, 1,747 links) | SKIP | Complete |
| VN (391) | Pending | Pending | SKIP | - |
| TH (45) | Pending | Pending | SKIP | - |

### CN Results
- Profile enrichment: 796/796 (95.9% with followers, 93.7% with bio, 11.7% with email)
- DB upsert: 796 inserted, 0 errors, 317 bio links
- Email extraction: 263 links scraped → 1 email found (~$0.55)

### TW Results
- Profile enrichment: 2,180/2,180 (98.8% with followers, 97.7% with bio, 24.9% with email)
- DB upsert: 2,180 inserted, 0 errors, 1,173 bio links
- Email extraction: 863 links scraped → 1 email found (~$1.82)

### JP Results
- Profile enrichment: 3,066/3,066 (99.1% with followers, 98.7% with bio, 4.8% with email)
- DB upsert: 3,066 inserted, 0 errors, 1,747 bio links
- Email extraction: SKIP (low hit rate from CN/TW)
- DB cleanup: 807 low-quality removed (followers < 5K AND avg_views <= 3K)

### Email Extraction Decision
CN과 TW 모두 웹 스크래핑 이메일 히트율이 **0.13%** (1,126개 링크 → 2건 이메일).
Profile Scraper의 businessEmail + bio regex가 이미 충분하므로 (CN 11.7%, TW 24.9%),
**나머지 국가에서는 웹 기반 이메일 스크래핑을 생략**하여 비용 절약.

## Output Files

| File | Description |
|------|-------------|
| `apify-ig-hashtag-all.json` | 147,726 raw items (all fields) |
| `apify-ig-hashtag-filtered.json` | 19,063 final filtered (videoPlayCount>=10K, deduped, brands removed) |
| `apify-ig-hashtag-enriched-{CC}.json` | Country-specific enriched data |
| `apify-ig-hashtag-enriched-{CC}.csv` | Country-specific CSV |
| `apify-ig-hashtag-final.csv` | Final CSV (pre-enrichment) |
