# Uncustom - 인플루언서 마케팅 자동화 플랫폼

## 프로젝트 개요
인플루언서를 SNS(Instagram, TikTok, YouTube, Twitter/X)에서 키워드/태그 기반으로 **글로벌 추출**하고, 마스터데이터에서 필터링 후 **캠페인에 선택 배정**하여, 제안서 링크 발송, 이메일 아웃리치, 회신 관리, 콘텐츠 멀티채널 업로드, 성과 추적까지 전 과정을 자동화하는 플랫폼.

Supabase 실시간 동기화로 프론트엔드에 즉시 반영.

## 핵심 프로세스 플로우

```
[글로벌 추출] → [마스터데이터] → [캠페인 배정] → [제안서 링크 생성] → [DM/이메일 아웃리치] → [인박스 관리] → [콘텐츠 업로드] → [성과 추적]
```

### 1. 글로벌 추출 (캠페인 독립)
- **키워드 등록** (`/extract/keywords`): 플랫폼별 키워드 등록 (campaign_id = null)
- **태그 계정 등록** (`/extract/tagged`): 경쟁사/관련 브랜드 계정 등록 (campaign_id = null)
- **추출 실행** (`/extract/run`): 등록된 키워드/태그로 Apify Actor 실행
- 추출된 인플루언서는 **마스터데이터(influencers 테이블)**에 자동 저장

### 2. Instagram 2단계 자동 파이프라인
1. **릴스 스크래퍼** (`apify/instagram-reel-scraper`): 키워드(해시태그)로 릴스 검색 → 인플루언서 username/platform_id/프로필사진 추출
2. **프로필 스크래퍼** (`apify/instagram-profile-scraper`): 자동 트리거되어 팔로워수, 바이오, 이메일, 게시물수, latestPosts 보강
3. **이메일 추출** (선택): 바이오 링크에서 이메일 수집 (`ahmed_jasarevic/linktree-beacons-bio-email-scraper`)

### 3. 마스터데이터 → 캠페인 배정
- `/master` 페이지에서 인플루언서를 **체크박스로 선택**
- 캠페인 드롭다운에서 **원하는 캠페인에 배정**
- `campaign_influencers` 테이블에 N:M 매핑 생성

### 4. 제안서 링크 빌더
- 캠페인별 제안서를 폼으로 작성 → 깔끔한 공개 랜딩페이지 URL 자동 생성
- 인플루언서가 URL을 통해 미션/리워드/제품 확인 후 참여 신청
- DM/이메일 템플릿에 `{{proposal_link}}` 태그로 자동 삽입

### 5. 캠페인별 관리 (글로벌 페이지 + 캠페인 선택 드롭다운)
- 배정된 인플루언서에게 DM/이메일 발송 (개인화 태그 + 제안서 링크)
- 인박스에서 회신 관리
- 콘텐츠 업로드 및 성과 추적

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | **Next.js 16 App Router** + TypeScript |
| UI | **Tailwind CSS v4** + **shadcn/ui** + **next-themes** (Dark/Light/System) |
| Backend/DB | **Supabase** (PostgreSQL + Auth + Realtime + Storage) |
| Scraping | **Apify** REST API (apify-client npm) |
| Auth | **Supabase Auth** (팀 기반, 이메일/비밀번호, RLS 연동) |
| Email | **Resend** + **react-email** (Webhook 추적) |
| State | **Zustand** + Supabase Realtime subscription |
| Rich Text | **Tiptap** (Gmail 호환 HTML 서식) |

## Apify Actor 스택 & 추출 흐름

| 용도 | Actor ID | 입력 |
|------|----------|------|
| IG 릴스 (키워드 추출) | `apify/instagram-reel-scraper` | `{ hashtags: [keyword], resultsLimit }` |
| IG 프로필 (자동 보강) | `apify/instagram-profile-scraper` | `{ usernames: [...] }` |
| IG 태그됨 | `apify/instagram-tagged-scraper` | `{ usernames: [account], resultsLimit }` |
| TikTok | `clockworks/tiktok-scraper` | `{ searchQueries: [keyword], resultsPerPage }` |
| YouTube | `streamers/youtube-scraper` | `{ searchKeywords: keyword, maxResults }` |
| Twitter/X | `apidojo/tweet-scraper` | `{ searchTerms: [keyword], maxItems }` |
| 이메일 추출 (링크) | `ahmed_jasarevic/linktree-beacons-bio-email-scraper-extract-leads` | `{ urls: [...] }` |
| 이메일 추출 (소셜) | `chitosibug3/social-media-email-scraper-2026` | `{ items: [{platform, user_id}] }` |
| 비디오 다운로드 | `easyapi/all-in-one-media-downloader` | `{ urls: [...] }` |
| 콘텐츠 메트릭 | `insiteco/social-insight-scraper` | URL 기반 |

