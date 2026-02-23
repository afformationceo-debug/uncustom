# Plan: 전체 시스템 아키텍처 점검 및 개선

## 1. 현황 분석

### 1.1 데이터 현황
| 항목 | 수치 |
|------|------|
| 총 인플루언서 | 130,700명 |
| 보강 완료 (프로필 스크래퍼) | 1,908명 (1.5%) |
| 이메일 보유 | 559명 |
| 비즈니스 계정 | 524명 |
| 미스크래핑 링크 | 892개 |

### 1.2 시스템 감사 결과

#### CRITICAL 문제 (8건)

**C1. influencers 테이블 Realtime 미등록**
- `ALTER PUBLICATION supabase_realtime`에 influencers 테이블 없음
- 마스터 페이지에서 `useRealtime("influencers")` 호출하지만 실제 DB Publication에 미등록
- 영향: 추출/보강 중 UI에 실시간 반영 안 될 수 있음

**C2. 이메일 배치 추출이 보강 파이프라인에 미연결**
- `/api/extract/email-batch` API 존재하지만 enrichment 후 자동 트리거 안 됨
- 현재: 키워드 추출 → 자동 보강 → **중단** (이메일 배치 수동 실행 필요)
- 필요: 키워드 추출 → 자동 보강 → **자동 이메일 배치 추출**

**C3. TikTok/YouTube/Twitter 보강 파이프라인 없음**
- `autoTriggerEnrichment()`가 Instagram만 지원
- TikTok/YouTube/Twitter는 키워드 추출 시 follower_count 포함되나 engagement_rate, 이메일 추가 수집 불가
- 특히 TikTok은 bio 링크 보유율 높아 이메일 수집 기회 손실

**C4. engagement_rate 거의 전체 NULL**
- Instagram Profile Scraper의 latestPosts에서만 계산
- TikTok: digg/play/share count 존재하나 미활용
- YouTube: viewCount 존재하나 미활용
- Twitter: favoriteCount/retweetCount 존재하나 미활용

**C5. country/language 대부분 NULL**
- YouTube만 country/defaultLanguage 반환
- Instagram/TikTok/Twitter는 액터가 반환 안 함
- keyword의 target_country → country 자동 매핑은 구현 완료, 하지만 기존 13만명에 미적용

**C6. import_source 필드 미사용**
- DB 스키마에 존재하지만 코드 어디에서도 값을 넣지 않음
- 엑셀 임포트, Apify 추출, 수동 추가 등 출처 추적 불가

**C7. Email Extractor 타임아웃 (1시간)**
- 892/997개 URL → 374/365개만 처리 (약 40% 완료)
- Apify 기본 timeout: 3600초
- 대량 URL에서 항상 타임아웃 발생 → 배치 분할 필요

**C8. bio-link 필터가 기존 influencer_links에 미적용**
- `isEmailExtractableLink()` 구현 완료, 신규 링크에만 적용
- 기존 892개 미스크래핑 링크에 Amazon/YouTube URL 포함 가능성

#### HIGH 문제 (5건)

**H1. 대량 보강 스크립트의 프로덕션화 필요**
- `scripts/enrich-1000.mjs` CLI 스크립트로만 존재
- UI/API에서 "1000명 보강" 버튼이나 스케줄러 없음
- 128K+ 미보강 인플루언서 → 약 130회 배치 필요

**H2. Realtime 콜백 비효율**
- influencer 하나 업데이트마다 전체 리스트 재조회
- 디바운싱 없음 → 보강 중 수백 번 재조회 가능

**H3. 캠페인 이메일 발송 파이프라인 미완성**
- 1차/2차/3차/4차 이메일 시퀀스 로직 없음
- 발송 스케줄링 없음
- 회신 감지 시 다음 차수 중지 로직 없음

**H4. 중복 인플루언서 처리 (크로스 플랫폼)**
- `UNIQUE(platform, platform_id)` 동일 플랫폼 내 중복만 방지
- 동일인이 IG+TikTok+YouTube 보유 시 3개 레코드 → 이메일 3번 발송 위험
- `dedup.ts` 파일 존재하나 크로스 플랫폼 로직 미구현

**H5. 캠페인 배정 후 상태 추적**
- `campaign_influencers` 상태: extracted → contacted → ... → completed
- 하지만 상태 전환 자동화 없음 (이메일 발송 → contacted 자동 변경 등)

#### MEDIUM 문제 (4건)

**M1. raw_data 구조 비일관**
- `_collectedPosts` + `latestPosts` 혼합
- 보강 시 raw_data 머지 전략이 덮어쓰기
- 이전 추출 데이터 유실 가능

**M2. 프로필 이미지 불안정**
- IG Hashtag Scraper: 프로필 사진 미반환 (코드 주석 확인)
- IG Tagged Scraper: 프로필 사진 미반환
- 보강 후에만 안정적 → 비보강 인플루언서 프로필 사진 없음

**M3. 누락 인덱스**
- `idx_keywords_campaign_id`
- `idx_tagged_accounts_campaign_id`
- `idx_proposals_status`
- `idx_influencer_links_scraped`

