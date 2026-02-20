# Uncustom - 인플루언서 마케팅 자동화 플랫폼 개발 계획

## Context

인플루언서를 SNS(Instagram, TikTok, YouTube, Twitter/X, Threads)에서 키워드/태그 기반으로 추출하고, 캠페인별 이메일 아웃리치, 회신 관리, 콘텐츠 멀티채널 업로드, 성과 추적까지 전 과정을 자동화하는 플랫폼. 모든 기능은 **캠페인 단위**로 분리 관리되며, Supabase 실시간 동기화로 프론트엔드에 즉시 반영됨.

---

## 기술 스택

| 레이어 | 기술 | 이유 |
|--------|------|------|
| Frontend | **Next.js 15 App Router** + TypeScript | NEXT_PUBLIC 환경변수 사용, SSR/RSC 지원 |
| UI | **Tailwind CSS** + **shadcn/ui** | 빠른 UI 개발, 일관된 디자인 시스템 |
| Backend/DB | **Supabase** (PostgreSQL + Auth + Realtime + Storage) | 실시간 WebSocket, RLS, Edge Functions |
| Scraping | **Apify** REST API | 플랫폼별 최적 Actor 활용 |
| Auth | **Supabase Auth** | 팀 사용, 이메일/비밀번호 로그인, RLS 연동 |
| Email | **Resend** + **react-email** | 개발자 친화적, React JSX 템플릿, Webhook 추적 |
| Video Download | **Apify Actor** (`easyapi/all-in-one-media-downloader`) | 멀티플랫폼 지원 |
| Content Upload | 플랫폼별 공식 API | Instagram Graph, YouTube Data, TikTok, X, Threads |
| State Management | **Zustand** + Supabase Realtime subscription | 경량, 실시간 동기화 |
| Rich Text Editor | **Tiptap** | Gmail 호환 HTML 서식 지원 |

---

## Apify Actor 스택

| 용도 | Actor ID | 비용 |
|------|----------|------|
| IG 릴스 | `apify/instagram-reel-scraper` | $2.60/1K |
| IG 해시태그 | `apify/instagram-hashtag-scraper` | PPR |
| IG 프로필 | `apify/instagram-profile-scraper` | PPR |
| IG 태그됨 | `apify/instagram-tagged-scraper` | ~$2.70/1K |
| TikTok | `clockworks/tiktok-scraper` | $0.30/1K |
| YouTube | `streamers/youtube-scraper` | $0.50/1K |
| Twitter/X | `apidojo/tweet-scraper` | $0.40/1K |
| 비디오 다운로드 | `easyapi/all-in-one-media-downloader` | Varies |
| 이메일 추출 (Linktree) | `ahmed_jasarevic/linktree-beacons-bio-email-scraper-extract-leads` | Varies |
| 콘텐츠 메트릭 | `insiteco/social-insight-scraper` | Varies |

---

## 데이터베이스 스키마 (Supabase PostgreSQL)

### 핵심 테이블