### 중요: Instagram 키워드 추출은 `INSTAGRAM_REEL` 사용
- Reel Scraper는 `hashtags` 입력을 지원하며 릴스 콘텐츠 기반으로 인플루언서 추출
- 릴스가 Instagram의 주력 콘텐츠이므로 퀄리티 높은 인플루언서 확보
- Reel Scraper는 `ownerProfilePicUrl`도 반환 → 프로필사진 즉시 확보
- `PLATFORM_KEYWORD_ACTORS.instagram = APIFY_ACTORS.INSTAGRAM_REEL`

### 자동 보강 (Auto-Enrichment) 플로우
```
릴스 추출 완료 → extract/status API에서 자동 감지
  ├─ campaign_id 있으면: autoTriggerEnrichment(campaignId)
  └─ campaign_id 없으면 (글로벌): autoTriggerGlobalEnrichment()
    → follower_count가 null인 IG 인플루언서 최대 200명 수집
    → Instagram Profile Scraper 자동 실행
    → 팔로워수, 바이오, 이메일, 프로필사진 등 보강
```

### 크로스 플랫폼 이메일 추출 플로우
```
모든 플랫폼 추출 완료 → autoTriggerSocialEmailExtraction() 자동 트리거
  → email이 null인 인플루언서 최대 200명 수집
  → social-media-email-scraper 실행 (platform + user_id 기반)
  → 이메일 발견 시 influencers.email 업데이트 (email_source: "social-scraper:{platform}")
  → Instagram, TikTok, YouTube, Twitter 모두 지원 (웹사이트 스크래핑 불필요)
```

## 프로젝트 구조

