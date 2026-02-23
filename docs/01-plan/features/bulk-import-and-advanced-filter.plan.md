# Plan: 엑셀 대량 임포트 + 프로필 보강 + 고급 필터링

## 목표

154,483명의 Instagram 인플루언서 엑셀 DB를 마스터데이터에 임포트하고,
Apify Profile Scraper로 전체 스키마를 보강한 뒤,
50개+ 캠페인에서 국가/팔로워/참여율/카테고리별로 정밀 필터링하여 활용.

## 엑셀 데이터 현황

| 시트(국가) | 행 수 | 비고 |
|-----------|-------|------|
| 홍콩 | 6,091 | |
| 말레이시아 | 4,643 | |
| 싱가포르 | 5,000 | |
| 대만 | 52,826 | |
| 일본 | 63,561 | |
| 영미권 | 22,362 | |
| **합계** | **154,483** | 시트간 중복 존재 |

### 현재 엑셀 컬럼
- `아이디` (username)
- `총 팔로워 수` (follower_count)
- `링크 이동` (profile URL)

### 엑셀에 **없는** 데이터 (Profile Scraper로 보강 필요)
- display_name, bio, profile_image_url
- following_count, post_count
- engagement_rate (latestPosts에서 계산)
- email, businessEmail
- externalUrl (bio 링크)
- isVerified, isBusinessAccount, businessCategoryName
- latestPosts[] (최근 게시물 + 좋아요/댓글)
- country (엑셀 시트명에서 초기값 설정)

## 실행 계획

### Phase 1: 엑셀 대량 임포트 API

**새 API 엔드포인트**: `POST /api/import/excel`

1. 서버에서 엑셀 파일 파싱 (xlsx 라이브러리)
2. 시트명 → country 매핑 (홍콩→HK, 말레이시아→MY, 싱가포르→SG, 대만→TW, 일본→JP, 영미권→EN)
3. username 기준 중복 제거
4. influencers 테이블에 **배치 upsert** (500명씩)
   - platform: "instagram"
   - username: 엑셀 아이디
   - follower_count: 엑셀 팔로워수 (초기값, 나중에 보강 시 갱신)
   - profile_url: 엑셀 링크
   - country: 시트명 매핑값
   - platform_id: username (임시, profile scraper가 실제 ID로 갱신)
5. 삽입 결과 리턴: 총 임포트 수, 신규/기존 업데이트 수

**임포트 UI**: `/master` 페이지에 "엑셀 임포트" 버튼 추가
- 파일 업로드 → 미리보기 (시트별 건수) → 확인 후 임포트
- 진행률 표시 (X/154,483)

### Phase 2: 배치 프로필 보강 (Apify Profile Scraper)

**핵심 문제**: 154K명 전체를 한 번에 스크래핑하면 Apify 비용이 높고 시간이 오래 걸림.

**전략: 단계적 배치 보강**

1. **우선순위 배치 큐**:
   - 1순위: follower_count > 10K + country 있음 (캠페인 타겟 가능성 높음)
   - 2순위: follower_count 1K~10K
   - 3순위: 나머지

2. **배치 크기**: 200명씩 (Apify Profile Scraper 최적)

3. **배치 보강 API**: `POST /api/import/enrich-batch`
   - DB에서 보강 미완료 인플루언서 200명 조회
   - Profile Scraper 실행 → extraction_jobs 생성
   - 완료 후 자동 다음 배치 (연쇄 실행 옵션)

4. **Profile Scraper 반환 데이터 → DB 매핑**:

| Profile Scraper 필드 | DB 컬럼 | 비고 |
|---------------------|---------|------|
| id | platform_id | 실제 numeric ID |
| username | username | 확인/갱신 |
| fullName | display_name | |
| profilePicUrlHD | profile_image_url | |
| biography | bio | |
| followersCount | follower_count | 최신값으로 갱신 |
| followsCount | following_count | |
| postsCount | post_count | |
| businessEmail | email | email_source='business' |
| externalUrl | → influencer_links | 링크 스크래핑 대상 |
| isVerified | raw_data.isVerified | |
| isBusinessAccount | raw_data.isBusinessAccount | |
| businessCategoryName | raw_data.businessCategoryName | 카테고리 필터에 활용 |
| latestPosts[] | raw_data.latestPosts | 참여율 계산 원본 |