```sql
-- 0. 팀 & 사용자 (Supabase Auth 연동)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, admin, member
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 1. 캠페인
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- active, paused, completed
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 키워드 등록
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  platform TEXT NOT NULL, -- instagram, tiktok, youtube, twitter
  country TEXT, -- KR, US, JP 등
  estimated_count INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, keyword, platform)
);

-- 3. 태그됨 (경쟁사 계정) 등록
CREATE TABLE tagged_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  account_username TEXT NOT NULL,
  platform TEXT NOT NULL,
  estimated_count INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, account_username, platform)
);

-- 4. 추출 작업
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- keyword, tagged
  source_id UUID, -- keyword_id 또는 tagged_account_id
  platform TEXT NOT NULL,
  apify_run_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  input_config JSONB,
  total_extracted INT DEFAULT 0,
  new_extracted INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 인플루언서 마스터 테이블 (플랫폼 통합)
CREATE TABLE influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_id TEXT,
  username TEXT,
  display_name TEXT,
  profile_url TEXT,
  profile_image_url TEXT,
  email TEXT,
  email_source TEXT, -- bio, linktree, website, manual
  bio TEXT,
  follower_count INT,
  following_count INT,
  post_count INT,
  engagement_rate DECIMAL,
  country TEXT,
  language TEXT,
  extracted_keywords TEXT[],
  extracted_from_tags TEXT[],
  raw_data JSONB,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, platform_id)
);

-- 6. 인플루언서 링크 (bio 내 linktree 등)
CREATE TABLE influencer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scraped BOOLEAN DEFAULT false,
  emails_found TEXT[],
  scraped_at TIMESTAMPTZ
);

-- 7. 캠페인-인플루언서 매핑 (N:M)
CREATE TABLE campaign_influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'extracted',
  agreed_date DATE,
  visit_date DATE,
  upload_deadline DATE,
  actual_upload_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);

-- 8. 이메일 템플릿
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  round_number INT DEFAULT 1,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. 이메일 발송 로그
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  round_number INT DEFAULT 1,
  resend_message_id TEXT,
  status TEXT DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  cta_clicked BOOLEAN DEFAULT false,
  cta_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 이메일 스레드 (인박스)
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  unread BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);

-- 11. 이메일 메시지 (스레드 내 개별 메시지)
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  resend_message_id TEXT,
  received_at TIMESTAMPTZ DEFAULT now()
);

-- 12. 캠페인 SNS 계정 관리
CREATE TABLE campaign_sns_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_name TEXT,
  account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  api_key TEXT,
  api_secret TEXT,
  extra_config JSONB,
  connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, platform)
);

-- 13. 인플루언서 콘텐츠 (업로드된)
CREATE TABLE influencer_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  original_platform TEXT NOT NULL,
  original_url TEXT NOT NULL,
  original_content_id TEXT,
  video_storage_path TEXT,
  video_downloaded BOOLEAN DEFAULT false,
  caption TEXT,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. 멀티채널 업로드 (리포스팅)
CREATE TABLE multi_channel_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES influencer_contents(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  target_platform TEXT NOT NULL,
  sns_account_id UUID REFERENCES campaign_sns_accounts(id),
  caption TEXT,
  title TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'pending',
  platform_post_id TEXT,
  platform_post_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. 콘텐츠 메트릭 추적
CREATE TABLE content_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES multi_channel_uploads(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  engagement_rate DECIMAL,
  tracked_at TIMESTAMPTZ DEFAULT now()
);
```

### 인덱스

```sql
CREATE INDEX idx_influencers_platform ON influencers(platform);
CREATE INDEX idx_influencers_email ON influencers(email);
CREATE INDEX idx_influencers_follower ON influencers(follower_count);
CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_campaign_influencers_status ON campaign_influencers(status);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_email_threads_campaign ON email_threads(campaign_id);
CREATE INDEX idx_content_metrics_upload ON content_metrics(upload_id);
```

---

## 프로젝트 디렉토리 구조