```
uncustom/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 루트 레이아웃 (사이드바 포함)
│   │   ├── page.tsx                # 대시보드
│   │   │
│   │   ├── (auth)/                 # 인증 (사이드바 없음)
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   │
│   │   ├── (dashboard)/            # 사이드바 있는 페이지들
│   │   │   ├── extract/            # ★ 글로벌 추출 (캠페인 독립)
│   │   │   │   ├── keywords/       #   키워드 관리 (campaign_id=null)
│   │   │   │   ├── tagged/         #   태그 계정 관리 (campaign_id=null)
│   │   │   │   └── run/            #   추출 실행 & 작업 내역
│   │   │   │
│   │   │   ├── master/page.tsx     # ★ 마스터데이터 (전체 인플루언서)
│   │   │   │
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx        # 캠페인 목록 (CRUD)
│   │   │   │   └── [id]/
│   │   │   │       ├── layout.tsx  # 캠페인명 + 상태 배지
│   │   │   │       └── page.tsx    # 요약 통계 + 바로가기 링크
│   │   │   │
│   │   │   ├── proposals/page.tsx  # ★ 제안서 링크 빌더 (캠페인 선택 required)
│   │   │   ├── templates/page.tsx  # ★ DM/이메일 통합 템플릿 (캠페인 선택 required)
│   │   │   │
│   │   │   ├── email/
│   │   │   │   ├── send/page.tsx   # ★ 이메일 발송 (캠페인 선택 required)
│   │   │   │   └── logs/page.tsx   # ★ 발송 로그 (캠페인 필터)
│   │   │   │
│   │   │   ├── inbox/page.tsx      # ★ 인박스 (캠페인 필터)
│   │   │   ├── manage/page.tsx     # ★ 인플루언서 관리 (캠페인 선택 required)
│   │   │   ├── contents/page.tsx   # ★ 콘텐츠 관리 (캠페인 선택 required)
│   │   │   ├── sns-accounts/page.tsx # ★ SNS 계정 (캠페인 선택 required)
│   │   │   └── metrics/page.tsx    # ★ 성과 추적 (캠페인 필터)
│   │   │
│   │   ├── proposals/
│   │   │   └── p/[slug]/page.tsx   # ★ 공개 랜딩페이지 (인증 불필요)
│   │   │
│   │   └── api/
│   │       ├── extract/
│   │       │   ├── route.ts        # 추출 실행 (campaign_id nullable)
│   │       │   ├── status/route.ts # 상태 폴링 + 자동 enrichment + 결과 저장
│   │       │   ├── enrich/route.ts # 수동 프로필 보강
│   │       │   ├── email/route.ts  # 개별 이메일 추출
│   │       │   └── email-batch/route.ts # 배치 이메일 추출
│   │       ├── proposals/
│   │       │   ├── route.ts        # 제안서 CRUD (GET: 목록, POST: 생성)
│   │       │   ├── [id]/route.ts   # 제안서 상세/수정/삭제/공개
│   │       │   ├── [id]/responses/route.ts # 응답 목록
│   │       │   └── p/[slug]/route.ts # 공개 제안서 조회 + 참여 신청 (public)
│   │       ├── csv/
│   │       │   ├── template/route.ts  # CSV 템플릿 다운로드 (플랫폼별)
│   │       │   ├── import/route.ts    # CSV 가져오기 (파일+플랫폼)
│   │       │   └── export/route.ts    # CSV 내보내기 (필터 적용)
│   │       ├── campaigns/route.ts
│   │       ├── keywords/route.ts
│   │       ├── tagged/route.ts
│   │       ├── influencers/route.ts
│   │       ├── email/
│   │       │   ├── send/route.ts   # Resend 발송
│   │       │   ├── webhook/route.ts# Resend 웹훅 (이벤트 추적)
│   │       │   └── inbound/route.ts# Resend 인바운드 (회신 수신)
│   │       ├── contents/
│   │       │   ├── download/route.ts
│   │       │   └── upload/route.ts
│   │       ├── sns-accounts/route.ts
│   │       └── metrics/route.ts
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 기본 컴포넌트
│   │   ├── layout/                 # sidebar.tsx, theme-toggle.tsx
│   │   ├── campaign-selector.tsx   # ★ 공통 캠페인 선택 드롭다운
│   │   ├── campaigns/              # campaign-card, campaign-form
│   │   ├── influencers/            # influencer-table, filter-panel
│   │   ├── email/                  # template-editor (Tiptap), send-dialog
│   │   ├── templates/              # ★ DM/이메일 템플릿 에디터
│   │   │   ├── phone-mockup.tsx    #   iPhone DM 미리보기 프레임
│   │   │   ├── dm-editor.tsx       #   DM 에디터 + 실시간 미리보기
│   │   │   └── email-editor.tsx    #   이메일 에디터 + 실시간 미리보기
│   │   ├── inbox/                  # thread-list, message-view, compose
│   │   ├── contents/               # content-card, upload-form
│   │   └── sns/                    # account-card, connect-dialog
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # 브라우저 (createBrowserClient)
│   │   │   ├── server.ts           # 서버 (createClient, cookie-based)
│   │   │   ├── admin.ts            # admin (createAdminClient, service_role)
│   │   │   └── middleware.ts       # Auth 미들웨어
│   │   ├── apify/
│   │   │   ├── client.ts           # startActor, getRunStatus, getDatasetItems
│   │   │   ├── actors.ts           # Actor ID 상수, PLATFORM_KEYWORD_ACTORS, getDefaultInput
│   │   │   └── transform.ts        # transformApifyItem (플랫폼별 output→DB 변환)
│   │   ├── resend/
│   │   │   ├── client.ts           # Resend API 클라이언트
│   │   │   └── tracking.ts         # 웹훅 이벤트 처리
│   │   ├── sns-api/                # 플랫폼별 업로드 API (5개)
│   │   └── utils/
│   │       ├── email-extractor.ts  # extractEmailFromBio, extractLinksFromBio
│   │       └── dedup.ts            # 인플루언서 중복 처리
│   │
│   ├── hooks/
│   │   ├── use-realtime.ts         # Supabase Realtime 구독
│   │   ├── use-campaign.ts
│   │   └── use-influencers.ts
│   │
│   ├── stores/                     # Zustand (campaign-store, filter-store)
│   └── types/
│       ├── database.ts             # Supabase 생성 타입 (Relationships 필수)
│       ├── apify.ts
│       └── platform.ts             # PLATFORMS 상수
│
├── supabase/migrations/
│   ├── 001_initial.sql             # 초기 17개 테이블
│   └── 002_proposals_and_templates.sql # 제안서 + 템플릿 확장
└── docs/
    ├── 01-plan/
    └── 02-phase2-refactoring.md    # Phase 2 리팩토링 문서
```

## 데이터베이스 스키마

### 핵심 테이블 (19개)
1. **teams** - 팀 관리
2. **team_members** - 팀 멤버 (Supabase Auth 연동)
3. **campaigns** - 캠페인
4. **keywords** - 키워드 (campaign_id nullable → 글로벌 or 캠페인별)
5. **tagged_accounts** - 태그 계정 (campaign_id nullable)
6. **extraction_jobs** - 추출 작업 (campaign_id nullable, type: keyword/tagged/enrich/email_scrape)
7. **influencers** - 인플루언서 마스터 (UNIQUE(platform, platform_id))
   - username, display_name, profile_url, profile_image_url
   - email, email_source (bio/business/linktree:url/domain:url)
   - bio, follower_count, following_count, post_count, engagement_rate
   - country, language, extracted_keywords[], extracted_from_tags[]
   - raw_data (JSONB - Apify 원본 데이터 전체)
