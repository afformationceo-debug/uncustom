# Plan: 추출 파이프라인 진단 및 개선

## 문제 요약

"韓國" 키워드로 Instagram, YouTube, TikTok 추출 시 Instagram에서 3명밖에 안 나오는 문제.
프로필사진, 게시물 미표시 문제. 전체 추출 파이프라인을 진단하고 개선.

## 진단 결과

### 1. Instagram 결과 부족 (3명만 추출) - CRITICAL

**원인**: `instagram-hashtag-scraper`의 `resultsLimit`이 **게시물 수**이지 유저 수가 아님.
- `resultsLimit: 50`으로 설정하면 게시물 50개를 가져오는데, 이 게시물들이 3명의 유저에게만 속할 수 있음
- 한국어 키워드("韓國")는 Instagram에서 해시태그 볼륨이 낮거나 지역 제한 있을 수 있음
- **핵심**: 현재 `resultsLimit`의 기본값이 50인데, 이는 게시물 기준이라 고유 유저 수가 적게 나올 수 있음

**해결**: `resultsLimit`을 100~200으로 상향 + `resultsType: "posts"` 파라미터 명시 + UI에서 결과 수 조절 가능하게

### 2. Instagram 프로필사진 미표시 - CRITICAL

**원인**: `instagram-hashtag-scraper` 출력에는 **프로필사진이 없음**.
- Hashtag scraper는 게시물(post) 수준 데이터를 반환: `displayUrl`(게시물 이미지), `ownerUsername`, `ownerId`
- `ownerProfilePicUrl` 필드가 **없거나 빈 값**
- Transform 함수가 fallback: `profilePicUrlHD ?? profilePicUrl ?? ownerProfilePicUrl ?? ""` → 전부 없으므로 `""` 저장
- 프로필사진은 **Profile Scraper(enrich)** 에서만 제공됨

**해결**: auto-enrichment가 확실히 작동하도록 보장 + enrichment 결과에서 profile_image_url 업데이트 확인

### 3. Instagram 게시물(콘텐츠) 미표시 - MAJOR

**원인**: `_collectedPosts`에 `displayUrl`이 저장되지만, 실제 Instagram CDN URL이 빠르게 만료됨.
- Hashtag scraper의 `displayUrl`은 임시 CDN URL이라 시간이 지나면 404
- `latestPosts`는 Profile Scraper에서 온 데이터인데, enrichment가 실패하면 비어있음
- 또한 enrichment 시 `raw_data`를 profile scraper 결과로 덮어쓰는데, 이때 `_collectedPosts`는 보존하지만 `latestPosts`가 별도 존재해야 함

**해결**: enrichment에서 `latestPosts` 필드 확실히 보존 + CDN URL 만료 안내 UI

### 4. Auto-Enrichment 실패 가능성 - MAJOR

**원인**: enrichment가 `follower_count IS NULL`인 유저만 찾음.
- Hashtag scraper에서 `follower_count`가 null이 아닌 경우(다른 필드에서 잘못 매핑)면 enrichment 건너뜀
- 또한 `username`이 빈 문자열이고 `platform_id`만 있는 경우, Profile Scraper가 numeric ID를 받아도 실패할 수 있음
- username이 `""` (빈 문자열)로 저장되면 truthy 체크(`if username`)가 통과하지 않아 문제 없지만, 실제로 해시태그 스크래퍼는 `ownerUsername`을 제공하므로 이 부분은 OK

**해결**: enrichment 조건 검증 + 로깅 강화 + fallback 처리

### 5. 플랫폼별 출력 스키마 차이 - MODERATE

**현재 상태**: 각 플랫폼별 transform 함수는 잘 분리되어 있으나, 마스터 데이터 테이블에서 플랫폼별 고유 필드를 잘 보여주지 못함.

| 플랫폼 | 고유 필드 |
|--------|----------|
| Instagram | verified, external_url, is_business, category |
| TikTok | heartCount, videoCount, diggCount, signature |
| YouTube | subscriberCount, channelUrl, videoCount, viewCount |
| Twitter | statusesCount, location, isBlueVerified |

**해결**: 마스터 데이터에서 플랫폼별 컬럼이 이미 구현되어 있음. 데이터 정확성만 확보하면 됨.

## 실행 계획

### Phase 1: 추출 파이프라인 핵심 수정 (Apify Input)

1. **`getDefaultInput()` 개선** (`actors.ts`)
   - Instagram Hashtag: `resultsLimit` 기본값 50 → 100으로 상향
   - `resultsType: "posts"` 파라미터 명시 추가
   - 모든 플랫폼 기본 limit 100으로 통일

2. **추출 실행 UI 개선** (`extract/run/page.tsx`)
   - 결과 수(limit) 조절 슬라이더/입력 추가 (50/100/200/500)
   - 기본값 100

### Phase 2: Transform 함수 개선 (데이터 정확도)

3. **`transformInstagram()` 강화** (`transform.ts`)
   - Hashtag scraper 출력 필드 명확 매핑
   - `ownerProfilePicUrl` 없을 때 빈 값 대신 null 유지 → enrichment에서 업데이트 보장
   - 게시물 URL에서 shortCode 기반으로 확인 가능한 URL 생성

4. **Enrichment 결과 처리 강화** (`status/route.ts > enrichInfluencer()`)
   - `profile_image_url` 업데이트 시 빈 문자열(`""`) 체크 추가
   - `latestPosts` 필드가 raw_data에 확실히 보존되도록 확인
   - enrichment 완료 로그에 업데이트된 필드 목록 출력

### Phase 3: Auto-Enrichment 안정화

5. **Enrichment 트리거 조건 개선** (`status/route.ts`)
   - `follower_count IS NULL` 외에도 `profile_image_url = '' OR profile_image_url IS NULL` 조건 추가
   - enrichment 실패 시 재시도 로직 (최대 1회)

6. **Enrichment 진행상황 UI** (`extract/run/page.tsx`)
   - enrichment 작업도 작업 내역에 표시
   - "프로필 보강 중..." 상태 표시

### Phase 4: 마스터데이터 표시 개선

7. **프로필사진 표시 개선** (`master/page.tsx`)
   - 프로필사진 없는 경우 플랫폼 아이콘 placeholder
   - enrichment 미완료 인플루언서에 "보강 필요" 배지 표시

8. **콘텐츠 썸네일 표시 개선** (`master/page.tsx`)
   - `_collectedPosts` + `latestPosts` 모두에서 콘텐츠 추출 (이미 구현됨, 데이터 확인)
   - CDN URL 만료 시 fallback 이미지 표시

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/apify/actors.ts` | resultsLimit 기본값 상향, resultsType 추가 |
| `src/lib/apify/transform.ts` | profile_image_url null 처리, 필드 매핑 검증 |
| `src/app/api/extract/status/route.ts` | enrichment 트리거 조건 개선, 로깅 강화 |
| `src/app/(dashboard)/extract/run/page.tsx` | limit 조절 UI, enrichment 상태 표시 |
| `src/app/(dashboard)/master/page.tsx` | 보강 필요 배지, 이미지 fallback |

## 예상 결과

- "韓國" 키워드로 Instagram 추출 시 결과 수 3명 → 20-50명+
- 프로필사진 enrichment 후 정상 표시
- 게시물 콘텐츠 latestPosts에서 최대 12개 표시
- 플랫폼별 고유 데이터(팔로워, 참여율 등) 정확 표시