```
uncustom/
├── .env.local
├── .gitignore
├── CLAUDE.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── public/
│   └── icons/
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── campaigns/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── keywords/page.tsx
│   │   │       ├── tagged/page.tsx
│   │   │       ├── extract/page.tsx
│   │   │       ├── influencers/page.tsx
│   │   │       ├── email/
│   │   │       │   ├── templates/page.tsx
│   │   │       │   ├── send/page.tsx
│   │   │       │   └── logs/page.tsx
│   │   │       ├── inbox/page.tsx
│   │   │       ├── manage/page.tsx
│   │   │       ├── contents/page.tsx
│   │   │       ├── sns-accounts/page.tsx
│   │   │       └── metrics/page.tsx
│   │   ├── extract/                  # 마스터 레벨 추출 (B안)
│   │   │   ├── keywords/page.tsx     # 글로벌 키워드 관리
│   │   │   ├── tagged/page.tsx       # 글로벌 태그됨 관리
│   │   │   └── run/page.tsx          # 마스터 추출 실행
│   │   ├── master/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── campaigns/route.ts
│   │       ├── keywords/route.ts
│   │       ├── tagged/route.ts
│   │       ├── extract/
│   │       │   ├── route.ts
│   │       │   └── status/route.ts
│   │       ├── influencers/
│   │       │   ├── route.ts
│   │       │   └── refresh/route.ts
│   │       ├── auth/
│   │       │   └── callback/route.ts
│   │       ├── email/
│   │       │   ├── send/route.ts
│   │       │   ├── webhook/route.ts
│   │       │   └── inbound/route.ts
│   │       ├── contents/
│   │       │   ├── download/route.ts
│   │       │   └── upload/route.ts
│   │       ├── sns-accounts/route.ts
│   │       └── metrics/route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── header.tsx
│   │   ├── campaigns/
│   │   ├── keywords/
│   │   ├── influencers/
│   │   ├── email/
│   │   ├── inbox/
│   │   ├── contents/
│   │   └── sns/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # 브라우저 클라이언트
│   │   │   ├── server.ts         # 서버 클라이언트 (cookie)
│   │   │   ├── admin.ts          # service_role 클라이언트
│   │   │   └── middleware.ts     # Auth 미들웨어
│   │   ├── apify/
│   │   │   ├── client.ts         # Apify SDK 클라이언트
│   │   │   ├── actors.ts         # Actor ID 상수 & 입력 스키마
│   │   │   └── transform.ts     # Apify output → 인플루언서 변환 ✅
│   │   ├── resend/
│   │   │   ├── client.ts         # Resend SDK 클라이언트
│   │   │   └── tracking.ts      # 웹훅 이벤트 처리 & CTA 감지 ✅
│   │   ├── sns-api/              # 플랫폼별 콘텐츠 업로드 API ✅
│   │   │   ├── instagram.ts     # Instagram Graph API (Reels)
│   │   │   ├── youtube.ts       # YouTube Data API v3
│   │   │   ├── tiktok.ts        # TikTok Content Posting API
│   │   │   ├── twitter.ts       # X API v2 (chunked upload)
│   │   │   └── threads.ts       # Threads API (Meta Graph)
│   │   ├── utils/                # 공통 유틸리티 ✅
│   │   │   ├── email-extractor.ts # 이메일/링크 추출 정규식
│   │   │   └── dedup.ts          # N회차 중복 발송 필터링
│   │   └── utils.ts              # cn() 유틸리티
│   │
│   ├── hooks/
│   │   ├── use-realtime.ts
│   │   ├── use-campaign.ts
│   │   └── use-influencers.ts
│   │
│   ├── stores/
│   │   ├── campaign-store.ts
│   │   └── filter-store.ts
│   │
│   └── types/
│       ├── database.ts
│       ├── apify.ts
│       └── platform.ts
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
│
└── docs/
    └── 01-plan/
        └── features/
            └── uncustom-platform.plan.md
```

---

## 구현 단계 (총 8단계)

### Phase 1: 프로젝트 초기화 & 인프라 (1단계)
- [x] Next.js 15 프로젝트 생성 (TypeScript, Tailwind, App Router)
- [x] shadcn/ui 설치 및 기본 컴포넌트 추가
- [x] `.env.local` 파일 생성
- [x] `.gitignore` 설정
- [x] `CLAUDE.md` 생성
- [x] Supabase 클라이언트 설정
- [x] Supabase Auth 설정 (로그인/회원가입/미들웨어)
- [x] Apify 클라이언트 설정
- [x] Resend 클라이언트 설정
- [x] Git 초기화 및 첫 커밋

### Phase 2: DB 스키마 & 기본 레이아웃 (2단계) ✅
- [x] Supabase에 전체 테이블 생성 (17 tables)
- [x] RLS 정책 설정 (22 RLS policies, 팀 기반 접근 제어)
- [x] 팀 관리 기능 (팀 생성, 멤버 관리)
- [x] 사이드바 레이아웃 구현 (동적 캠페인 목록)
- [x] 캠페인 CRUD 페이지
- [x] 대시보드 기본 UI (실시간 통계)

### Phase 3: 키워드/태그 관리 & 인플루언서 추출 (3단계) ✅
- [x] 키워드 등록/관리 UI + API
- [x] 태그됨 계정 등록/관리 UI + API
- [x] 예상 인플루언서 수 표시 (Apify estimation)
- [x] 인플루언서 추출 실행 (Apify Actor 호출)
- [x] Apify input 파라미터 설정 UI (limit, actor override)
- [x] 추출 진행 상태 실시간 표시 (5초 auto-polling)
- [x] 중복 감지 및 처리 로직
- [x] Linktree/bio 링크 이메일 추출