8. **influencer_links** - 바이오 링크 (url, scraped, emails_found[], UNIQUE(influencer_id, url))
9. **campaign_influencers** - 캠페인-인플루언서 N:M (UNIQUE(campaign_id, influencer_id))
10. **email_templates** - N회차 이메일/DM 템플릿
    - type: 'email' | 'dm' (기본: 'email')
    - name: 템플릿 이름
    - dm_body: DM 전용 본문 (plain text + 개인화 태그)
    - proposal_id: 연결 제안서 FK
11. **email_logs** - 발송/열람/클릭/바운스 추적
12. **email_threads** - 인박스 스레드
13. **email_messages** - 스레드 내 메시지 (inbound/outbound)
14. **campaign_sns_accounts** - SNS 계정 (OAuth/API 키)
15. **influencer_contents** - 인플루언서 콘텐츠
16. **multi_channel_uploads** - 멀티채널 리포스팅
17. **content_metrics** - 조회수/좋아요/댓글/공유 추적
18. **proposals** - ★ 제안서 데이터 (캠페인별 제안서 + 공개 URL)
    - slug (UNIQUE): 공개 URL 슬러그
    - title, language, hero_image_url, mission_html, mission_images[]
    - products (JSONB): [{name, description, image_url}]
    - required_tags[], rewards_html
    - collect_instagram, collect_paypal, collect_basic_info, collect_shipping
    - allowed_countries[], cs_channel, cs_account, notice_html
    - status: draft/published/closed
19. **proposal_responses** - ★ 인플루언서 참여 신청
    - influencer_name, instagram_id, email, phone, paypal_email
    - shipping_address (JSONB), message

### campaign_influencers 상태 흐름
`extracted` → `contacted` → `replied` → `confirmed` → `visited` → `uploaded` → `completed`

### extraction_jobs 타입
- `keyword` - 키워드 기반 추출
- `tagged` - 태그 계정 기반 추출
- `enrich` - 프로필 보강 (Instagram Profile Scraper)
- `email_scrape` - 배치 이메일 추출 (바이오 링크 스크래핑)
- `email_social` - 소셜미디어 이메일 추출 (플랫폼+user_id 기반, 모든 플랫폼)

## 사이드바 네비게이션 구조

```
[대시보드]              → /
[캠페인 목록]           → /campaigns
[마스터데이터]          → /master

── 인플루언서 추출 ──
  [키워드]              → /extract/keywords
  [태그됨]              → /extract/tagged
  [추출 실행]           → /extract/run

── 제안서 & 템플릿 ──
  [제안서 링크]         → /proposals        (캠페인 선택 required)
  [DM/이메일 템플릿]    → /templates        (캠페인 선택 required)

── 이메일 ──
  [발송]                → /email/send       (캠페인 선택 required)
  [발송 로그]           → /email/logs       (캠페인 필터)

── 소통 ──
  [인박스]              → /inbox            (캠페인 필터)

── 관리 ──
  [인플루언서 관리]      → /manage           (캠페인 선택 required)
  [콘텐츠]              → /contents         (캠페인 선택 required)
  [SNS 계정]            → /sns-accounts     (캠페인 선택 required)
  [성과]                → /metrics          (캠페인 필터)
```

### 캠페인 모드
- **required**: 캠페인 선택 필수. 미선택 시 안내 메시지 표시.
- **filter**: "전체 캠페인" 옵션 포함. 전체 선택 시 모든 캠페인 데이터 통합 표시.

### 캠페인 선택 컴포넌트
- `<CampaignSelector mode="filter|required" value={...} onChange={...} />`
- URL `?campaign=<id>` 자동 동기화 (새로고침 시 유지)
- 팀 캠페인 목록 자동 fetch

## 제안서 시스템

### 제안서 빌더 (`/proposals`)
- 좌측: 폼 입력 (제목, 언어, 히어로 이미지, 미션(Tiptap), 제품, 리워드, 필수태그, 수집항목, CS채널, 공지)
- 우측: 실시간 미리보기 (공개 랜딩페이지와 동일 레이아웃)
- 저장 후 "게시" → slug 기반 공개 URL 자동 생성

### 공개 랜딩페이지 (`/proposals/p/[slug]`)
- 인증 불필요 (public route)
- 히어로 이미지, 미션, 제품, 리워드, 필수태그 표시
- 하단 참여 신청 폼 (collect_* 설정에 따라 필드 동적 표시)
- 제출 시 `proposal_responses` 테이블에 저장
- 모바일 반응형 필수

