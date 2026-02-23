# Plan: 시스템 무결성 점검 및 수정

## 발견된 문제 요약

### CRITICAL (즉시 수정)

#### 1. Supabase Realtime 누락 (5개 테이블)
UI에서 `useRealtime()` 구독 중이지만 Publication에 등록 안 됨 → **실시간 업데이트 작동 안 함**
- `influencers` (마스터 페이지)
- `email_templates` (템플릿 페이지)
- `tagged_accounts` (태그 계정 페이지)
- `campaign_sns_accounts` (SNS 계정 페이지)
- `influencer_contents` (콘텐츠 페이지)

#### 2. Enrichment 이메일 우선순위 역전
- 현재: bio regex 이메일이 businessEmail보다 우선 → **비공식 이메일 저장됨**
- 수정: businessEmail > bio regex 순서로 적용

#### 3. Enrichment 시 기존 인플루언서 링크 미갱신
- 기존 인플루언서에 이메일 없고 bio 링크 있어도 `influencer_links`에 저장 안 됨
- 결과: 이메일 추출 기회 상실 (13만명 중 대부분 해당)

#### 4. URL 매칭 정규화 부재 (이메일 스크래핑)
- HTTP/HTTPS, www, 쿼리 파라미터 차이 무시 안 함
- 결과: 스크래핑 결과와 DB URL 매칭 실패 → 이메일 유실

### HIGH (중요)

#### 5. engagement_rate 계산 누락
- latestPosts 없으면 계산 안 됨 → NULL 유지
- 이미 수정 완료 (이전 세션), 검증 필요

#### 6. 누락 인덱스
- `idx_keywords_campaign_id`
- `idx_tagged_accounts_campaign_id`
- `idx_proposals_status`

### MEDIUM (개선)

#### 7. 엑셀 임포트 인플루언서 enrichment 연결
- 13만명 중 bio, display_name, email 전부 NULL
- 배치 보강 API 있지만 자동 연쇄 보강 없음

## 실행 계획

### Phase 1: Realtime Publication 수정 (마이그레이션)
- 5개 테이블 ALTER PUBLICATION 추가
- 누락 인덱스 추가

### Phase 2: Enrichment 파이프라인 수정
- 이메일 우선순위: businessEmail > bio regex
- 기존 인플루언서 링크 갱신 로직 추가
- URL 정규화 함수 추가

### Phase 3: 검증
- 빌드 확인
- DB 마이그레이션 push
