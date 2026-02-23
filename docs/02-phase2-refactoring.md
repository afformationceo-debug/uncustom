# Phase 2: 전체 구조 리팩토링 + 제안서/템플릿 시스템

## 변경 개요

### 핵심 변경사항
1. **글로벌 페이지 전환**: 모든 기능이 `/campaigns/[id]/` 하위에서 최상위 글로벌 페이지로 이동
2. **캠페인 선택 드롭다운**: 각 페이지에서 캠페인을 드롭다운으로 선택 (URL `?campaign=<id>` 동기화)
3. **제안서 링크 빌더**: 인플루언서용 공개 랜딩페이지 URL 생성 시스템
4. **DM/이메일 통합 템플릿**: 실시간 미리보기 + 개인화 태그 + 제안서 링크 삽입

---

## 새로운 라우트 구조

### 글로벌 페이지 (NEW)
| 경로 | 설명 | 캠페인 모드 |
|------|------|------------|
| `/proposals` | 제안서 링크 빌더 | required |
| `/proposals/p/[slug]` | 공개 랜딩페이지 (인증 불필요) | - |
| `/templates` | DM/이메일 통합 템플릿 | required |
| `/email/send` | 이메일 발송 | required |
| `/email/logs` | 발송 로그 | filter |
| `/inbox` | 인박스 | filter |
| `/manage` | 인플루언서 관리 | required |
| `/contents` | 콘텐츠 관리 | required |
| `/sns-accounts` | SNS 계정 | required |
| `/metrics` | 성과 추적 | filter |

### 캠페인 모드
- **required**: 캠페인 선택 필수. 선택하지 않으면 안내 메시지 표시.
- **filter**: "전체 캠페인" 옵션 포함. 전체 선택 시 모든 캠페인 데이터 통합 표시.

### 기존 유지 (변경 없음)
| 경로 | 설명 |
|------|------|
| `/` | 대시보드 |
| `/campaigns` | 캠페인 목록 (CRUD) |
| `/campaigns/[id]` | 캠페인 상세 (요약 통계 + 바로가기) |
| `/master` | 마스터데이터 |
| `/extract/keywords` | 글로벌 키워드 |
| `/extract/tagged` | 글로벌 태그됨 |
| `/extract/run` | 추출 실행 |

### 삭제됨
캠페인 하위 12개 서브페이지 (`/campaigns/[id]/keywords/`, `/campaigns/[id]/email/send/` 등)

---

## DB 변경사항

### 신규 테이블

#### proposals
제안서 데이터. 캠페인별 제안서를 생성하고 공개 URL을 통해 인플루언서에게 공유.

| 칼럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| campaign_id | UUID FK → campaigns | 연결 캠페인 |
| team_id | UUID FK → teams | 소속 팀 |
| slug | TEXT UNIQUE | 공개 URL 슬러그 |
| title | TEXT | 제안서 제목 |
| language | TEXT | 언어 (ko/en/ja) |
| hero_image_url | TEXT | 대표 이미지 |
| mission_html | TEXT | 미션 (리치텍스트) |
| mission_images | TEXT[] | 미션 이미지 배열 |
| products | JSONB | 제품 정보 [{name, description, image_url}] |
| required_tags | TEXT[] | 필수 태그 |
| rewards_html | TEXT | 리워드 설명 |
| collect_instagram | BOOLEAN | IG ID 수집 여부 |
| collect_paypal | BOOLEAN | 페이팔 수집 여부 |
| collect_basic_info | BOOLEAN | 기본정보 수집 여부 |
| collect_shipping | BOOLEAN | 배송정보 수집 여부 |
| allowed_countries | TEXT[] | 허용 국가 |
| cs_channel | TEXT | CS 채널 종류 |
| cs_account | TEXT | CS 계정 ID |
| notice_html | TEXT | 안내사항 |
| status | TEXT | draft/published/closed |
| published_at | TIMESTAMPTZ | 공개 일시 |

#### proposal_responses
인플루언서가 제출한 참여 신청.

| 칼럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| proposal_id | UUID FK → proposals | 제안서 |
| influencer_name | TEXT | 이름 |
| instagram_id | TEXT | IG ID |
| email | TEXT | 이메일 |
| phone | TEXT | 전화번호 |
| paypal_email | TEXT | 페이팔 이메일 |
| shipping_address | JSONB | 배송 주소 |
| message | TEXT | 추가 메시지 |
| submitted_at | TIMESTAMPTZ | 제출 일시 |

### 기존 테이블 변경

#### email_templates (칼럼 추가)
| 칼럼 | 타입 | 설명 |
|------|------|------|
| type | TEXT | 'email' or 'dm' (기본: 'email') |
| name | TEXT | 템플릿 이름 |
| dm_body | TEXT | DM 전용 본문 |
| proposal_id | UUID FK → proposals | 연결 제안서 |

---

## 새 컴포넌트

### campaign-selector.tsx
공통 캠페인 선택 드롭다운.
- Props: `mode: "filter" | "required"`, `value`, `onChange`, `syncUrl`
- URL `?campaign=<id>` 자동 동기화
- Supabase에서 팀 캠페인 목록 자동 fetch

### templates/phone-mockup.tsx
DM 미리보기용 iPhone 목업 프레임.

### templates/dm-editor.tsx
DM 템플릿 에디터 + iPhone 실시간 미리보기.

### templates/email-editor.tsx
이메일 템플릿 에디터 + 이메일 실시간 미리보기 + 제안서 링크.

### proposal/proposal-form.tsx (빌더 페이지에 인라인)
제안서 빌더 폼 (좌측 입력 + 우측 미리보기).

---

## API 라우트

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

---

## 개인화 태그 시스템

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

---

## 사이드바 네비게이션

```
[대시보드]              → /
[캠페인 목록]           → /campaigns
[마스터데이터]          → /master

── 인플루언서 추출 ──
  [키워드]              → /extract/keywords
  [태그됨]              → /extract/tagged
  [추출 실행]           → /extract/run

── 제안서 & 템플릿 ──
  [제안서 링크]         → /proposals
  [DM/이메일 템플릿]    → /templates

── 이메일 ──
  [발송]                → /email/send
  [발송 로그]           → /email/logs

── 소통 ──
  [인박스]              → /inbox

── 관리 ──
  [인플루언서 관리]      → /manage
  [콘텐츠]              → /contents
  [SNS 계정]            → /sns-accounts
  [성과]                → /metrics
```

---

## 마이그레이션 파일
`supabase/migrations/002_proposals_and_templates.sql`

## RLS 정책
- proposals: team_id 기반 CRUD
- proposal_responses: team 기반 SELECT, 공개 INSERT (참여 신청)

## Public 경로 (인증 불필요)
- `/proposals/p/[slug]` - 공개 랜딩페이지
- `/api/proposals/p/[slug]` - 공개 API