### Phase 4: 인플루언서 데이터 관리 (4단계) ✅
- [x] 플랫폼별 상세 뷰 (Instagram, TikTok, YouTube, Twitter 필드)
- [x] 마스터 통합 테이블 뷰 (범용 필드 통합)
- [x] 프로필 사진, 주요 메트릭 표시
- [x] 정밀 필터링 패널 (팔로워, 플랫폼, 국가, 키워드 등)
- [x] 인플루언서 데이터 최신화 기능
- [x] 이메일 소스 표시 (bio, linktree, manual 뱃지)
- [x] 테이블/카드 뷰 토글

### Phase 5: 이메일 캠페인 시스템 (5단계) ✅
- [x] Resend API 연동
- [x] react-email 이메일 템플릿
- [x] Tiptap 에디터 이메일 작성 (Gmail 호환 HTML 서식)
- [x] N회차 템플릿 관리
- [x] 필터링된 인플루언서 선택 → 발송
- [x] 발송 로그 추적 (sent/delivered/opened/clicked/bounced)
- [x] Resend Webhook 수신
- [x] CTA 클릭 추적 (LINE, WhatsApp 링크)
- [x] N회차 자동 발송 관리 (미읽음/미회신 필터)

### Phase 6: 인박스 & 회신 관리 (6단계) ✅
- [x] Resend Inbound Email 설정
- [x] 수신 이메일 본문 조회
- [x] 스레드 기반 인박스 UI (채팅방 스타일)
- [x] 캠페인별 필터링 + 태그
- [x] 답장 작성 (Tiptap HTML 서식, 제목 + 본문)
- [x] 실시간 새 메시지 알림 (Supabase Realtime, dual subscription)

### Phase 7: 최종 인플루언서 관리 & 콘텐츠 (7단계) ✅
- [x] 캠페인별 협업 인플루언서 관리 (상태 파이프라인)
- [x] 일정 관리 (협업일, 방문일, 업로드일)
- [x] 비디오 다운로드 (Apify Actor)
- [x] Supabase Storage 비디오 저장
- [x] 멀티채널 업로드 (YouTube, Instagram, TikTok, Threads, Twitter)
- [x] 플랫폼별 캡션/제목 자동 생성
- [x] SNS 계정 관리 (CRUD, 편집/삭제)

### Phase 8: 성과 추적 & 최적화 (8단계) ✅
- [x] 콘텐츠 메트릭 추적 (Apify social insight)
- [x] 대시보드 (뷰, 좋아요, 댓글, 공유 통계)
- [x] 플랫폼별 성과 분석 카드
- [x] 콘텐츠별 비교 차트 (CSS 바 차트)
- [x] 플랫폼 필터링

### Phase 9: UI/UX 오버홀 & 테마 시스템 ✅
- [x] Dark/Light 테마 시스템 구축 (next-themes)
- [x] Purple accent OKLCH 색상 체계 (light + dark)
- [x] ThemeToggle 컴포넌트 (Sun/Moon/Monitor 3-way)
- [x] 사이드바 리디자인 (브랜딩 로고, 활성 상태 표시)
- [x] 헤더 강화 (테마 토글, 알림, 사용자 아바타)
- [x] Auth 페이지 오버홀 (로그인/회원가입 테마 지원)
- [x] 전체 20+ 페이지 테마 호환 클래스 적용
- [x] CSS 변수 기반 시멘틱 컬러 (bg-card, text-foreground 등)
- [x] 인플루언서 테이블/카드 뷰 토글

### Phase 10: 코드 아키텍처 정리 & SNS API 통합 ✅
- [x] SNS 플랫폼별 업로드 API 클라이언트 구현 (5개 파일)
  - Instagram Graph API (Reels, container-based publish)
  - YouTube Data API v3 (resumable upload)
  - TikTok Content Posting API v2 (direct post)
  - X/Twitter API v2 (chunked media upload + tweet)
  - Threads API (Meta Graph, container-based publish)
- [x] contents/upload 라우트 실제 플랫폼 업로드 연동
- [x] contents/download 라우트 비동기 완전 처리
  - Apify 실행 → 폴링 대기 → 파일 회수 → Supabase Storage 저장
- [x] 유틸리티 모듈 분리 (인라인 → 재사용 모듈)
  - `lib/apify/transform.ts` - Apify output 변환
  - `lib/resend/tracking.ts` - 웹훅 이벤트 처리
  - `lib/utils/email-extractor.ts` - 이메일/링크 추출
  - `lib/utils/dedup.ts` - 중복 발송 필터링