### 제안서 API
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/proposals?campaign_id=xxx | 캠페인별 제안서 목록 |
| POST | /api/proposals | 제안서 생성 |
| GET | /api/proposals/[id] | 제안서 상세 |
| PUT | /api/proposals/[id] | 제안서 수정 |
| PATCH | /api/proposals/[id] | 제안서 공개 |
| DELETE | /api/proposals/[id] | 제안서 삭제 |
| GET | /api/proposals/p/[slug] | 공개 제안서 (public) |
| POST | /api/proposals/p/[slug] | 참여 신청 (public) |
| GET | /api/proposals/[id]/responses | 응답 목록 |

## DM/이메일 템플릿 시스템

### DM 템플릿 에디터
- 좌측: textarea + `{} 개인화 태그 넣기` 드롭다운
- 우측: **iPhone 목업 실시간 미리보기** (DM 대화 풍선 스타일)
- 태그 → 샘플 데이터 치환 (예: `{{name}}` → "김인플")

### 이메일 템플릿 에디터
- 좌측: 메일 제목 + Tiptap 리치에디터 + `{} 태그` + `제안서 링크 넣기` 버튼
- 우측: **이메일 실시간 미리보기** (From/To/Subject 헤더 + HTML 본문)
- 다크모드 토글 지원

### 개인화 태그 시스템
| 태그 | 설명 | 사용처 |
|------|------|--------|
| `{{name}}` | 인플루언서 display_name | DM, 이메일 |
| `{{username}}` | 인플루언서 username | DM, 이메일 |
| `{{email}}` | 인플루언서 이메일 | 이메일 |
| `{{platform}}` | 플랫폼명 | 이메일 |
| `{{follower_count}}` | 팔로워 수 | 이메일 |
| `{{campaign_name}}` | 캠페인명 | DM, 이메일 |
| `{{sender_name}}` | 보내는 사람 이름 | 이메일 |
| `{{proposal_link}}` | 제안서 공개 URL | DM, 이메일 |

## 코딩 컨벤션

### TypeScript
- `types/database.ts`에서 Supabase 생성 타입 사용
- `Relationships: []` 필수 (없으면 Insert/Update가 never로 풀림)
- `.select("*")` 결과는 반드시 캐스팅: `(data as TypeName[]) ?? []`
- Join 쿼리: `as unknown as TypeName` 패턴

### React / Next.js
- App Router (pages/ 사용 금지)
- 서버 컴포넌트 기본, 'use client'는 필요 시에만
- API Route + fetch 패턴 (서버 액션 사용 안 함)

### Supabase 클라이언트
- 브라우저: `createClient()` from `@/lib/supabase/client`
- 서버/API: `createClient()` from `@/lib/supabase/server` (cookie-based)
- 웹훅/admin: `createAdminClient()` from `@/lib/supabase/admin` (service_role)

### UI & 테마
- shadcn/ui + Tailwind CSS v4 + next-themes (Dark/Light/System)
- Purple accent OKLCH 색상 체계 (`globals.css`)
- 시멘틱 변수: `bg-card`, `text-foreground`, `bg-muted`, `bg-primary`
- 하드코딩 금지: `bg-gray-50` → `bg-muted/50`

### Auth 패턴
- Signup: API route (`/api/teams`) + admin client (RLS 우회)
- Login: 클라이언트 `supabase.auth.signInWithPassword`
- Middleware: 미인증 → `/login` 리다이렉트
- Public paths: `/login`, `/signup`, `/api/auth/callback`, `/api/email/webhook`, `/api/email/inbound`, `/proposals/p/`, `/api/proposals/p/`

### Realtime
- `useRealtime` hook: Supabase Realtime 채널 구독
- 필터: `column=eq.value` 형식

### 추출 자동 폴링
- 5초 간격 `setInterval` + `useRef`로 job ID 추적
- `extract/status` API 호출 → Apify run 상태 확인
- 완료 시 자동 결과 저장 + enrichment 트리거

## 환경변수 (.env.local)

| 변수 | 용도 | 위치 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | 클라이언트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | admin 작업 | 서버 전용 |
| `APIFY_API_TOKEN` | Apify API | 서버 전용 |
| `RESEND_API_KEY` | 이메일 발송 | 서버 전용 |

## 빌드 & 실행

```bash
npx next dev --turbopack    # 개발 서버
npx next build              # 프로덕션 빌드 (40+ routes)
npm run start               # 프로덕션 서버
npm run lint                # ESLint
```
