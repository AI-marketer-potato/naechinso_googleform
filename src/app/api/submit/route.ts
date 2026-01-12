import { NextRequest, NextResponse } from "next/server";

interface FormData {
  agreement1: string;
  privacyAgreement: boolean;
  smsAgreement: string;
  name: string;
  phone: string;
  birthYear: string;
  gender: string;
}

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

    // Google Apps Script 웹 앱 URL
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_SCRIPT_URL) {
      console.error("GOOGLE_SCRIPT_URL is not configured");
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    // Google Sheets에 데이터 전송
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        agreement1: data.agreement1 === "agree" ? "동의" : "비동의",
        privacyAgreement: data.privacyAgreement ? "동의" : "비동의",
        smsAgreement: data.smsAgreement === "agree" ? "동의" : "비동의",
        name: data.name,
        phone: data.phone,
        birthYear: data.birthYear,
        gender: data.gender === "male" ? "남자" : "여자",
      }),
    });

    if (!response.ok) {
      throw new Error("Google Sheets 전송 실패");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