**M4. 사이드바 대시보드 링크 깨짐**
- `/home`으로 연결되나 `page.tsx` 삭제됨 (git status에서 확인)

---

## 2. 목표 아키텍처

### 2.1 전체 데이터 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│ 1단계: 글로벌 추출 (캠페인 독립)                                    │
│                                                                   │
│  키워드/태그 등록 → Apify 실행 → 인플루언서 추출                      │
│  ├─ Instagram: Hashtag Scraper → 기본 필드                         │
│  ├─ TikTok: TikTok Scraper → 풀 필드                               │
│  ├─ YouTube: YouTube Scraper → 풀 필드 + country/language           │
│  └─ Twitter: Tweet Scraper → 풀 필드                               │
│                                                                   │
│  결과 → influencers 테이블 (마스터데이터)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2단계: 자동 보강 (enrichment)                                      │
│                                                                   │
│  ├─ Instagram: Profile Scraper (follower, bio, email, category)   │
│  ├─ TikTok: (현재 없음 → Phase 2에서 추가)                         │
│  ├─ YouTube: (이미 풀 필드 → 보강 불필요)                           │
│  └─ Twitter: (이미 풀 필드 → 보강 불필요)                           │
│                                                                   │
│  결과 → influencers 업데이트 + influencer_links 생성               │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3단계: 이메일 수집 (자동)                                          │
│                                                                   │
│  ├─ bio 이메일: businessEmail, bio regex (보강 시 자동)             │
│  ├─ 링크 이메일: bio-link URLs → Email Extractor Actor            │
│  │   └─ 배치 분할: 200 URL/batch (타임아웃 방지)                    │
│  └─ 결과 → influencers.email + influencer_links.emails_found      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4단계: 마스터데이터 필터링 → 캠페인 배정                             │
│                                                                   │
│  필터: 플랫폼, 국가, 팔로워수, 이메일 유무, 카테고리, 키워드 등     │
│  체크박스 선택 → 캠페인에 배정 (campaign_influencers)               │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5단계: 아웃리치 시퀀스                                             │
│                                                                   │
│  ├─ 제안서 링크 생성 (proposals)                                   │
│  ├─ DM/이메일 템플릿 작성 (개인화 태그 + proposal_link)             │
│  ├─ 1차 발송 → 3일 대기 → 미회신 시 2차 → ... → 4차               │
│  ├─ 회신 감지: Resend 인바운드 웹훅 → email_threads                │
│  └─ 회신 시 해당 인플루언서 시퀀스 자동 중지                        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6단계: 캠페인 관리 & 성과                                          │
│                                                                   │
│  콘텐츠 업로드 → 멀티채널 리포스팅 → 성과 메트릭 추적               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 플랫폼별 필드 커버리지 목표

| 필드 | Instagram | TikTok | YouTube | Twitter |
|------|-----------|--------|---------|---------|
| platform_id | ✅ | ✅ | ✅ | ✅ |
| username | ✅ | ✅ | ✅ | ✅ |
| display_name | ✅ | ✅ | ✅ | ✅ |
| profile_image_url | ✅ (보강 후) | ✅ | ⚠️ 비디오 썸네일 | ✅ |
| bio | ✅ (보강 후) | ✅ | ✅ | ✅ |
| follower_count | ✅ (보강 후) | ✅ | ✅ | ✅ |
| following_count | ✅ (보강 후) | ✅ | ❌ | ✅ |
| post_count | ✅ (보강 후) | ✅ | ✅ | ✅ |
| engagement_rate | ✅ (보강 후) | 🔧 계산 추가 | 🔧 계산 추가 | 🔧 계산 추가 |
| email | ✅ (3가지 소스) | ✅ (bio regex) | ✅ (bio regex) | ✅ (bio+location) |
| is_verified | ✅ (보강 후) | ❌ | ❌ | ✅ |
| is_business | ✅ (보강 후) | ❌ | ❌ | ❌ |
| category | ✅ (보강 후) | ❌ | ❌ | ❌ |
| country | 🔧 keyword → country | ❌ | ✅ | ❌ |
| language | ❌ | ❌ | ✅ | ❌ |

---

## 3. 실행 계획

### Phase 1: DB 인프라 수정 (즉시)

