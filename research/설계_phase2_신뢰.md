# Phase 2 신뢰 시스템 — 상세 설계서

> 작성일: 2026-03-26
> 대상 기능: #6 공통 친구 우선 노출, #12 추천사 스택 (누적 보증)
> 참고: 기능_브레인스토밍_v2.md

---

## 목차

1. [기능 #6: 공통 친구 우선 노출](#기능-6-공통-친구-우선-노출)
2. [기능 #12: 추천사 스택 (누적 보증)](#기능-12-추천사-스택-누적-보증)
3. [두 기능 간 시너지](#두-기능-간-시너지)

---

# 기능 #6: 공통 친구 우선 노출

## 1. 유저 플로우

### 플로우 요약

```
[피드 진입] → 피드 정렬 (공통 친구 가중치 적용)
            → 카드 렌더링 시 공통 친구 뱃지 계산
            → 유저가 카드 확인
            → (선택) 공통 친구 이름 탭 → 공통 친구 목록 바텀시트
```

### 텍스트 와이어프레임

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [피드 화면]

  ┌─────────────────────────────┐
  │ 👥 공통 친구 2명             │  ← 뱃지 (탭 가능)
  │ 민준 · 태양                  │
  │─────────────────────────────│
  │                             │
  │      [프로필 사진]           │
  │                             │
  │  지수, 26                   │
  │  서울 · 마케팅               │
  │─────────────────────────────│
  │  ❤️ 관심있어  |  👋 소개하기  │
  └─────────────────────────────┘

  ┌─────────────────────────────┐
  │      [프로필 사진]           │  ← 공통 친구 없는 카드
  │  하은, 25                   │     (뱃지 없음, 아래쪽 노출)
  │  ...                        │
  └─────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 공통 친구 목록 바텀시트

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [공통 친구 바텀시트]

  지수님과의 공통 친구

  ┌─────────────────────────────┐
  │  👤 민준                    │
  │  "같이 영화 자주 봐요"       │  ← 민준이 쓴 추천사 (있으면)
  ├─────────────────────────────┤
  │  👤 태양                    │
  │  공통 친구                   │  ← 추천사 없으면 기본 텍스트
  └─────────────────────────────┘

  [닫기]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2. DB 스키마

### 기존 테이블 (전제)

```sql
-- 이미 존재한다고 가정하는 핵심 테이블
CREATE TABLE users (
    id          UUID PRIMARY KEY,
    nickname    VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 친구 관계 (양방향, 소개/주선 등으로 맺어진 관계)
CREATE TABLE friendships (
    id          UUID PRIMARY KEY,
    user_a_id   UUID NOT NULL REFERENCES users(id),
    user_b_id   UUID NOT NULL REFERENCES users(id),
    status      VARCHAR(20) DEFAULT 'active',  -- active, blocked
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_a_id, user_b_id),
    CHECK(user_a_id < user_b_id)  -- 중복 방지: 항상 작은 ID가 A
);
```

### 새로 필요한 테이블/인덱스

```sql
-- 공통 친구 캐시 (성능 최적화)
-- 실시간 계산은 O(n^2)이므로, 비동기로 미리 계산하여 캐시
CREATE TABLE mutual_friend_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    target_user_id  UUID NOT NULL REFERENCES users(id),
    mutual_count    INT NOT NULL DEFAULT 0,
    mutual_user_ids UUID[] NOT NULL DEFAULT '{}',  -- 공통 친구 ID 배열
    calculated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_user_id)
);

-- 인덱스: 피드 정렬 시 빠른 조회
CREATE INDEX idx_mutual_cache_user_count
    ON mutual_friend_cache(user_id, mutual_count DESC);

CREATE INDEX idx_mutual_cache_freshness
    ON mutual_friend_cache(calculated_at);

-- friendships 테이블 인덱스 보강
CREATE INDEX idx_friendships_user_a ON friendships(user_a_id) WHERE status = 'active';
CREATE INDEX idx_friendships_user_b ON friendships(user_b_id) WHERE status = 'active';
```

### 스키마 설명

| 테이블 | 컬럼 | 설명 |
|--------|------|------|
| `mutual_friend_cache` | `user_id` | 피드를 보는 유저 |
| | `target_user_id` | 피드에 노출되는 상대 유저 |
| | `mutual_count` | 공통 친구 수 |
| | `mutual_user_ids` | 공통 친구 UUID 배열 (뱃지에 이름 표시용) |
| | `calculated_at` | 캐시 계산 시점 (TTL 판단용) |

---

## 3. API 엔드포인트

### 3-1. 피드 조회 (기존 API 확장)

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **Path** | `/api/v1/feed` |
| **설명** | 피드 카드 목록 반환. 공통 친구 정보 포함 |

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `cursor` | string | N | 페이지네이션 커서 |
| `limit` | int | N | 기본 20, 최대 50 |

**Response (200)**

```json
{
  "cards": [
    {
      "user_id": "uuid-xxx",
      "nickname": "지수",
      "age": 26,
      "location": "서울",
      "photos": ["url1", "url2"],
      "mutual_friends": {
        "count": 2,
        "previews": [
          {"user_id": "uuid-mj", "nickname": "민준"},
          {"user_id": "uuid-ty", "nickname": "태양"}
        ]
      }
    },
    {
      "user_id": "uuid-yyy",
      "nickname": "하은",
      "age": 25,
      "mutual_friends": {
        "count": 0,
        "previews": []
      }
    }
  ],
  "next_cursor": "cursor-abc",
  "has_more": true
}
```

### 3-2. 공통 친구 상세 조회

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **Path** | `/api/v1/users/{target_user_id}/mutual-friends` |
| **설명** | 특정 유저와의 공통 친구 전체 목록 (바텀시트용) |

**Response (200)**

```json
{
  "target_user_id": "uuid-xxx",
  "mutual_friends": [
    {
      "user_id": "uuid-mj",
      "nickname": "민준",
      "profile_photo": "url",
      "recommendation": "같이 영화 자주 봐요"
    },
    {
      "user_id": "uuid-ty",
      "nickname": "태양",
      "profile_photo": "url",
      "recommendation": null
    }
  ]
}
```

### 3-3. 공통 친구 캐시 갱신 (내부 API / 배치)

| 항목 | 값 |
|------|-----|
| **Method** | `POST` |
| **Path** | `/internal/mutual-friends/recalculate` |
| **설명** | 특정 유저의 공통 친구 캐시 재계산 (친구 추가/삭제 시 트리거) |

**Request Body**

```json
{
  "user_id": "uuid-xxx",
  "reason": "friendship_created"  // friendship_created | friendship_removed | scheduled
}
```

---

## 4. 엣지 케이스

| # | 상황 | 처리 방법 |
|---|------|----------|
| 1 | **공통 친구가 탈퇴함** | 캐시 갱신 배치에서 자동 제거. 뱃지 수 즉시 반영 안 될 수 있음 (최대 1시간 딜레이) |
| 2 | **공통 친구가 차단됨** | 차단한 쪽에서는 공통 친구 목록에서 제외. 상대쪽은 유지 |
| 3 | **공통 친구 0명인 유저만 있을 때** | 뱃지 없이 일반 피드로 동작. 빈 뱃지 표시하지 않음 |
| 4 | **공통 친구가 100명 이상** | 뱃지에는 최대 3명 이름만 표시 + "+N명". 바텀시트에서 전체 조회 |
| 5 | **신규 유저 (친구 0명)** | 공통 친구 기능 자체가 비활성. 일반 피드 알고리즘으로 대체 |
| 6 | **캐시 미계산 상태** | 실시간 폴백 쿼리 실행 (느리지만 정확). 계산 후 캐시 저장 |
| 7 | **"소개받고 싶어요" 토글 OFF인 공통 친구** | 공통 친구 수에는 포함하되, 이름은 "비공개 친구"로 표시 |

---

## 5. 썬구리 보상 연동

공통 친구 우선 노출은 **직접적인 유저 행동이 아닌 시스템 계산 기능**이므로, 이 기능 자체에 대한 썬구리 보상은 없음.

단, **간접 보상 연결**:

| 시점 | 보상 | 설명 |
|------|------|------|
| 공통 친구 뱃지 카드에서 "소개하기" 클릭 | +5 (기존 #1 소개 전송) | 기존 보상 그대로 적용 |
| 공통 친구 뱃지 카드에서 매칭 성사 | +50 + 뱃지 (기존 #15) | 기존 보상 그대로 적용 |
| 친구를 많이 초대할수록 공통 친구 증가 | 간접 혜택 | 초대 보상은 #5 카카오 소개 카드에서 처리 |

> 설계 원칙: 공통 친구는 "보상 대상"이 아니라 "보상 행동(소개)의 확률을 높이는 촉매".

---

## 6. 피드 알고리즘 영향

### 정렬 공식

```
feed_score = base_score
           + (mutual_friend_count * MUTUAL_WEIGHT)
           + recommendation_score
           + recency_bonus
```

### 가중치 설계

| 요소 | 가중치 | 비고 |
|------|--------|------|
| `base_score` | 1.0 | 프로필 완성도, 활동도 등 기본 점수 |
| `mutual_friend_count` | **0.15 / 명** | 공통 친구 1명당 +0.15. 최대 5명(+0.75)까지 반영 |
| `MUTUAL_WEIGHT` 상한 | **0.75** | 공통 친구만으로 상위 고정되지 않도록 캡 설정 |
| `recommendation_score` | 별도 (#12) | 추천사 스택 점수 |
| `recency_bonus` | 0~0.3 | 최근 가입/활동 유저 부스트 |

### 정렬 로직 상세

```python
def calculate_feed_score(viewer_id: str, candidate_id: str) -> float:
    """피드 카드 정렬 점수 계산."""
    base = get_base_score(candidate_id)

    # 공통 친구 점수 (캐시에서 조회)
    mutual = get_mutual_friend_count(viewer_id, candidate_id)
    mutual_score = min(mutual * 0.15, 0.75)  # 상한 0.75

    # 추천사 점수 (#12 연동)
    rec_score = get_recommendation_score(candidate_id)

    # 최근 활동 보너스
    recency = get_recency_bonus(candidate_id)

    return base + mutual_score + rec_score + recency
```

### 피드 노출 규칙

1. `mutual_friend_count >= 1`인 카드가 상단 그룹
2. 상단 그룹 내에서는 `mutual_friend_count` 내림차순
3. 같은 공통 친구 수면 `base_score` 순
4. 하단 그룹(공통 친구 0명)은 기존 알고리즘 유지

---

## 7. 구현 난이도 / 예상 기간

### 백엔드

| 작업 | 난이도 | 예상 기간 | 설명 |
|------|--------|----------|------|
| DB 스키마 + 마이그레이션 | 하 | 0.5일 | 테이블 1개, 인덱스 추가 |
| 공통 친구 계산 배치 잡 | **중** | 2일 | 친구 그래프 순회 알고리즘. 증분 업데이트 로직 |
| 캐시 갱신 트리거 (친구 추가/삭제 시) | 중 | 1일 | 이벤트 기반 캐시 무효화 |
| 피드 API 확장 | 하 | 1일 | 기존 피드 쿼리에 JOIN 추가 |
| 공통 친구 상세 API | 하 | 0.5일 | 단순 조회 |
| 피드 정렬 알고리즘 수정 | 중 | 1일 | 가중치 적용 + 테스트 |
| **백엔드 합계** | | **~6일** | |

### 프론트엔드

| 작업 | 난이도 | 예상 기간 | 설명 |
|------|--------|----------|------|
| 피드 카드 뱃지 UI | 하 | 1일 | 조건부 렌더링 + 스타일링 |
| 공통 친구 바텀시트 | 하 | 1일 | 목록 UI + API 연동 |
| 피드 카드 정렬 반영 확인 | 하 | 0.5일 | 서버 정렬 결과 그대로 표시 |
| **프론트엔드 합계** | | **~2.5일** | |

### 총 예상: **약 1.5~2주** (버퍼 포함)

---
---

# 기능 #12: 추천사 스택 (누적 보증)

## 1. 유저 플로우

### 플로우 A: 추천사 작성 (작성자 시점)

```
[친구 프로필 방문] → [추천사 쓰기] 버튼
→ 추천사 작성 화면
  - 프리셋 태그 선택 (최대 3개): 성격좋음 / 유머있음 / 진지함 / 배려깊음 / ...
  - 자유 텍스트 입력 (최대 100자)
→ [보내기]
→ 확인 알림: "추천사가 전달됐어! 썬구리 +8"
→ 상대에게 푸시: "민준이 너한테 추천사를 남겼어!"
```

### 플로우 B: 추천사 확인/관리 (받는 사람 시점)

```
[알림 수신] → 프로필 > 추천사 섹션
→ 새 추천사 확인
→ 옵션: [공개] / [비공개] / [삭제 요청]
→ 공개된 추천사가 프로필에 누적 표시
```

### 플로우 C: 추천사 열람 (피드에서 보는 사람 시점)

```
[피드 카드] → 프로필 진입
→ 프로필 스크롤
→ 추천사 섹션:
  ━━━ 친구 5명이 보증 ━━━
  "걔 진짜 성격 좋아" — 민준
  "유머 감각 최고" — 현우
  [+3 더보기]
→ [더보기] 탭 → 전체 추천사 리스트
```

### 텍스트 와이어프레임: 추천사 작성

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [추천사 작성]

  지수에게 추천사 남기기

  태그 선택 (최대 3개):
  ┌──────┐ ┌──────┐ ┌────────┐
  │✅성격좋음│ │ 유머있음 │ │✅배려깊음 │
  └──────┘ └──────┘ └────────┘
  ┌──────┐ ┌────────┐ ┌──────┐
  │ 진지함 │ │ 센스있음 │ │ 따뜻함 │
  └──────┘ └────────┘ └──────┘

  한마디 (선택, 100자 이내):
  ┌─────────────────────────────┐
  │ 걔 진짜 성격 좋아. 만나면   │
  │ 편한 스타일이야             │
  └─────────────────────────────┘

  [보내기 → 썬구리 +8]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 텍스트 와이어프레임: 프로필 내 추천사 섹션

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [지수의 프로필]

  ... (사진, 기본 정보) ...

  ━━━ 👥 친구 5명이 보증 ━━━

  🏷 #성격좋음 x3  #유머있음 x2  #배려깊음 x1

  🗣 "걔 진짜 성격 좋아" — 민준
  🗣 "유머 감각 최고" — 현우
  🗣 "진지하게 연애하고 싶어하는 애" — 도윤

  [+2 더보기]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2. DB 스키마

```sql
-- 추천사 태그 마스터
CREATE TABLE recommendation_tags (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(20) NOT NULL UNIQUE,  -- '성격좋음', '유머있음', ...
    emoji       VARCHAR(10),                   -- 표시용 이모지
    sort_order  INT DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE
);

-- 추천사 본문
CREATE TABLE recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    writer_id       UUID NOT NULL REFERENCES users(id),
    receiver_id     UUID NOT NULL REFERENCES users(id),
    content         VARCHAR(100),           -- 자유 텍스트 (nullable)
    visibility      VARCHAR(20) DEFAULT 'public',  -- public, private, deleted
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(writer_id, receiver_id)          -- 1인당 1추천사
);

-- 추천사에 붙은 태그 (다대다)
CREATE TABLE recommendation_tag_map (
    recommendation_id  UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    tag_id             INT NOT NULL REFERENCES recommendation_tags(id),
    PRIMARY KEY(recommendation_id, tag_id)
);

-- 유저별 추천사 집계 캐시 (프로필/피드 성능용)
CREATE TABLE recommendation_summary (
    user_id             UUID PRIMARY KEY REFERENCES users(id),
    total_count         INT DEFAULT 0,          -- 공개 추천사 수
    top_tags            JSONB DEFAULT '[]',     -- [{"tag":"성격좋음","count":3}, ...]
    badge_level         VARCHAR(20) DEFAULT 'none',  -- none, bronze(3+), silver(5+), gold(10+)
    feed_boost_score    FLOAT DEFAULT 0.0,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_recommendations_receiver ON recommendations(receiver_id, visibility)
    WHERE visibility = 'public';
CREATE INDEX idx_recommendations_writer ON recommendations(writer_id);
CREATE INDEX idx_rec_summary_boost ON recommendation_summary(feed_boost_score DESC);
```

### 스키마 설명

| 테이블 | 용도 |
|--------|------|
| `recommendation_tags` | 프리셋 태그 마스터. 운영자가 추가/삭제 가능 |
| `recommendations` | 추천사 본문. 작성자-수신자 1:1 제약 |
| `recommendation_tag_map` | 추천사당 최대 3개 태그 연결 |
| `recommendation_summary` | 유저별 집계 캐시. 프로필/피드 렌더링 시 이 테이블만 조회 |

---

## 3. API 엔드포인트

### 3-1. 추천사 작성

| 항목 | 값 |
|------|-----|
| **Method** | `POST` |
| **Path** | `/api/v1/recommendations` |
| **설명** | 친구에게 추천사 작성 |

**Request Body**

```json
{
  "receiver_id": "uuid-jisu",
  "tag_ids": [1, 4],
  "content": "걔 진짜 성격 좋아. 만나면 편한 스타일이야"
}
```

**Response (201)**

```json
{
  "id": "uuid-rec-xxx",
  "receiver_id": "uuid-jisu",
  "tags": ["성격좋음", "배려깊음"],
  "content": "걔 진짜 성격 좋아. 만나면 편한 스타일이야",
  "sunguree_earned": 8
}
```

**에러 응답**

| 코드 | 상황 |
|------|------|
| `400` | 태그 0개 또는 4개 이상 선택 |
| `403` | 친구가 아닌 유저에게 작성 시도 |
| `409` | 이미 추천사를 작성한 상대 |

### 3-2. 추천사 태그 목록

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **Path** | `/api/v1/recommendations/tags` |
| **설명** | 사용 가능한 태그 프리셋 목록 |

**Response (200)**

```json
{
  "tags": [
    {"id": 1, "name": "성격좋음", "emoji": "😊"},
    {"id": 2, "name": "유머있음", "emoji": "😄"},
    {"id": 3, "name": "진지함", "emoji": "🤝"},
    {"id": 4, "name": "배려깊음", "emoji": "💛"},
    {"id": 5, "name": "센스있음", "emoji": "✨"},
    {"id": 6, "name": "따뜻함", "emoji": "🔥"}
  ]
}
```

### 3-3. 유저 프로필 추천사 조회

| 항목 | 값 |
|------|-----|
| **Method** | `GET` |
| **Path** | `/api/v1/users/{user_id}/recommendations` |
| **설명** | 특정 유저가 받은 공개 추천사 목록 |

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `cursor` | string | N | 페이지네이션 |
| `limit` | int | N | 기본 5, 최대 20 |

**Response (200)**

```json
{
  "summary": {
    "total_count": 5,
    "badge_level": "silver",
    "top_tags": [
      {"name": "성격좋음", "count": 3},
      {"name": "유머있음", "count": 2}
    ]
  },
  "recommendations": [
    {
      "id": "uuid-rec-1",
      "writer": {"user_id": "uuid-mj", "nickname": "민준"},
      "tags": ["성격좋음", "배려깊음"],
      "content": "걔 진짜 성격 좋아",
      "created_at": "2026-03-20T10:00:00Z"
    }
  ],
  "next_cursor": "cursor-abc",
  "has_more": true
}
```

### 3-4. 추천사 공개/비공개 전환

| 항목 | 값 |
|------|-----|
| **Method** | `PATCH` |
| **Path** | `/api/v1/recommendations/{recommendation_id}/visibility` |
| **설명** | 받은 추천사의 공개 상태 변경 (수신자만 가능) |

**Request Body**

```json
{
  "visibility": "private"  // "public" | "private"
}
```

### 3-5. 추천사 삭제 요청

| 항목 | 값 |
|------|-----|
| **Method** | `DELETE` |
| **Path** | `/api/v1/recommendations/{recommendation_id}` |
| **설명** | 수신자가 추천사 삭제 요청 (soft delete) |

---

## 4. 엣지 케이스

| # | 상황 | 처리 방법 |
|---|------|----------|
| 1 | **작성자가 탈퇴** | 추천사 유지, 작성자 이름 "탈퇴한 친구"로 표시 |
| 2 | **작성자와 수신자가 친구 해제** | 추천사 유지. 이미 작성된 보증은 삭제하지 않음 (LinkedIn 방식) |
| 3 | **같은 사람에게 추천사 수정** | 기존 추천사 `UPDATE`. 새로 생성 불가 (UNIQUE 제약) |
| 4 | **부적절한 추천사 내용** | 비속어 필터 + 신고 기능. 신고 3회 시 자동 비공개 + 운영자 검토 |
| 5 | **자기 자신에게 추천사** | API 레벨에서 `writer_id != receiver_id` 검증. 400 에러 |
| 6 | **추천사 0개인 유저** | 추천사 섹션 자체를 숨김. "아직 추천사가 없어요" 표시 안 함 (부정적 인상 방지) |
| 7 | **태그만 있고 텍스트 없음** | 허용. 태그만으로도 보증 의미 있음 |
| 8 | **추천사 100개 이상** | 프로필에는 최근 5개만 표시 + "더보기". 태그 집계는 전체 반영 |
| 9 | **비공개 추천사만 있을 때** | 추천사 섹션 숨김. 뱃지도 비표시 |
| 10 | **추천사 작성 후 바로 삭제 반복 (썬구리 어뷰징)** | 같은 수신자에게 재작성 시 썬구리 미지급. 첫 작성 시에만 보상 |

---

## 5. 썬구리 보상 연동

| 시점 | 보상 | 조건 | 반복 가능 |
|------|------|------|----------|
| 추천사 작성 완료 | **+8** | 친구에게 첫 추천사 작성 시 | 대상별 1회 |
| 추천사 수정 | 0 | 이미 보상 지급됨 | - |
| 추천사 3개 도달 (수신자) | **+5 보너스** | 공개 추천사 3개 누적 시 수신자에게 | 1회 |
| 추천사 5개 도달 (수신자) | **+10 보너스** + 실버 뱃지 | 공개 추천사 5개 누적 시 | 1회 |
| 추천사 10개 도달 (수신자) | **+20 보너스** + 골드 뱃지 | 공개 추천사 10개 누적 시 | 1회 |

### 어뷰징 방지 규칙

| 규칙 | 설명 |
|------|------|
| 1인 1추천사 | 같은 사람에게 중복 작성 불가 |
| 친구 관계 필수 | `friendships` 테이블에 active 관계 확인 |
| 일일 작성 제한 | 하루 최대 5건 (스팸 방지) |
| 삭제 후 재작성 | 같은 수신자에게 재작성 시 썬구리 미지급 |

### 뱃지 레벨 체계

| 레벨 | 조건 | 프로필 표시 | 피드 효과 |
|------|------|------------|----------|
| 없음 | 0~2개 | 표시 안 함 | 없음 |
| 브론즈 | 3~4개 | "친구 3명이 보증" | boost +0.05 |
| 실버 | 5~9개 | "친구 5명이 보증" + 실버 아이콘 | boost +0.10 |
| 골드 | 10개+ | "친구 10명이 보증" + 골드 아이콘 | boost +0.15 |

---

## 6. 피드 알고리즘 영향

### 추천사 피드 부스트 공식

```python
def calculate_recommendation_boost(user_id: str) -> float:
    """추천사 기반 피드 노출 부스트 점수 계산."""
    summary = get_recommendation_summary(user_id)

    if summary.total_count == 0:
        return 0.0

    # 기본 부스트: 추천사 수에 따른 로그 스케일 (무한 증가 방지)
    count_boost = min(math.log2(summary.total_count + 1) * 0.05, 0.15)

    # 태그 다양성 보너스: 다양한 사람이 다양한 태그로 보증할수록 높음
    unique_tags = len(summary.top_tags)
    diversity_bonus = min(unique_tags * 0.02, 0.10)

    return count_boost + diversity_bonus
```

### 피드 정렬 통합 (기능 #6과 합산)

```
feed_score = base_score
           + mutual_friend_boost    (#6: 최대 0.75)
           + recommendation_boost   (#12: 최대 0.25)
           + recency_bonus          (최대 0.30)
```

| 요소 | 최대 기여 | 비고 |
|------|----------|------|
| `base_score` | 1.0 | 기본 |
| `mutual_friend_boost` | 0.75 | #6에서 계산 |
| `recommendation_boost` | **0.25** | 추천사 수 + 태그 다양성 |
| `recency_bonus` | 0.30 | 최근 활동 |
| **최대 total** | **2.30** | |

### 노출 규칙

1. `recommendation_boost > 0`인 카드에 뱃지 아이콘 표시
2. 같은 공통 친구 수일 때, 추천사가 많은 카드가 상위
3. 추천사 0개라고 해서 불이익 없음 (boost가 0일 뿐)
4. 골드 뱃지 유저는 피드에서 카드 테두리 강조 (시각적 차별)

---

## 7. 구현 난이도 / 예상 기간

### 백엔드

| 작업 | 난이도 | 예상 기간 | 설명 |
|------|--------|----------|------|
| DB 스키마 + 마이그레이션 | 하 | 0.5일 | 테이블 4개, 관계 설정 |
| 추천사 CRUD API | 중 | 2일 | 작성, 조회, 수정, 삭제 + 검증 로직 |
| 태그 시스템 | 하 | 0.5일 | 마스터 데이터 + 다대다 관계 |
| 집계 캐시 (recommendation_summary) | 중 | 1.5일 | 작성/삭제/공개 변경 시 집계 갱신 트리거 |
| 뱃지 레벨 계산 로직 | 하 | 0.5일 | 단순 임계값 비교 |
| 썬구리 보상 연동 | 중 | 1일 | 어뷰징 방지 로직 포함 |
| 비속어 필터 + 신고 | 중 | 1일 | 콘텐츠 필터링 |
| 피드 알고리즘 부스트 연동 | 중 | 1일 | #6과 통합 정렬 |
| **백엔드 합계** | | **~8일** | |

### 프론트엔드

| 작업 | 난이도 | 예상 기간 | 설명 |
|------|--------|----------|------|
| 추천사 작성 화면 (태그 선택 + 텍스트 입력) | 중 | 2일 | 태그 멀티셀렉트 UI + 글자수 제한 |
| 프로필 내 추천사 섹션 | 중 | 1.5일 | 태그 집계 바, 추천사 리스트, 더보기 |
| 추천사 관리 (공개/비공개/삭제) | 하 | 1일 | 토글 + 삭제 확인 다이얼로그 |
| 뱃지 UI (피드 카드 + 프로필) | 하 | 1일 | 레벨별 아이콘/색상 분기 |
| 푸시 알림 연동 | 하 | 0.5일 | 기존 알림 시스템에 타입 추가 |
| **프론트엔드 합계** | | **~6일** | |

### 총 예상: **약 2.5~3주** (버퍼 포함)

---
---

# 두 기능 간 시너지

## 데이터 흐름

```
[유저 가입] → 친구 초대 → friendships 생성
                ↓
         [공통 친구 계산 (#6)]  ←──── mutual_friend_cache 갱신
                ↓
         [추천사 작성 (#12)]   ←──── 공통 친구가 있으면 추천사 작성 동기 증가
                ↓
         [피드 정렬]
           = base_score
           + mutual_friend_boost (최대 0.75)
           + recommendation_boost (최대 0.25)
           + recency_bonus (최대 0.30)
```

## 상호 강화 루프

```
공통 친구 많음 → 신뢰도 높음 → 추천사 작성 동기 증가
     ↑                              ↓
     └── 추천사 많음 → 피드 노출 증가 → 매칭 확률 증가
                                        ↓
                                   새 친구 관계 형성 → 공통 친구 증가
```

## 구현 순서 권장

| 순서 | 작업 | 이유 |
|------|------|------|
| 1 | #6 공통 친구 DB + 배치 | 데이터 기반 기능, 먼저 쌓아야 함 |
| 2 | #6 피드 API + 프론트 | 유저에게 바로 보이는 효과 |
| 3 | #12 추천사 CRUD + DB | 핵심 기능 구현 |
| 4 | #12 프로필 UI + 뱃지 | 유저가 추천사를 보고 쓰는 흐름 |
| 5 | 피드 알고리즘 통합 | #6 + #12 점수를 합산한 최종 정렬 |
| 6 | 썬구리 보상 통합 테스트 | 어뷰징 시나리오 포함 |

**총 합산 예상: 약 4~5주** (두 기능 병렬 진행 시 3~4주)
