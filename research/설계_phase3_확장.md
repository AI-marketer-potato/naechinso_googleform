# Phase 3 확장 기능 상세 설계서

> 마지막 업데이트: 2026-03-26
> 대상: 기능 #2, #7, #8 (Phase 3 — 3~6개월)
> 참조: `기능_브레인스토밍_v2.md`

---

## 목차

1. [기능 #2 — 친구 대신 피드 탐색](#기능-2--친구-대신-피드-탐색)
2. [기능 #7 — 비유저 주선 참여](#기능-7--비유저-주선-참여)
3. [기능 #8 — 소개팅 브릿지 채팅](#기능-8--소개팅-브릿지-채팅)

---

# 기능 #2 — 친구 대신 피드 탐색

> "내 친구 조건에 맞는 사람을 내가 대신 찾아준다"
> 출처: Ship (53% 매칭이 크루 대리 스와이프), Wingman

---

## 2-1. 유저 플로우

### 진입 → 탐색 → 소개 전체 흐름

```
[홈 피드]
  │
  ▼
[대신 찾아주기] 버튼 탭
  │
  ▼
┌─────────────────────────┐
│  누구를 위해 찾아줄까?   │
│                         │
│  👤 태양 (25, 남)       │
│  👤 지수 (27, 여)       │
│  👤 현우 (24, 남)       │
│                         │
│  ※ "소개받고 싶어요" ON  │
│    인 친구만 표시        │
└─────────────────────────┘
  │
  ▼ 친구 선택 (예: 태양)
  │
┌─────────────────────────┐
│  태양의 선호 조건        │
│  ─────────────────────  │
│  나이: 23~28세           │
│  지역: 서울              │
│  키: 160cm 이상          │
│  관심사: 운동, 음악      │
│  ─────────────────────  │
│  [이 조건으로 탐색 →]    │
│  [조건 수정하기]         │
└─────────────────────────┘
  │
  ▼
┌─────────────────────────┐
│  🔍 태양을 위한 피드     │
│  ─────────────────────  │
│  ┌───────────────────┐  │
│  │ 추천사 먼저 보기   │  │
│  │ "성격 진짜 좋아"   │  │
│  │ — 도윤이 소개      │  │
│  │                   │  │
│  │ [태양에게 소개]    │  │
│  │ [패스]             │  │
│  └───────────────────┘  │
│                         │
│  상단: "태양을 위해 탐색 중 🔍" │
│  [내 피드로 돌아가기]    │
└─────────────────────────┘
  │
  ▼ [태양에게 소개] 탭
  │
┌─────────────────────────┐
│  태양에게 한마디          │
│  ─────────────────────  │
│  프리셋:                 │
│  "너 스타일이야 ㅋㅋ"    │
│  "취향 저격 아니야?"     │
│  "진지할 것 같아서"      │
│  ─────────────────────  │
│  [직접 입력...]          │
│  [전송]                  │
└─────────────────────────┘
  │
  ▼
[전송 완료 → 썬구리 +5]
[태양에게 알림: "민준이가 찾아준 사람이 있어!"]
```

### 태양(소개받는 사람) 측 플로우

```
[푸시 알림]
"민준이가 너한테 어울릴 사람을 찾았어!"
  │
  ▼
┌─────────────────────────┐
│  민준이가 찾아줬어요 🎁  │
│  ─────────────────────  │
│  "너 스타일이야 ㅋㅋ"    │
│                         │
│  [추천사 카드 미리보기]  │
│                         │
│  [볼게!]    [나중에]     │
└─────────────────────────┘
```

---

## 2-2. DB 스키마

```sql
-- 친구의 선호 조건 (프록시 탐색용)
CREATE TABLE proxy_browse_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),       -- 소개받는 친구
    age_min         INT,
    age_max         INT,
    region          VARCHAR(50),
    height_min      INT,
    height_max      INT,
    interests       TEXT[],                                    -- 관심사 태그 배열
    gender_pref     VARCHAR(10),                               -- 'M', 'F', 'ALL'
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 대리 탐색 세션
CREATE TABLE proxy_browse_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    browser_id      UUID NOT NULL REFERENCES users(id),       -- 탐색하는 주선자
    target_id       UUID NOT NULL REFERENCES users(id),       -- 소개받을 친구
    started_at      TIMESTAMPTZ DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    cards_viewed    INT DEFAULT 0,                            -- 본 카드 수
    cards_sent      INT DEFAULT 0                             -- 소개 전송 수
);

-- 대리 탐색에서 발생한 소개 (기존 introductions 테이블 확장)
ALTER TABLE introductions ADD COLUMN proxy_session_id UUID REFERENCES proxy_browse_sessions(id);
ALTER TABLE introductions ADD COLUMN browse_type VARCHAR(20) DEFAULT 'direct';
-- browse_type: 'direct' (일반 소개), 'proxy' (대리 탐색 소개)
```

| 테이블 | 주요 컬럼 | 설명 |
|--------|----------|------|
| `proxy_browse_preferences` | `user_id`, `age_min/max`, `region`, `interests` | 친구의 선호 조건 저장 |
| `proxy_browse_sessions` | `browser_id`, `target_id`, `cards_viewed/sent` | 대리 탐색 세션 추적 |
| `introductions` (확장) | `proxy_session_id`, `browse_type` | 소개 출처 구분 |

---

## 2-3. API 엔드포인트

| Method | Path | 설명 | Request Body | Response |
|--------|------|------|-------------|----------|
| `GET` | `/api/v1/proxy-browse/friends` | 대리 탐색 가능한 친구 목록 | — | `{ friends: [{ id, name, avatar, hasPreferences }] }` |
| `GET` | `/api/v1/proxy-browse/preferences/{friendId}` | 친구의 선호 조건 조회 | — | `{ ageMin, ageMax, region, interests, ... }` |
| `POST` | `/api/v1/proxy-browse/sessions` | 대리 탐색 세션 시작 | `{ targetId }` | `{ sessionId }` |
| `GET` | `/api/v1/proxy-browse/sessions/{sessionId}/feed` | 조건 필터링된 피드 | `?page=1&size=20` | `{ profiles: [...], hasMore }` |
| `POST` | `/api/v1/proxy-browse/sessions/{sessionId}/introduce` | 대리 탐색에서 소개 전송 | `{ profileId, message?, presetKey? }` | `{ introductionId, sunguriEarned }` |
| `PATCH` | `/api/v1/proxy-browse/sessions/{sessionId}/end` | 세션 종료 | — | `{ cardsViewed, cardsSent }` |
| `PUT` | `/api/v1/proxy-browse/preferences/{friendId}` | 주선자가 조건 임시 수정 | `{ ageMin?, region?, ... }` | `{ updated: true }` |

---

## 2-4. 기술적 챌린지

| 챌린지 | 설명 | 해결 방향 |
|--------|------|----------|
| **조건 기반 필터링 알고리즘** | 친구의 선호 조건으로 피드를 실시간 필터링해야 함. 조건이 다양하고 조합이 복잡 | PostgREST 필터 또는 Supabase RPC로 복합 쿼리 구성. 자주 쓰는 조건 조합은 materialized view 캐싱 |
| **이미 본 카드 제외** | 주선자가 본 카드, 친구가 이미 본 카드 모두 제외해야 함 | `proxy_browse_sessions`의 viewed 이력 + 친구의 기존 viewed 이력을 EXCEPT 처리 |
| **프라이버시: 조건 열람** | 주선자가 친구의 선호 조건을 볼 수 있음 — 민감할 수 있음 | 친구가 "조건 공개 범위" 설정 가능 (전체 공개 / 일부 공개 / 비공개). 비공개 시 주선자가 직접 조건 입력 |
| **피드 분리 UX** | "내 피드"와 "친구를 위한 피드"가 혼동되면 안 됨 | 상단 배너로 "OO를 위해 탐색 중" 명시. 배경색 미세 변경. 뒤로가기 시 즉시 내 피드 복귀 |
| **동시 세션 방지** | 여러 주선자가 같은 친구를 위해 동시 탐색 → 중복 소개 | 동시 세션 허용하되, 소개 시 중복 프로필 체크. 이미 소개된 프로필은 "이미 소개됨" 표시 |

---

## 2-5. 엣지 케이스

| 상황 | 처리 방법 |
|------|----------|
| 친구가 선호 조건을 설정하지 않았을 때 | "아직 조건을 설정하지 않았어요. OO에게 조건 설정을 요청할까요?" → 친구에게 알림 전송 |
| 조건에 맞는 프로필이 0개일 때 | "조건에 맞는 사람이 아직 없어요. 조건을 넓혀볼까요?" → 조건 완화 제안 (나이 범위 확대 등) |
| 친구가 대리 탐색 도중 "소개받고 싶어요"를 OFF로 변경 | 즉시 세션 종료 + 주선자에게 "OO이 소개받기를 일시 중지했어요" 안내 |
| 주선자가 자기 자신을 소개 대상으로 선택 | UI에서 자기 자신은 목록에서 제외 |
| 소개받는 친구가 해당 프로필을 이미 패스한 적 있을 때 | 피드에서 제외하되, 주선자에게는 이유를 노출하지 않음 (프라이버시) |
| 주선자가 세션 중 앱을 강제 종료 | `ended_at`이 null인 세션은 30분 후 자동 종료. `cards_viewed` 기록은 유지 |

---

## 2-6. 썬구리 보상 연동

| 시점 | 보상 | 조건 |
|------|------|------|
| 대리 탐색 세션 시작 | +2 | 세션당 1회 |
| 대리 탐색에서 소개 전송 | +5 | 건당. 1세션 최대 10건 |
| 소개에 메시지 첨부 | +3 (보너스) | 프리셋이 아닌 직접 입력 시 |
| 소개받은 친구가 "볼게" 수락 | +10 | — |
| 대화 시작 (3메시지 이상) | +20 | — |
| 매칭 성사 | +50 + "대리 탐색왕" 뱃지 | 대리 탐색 경유 첫 매칭 시 뱃지 |

---

## 2-7. 구현 난이도 / 예상 기간

| 영역 | 난이도 | 예상 기간 | 상세 |
|------|--------|----------|------|
| **프론트엔드** | 높음 | 3~4주 | 피드 분리 UI, 조건 확인/수정 화면, 세션 상태 관리, 배너 컴포넌트 |
| **백엔드** | 높음 | 3~4주 | 조건 기반 필터링 쿼리, 세션 관리, 중복 체크, 알림 연동 |
| **합계** | — | **5~6주** | 프론트/백엔드 병렬 진행 기준 |

---
---

# 기능 #7 — 비유저 주선 참여

> "앱 설치 없이 웹 링크로 주선에 참여하는 연애 중인 친구"
> 출처: Tinder Matchmaker, Hinge Matchmaker

---

## 7-1. 유저 플로우

### 앱 유저(주선자) 측 — 초대 링크 생성

```
[친구에게 소개] 버튼 탭
  │
  ▼
┌─────────────────────────┐
│  누구에게 소개할까?       │
│                         │
│  📱 앱 친구 목록         │
│  ─────────────────────  │
│  📎 앱 밖 친구 초대      │  ← NEW
│     "내친소 없는 친구도  │
│      주선할 수 있어요"   │
└─────────────────────────┘
  │
  ▼ [앱 밖 친구 초대] 탭
  │
┌─────────────────────────┐
│  게스트 주선 링크 만들기  │
│  ─────────────────────  │
│  이름: [        ]        │
│  관계: [친구 ▾]          │
│  ─────────────────────  │
│  [카카오톡으로 보내기]    │
│  [링크 복사하기]          │
└─────────────────────────┘
  │
  ▼
[카카오톡 공유]
┌─────────────────────────┐
│  내친소 💌               │
│  "민준이가 너한테 주선을  │
│   부탁하고 싶대!         │
│   소개해줄 사람이 있어?" │
│                         │
│  [주선 참여하기 →]       │
└─────────────────────────┘
```

### 비유저(게스트 주선자) 측 — 웹 경험

```
[카카오톡 링크 클릭]
  │
  ▼
┌─────────────────────────────────┐
│  📱 모바일 웹 브라우저           │
│  ─────────────────────────────  │
│                                 │
│  내친소 — 게스트 주선            │
│                                 │
│  "민준이가 너한테 부탁했어!      │
│   소개해줄 친구가 있어?"         │
│  ─────────────────────────────  │
│                                 │
│  Step 1. 본인 확인               │
│  [카카오 간편 로그인]             │
│  ※ 회원가입 아님, 본인 확인용    │
│                                 │
└─────────────────────────────────┘
  │
  ▼ 카카오 인증 완료
  │
┌─────────────────────────────────┐
│  Step 2. 프로필 카드 탐색         │
│  ─────────────────────────────  │
│  ┌───────────────────────────┐  │
│  │ "성격 진짜 좋아" — 도윤    │  │
│  │ 지수, 26세, 서울           │  │
│  │ ─────────────────────     │  │
│  │ [민준에게 소개] [패스]     │  │
│  └───────────────────────────┘  │
│                                 │
│  ※ 게스트는 하루 5장까지 열람    │
│  ─────────────────────────────  │
│  [앱 설치하면 더 많이 볼 수 있어요] │
└─────────────────────────────────┘
  │
  ▼ [민준에게 소개] 탭
  │
┌─────────────────────────────────┐
│  Step 3. 추천 한마디              │
│  ─────────────────────────────  │
│  "이 사람 괜찮을 것 같아!"       │
│  [직접 입력...]                  │
│  ─────────────────────────────  │
│  [전송]                          │
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│  전송 완료! 🎉                   │
│  ─────────────────────────────  │
│  "민준이한테 소개를 보냈어!       │
│   결과가 나오면 알려줄게."       │
│  ─────────────────────────────  │
│  [내친소 앱 설치하기]             │
│  [카카오톡으로 결과 받기]         │
└─────────────────────────────────┘
```

---

## 7-2. DB 스키마

```sql
-- 게스트 주선자
CREATE TABLE guest_matchmakers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) NOT NULL,
    kakao_id        VARCHAR(100),                              -- 카카오 간편인증 ID
    phone_hash      VARCHAR(64),                               -- 전화번호 해시 (중복 방지)
    invited_by      UUID NOT NULL REFERENCES users(id),        -- 초대한 앱 유저
    relationship    VARCHAR(20) DEFAULT 'friend',              -- 'friend', 'colleague', 'family'
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_active_at  TIMESTAMPTZ,
    converted_to    UUID REFERENCES users(id)                  -- 앱 가입 시 연결
);

-- 게스트 초대 링크
CREATE TABLE guest_invite_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id      UUID NOT NULL REFERENCES users(id),
    guest_id        UUID REFERENCES guest_matchmakers(id),     -- 게스트 인증 후 연결
    token           VARCHAR(64) UNIQUE NOT NULL,               -- URL 토큰
    expires_at      TIMESTAMPTZ NOT NULL,                      -- 7일 만료
    status          VARCHAR(20) DEFAULT 'pending',             -- 'pending', 'activated', 'expired'
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 게스트 탐색 제한 추적
CREATE TABLE guest_daily_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id        UUID NOT NULL REFERENCES guest_matchmakers(id),
    view_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    cards_viewed    INT DEFAULT 0,
    cards_sent      INT DEFAULT 0,
    UNIQUE(guest_id, view_date)
);

-- 게스트가 보낸 소개 (기존 introductions 테이블 확장)
ALTER TABLE introductions ADD COLUMN guest_matchmaker_id UUID REFERENCES guest_matchmakers(id);
```

| 테이블 | 주요 컬럼 | 설명 |
|--------|----------|------|
| `guest_matchmakers` | `kakao_id`, `invited_by`, `converted_to` | 게스트 주선자 정보 |
| `guest_invite_links` | `token`, `expires_at`, `status` | 초대 링크 관리 |
| `guest_daily_views` | `guest_id`, `view_date`, `cards_viewed` | 일일 열람 제한 |
| `introductions` (확장) | `guest_matchmaker_id` | 게스트 소개 출처 추적 |

---

## 7-3. API 엔드포인트

### 앱 측 (주선자)

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| `POST` | `/api/v1/guest/invite` | 게스트 초대 링크 생성 | `{ guestName, relationship }` | `{ inviteToken, shareUrl, expiresAt }` |
| `GET` | `/api/v1/guest/invites` | 내가 보낸 초대 목록 | — | `{ invites: [{ token, guestName, status, ... }] }` |
| `DELETE` | `/api/v1/guest/invite/{token}` | 초대 링크 만료 처리 | — | `{ revoked: true }` |

### 웹 측 (게스트)

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| `GET` | `/web/v1/guest/verify/{token}` | 초대 링크 유효성 확인 | — | `{ valid, inviterName, expiresAt }` |
| `POST` | `/web/v1/guest/auth` | 카카오 간편 인증 | `{ kakaoAccessToken, inviteToken }` | `{ guestId, sessionToken }` |
| `GET` | `/web/v1/guest/feed` | 게스트용 피드 (제한된) | `?page=1&size=5` | `{ profiles: [...], remainingViews }` |
| `POST` | `/web/v1/guest/introduce` | 게스트가 소개 전송 | `{ profileId, message }` | `{ introductionId, sent: true }` |
| `GET` | `/web/v1/guest/results` | 게스트가 보낸 소개 결과 | — | `{ introductions: [{ status, ... }] }` |

---

## 7-4. 기술적 챌린지

| 챌린지 | 설명 | 해결 방향 |
|--------|------|----------|
| **웹 경험 별도 구축** | 앱과 독립된 모바일 웹 프론트엔드 필요. 앱 내 WebView가 아닌 순수 웹 | Next.js 또는 Nuxt.js로 경량 웹앱 구축. 공통 API 레이어 공유. 별도 도메인 (`invite.naechinso.com`) |
| **게스트 인증** | 회원가입 없이 본인 확인. 악용 방지 필수 | 카카오 간편인증 (OAuth). 전화번호 해시로 중복 방지. 1인 1게스트 계정 |
| **열람 제한 우회 방지** | 게스트가 여러 링크로 제한 우회 시도 | `kakao_id` 기준 일일 제한. 같은 사람이 여러 초대를 받아도 1개 게스트 계정으로 통합 |
| **프로필 노출 프라이버시** | 비유저에게 프로필 노출 — 유저 동의 필요 | "게스트에게도 프로필 공개" 토글 추가 (기본 OFF). 또는 게스트에게는 제한된 정보만 표시 (사진 블러, 이름 이니셜) |
| **전환 퍼널 최적화** | 게스트 → 앱 설치 전환율이 핵심 | 소개 결과 알림을 카카오톡으로 전송 → "더 보려면 앱 설치" 유도. 게스트 활동 데이터를 앱 가입 시 자동 이관 |
| **링크 보안** | 초대 링크 유출 시 누구나 접근 가능 | 토큰 + 카카오 인증 이중 검증. 7일 만료. 1회 활성화 후 토큰 재사용 불가 (같은 게스트만 재접근 가능) |

---

## 7-5. 엣지 케이스

| 상황 | 처리 방법 |
|------|----------|
| 게스트가 이미 내친소 앱 유저일 때 | 카카오 인증 시 기존 유저로 감지 → "이미 내친소 회원이에요! 앱에서 주선해보세요" + 앱 딥링크 |
| 초대 링크 만료 후 접근 | "이 링크는 만료됐어요. OO에게 새 링크를 요청해보세요" |
| 게스트가 일일 5장 한도 소진 | "오늘은 여기까지! 내일 다시 와도 되고, 앱 설치하면 제한 없이 볼 수 있어요" |
| 주선자가 초대를 취소했는데 게스트가 이미 인증 완료 | 게스트 세션 유지하되 새 피드 로딩 차단. "초대가 취소됐어요" 안내 |
| 게스트가 부적절한 메시지 전송 | 기존 신고 시스템 연동. 게스트도 신고 대상. 누적 시 `kakao_id` 블랙리스트 |
| 동일인이 여러 사람에게 초대받았을 때 | `kakao_id` 기준 1계정. 여러 초대자와 연결 가능 (N:1). 피드는 통합 |

---

## 7-6. 썬구리 보상 연동

| 시점 | 보상 | 대상 | 조건 |
|------|------|------|------|
| 게스트 초대 링크 생성 | +3 | 앱 유저 (초대자) | 링크당 1회 |
| 게스트가 인증 완료 | +10 | 앱 유저 (초대자) | 실제 인증 완료 시 |
| 게스트가 소개 전송 | +5 | 앱 유저 (초대자) | 건당 |
| 게스트 소개로 대화 시작 | +20 | 앱 유저 (초대자) | — |
| 게스트 소개로 매칭 성사 | +50 + "인맥왕" 뱃지 | 앱 유저 (초대자) | — |
| 게스트가 앱 설치 + 가입 | +30 + "리크루터" 뱃지 | 앱 유저 (초대자) | 게스트 → 정식 유저 전환 시 |

> 참고: 게스트 본인에게는 썬구리가 지급되지 않음 (앱 유저가 아니므로). 단, 앱 가입 전환 시 기존 활동 기록에 대해 소급 지급 가능.

---

## 7-7. 구현 난이도 / 예상 기간

| 영역 | 난이도 | 예상 기간 | 상세 |
|------|--------|----------|------|
| **프론트엔드 (앱)** | 중간 | 1~2주 | 초대 링크 생성 UI, 초대 관리 화면 |
| **프론트엔드 (웹)** | 높음 | 3~4주 | 모바일 웹앱 신규 구축 (인증, 피드, 소개 전송, 결과 확인) |
| **백엔드** | 높음 | 3~4주 | 게스트 인증 시스템, 초대 링크 관리, 열람 제한, 카카오 알림 연동 |
| **합계** | — | **5~6주** | 웹 프론트엔드 + 백엔드 병렬 진행 기준 |

---
---

# 기능 #8 — 소개팅 브릿지 채팅

> "매칭 성사 시 주선자가 3자 채팅방에서 아이스브레이킹 후 자연스럽게 나가기"
> 출처: 한국 소개팅 문화 (카톡 단톡방), Hinge 아이스브레이커

---

## 8-1. 유저 플로우

### 매칭 성사 → 브릿지 채팅 생성

```
[양쪽 수락 → 매칭 성사!]
  │
  ▼
┌─────────────────────────────┐
│  🎉 매칭 성사!               │
│  ─────────────────────────  │
│  태양 ↔ 지수                 │
│  주선자: 민준                 │
│  ─────────────────────────  │
│                             │
│  💬 민준이가 잠깐 도와줄게!   │
│  "3자 채팅으로 시작하면       │
│   더 자연스러워요"           │
│                             │
│  [브릿지 채팅 시작]           │
│  [둘이서 바로 대화]           │
└─────────────────────────────┘
```

### 3자 채팅방 진행

```
┌─────────────────────────────────┐
│  💬 브릿지 채팅                  │
│  참여자: 민준(주선) · 태양 · 지수 │
│  ─────────────────────────────  │
│                                 │
│  🤖 시스템:                      │
│  "민준이가 두 분을 소개해줬어요!  │
│   잠깐 같이 대화해봐요 😊"      │
│                                 │
│  민준: 야 둘 다 러닝 좋아하잖아   │
│        같이 한강 뛸 사람 찾고     │
│        있었지? ㅋㅋ              │
│                                 │
│  태양: 오 진짜요? 저 매일 아침    │
│        뛰는데 ㅋㅋ              │
│                                 │
│  지수: 헐 나도 한강 자주 가는데!  │
│                                 │
│  ─────────────────────────────  │
│  [입력...]           [전송]      │
│  ─────────────────────────────  │
│  ⏱ 민준이는 10분 후 자동 퇴장    │
│  [지금 나가기 👋]                │
└─────────────────────────────────┘
```

### 주선자 퇴장 → 2자 채팅 전환

```
[주선자 퇴장 시]
  │
  ▼
┌─────────────────────────────────┐
│  💬 채팅                         │
│  참여자: 태양 · 지수              │
│  ─────────────────────────────  │
│                                 │
│  🤖 시스템:                      │
│  "민준이가 퇴장했어요.            │
│   이제 둘이서 편하게 대화해요! 💕"│
│                                 │
│  ... (기존 대화 이력 유지) ...    │
│                                 │
│  ─────────────────────────────  │
│  [입력...]           [전송]      │
└─────────────────────────────────┘

[주선자에게 알림]
"태양이랑 지수가 잘 대화하고 있어! 👍"
→ 썬구리 +20
```

### 주선자 시점 — 퇴장 후

```
┌─────────────────────────────────┐
│  브릿지 채팅 종료                 │
│  ─────────────────────────────  │
│                                 │
│  태양 ↔ 지수 대화 중 💬          │
│                                 │
│  "잘 연결해줬어! 👋"             │
│  ─────────────────────────────  │
│  ※ 퇴장 후에는 대화 내용을       │
│    볼 수 없어요 (프라이버시)     │
│                                 │
│  [다른 친구도 소개해볼까?]        │
└─────────────────────────────────┘
```

---

## 8-2. DB 스키마

```sql
-- 브릿지 채팅방
CREATE TABLE bridge_chatrooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID NOT NULL REFERENCES matches(id),       -- 매칭 ID
    matchmaker_id   UUID NOT NULL REFERENCES users(id),         -- 주선자
    user_a_id       UUID NOT NULL REFERENCES users(id),         -- 매칭 당사자 A
    user_b_id       UUID NOT NULL REFERENCES users(id),         -- 매칭 당사자 B
    status          VARCHAR(20) DEFAULT 'bridge',               -- 'bridge', 'transitioned', 'expired'
    bridge_started  TIMESTAMPTZ DEFAULT now(),
    bridge_ended    TIMESTAMPTZ,                                -- 주선자 퇴장 시각
    auto_exit_at    TIMESTAMPTZ,                                -- 자동 퇴장 예정 시각
    exit_type       VARCHAR(20),                                -- 'manual', 'auto_timer', 'auto_inactivity'
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 채팅 메시지 (3자 + 2자 통합)
CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatroom_id     UUID NOT NULL REFERENCES bridge_chatrooms(id),
    sender_id       UUID NOT NULL REFERENCES users(id),
    sender_type     VARCHAR(20) NOT NULL,                       -- 'matchmaker', 'user_a', 'user_b', 'system'
    content         TEXT NOT NULL,
    content_type    VARCHAR(20) DEFAULT 'text',                 -- 'text', 'image', 'system', 'icebreaker'
    is_bridge_phase BOOLEAN DEFAULT true,                       -- 3자 단계 메시지 여부
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 아이스브레이커 템플릿
CREATE TABLE icebreaker_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        VARCHAR(30) NOT NULL,                       -- 'common_interest', 'fun', 'casual'
    template_text   TEXT NOT NULL,                              -- "둘 다 {interest}를 좋아하잖아!"
    variables       TEXT[],                                     -- 치환 변수 목록
    is_active       BOOLEAN DEFAULT true
);

-- 주선자 브릿지 활동 통계
CREATE TABLE bridge_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchmaker_id   UUID NOT NULL REFERENCES users(id),
    total_bridges   INT DEFAULT 0,
    avg_bridge_duration_sec INT DEFAULT 0,
    successful_transitions INT DEFAULT 0,                       -- 2자 전환 후 대화 지속
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

| 테이블 | 주요 컬럼 | 설명 |
|--------|----------|------|
| `bridge_chatrooms` | `match_id`, `matchmaker_id`, `status`, `auto_exit_at` | 브릿지 채팅방 상태 관리 |
| `chat_messages` | `chatroom_id`, `sender_type`, `is_bridge_phase` | 3자/2자 통합 메시지 저장 |
| `icebreaker_templates` | `category`, `template_text`, `variables` | 아이스브레이커 자동 생성 |
| `bridge_stats` | `matchmaker_id`, `total_bridges`, `successful_transitions` | 주선자 활동 통계 |

---

## 8-3. API 엔드포인트

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| `POST` | `/api/v1/bridge/create` | 브릿지 채팅방 생성 | `{ matchId }` | `{ chatroomId, autoExitAt }` |
| `GET` | `/api/v1/bridge/{chatroomId}` | 채팅방 정보 조회 | — | `{ status, participants, bridgeStarted, autoExitAt }` |
| `GET` | `/api/v1/bridge/{chatroomId}/messages` | 메시지 목록 조회 | `?before={messageId}&limit=50` | `{ messages: [...], hasMore }` |
| `POST` | `/api/v1/bridge/{chatroomId}/messages` | 메시지 전송 | `{ content, contentType? }` | `{ messageId, createdAt }` |
| `POST` | `/api/v1/bridge/{chatroomId}/exit` | 주선자 수동 퇴장 | — | `{ exitedAt, sunguriEarned }` |
| `POST` | `/api/v1/bridge/{chatroomId}/icebreaker` | 아이스브레이커 생성 | `{ category? }` | `{ template, filledText }` |
| `GET` | `/api/v1/bridge/stats` | 내 브릿지 통계 | — | `{ totalBridges, avgDuration, successRate }` |
| `PATCH` | `/api/v1/bridge/{chatroomId}/timer` | 자동 퇴장 타이머 수정 | `{ minutes: 15 }` | `{ newAutoExitAt }` |

### WebSocket 이벤트

| 이벤트 | 방향 | 페이로드 | 설명 |
|--------|------|---------|------|
| `bridge:message` | Server→Client | `{ messageId, senderId, content, senderType }` | 새 메시지 수신 |
| `bridge:typing` | Client→Server | `{ chatroomId, isTyping }` | 타이핑 인디케이터 |
| `bridge:matchmaker_exit` | Server→Client | `{ chatroomId, exitType, exitedAt }` | 주선자 퇴장 알림 |
| `bridge:timer_warning` | Server→Client | `{ chatroomId, remainingSeconds }` | 자동 퇴장 2분 전 경고 |
| `bridge:transitioned` | Server→Client | `{ chatroomId }` | 2자 채팅 전환 완료 |

---

## 8-4. 기술적 챌린지

| 챌린지 | 설명 | 해결 방향 |
|--------|------|----------|
| **3자 → 2자 전환 UX** | 채팅방 참여자 수가 바뀌는 순간 UX가 어색하지 않아야 함 | 시스템 메시지로 자연스러운 전환. "민준이가 퇴장했어요" + 파티클 애니메이션. 이전 대화 이력은 유지하되 주선자 메시지는 흐리게 처리 |
| **실시간 채팅 인프라** | WebSocket 기반 실시간 메시지 전송 | Supabase Realtime 또는 별도 Socket.IO 서버. `bridge_chatrooms` 테이블에 Realtime subscription 설정 |
| **자동 퇴장 타이머** | 서버 사이드에서 정확한 시간에 주선자 자동 퇴장 | 서버 cron (10분 기본값) + 클라이언트 카운트다운 UI. 주선자가 5/10/15분 중 선택 가능 |
| **주선자 퇴장 후 프라이버시** | 퇴장 후 대화 내용을 볼 수 없어야 함 | `is_bridge_phase = false`인 메시지는 주선자 API 응답에서 필터링. 클라이언트 캐시도 퇴장 시 삭제 |
| **메시지 순서 보장** | 3명이 동시에 메시지를 보낼 때 순서 보장 | 서버 타임스탬프 기준 정렬. Optimistic UI 적용 후 서버 응답으로 보정 |
| **아이스브레이커 개인화** | 두 사람의 공통점을 기반으로 아이스브레이커 생성 | 프로필 관심사 교집합 추출 → 템플릿 변수 치환. 공통점 없으면 범용 템플릿 ("첫인상이 어때요?") |

---

## 8-5. 엣지 케이스

| 상황 | 처리 방법 |
|------|----------|
| 주선자가 브릿지 채팅을 거부할 때 | "둘이서 바로 대화" 옵션으로 일반 1:1 채팅 개설. 브릿지 없이도 매칭 진행 가능 |
| 매칭 당사자 중 한 명이 브릿지 채팅을 원하지 않을 때 | 양쪽 모두 동의해야 브릿지 생성. 한 쪽이라도 거부 시 일반 1:1 채팅으로 진행 |
| 주선자가 자동 퇴장 전에 앱을 종료 | 타이머는 서버 사이드이므로 예정 시각에 자동 퇴장 처리. 주선자에게 푸시 알림 "자동으로 퇴장했어요" |
| 주선자가 10분 내 아무 말도 안 할 때 | 3분 무응답 시 "민준아, 한마디 해줘!" 넛지. 5분 무응답 시 "민준이가 바쁜가봐요. 자동 퇴장할게요" → 퇴장 |
| 매칭 당사자가 둘 다 아무 말도 안 할 때 | 2분 무응답 시 시스템 아이스브레이커 자동 발송. "둘 다 {interest} 좋아하시네요! 최근에 뭐 했어요?" |
| 브릿지 채팅에서 주선자가 부적절한 발언 | 일반 신고 시스템 동일 적용. 신고 시 즉시 퇴장 + 채팅 기록 보존 (검토용) |
| 주선자 퇴장 후 매칭 당사자가 바로 나가기 | 정상 처리. 일반 1:1 채팅의 비활성과 동일하게 취급 |
| 한 매칭에 여러 주선자가 관여한 경우 (양방향 소개) | 대표 주선자 1명만 브릿지 참여. 나머지 주선자에게는 결과 알림만 전송 |

---

## 8-6. 썬구리 보상 연동

| 시점 | 보상 | 대상 | 조건 |
|------|------|------|------|
| 브릿지 채팅 시작 | +5 | 주선자 | 채팅방 생성 시 |
| 아이스브레이커 메시지 전송 | +3 | 주선자 | 주선자가 직접 작성한 첫 메시지 |
| 양쪽 모두 1개 이상 메시지 전송 (브릿지 중) | +10 | 주선자 | 브릿지 단계에서 양쪽 참여 확인 |
| 주선자 퇴장 후 대화 지속 (3메시지 이상) | +20 | 주선자 | 2자 전환 후 대화가 이어질 때 |
| 브릿지 채팅 참여 | +5 | 매칭 당사자 (각각) | 브릿지에서 1개 이상 메시지 전송 시 |

### 보너스 뱃지

| 뱃지 | 조건 | 설명 |
|------|------|------|
| "아이스브레이커 달인" | 브릿지 5회 이상 + 퇴장 후 대화 지속율 80% 이상 | 주선자 프로필에 표시 |
| "소개팅 MC" | 브릿지 10회 이상 | — |

---

## 8-7. 구현 난이도 / 예상 기간

| 영역 | 난이도 | 예상 기간 | 상세 |
|------|--------|----------|------|
| **프론트엔드** | 매우 높음 | 4~5주 | 3자 채팅 UI, 참여자 전환 애니메이션, 타이머 UI, 시스템 메시지, 타이핑 인디케이터 |
| **백엔드** | 매우 높음 | 4~5주 | WebSocket 채팅 서버, 자동 퇴장 스케줄러, 아이스브레이커 엔진, 메시지 필터링 |
| **합계** | — | **6~8주** | 채팅 인프라가 없는 상태에서 시작 시. 기존 채팅 시스템이 있으면 3~4주 단축 가능 |

---
---

## 부록: 3개 기능 비교 요약

| 항목 | #2 친구 대신 피드 탐색 | #7 비유저 주선 참여 | #8 소개팅 브릿지 채팅 |
|------|----------------------|-------------------|--------------------|
| **핵심 가치** | 주선자 능동성 강화 | 유저 풀 확대 (앱 밖 참여) | 매칭 품질 향상 (어색함 해소) |
| **구현 복잡도** | 높음 | 높음 | 매우 높음 |
| **예상 기간** | 5~6주 | 5~6주 | 6~8주 |
| **의존 기능** | #1 피드 즉시 공유, #16 소개 토글 | #5 카카오 소개 카드 | 채팅 시스템 전체 |
| **바이럴 임팩트** | 중간 (앱 내 활동 증가) | 매우 높음 (앱 밖 유저 유입) | 낮음 (기존 유저 경험 개선) |
| **주요 기술 스택** | 필터링 쿼리 최적화 | 모바일 웹앱 + OAuth | WebSocket + 스케줄러 |
| **추천 구현 순서** | 2번째 | 1번째 | 3번째 |

> **추천 구현 순서 근거**: #7(비유저 참여)은 유저 풀 확대에 직결되어 가장 높은 ROI. #2(대신 피드)는 기존 기능 확장이라 상대적으로 빠름. #8(브릿지 채팅)은 채팅 인프라 의존도가 높아 마지막.