**1-1. Realtime Publication 추가**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE influencers;
ALTER PUBLICATION supabase_realtime ADD TABLE influencer_links;
ALTER PUBLICATION supabase_realtime ADD TABLE email_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE tagged_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE influencer_contents;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_sns_accounts;
```

**1-2. 누락 인덱스 추가**
```sql
CREATE INDEX IF NOT EXISTS idx_keywords_campaign_id ON keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tagged_accounts_campaign_id ON tagged_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_influencer_links_scraped ON influencer_links(scraped);
CREATE INDEX IF NOT EXISTS idx_influencers_follower_count ON influencers(follower_count);
CREATE INDEX IF NOT EXISTS idx_influencers_email ON influencers(email);
```

**1-3. 기존 bio-link 정리**
- `influencer_links` 테이블에서 Amazon/YouTube 등 스킵 도메인 URL 삭제
- `isEmailExtractableLink()` 필터 적용하여 비링크트리 URL 제거

### Phase 2: 추출 파이프라인 개선

**2-1. engagement_rate 계산 확장**
- TikTok: `(diggCount + commentCount + shareCount) / playCount` 계산
- YouTube: `(likeCount + commentCount) / viewCount` 계산
- Twitter: `(favoriteCount + retweetCount) / follower_count` 계산
- transform.ts에 플랫폼별 계산 로직 추가

**2-2. import_source 필드 활용**
- 키워드 추출: `import_source = 'apify:keyword:${keyword}'`
- 태그 추출: `import_source = 'apify:tagged:${account}'`
- 엑셀 임포트: `import_source = 'excel:filename.xlsx'`
- 수동 추가: `import_source = 'manual'`

**2-3. 이메일 배치 추출 자동 트리거**
- enrichment 완료 후 → unscraped bio-link 있으면 자동으로 email_scrape job 생성
- 배치 크기 제한: 200 URL/batch (타임아웃 방지)
- `extract/status` API에 email_scrape 자동 트리거 추가

**2-4. 대시보드 페이지 수정**
- `/home` 경로 복원 또는 사이드바 링크를 유효한 경로로 변경

### Phase 3: 대량 보강 인프라

**3-1. 대량 보강 API 엔드포인트**
- `POST /api/extract/enrich` 에 배치 보강 기능 추가
- 파라미터: `{ batch_size: 1000, min_followers: 10000, platform: 'instagram' }`
- 스크립트 대신 API에서 실행 가능하도록

**3-2. 보강 진행률 대시보드**
- 마스터 페이지에 보강 현황 표시: X/130,700 완료 (X%)
- 보강 시작/중지 버튼
- 현재 실행 중인 보강 작업 상태 표시

**3-3. 기존 13만명 country 배치 업데이트**
- keyword target_country 기반 country 역방향 매핑
- `extracted_keywords` 배열에서 keyword → target_country 조회 → country 설정

### Phase 4: 이메일 시퀀스 자동화

**4-1. 시퀀스 로직**
- campaign_influencers에 `last_email_at`, `email_sequence_step` 컬럼 추가
- 1차 발송 → 3일 대기 → 미회신 시 2차 → ... → N차
- 회신 감지 시 자동 중지 (email_threads 연동)

**4-2. 발송 스케줄링**
- Cron 또는 Supabase Edge Function으로 매일 미회신자 확인
- 다음 차수 템플릿 자동 발송

**4-3. 상태 자동 전환**
- 이메일 발송 → `campaign_influencers.status = 'contacted'`
- 회신 수신 → `status = 'replied'`
- 콘텐츠 업로드 → `status = 'uploaded'`

### Phase 5: 크로스 플랫폼 중복 처리

**5-1. 이메일 기반 중복 감지**
- 동일 이메일 → 다른 플랫폼 인플루언서 연결
- `influencer_groups` 테이블 또는 `primary_influencer_id` 컬럼

**5-2. 이메일 발송 시 중복 방지**
- 캠페인에 동일 이메일 다수 배정 시 경고
- 1명당 1이메일 원칙 적용

---

## 4. 우선순위 매트릭스

| 순위 | 작업 | 영향도 | 난이도 | Phase |
|------|------|--------|--------|-------|
| 1 | Realtime Publication 추가 | 🔴 높음 | ⬜ 낮음 | 1 |
| 2 | 누락 인덱스 추가 | 🟡 중간 | ⬜ 낮음 | 1 |
| 3 | bio-link 데이터 정리 | 🟡 중간 | ⬜ 낮음 | 1 |
| 4 | engagement_rate 플랫폼별 계산 | 🔴 높음 | 🟡 중간 | 2 |
| 5 | import_source 자동 기록 | 🟡 중간 | ⬜ 낮음 | 2 |
| 6 | 이메일 배치 자동 트리거 | 🔴 높음 | 🟡 중간 | 2 |
| 7 | 대시보드 깨진 링크 수정 | 🟡 중간 | ⬜ 낮음 | 2 |
| 8 | 대량 보강 API | 🔴 높음 | 🔴 높음 | 3 |
| 9 | 보강 진행률 UI | 🟡 중간 | 🟡 중간 | 3 |
| 10 | country 배치 업데이트 | 🟡 중간 | ⬜ 낮음 | 3 |
| 11 | 이메일 시퀀스 자동화 | 🔴 높음 | 🔴 높음 | 4 |
| 12 | 크로스 플랫폼 중복 처리 | 🟡 중간 | 🟡 중간 | 5 |

---

## 5. 즉시 실행 가능 (Phase 1)

Phase 1은 마이그레이션 SQL + 데이터 정리만으로 완료 가능:
1. 새 마이그레이션 파일 생성 (Realtime + 인덱스)
2. `supabase db push` 실행
3. bio-link 정리 스크립트 실행

예상 소요: 마이그레이션 작성 + 검증
