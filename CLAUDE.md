# Uncustom - 인플루언서 마케팅 자동화 플랫폼

## 프로젝트 개요
인플루언서를 SNS(Instagram, TikTok, YouTube, Twitter/X, Threads)에서 키워드/태그 기반으로 추출하고, 캠페인별 이메일 아웃리치, 회신 관리, 콘텐츠 멀티채널 업로드, 성과 추적까지 전 과정을 자동화하는 플랫폼.

모든 기능은 **캠페인 단위**로 분리 관리되며, Supabase 실시간 동기화로 프론트엔드에 즉시 반영.

## 기술 스택

| 레이어 | 기술 | 이유 |
|--------|------|------|
| Frontend | **Next.js 15 App Router** + TypeScript | SSR/RSC, NEXT_PUBLIC 환경변수 |
| UI | **Tailwind CSS** + **shadcn/ui** | 빠른 UI 개발, 일관된 디자인 시스템 |
| Backend/DB | **Supabase** (PostgreSQL + Auth + Realtime + Storage) | 실시간 WebSocket, RLS, Edge Functions |
| Scraping | **Apify** REST API | 플랫폼별 최적 Actor 활용 |
| Auth | **Supabase Auth** | 팀 사용, 이메일/비밀번호 로그인, RLS 연동 |
| Email | **Resend** + **react-email** | React JSX 템플릿, Webhook 추적 |
| Video Download | **Apify Actor** (`easyapi/all-in-one-media-downloader`) | 멀티플랫폼 지원 |
| Content Upload | 플랫폼별 공식 API | Instagram Graph, YouTube Data, TikTok, X, Threads |
| State Management | **Zustand** + Supabase Realtime subscription | 경량, 실시간 동기화 |
| Rich Text Editor | **Tiptap** | Gmail 호환 HTML 서식 지원 |

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
| 이메일 추출 | `ahmed_jasarevic/linktree-beacons-bio-email-scraper-extract-leads` | Varies |
| 콘텐츠 메트릭 | `insiteco/social-insight-scraper` | Varies |

## 프로젝트 구조

```
uncustom/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # 루트 레이아웃 (사이드바 포함)
│   │   ├── page.tsx              # 대시보드
│   │   ├── (auth)/               # 인증 (로그인/회원가입)
│   │   ├── campaigns/            # 캠페인 관리
│   │   │   ├── page.tsx          # 캠페인 목록
│   │   │   └── [id]/             # 캠페인 상세
│   │   │       ├── page.tsx          # 캠페인 대시보드
│   │   │       ├── keywords/         # 키워드 관리
│   │   │       ├── tagged/           # 태그됨 관리
│   │   │       ├── extract/          # 인플루언서 추출
│   │   │       ├── influencers/      # 추출된 인플루언서
│   │   │       ├── email/            # 이메일 (템플릿/발송/로그)
│   │   │       ├── inbox/            # 인박스 (채팅 UI)
│   │   │       ├── manage/           # 최종 인플루언서 관리
│   │   │       ├── contents/         # 콘텐츠 관리/업로드
│   │   │       ├── sns-accounts/     # SNS 계정 관리
│   │   │       └── metrics/          # 성과 추적
│   │   ├── master/               # 전체 마스터데이터 (캠페인 통합)
│   │   └── api/                  # API Route Handlers
│   │       ├── campaigns/
│   │       ├── keywords/
│   │       ├── tagged/
│   │       ├── extract/
│   │       ├── influencers/
│   │       ├── auth/callback/
│   │       ├── email/            # send, webhook, inbound
│   │       ├── contents/         # download, upload
│   │       ├── sns-accounts/
│   │       └── metrics/
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui 컴포넌트
│   │   ├── layout/               # sidebar, header
│   │   ├── campaigns/            # campaign-card, campaign-form
│   │   ├── keywords/             # keyword-table, keyword-form
│   │   ├── influencers/          # influencer-table, filter-panel, etc.
│   │   ├── email/                # template-editor, send-dialog, log-table
│   │   ├── inbox/                # thread-list, message-view, compose
│   │   ├── contents/             # content-card, upload-form, metrics-chart
│   │   └── sns/                  # account-card, connect-dialog
│   │
│   ├── lib/
│   │   ├── supabase/             # client.ts, server.ts, admin.ts, middleware.ts
│   │   ├── apify/                # client.ts, actors.ts, transform.ts
│   │   ├── resend/               # client.ts, tracking.ts
│   │   ├── sns-api/              # instagram.ts, youtube.ts, tiktok.ts, twitter.ts, threads.ts
│   │   └── utils/                # email-extractor.ts, dedup.ts
│   │
│   ├── hooks/                    # use-realtime.ts, use-campaign.ts, use-influencers.ts
│   ├── stores/                   # campaign-store.ts, filter-store.ts (Zustand)
│   └── types/                    # database.ts, apify.ts, platform.ts
│
├── supabase/
│   └── migrations/               # SQL 마이그레이션 파일
│
└── docs/
    └── 01-plan/                  # 개발 계획 문서
```

