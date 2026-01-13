import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

interface FormData {
  agreement1: string;
  privacyAgreement: boolean;
  smsAgreement: string;
  name: string;
  phone: string;
  birthYear: string;
  gender: string;
}

interface SubmissionData {
  timestamp: string;
  agreement1: string;
  privacyAgreement: string;
  smsAgreement: string;
  name: string;
  phone: string;
  birthYear: string;
  gender: string;
}

const CSV_HEADERS = "타임스탬프,사전공지동의,개인정보동의,SMS동의,성함,전화번호,출생연도,성별";

export async function POST(request: NextRequest) {
  try {
    const data: FormData = await request.json();

    // 필수 필드 검증
    if (!data.name || !data.phone || !data.birthYear || !data.gender) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    // 제출 데이터 생성
    const timestamp = new Date().toISOString();
    const submission: SubmissionData = {
      timestamp,
      agreement1: data.agreement1 === "agree" ? "동의" : "비동의",
      privacyAgreement: data.privacyAgreement ? "동의" : "비동의",
      smsAgreement: data.smsAgreement === "agree" ? "동의" : "비동의",
      name: data.name,
      phone: data.phone,
      birthYear: data.birthYear,
      gender: data.gender === "male" ? "남자" : "여자",
    };

    // 고유 파일명으로 저장 (timestamp + random)
    const filename = `submissions/${timestamp.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.json`;

    await put(filename, JSON.stringify(submission), {
      access: "public",
      contentType: "application/json",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// CSV 다운로드 API
export async function GET() {
  try {
    const blobs = await list({ prefix: "submissions/" });

    if (blobs.blobs.length === 0) {
      return new NextResponse(CSV_HEADERS + "\n", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="submissions.csv"',
        },
      });
    }

    // 모든 JSON 파일 읽어서 합치기
    const submissions: SubmissionData[] = [];

    for (const blob of blobs.blobs) {
      try {
        const response = await fetch(blob.url);
        const data: SubmissionData = await response.json();
        submissions.push(data);
      } catch {
        // 개별 파일 읽기 실패 시 스킵
      }
    }

    // 시간순 정렬
    submissions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // CSV 생성
    const csvRows = submissions.map(s =>
      [s.timestamp, s.agreement1, s.privacyAgreement, s.smsAgreement, s.name, s.phone, s.birthYear, s.gender]
        .map(field => `"${field}"`)
        .join(",")
    );

    const csvContent = CSV_HEADERS + "\n" + csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="submissions.csv"',
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "다운로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
