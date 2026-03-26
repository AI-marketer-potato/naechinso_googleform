# 내친소 Phase 1 — 시스템 상세 설계서

> 작성일: 2026-03-26
> 대상 기능: #15 주선 결과 피드백 루프, #16 "소개받고 싶어요" 토글
> 참조: `기능_브레인스토밍_v2.md`

---

## 목차

1. [기능 #15: 주선 결과 피드백 루프](#기능-15-주선-결과-피드백-루프)
2. [기능 #16: "소개받고 싶어요" 토글](#기능-16-소개받고-싶어요-토글)
3. [기능 간 의존 관계](#기능-간-의존-관계)

---

# 기능 #15: 주선 결과 피드백 루프

## 1. 핵심 목적

주선자가 소개 후 **결과를 알 수 있게** 하여 주선 행동을 반복시키는 리텐션 장치.
Ship 실패 사례(주선자가 결과를 모르면 동기 소멸)를 직접 해결한다.

**원칙**: 프라이버시 보호 — 대화 내용은 절대 공개하지 않고 **상태만 전달**

---

## 2. 유저 플로우

### 2-1. 전체 흐름

```
주선자가 소개 전송 (#1 피드 즉시 공유)
        │
        ▼
┌─────────────────────────────┐
│  소개 상태: PENDING          │
│  (상대에게 카드 전달됨)       │
└─────────────────────────────┘
        │
        ▼  상대가 "볼게!" 수락
┌─────────────────────────────┐
│  소개 상태: VIEWED           │
│  → 주선자 알림: 없음 (노이즈)│
└─────────────────────────────┘
        │
        ▼  양쪽 중 한 명이 첫 메시지 전송
┌─────────────────────────────┐
│  소개 상태: CHATTING         │
│  → 주선자 알림:              │
│  "너의 소개로 태양↔지수가    │
│   대화를 시작했어! 🎉"       │
│  → 썬구리 +20               │
└─────────────────────────────┘
        │
        ▼  양쪽 모두 3개 이상 메시지 교환
┌─────────────────────────────┐
│  소개 상태: ACTIVE_CHAT      │
│  → 주선자 알림: 없음         │
│  (CHATTING과 구분하되 노이즈 │
│   방지를 위해 알림은 안 보냄) │
└─────────────────────────────┘
        │
        ▼  양쪽 중 한 명이 "매칭 확정" 누름
┌─────────────────────────────┐
│  소개 상태: MATCHED          │
│  → 주선자 알림:              │
│  "주선 성공! 🎊              │
│   태양이 고마워하고 있어"     │
│  → 썬구리 +50 + 뱃지         │
└─────────────────────────────┘
        │
        ▼  (실패 경로)
┌─────────────────────────────┐
│  소개 상태: EXPIRED / DECLINED│
│  → 주선자 알림:              │
│  "이번에는 안 됐지만,        │
│   다음 소개를 응원해! 💪"     │
│  → 썬구리 보상 없음          │
│  (누가 거절했는지 안 알려줌)  │
└─────────────────────────────┘
```

### 2-2. 주선자 알림 화면

```
┌───────────────────────────────────┐
│  🔔 주선 소식                      │
│───────────────────────────────────│
│                                   │
│  ┌─────────────────────────────┐  │
│  │ 🎉 대화 시작!               │  │
│  │ 너의 소개로 태양↔지수가     │  │
│  │ 대화를 시작했어!            │  │
│  │                             │  │
│  │ +20 🌟 획득                 │  │
│  │ ─────────────────────────── │  │
│  │ 3분 전                      │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ 🎊 매칭 성사!               │  │
│  │ 민수↔영희 — 주선 성공!      │  │
│  │ 민수가 고마워하고 있어      │  │
│  │                             │  │
│  │ +50 🌟 + 🏅 큐피드 뱃지     │  │
│  │ ─────────────────────────── │  │
│  │ 어제                        │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ 💪 다음에 다시!             │  │
│  │ 이번 소개는 성사되지        │  │
│  │ 않았어. 다음 소개를 응원해! │  │
│  │ ─────────────────────────── │  │
│  │ 2일 전                      │  │
│  └─────────────────────────────┘  │
│                                   │
└───────────────────────────────────┘
```

### 2-3. 주선자 대시보드 (프로필 > 나의 주선)

```
┌───────────────────────────────────┐
│  📊 나의 주선 현황                 │
│───────────────────────────────────│
│                                   │
│  총 소개: 12건                    │
│  대화 시작: 7건 (58%)             │
│  매칭 성사: 3건 (25%) 🏅          │
│                                   │
│  ─────────────────────────────── │
│  최근 소개                        │
│  태양↔지수    💬 대화 중          │
│  민수↔영희    ✅ 매칭 성사        │
│  현우↔소연    ⏳ 대기 중          │
│  도윤↔미나    ❌ 불발             │
│                                   │
│  ─────────────────────────────── │
│  누적 썬구리: 340 🌟              │
│                                   │
└───────────────────────────────────┘
```

---

## 3. DB 스키마

### 3-1. 핵심 테이블

```sql
-- 소개 건별 상태 추적
CREATE TABLE introductions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchmaker_id   UUID NOT NULL REFERENCES users(id),    -- 주선자
    sender_id       UUID NOT NULL REFERENCES users(id),    -- 소개 보낸 대상 (카드의 주인)
    receiver_id     UUID NOT NULL REFERENCES users(id),    -- 소개 받는 친구
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING → VIEWED → CHATTING → ACTIVE_CHAT → MATCHED
    -- PENDING → DECLINED
    -- PENDING → EXPIRED (72시간 무응답)
    message         TEXT,                                   -- 주선자의 한마디
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_status CHECK (
        status IN ('PENDING', 'VIEWED', 'CHATTING', 'ACTIVE_CHAT', 'MATCHED', 'DECLINED', 'EXPIRED')
    )
);

CREATE INDEX idx_intro_matchmaker ON introductions(matchmaker_id, created_at DESC);
CREATE INDEX idx_intro_status     ON introductions(status);
CREATE INDEX idx_intro_receiver   ON introductions(receiver_id, status);

-- 상태 변경 이력 (감사 로그 + 보상 지급 근거)
CREATE TABLE introduction_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    introduction_id UUID NOT NULL REFERENCES introductions(id),
    prev_status     VARCHAR(20),
    new_status      VARCHAR(20) NOT NULL,
    triggered_by    VARCHAR(20) NOT NULL, -- 'USER_ACTION' | 'SYSTEM' | 'TIMEOUT'
    metadata        JSONB,                -- ex: {"message_count": 3}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_intro ON introduction_events(introduction_id, created_at);

-- 주선자 알림
CREATE TABLE matchmaker_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchmaker_id   UUID NOT NULL REFERENCES users(id),
    introduction_id UUID NOT NULL REFERENCES introductions(id),
    type            VARCHAR(30) NOT NULL,
    -- 'CHAT_STARTED' | 'MATCH_SUCCESS' | 'INTRODUCTION_FAILED'
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    sungguri_amount INT DEFAULT 0,
    badge_slug      VARCHAR(50),          -- NULL이면 뱃지 없음
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_matchmaker ON matchmaker_notifications(matchmaker_id, is_read, created_at DESC);

-- 주선자 통계 (집계 캐시)
CREATE TABLE matchmaker_stats (
    user_id             UUID PRIMARY KEY REFERENCES users(id),
    total_introductions INT NOT NULL DEFAULT 0,
    chat_started_count  INT NOT NULL DEFAULT 0,
    match_success_count INT NOT NULL DEFAULT 0,
    total_sungguri      INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3-2. 상태 전이 다이어그램

```
PENDING ──(수락)──→ VIEWED ──(첫 메시지)──→ CHATTING ──(3+메시지)──→ ACTIVE_CHAT ──(매칭 확정)──→ MATCHED
   │                  │
   ├──(거절)──→ DECLINED
   │
   └──(72h)───→ EXPIRED
```

---

## 4. API 엔드포인트

### 4-1. 소개 상태 조회 (주선자용)

| 항목 | 내용 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/v1/introductions/mine` |
| **Auth** | Bearer Token (주선자) |
| **Query** | `?status=CHATTING&page=1&limit=20` |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "sender": { "id": "uuid", "nickname": "태양", "thumbnail": "url" },
      "receiver": { "id": "uuid", "nickname": "지수", "thumbnail": "url" },
      "status": "CHATTING",
      "message": "너 스타일이야 ㅋㅋ",
      "created_at": "2026-03-25T14:00:00Z",
      "updated_at": "2026-03-26T09:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 7 }
}
```

### 4-2. 주선자 통계 조회

| 항목 | 내용 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/v1/introductions/stats` |
| **Auth** | Bearer Token |

**Response 200:**

```json
{
  "total_introductions": 12,
  "chat_started_count": 7,
  "match_success_count": 3,
  "success_rate": 0.25,
  "total_sungguri": 340
}
```

### 4-3. 알림 목록 조회

| 항목 | 내용 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/v1/notifications/matchmaker` |
| **Auth** | Bearer Token |
| **Query** | `?is_read=false&page=1&limit=20` |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "CHAT_STARTED",
      "title": "🎉 대화 시작!",
      "body": "너의 소개로 태양↔지수가 대화를 시작했어!",
      "sungguri_amount": 20,
      "badge_slug": null,
      "is_read": false,
      "created_at": "2026-03-26T09:30:00Z"
    }
  ],
  "unread_count": 3,
  "pagination": { "page": 1, "limit": 20, "total": 8 }
}
```

### 4-4. 알림 읽음 처리

| 항목 | 내용 |
|------|------|
| **Method** | `PATCH` |
| **Path** | `/api/v1/notifications/matchmaker/{notification_id}/read` |
| **Auth** | Bearer Token |

**Response 200:**

```json
{ "success": true }
```

### 4-5. 상태 전이 트리거 (내부 API — 채팅 서비스에서 호출)

| 항목 | 내용 |
|------|------|
| **Method** | `POST` |
| **Path** | `/api/internal/introductions/{id}/transition` |
| **Auth** | Internal Service Token |

**Request:**

```json
{
  "new_status": "CHATTING",
  "triggered_by": "USER_ACTION",
  "metadata": { "message_count": 1, "first_message_by": "sender_uuid" }
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "prev_status": "VIEWED",
  "new_status": "CHATTING",
  "notification_sent": true,
  "sungguri_awarded": 20
}
```

---

## 5. 엣지 케이스

| # | 상황 | 처리 방법 |
|---|------|----------|
| 1 | 같은 주선자가 같은 두 사람을 중복 소개 | `introductions` 테이블에 `(matchmaker_id, sender_id, receiver_id)` 유니크 제약 + status가 `MATCHED`/`ACTIVE_CHAT`/`CHATTING`인 경우 재소개 차단. `DECLINED`/`EXPIRED`는 30일 후 재소개 허용 |
| 2 | 다른 주선자가 같은 두 사람을 소개 | 허용. 단, 두 번째 주선자에게 "이미 다른 친구가 소개한 사이야"라는 안내 표시. 매칭 성사 시 **먼저 소개한 주선자**에게 보상 |
| 3 | 72시간 무응답 (수신자가 안 봄) | Cron Job으로 `PENDING` 상태 72시간 초과 건 → `EXPIRED` 전이. 주선자에게 "이번에는 안 됐어" 알림 (거절과 동일 메시지로 프라이버시 보호) |
| 4 | 대화 중 한쪽이 탈퇴/차단 | 상태를 `DECLINED`로 전이. 주선자에게는 "성사되지 않았어"로 통합 알림 (탈퇴/차단 구분 안 함) |
| 5 | 주선자 본인이 탈퇴 | `introductions` 상태는 유지 (두 사람 간 연결은 끊지 않음). `matchmaker_id`는 soft-delete된 유저로 남김. 알림 전송 중단 |
| 6 | 매칭 확정 후 파토 | `MATCHED` 이후 상태 변경 없음. 이미 지급된 썬구리/뱃지 회수하지 않음 |
| 7 | 푸시 알림 실패 | 실패 시 인앱 알림으로 폴백. `matchmaker_notifications` 테이블에는 항상 저장. 앱 진입 시 unread 뱃지로 표시 |
| 8 | 소개 보낸 사람과 받는 사람이 동일 | API 레벨에서 `sender_id != receiver_id` 검증. 400 에러 반환 |

---

## 6. 썬구리 보상 연동

| 트리거 시점 | 보상 | 수신자 | 지급 조건 |
|------------|------|--------|----------|
| 소개 전송 시 | +5 | 주선자 | 기능 #1에서 처리 (여기서는 중복 지급 안 함) |
| 상대가 "볼게!" 수락 | +10 | 주선자 | `PENDING → VIEWED` 전이 시 |
| 대화 시작 (첫 메시지) | +20 | 주선자 | `VIEWED → CHATTING` 전이 시 |
| 매칭 성사 | +50 + 뱃지 | 주선자 | `ACTIVE_CHAT → MATCHED` 전이 시 |
| 매칭 성사 | 뱃지 "큐피드" | 주선자 | 최초 매칭 성사 시 1회. 이후 누적 뱃지 (5회: "베테랑 큐피드", 10회: "전설의 주선왕") |
| 소개 불발 | 0 | - | 보상 없음. 감정적 위로 메시지만 |

**지급 로직 (의사코드):**

```python
async def handle_status_transition(introduction_id: str, new_status: str):
    intro = await get_introduction(introduction_id)
    prev_status = intro.status

    # 상태 전이 기록
    await create_event(intro.id, prev_status, new_status)

    # 썬구리 보상
    rewards = {
        ("PENDING", "VIEWED"):       {"amount": 10, "badge": None},
        ("VIEWED", "CHATTING"):      {"amount": 20, "badge": None},
        ("ACTIVE_CHAT", "MATCHED"):  {"amount": 50, "badge": "cupid"},
    }

    reward = rewards.get((prev_status, new_status))
    if reward:
        await award_sungguri(intro.matchmaker_id, reward["amount"])
        if reward["badge"]:
            await maybe_award_badge(intro.matchmaker_id, reward["badge"])

    # 알림 발송
    notification_map = {
        "CHATTING": ("CHAT_STARTED", "🎉 대화 시작!", f"너의 소개로 {sender}↔{receiver}가 대화를 시작했어!"),
        "MATCHED":  ("MATCH_SUCCESS", "🎊 매칭 성사!", f"주선 성공! {sender}이(가) 고마워하고 있어"),
        "DECLINED": ("INTRODUCTION_FAILED", "💪 다음에 다시!", "이번 소개는 성사되지 않았어. 다음 소개를 응원해!"),
        "EXPIRED":  ("INTRODUCTION_FAILED", "💪 다음에 다시!", "이번 소개는 성사되지 않았어. 다음 소개를 응원해!"),
    }

    notif = notification_map.get(new_status)
    if notif:
        await send_matchmaker_notification(intro.matchmaker_id, intro.id, *notif)
```

---

## 7. 구현 난이도 / 예상 기간

### 백엔드

| 작업 | 난이도 | 예상 기간 |
|------|--------|----------|
| DB 스키마 + 마이그레이션 | 낮음 | 0.5일 |
| 상태 전이 엔진 (이벤트 기반) | 중간 | 2일 |
| 채팅 서비스 연동 (메시지 카운트 → 상태 전이 트리거) | 중간 | 1.5일 |
| 썬구리 보상 지급 로직 | 낮음 | 0.5일 |
| 알림 서비스 (인앱 + 푸시) | 중간 | 1.5일 |
| 만료 Cron Job (72시간 타임아웃) | 낮음 | 0.5일 |
| API 엔드포인트 (4개) | 낮음 | 1일 |
| **백엔드 합계** | | **약 7.5일** |

### 프론트엔드

| 작업 | 난이도 | 예상 기간 |
|------|--------|----------|
| 주선자 알림 목록 화면 | 낮음 | 1일 |
| 주선자 대시보드 (통계 + 소개 목록) | 중간 | 2일 |
| 푸시 알림 수신 + 딥링크 | 중간 | 1일 |
| 알림 뱃지 (탭바) | 낮음 | 0.5일 |
| 뱃지 획득 모달 (축하 애니메이션) | 중간 | 1일 |
| **프론트엔드 합계** | | **약 5.5일** |

### 총 예상: 약 2~2.5주 (1명 풀스택 기준)

---
---

# 기능 #16: "소개받고 싶어요" 토글

## 1. 핵심 목적

유저가 **자신이 소개 대상이 되는 것을 명시적으로 동의**하는 안전장치.
Hinge Matchmaker 실패(opt-out 기본값 → "creepy" 반응)를 직접 해결한다.

**원칙**: 기본값 OFF. 모든 주선 기능의 전제 조건(게이트).

---

## 2. 유저 플로우

### 2-1. 최초 진입 (온보딩 후 설정)

```
┌───────────────────────────────────┐
│  ✨ 프로필 설정 완료!              │
│                                   │
│  마지막으로 하나만!               │
│                                   │
│  친구들이 너를 다른 사람에게       │
│  소개할 수 있도록 허용할까?       │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ 🔘 소개받고 싶어요          │  │  ← OFF 상태
│  │                             │  │
│  │ 켜면 친구들이 다른 사람에게  │  │
│  │ 너를 소개할 수 있어요.      │  │
│  │ 소개 전에 항상 네 동의를    │  │
│  │ 먼저 구해요.               │  │
│  └─────────────────────────────┘  │
│                                   │
│  [나중에 설정할게]    [계속 →]    │
│                                   │
└───────────────────────────────────┘
```

### 2-2. 토글 ON 시 확인 모달

```
┌───────────────────────────────────┐
│                                   │
│  소개 허용을 켤까요?              │
│                                   │
│  ✅ 친구들이 너를 소개할 수 있어  │
│  ✅ 소개 전에 항상 동의를 구해    │
│  ✅ 프로필 사진은 친구에게만 보여 │
│  ✅ 언제든 끌 수 있어             │
│                                   │
│  [취소]          [켤게!]          │
│                                   │
└───────────────────────────────────┘
```

### 2-3. 설정 화면에서 관리

```
┌───────────────────────────────────┐
│  ⚙️ 설정 > 소개 관리              │
│───────────────────────────────────│
│                                   │
│  소개받고 싶어요                  │
│  [🟢━━━━━━━━━━━━━━━━━━━━━ ON]    │
│                                   │
│  친구들이 다른 사람에게 너를       │
│  소개할 수 있어요.                │
│  소개 전에 항상 네 동의를         │
│  먼저 구해요.                     │
│                                   │
│  ─────────────────────────────── │
│                                   │
│  소개받은 이력                    │
│  이번 달: 3건                     │
│  [소개 이력 보기 →]               │
│                                   │
│  ─────────────────────────────── │
│                                   │
│  ⚠️ 끄면 진행 중인 소개에는       │
│  영향을 주지 않아요.              │
│  새로운 소개만 차단돼요.          │
│                                   │
└───────────────────────────────────┘
```

### 2-4. 토글 OFF 시 확인 모달

```
┌───────────────────────────────────┐
│                                   │
│  소개 허용을 끌까요?              │
│                                   │
│  끄면 친구들이 너를 더 이상       │
│  소개할 수 없어요.                │
│                                   │
│  진행 중인 소개 2건은             │
│  영향받지 않아요.                 │
│                                   │
│  [취소]          [끌게]           │
│                                   │
└───────────────────────────────────┘
```

### 2-5. 다른 기능에서의 게이트 역할

```
[친구가 피드에서 소개 버튼 클릭]
        │
        ▼
┌── 소개 대상의 토글 상태 확인 ──┐
│                                │
│  ON → 소개 프로세스 정상 진행  │
│                                │
│  OFF → 소개 불가 메시지:       │
│  "이 친구는 지금 소개를        │
│   받고 싶지 않대. 😢"          │
│                                │
└────────────────────────────────┘
```

---

## 3. DB 스키마

### 3-1. 핵심 테이블

```sql
-- users 테이블에 컬럼 추가
ALTER TABLE users
    ADD COLUMN is_open_to_intro     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN intro_toggled_at     TIMESTAMPTZ;  -- 마지막 토글 변경 시각

-- 토글 변경 이력 (남용 방지 + 분석)
CREATE TABLE intro_toggle_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    old_value   BOOLEAN NOT NULL,
    new_value   BOOLEAN NOT NULL,
    source      VARCHAR(20) NOT NULL, -- 'ONBOARDING' | 'SETTINGS' | 'SYSTEM'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_toggle_user ON intro_toggle_history(user_id, created_at DESC);

-- 소개 가능 유저 빠른 조회를 위한 부분 인덱스
CREATE INDEX idx_users_open_intro ON users(id) WHERE is_open_to_intro = TRUE;
```

### 3-2. 기존 테이블 연동

```sql
-- introductions 테이블의 INSERT 전 체크
-- (애플리케이션 레벨에서 처리하되, DB 트리거로 이중 방어)

CREATE OR REPLACE FUNCTION check_intro_eligibility()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.receiver_id
        AND is_open_to_intro = TRUE
    ) THEN
        RAISE EXCEPTION 'Receiver has not opted in to introductions';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_intro_eligibility
    BEFORE INSERT ON introductions
    FOR EACH ROW
    EXECUTE FUNCTION check_intro_eligibility();
```

---

## 4. API 엔드포인트

### 4-1. 토글 상태 조회

| 항목 | 내용 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/v1/users/me/intro-toggle` |
| **Auth** | Bearer Token |

**Response 200:**

```json
{
  "is_open_to_intro": true,
  "toggled_at": "2026-03-20T10:00:00Z"
}
```

### 4-2. 토글 변경

| 항목 | 내용 |
|------|------|
| **Method** | `PUT` |
| **Path** | `/api/v1/users/me/intro-toggle` |
| **Auth** | Bearer Token |

**Request:**

```json
{
  "is_open_to_intro": true,
  "source": "SETTINGS"
}
```

**Response 200:**

```json
{
  "is_open_to_intro": true,
  "toggled_at": "2026-03-26T14:00:00Z",
  "message": "친구들이 너를 소개할 수 있게 됐어!"
}
```

**Response 429 (하루 토글 제한 초과):**

```json
{
  "error": "TOGGLE_RATE_LIMITED",
  "message": "토글은 하루에 5번까지만 변경할 수 있어요.",
  "retry_after": "2026-03-27T00:00:00Z"
}
```

### 4-3. 소개 가능 여부 확인 (다른 기능에서 호출)

| 항목 | 내용 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/v1/users/{user_id}/intro-eligible` |
| **Auth** | Bearer Token (요청자가 해당 유저의 친구여야 함) |

**Response 200:**

```json
{
  "user_id": "uuid",
  "is_eligible": true
}
```

**Response 200 (불가):**

```json
{
  "user_id": "uuid",
  "is_eligible": false,
  "reason": "USER_OPT_OUT"
}
```

### 4-4. 토글 변경 이력 조회 (관리자용)

| 항목 | 내용 |
|------|------|
| **Method** | `GET` |
| **Path** | `/api/admin/users/{user_id}/intro-toggle-history` |
| **Auth** | Admin Token |

**Response 200:**

```json
{
  "data": [
    {
      "old_value": false,
      "new_value": true,
      "source": "ONBOARDING",
      "created_at": "2026-03-20T10:00:00Z"
    },
    {
      "old_value": true,
      "new_value": false,
      "source": "SETTINGS",
      "created_at": "2026-03-25T22:00:00Z"
    }
  ]
}
```

---

## 5. 엣지 케이스

| # | 상황 | 처리 방법 |
|---|------|----------|
| 1 | 토글 OFF인데 진행 중인 소개가 있음 | 진행 중인 소개(`PENDING`, `VIEWED`, `CHATTING`, `ACTIVE_CHAT`)는 영향 없이 계속 진행. **새로운 소개만 차단**. 끄기 확인 모달에 진행 중 건수 표시 |
| 2 | 토글을 하루에 여러 번 On/Off 반복 (악용) | **하루 5회 제한**. 초과 시 429 에러. `intro_toggle_history`로 패턴 감지. 비정상 패턴 시 관리자 알림 |
| 3 | 친구가 소개 버튼 누르는 순간과 실제 전송 사이에 토글 변경 | 소개 `INSERT` 시점에 DB 트리거로 이중 체크. 그 사이에 OFF로 바뀌었으면 "소개를 보낼 수 없어요" 에러 |
| 4 | 온보딩에서 "나중에 설정할게" 선택 | 기본값 OFF 유지. 7일 후 인앱 넛지 알림: "소개받고 싶어요를 켜면 친구들이 소개해줄 수 있어!" |
| 5 | 계정 정지/신고된 유저 | 정지 시 자동으로 토글 OFF + 변경 불가 잠금. `source = 'SYSTEM'`으로 기록 |
| 6 | 유저 탈퇴 후 재가입 | 새 계정이므로 기본값 OFF 적용. 이전 토글 이력은 soft-delete된 계정에 남아있음 |
| 7 | 피드에서 "소개" 버튼이 보이지만 대상이 OFF | 피드 로딩 시 `is_open_to_intro = TRUE`인 유저만 소개 버튼 표시. 단, 캐시 딜레이로 버튼이 보일 수 있으므로 API 호출 시 재검증 |
| 8 | 친구가 0명인 유저가 토글 ON | 허용. 하지만 "소개해줄 친구를 먼저 추가해봐!"라는 안내 표시 |

---

## 6. 썬구리 보상 연동

| 트리거 시점 | 보상 | 수신자 | 비고 |
|------------|------|--------|------|
| 최초 토글 ON | +5 | 본인 | 온보딩 완료 보상의 일부. 1회만 지급 |
| 토글 유지 7일 연속 | +3 | 본인 | 주간 유지 보너스 (리텐션 장치) |
| 토글 유지 30일 연속 | +10 | 본인 | 월간 유지 보너스 |

> 토글 자체의 보상은 작게 유지. 핵심 보상은 실제 소개가 일어났을 때 기능 #15에서 처리.
> 토글을 켜는 것 자체가 "보상을 받기 위한 행동"이 되지 않도록 설계.

**지급 로직 (의사코드):**

```python
async def handle_toggle_change(user_id: str, old_value: bool, new_value: bool, source: str):
    # 이력 기록
    await create_toggle_history(user_id, old_value, new_value, source)

    # 최초 ON 보상
    if new_value is True and not await has_ever_toggled_on(user_id):
        await award_sungguri(user_id, 5)

    # 유저 업데이트
    await update_user_toggle(user_id, new_value)


# Cron: 매일 자정 실행 — 연속 유지 보너스
async def check_toggle_streaks():
    users = await get_users_with_toggle_on()
    for user in users:
        days_on = await calc_consecutive_days_on(user.id)
        if days_on == 7:
            await award_sungguri(user.id, 3)
        elif days_on == 30:
            await award_sungguri(user.id, 10)
```

---

## 7. 구현 난이도 / 예상 기간

### 백엔드

| 작업 | 난이도 | 예상 기간 |
|------|--------|----------|
| DB 스키마 변경 (users 컬럼 + 이력 테이블) | 낮음 | 0.5일 |
| 토글 API (조회/변경/이력) | 낮음 | 1일 |
| 소개 가능 여부 체크 API | 낮음 | 0.5일 |
| DB 트리거 (소개 INSERT 전 체크) | 낮음 | 0.5일 |
| 토글 rate limiting (하루 5회) | 낮음 | 0.5일 |
| 연속 유지 Cron Job | 낮음 | 0.5일 |
| 온보딩 넛지 알림 (7일 후) | 낮음 | 0.5일 |
| **백엔드 합계** | | **약 4일** |

### 프론트엔드

| 작업 | 난이도 | 예상 기간 |
|------|--------|----------|
| 온보딩 토글 안내 화면 | 낮음 | 0.5일 |
| 설정 > 소개 관리 화면 | 낮음 | 1일 |
| ON/OFF 확인 모달 | 낮음 | 0.5일 |
| 피드에서 소개 불가 상태 처리 (버튼 숨김/메시지) | 낮음 | 0.5일 |
| 넛지 알림 UI | 낮음 | 0.5일 |
| **프론트엔드 합계** | | **약 3일** |

### 총 예상: 약 1~1.5주 (1명 풀스택 기준)

---
---

# 기능 간 의존 관계

```
#16 토글 ──────────────────────── 다른 모든 주선 기능의 전제 조건 (게이트)
    │
    │  토글 ON인 유저만 소개 대상
    ▼
#1 피드 즉시 공유 ──────────────── 소개 전송 시 introductions 레코드 생성
    │
    │  소개 전송 완료
    ▼
#15 피드백 루프 ────────────────── 상태 추적 + 주선자 알림 + 보상
    │
    │  매칭 성사 시
    ▼
#11 성공 공유 카드 (Phase 3) ──── 바이럴 확산
```

## 구현 순서 권장

| 순서 | 기능 | 이유 |
|------|------|------|
| 1 | #16 토글 | 모든 주선 기능의 안전장치. 가장 먼저 있어야 함 |
| 2 | #15 피드백 루프 | #1(피드 즉시 공유)과 함께 연동. 주선 코어 루프 완성 |

---

> 이 문서는 `기능_브레인스토밍_v2.md`를 기반으로 작성된 Phase 1 시스템 상세 설계서입니다.
> 다음 단계: Phase 2 기능 (#6, #12, #3, #5, #13) 상세 설계