## 데이터베이스 스키마 요약

### 핵심 테이블 (15개)
1. **teams** - 팀 관리
2. **team_members** - 팀 멤버 (Supabase Auth 연동)
3. **campaigns** - 캠페인 (모든 기능의 기본 단위)
4. **keywords** - 키워드 등록 (캠페인별)
5. **tagged_accounts** - 태그됨 경쟁사 계정
6. **extraction_jobs** - 추출 작업 (Apify 연동)
7. **influencers** - 인플루언서 마스터 (플랫폼 통합, UNIQUE(platform, platform_id))
8. **influencer_links** - 인플루언서 bio 링크
9. **campaign_influencers** - 캠페인-인플루언서 N:M 매핑 (상태 관리)
10. **email_templates** - 이메일 템플릿 (N회차)
11. **email_logs** - 이메일 발송 로그 (추적)
12. **email_threads** - 이메일 스레드 (인박스)
13. **email_messages** - 이메일 메시지 (스레드 내 개별 메시지)
14. **campaign_sns_accounts** - 캠페인 SNS 계정 관리
15. **influencer_contents** - 인플루언서 콘텐츠
16. **multi_channel_uploads** - 멀티채널 업로드 (리포스팅)
17. **content_metrics** - 콘텐츠 메트릭 추적

### campaign_influencers 상태 흐름
`extracted` → `contacted` → `replied` → `confirmed` → `visited` → `uploaded` → `completed`

## 코딩 컨벤션

### TypeScript
- 모든 파일 TypeScript 사용
- `types/database.ts`에서 Supabase 생성 타입 사용
- `any` 타입 사용 금지, 최소한 `unknown` 사용

### React / Next.js
- App Router 사용 (pages/ 사용 금지)
- 서버 컴포넌트가 기본, 'use client'는 필요 시에만
- API Route는 `src/app/api/` 아래에 `route.ts`로 생성
- 서버 액션 대신 API Route + fetch 패턴 사용

### Supabase
- 브라우저: `lib/supabase/client.ts` → `createBrowserClient()`
- 서버 컴포넌트/API Route: `lib/supabase/server.ts` → `createServerClient()`
- 서버 전용 (admin 작업): `lib/supabase/admin.ts` → `createAdminClient()`
- RLS 정책은 team_id 기반으로 접근 제어

### UI
- shadcn/ui 컴포넌트를 기본으로 사용
- Tailwind CSS 유틸리티 클래스 사용
- `cn()` 유틸리티 함수로 클래스 결합

### 상태 관리
- 글로벌 상태: Zustand store (src/stores/)
- 서버 상태: Supabase Realtime subscription (src/hooks/)
- 컴포넌트 로컬 상태: useState/useReducer

### 파일 네이밍
- 컴포넌트: kebab-case (campaign-card.tsx)
- 유틸리티: kebab-case (email-extractor.ts)
- 타입: kebab-case (database.ts)
- API: route.ts (Next.js 규약)

## 환경변수

모든 키와 토큰은 `.env.local`에 저장. `.env*`는 `.gitignore`에 포함.

- `NEXT_PUBLIC_*` 접두사가 있는 변수만 클라이언트에 노출
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 (admin 작업)
- `APIFY_API_TOKEN`은 서버 전용 (API Route에서만 사용)
- `RESEND_API_KEY`는 서버 전용

## API 통합 참고

### Apify
- REST API 사용: `https://api.apify.com/v2/`
- Actor 실행: `POST /acts/{actorId}/runs`
- 결과 조회: `GET /datasets/{datasetId}/items`
- apify-client npm 패키지 사용 가능

### Resend
- 발송: `POST /emails` (개별), `POST /emails/batch` (대량, 최대 100/요청)
- Webhook: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
- Inbound: `email.received` → `GET /emails/{id}`로 본문 조회
- 무료 100 이메일/일, 1 도메인

### SNS Upload APIs
- Instagram Graph API: 사진/릴스 업로드
- YouTube Data API v3: 동영상 업로드
- TikTok Content Posting API
- X API v2: 트윗/미디어 업로드
- Threads API: 텍스트/미디어 게시

## 구현 단계 (총 8단계)

### Phase 1: 프로젝트 초기화 & 인프라 ✅
### Phase 2: DB 스키마 & 기본 레이아웃
### Phase 3: 키워드/태그 관리 & 인플루언서 추출
### Phase 4: 인플루언서 데이터 관리
### Phase 5: 이메일 캠페인 시스템
### Phase 6: 인박스 & 회신 관리
### Phase 7: 최종 인플루언서 관리 & 콘텐츠
### Phase 8: 성과 추적 & 최적화

## 빌드 & 실행

```bash
npm run dev    # 개발 서버 (http://localhost:3000)
npm run build  # 프로덕션 빌드
npm run start  # 프로덕션 서버
npm run lint   # ESLint 실행
```