- [x] 기존 라우트 핸들러에서 유틸 모듈 import 적용

### Phase 11: B안 마스터 추출 & Apify 스키마 검증 ✅
- [x] 마스터 레벨 추출 (캠페인 독립) 구현
  - `/extract/keywords` - 글로벌 키워드 관리 (campaign_id null)
  - `/extract/tagged` - 글로벌 태그됨 계정 관리
  - `/extract/run` - 마스터 레벨 추출 실행 (모든 키워드/태그 통합)
- [x] 사이드바에 "인플루언서 추출" 섹션 추가
- [x] campaign_id nullable 처리 (keywords, tagged_accounts, extraction_jobs)
- [x] Apify output 스키마 실제 검증 (5개 Actor 문서 확인)
  - Instagram reel scraper: `ownerProfilePicUrl`, `ownerUsername`, `likesCount`
  - TikTok scraper: nested `authorMeta.*` (name, fans, avatar)
  - YouTube scraper: `numberOfSubscribers`, `channelName`, `details`
  - Twitter scraper: nested `author.*` (userName, name, profilePicture)
- [x] transform.ts 플랫폼별 변환 함수 분리 및 수정
- [x] 플랫폼별 인플루언서 뷰 필드 매핑 수정
- [x] Tagged 추출 비Instagram 경고 UI 추가

### Phase 12: 프로덕션 안정화 & 갭 수정 ✅
- [x] Apify `actor.call()` → `actor.start()` 전환 (서버리스 타임아웃 방지)
- [x] contents/download 라우트 비동기 시작 + 프론트엔드 폴링 패턴
- [x] metrics 라우트 비동기 시작 + PUT 상태 확인 엔드포인트
- [x] 답장 모드 발신자 정보 캠페인 템플릿 기반 동적 설정
- [x] Resend webhook 서명 검증 (svix 헤더, 타임스탬프 replay 방지)
- [x] CampaignForm 에러 토스트 표시 (console.error → toast.error)
- [x] influencers/refresh 비동기 시작 + 비Instagram 경고 메시지 반환
- [x] 프론트엔드 다운로드/메트릭 폴링 핸들러 구현

---

## 환경변수 (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
DATABASE_URL=

# Apify
APIFY_API_TOKEN=

# Resend
RESEND_API_KEY=
```

---

## 주요 패키지 의존성

```json
{
  "dependencies": {
    "next": "^15",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.5",
    "apify-client": "^2",
    "resend": "^4",
    "@react-email/components": "^0.0.25",
    "zustand": "^5",
    "@tiptap/react": "^2",
    "@tiptap/starter-kit": "^2",
    "lucide-react": "latest",
    "tailwindcss": "^4",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "date-fns": "^4"
  }
}
```

---

## Resend API 세부 사항

### 발송
- `POST /emails` - 개별 이메일 발송
- `POST /emails/batch` - 대량 발송 (최대 100개/요청)
- HTML 본문 또는 React 컴포넌트로 이메일 작성

### 추적 (Webhook Events)
- `email.sent` - 발송 완료
- `email.delivered` - 전달 완료
- `email.opened` - 열람 (오픈 추적 픽셀)
- `email.clicked` - 링크 클릭
- `email.bounced` - 바운스
- `email.complained` - 스팸 신고

### 인바운드 (회신 수신)
- Webhook `email.received` → 메타데이터만 포함
- `GET /emails/{id}` API 호출로 전체 본문 조회 필요
- 도메인 설정 필요 (MX 레코드)

### 제한 사항
- 무료: 100 이메일/일, 1 도메인
- Pro: $20/월, 50,000 이메일/월

---

## 검증 방법

1. **인증**: 로그인/회원가입 후 팀 생성, 팀원 초대까지 확인
2. **DB 스키마**: Supabase SQL Editor에서 직접 실행 후 테이블 확인
3. **RLS**: 다른 팀 데이터 접근 불가 확인
4. **API 연동**: Apify Actor 테스트 실행으로 Instagram 키워드 추출 확인
5. **실시간 동기화**: Supabase Realtime 구독 후 데이터 변경 시 UI 업데이트 확인
6. **이메일 발송**: Resend 테스트 모드로 발송/추적 확인
7. **E2E 흐름**: 키워드 등록 → 추출 → 필터링 → 이메일 발송 → 회신 수신 전체 흐름 테스트