5. **참여율 자동 계산**:
   ```
   engagement_rate = avg(likes + comments) / follower_count * 100
   ```
   latestPosts에서 최근 12개 게시물의 평균 좋아요+댓글 / 팔로워수

6. **이메일 추출 파이프라인**:
   - bio에서 이메일 regex 추출
   - businessEmail 우선
   - externalUrl → influencer_links 테이블에 저장
   - 링크 스크래핑(EMAIL_EXTRACTOR)으로 이메일 추출

### Phase 3: DB 스키마 확장

현재 influencers 테이블에 **추가할 컬럼**:

```sql
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS is_business boolean DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS import_source text;
```

| 컬럼 | 타입 | 용도 |
|------|------|------|
| is_verified | boolean | 인증 배지 여부 필터 |
| is_business | boolean | 비즈니스 계정 여부 필터 |
| category | text | 비즈니스 카테고리 (뷰티, 패션, 푸드 등) |
| import_source | text | 데이터 출처 (excel:홍콩, keyword:韓國, tagged:@xxx) |

### Phase 4: 마스터데이터 고급 필터링

**필터 패널 (사이드바 or 상단)**:

| 필터 | 타입 | 예시 |
|------|------|------|
| 플랫폼 | 멀티셀렉트 | Instagram, TikTok, YouTube, Twitter |
| 국가 | 멀티셀렉트 | HK, MY, SG, TW, JP, EN, KR, ALL |
| 팔로워 범위 | 레인지 슬라이더 | 1K~10M |
| 참여율 범위 | 레인지 슬라이더 | 0%~20% |
| 게시물 수 | 레인지 슬라이더 | 최소 N개 이상 |
| 이메일 유무 | 토글 | 이메일 있음 / 없음 / 전체 |
| 인증 배지 | 토글 | 인증만 / 전체 |
| 비즈니스 계정 | 토글 | 비즈니스만 / 전체 |
| 카테고리 | 멀티셀렉트 | 뷰티, 패션, 푸드, 라이프스타일, etc. |
| 보강 상태 | 셀렉트 | 전체 / 보강완료 / 미보강 |
| 키워드 검색 | 텍스트 | username, display_name, bio 검색 |
| 데이터 출처 | 멀티셀렉트 | excel:홍콩, keyword:韓國, etc. |

### Phase 5: 배치 보강 UI (마스터 페이지)

**보강 진행 대시보드**:
- 전체 인플루언서 수 / 보강 완료 수 / 미보강 수
- 국가별 보강률 차트
- "다음 배치 보강 시작" 버튼 (200명씩)
- "자동 연쇄 보강" 토글 (완료 시 자동 다음 배치)
- 진행률 프로그레스 바

## Apify 비용 추정

| 항목 | 단가 | 수량 | 예상 비용 |
|------|------|------|----------|
| Profile Scraper | ~$2.50/1K profiles | 154K | ~$385 |
| Email Extractor | ~$1.00/1K links | ~50K links (추정) | ~$50 |
| **합계** | | | **~$435** |

**비용 절감 전략**:
- 1순위(팔로워 10K+)만 먼저 보강: ~30K명 → ~$75
- 캠페인 필요 시 추가 보강
- 이미 follower_count가 있으므로 필터링 후 보강 가능

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `src/app/api/import/excel/route.ts` | **신규** - 엑셀 파싱 + 배치 임포트 |
| `src/app/api/import/enrich-batch/route.ts` | **신규** - 배치 프로필 보강 |
| `src/app/(dashboard)/master/page.tsx` | 임포트 버튼, 고급 필터, 보강 대시보드 |
| `src/types/database.ts` | is_verified, is_business, category, import_source 컬럼 |
| `supabase/migrations/xxx_bulk_import.sql` | 스키마 확장 마이그레이션 |
| `src/lib/apify/transform.ts` | Profile Scraper → 새 컬럼 매핑 + engagement_rate 계산 |
| `src/app/api/extract/status/route.ts` | enrichInfluencer에 새 컬럼 업데이트 추가 |

## 실행 우선순위

1. **Phase 1** (엑셀 임포트) - 즉시 실행 가능, 비용 없음
2. **Phase 3** (스키마 확장) - Phase 2 전에 필요
3. **Phase 2** (배치 보강) - Apify 비용 발생, 단계적 실행
4. **Phase 4** (고급 필터) - 데이터가 있어야 의미 있음
5. **Phase 5** (보강 대시보드) - 편의 기능
