import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";

interface FormData {
  agreement1: string;
  privacyAgreement: boolean;
  smsAgreement: string;
  name: string;
  phone: string;
  birthYear: string;
  gender: string;
}

const CSV_FILENAME = "submissions.csv";
const CSV_HEADERS = "타임스탬프,사전공지동의,개인정보동의,SMS동의,성함,전화번호,출생연도,성별\n";

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

    // CSV 행 생성
    const timestamp = new Date().toISOString();
    const csvRow = [
      timestamp,
      data.agreement1 === "agree" ? "동의" : "비동의",
      data.privacyAgreement ? "동의" : "비동의",
      data.smsAgreement === "agree" ? "동의" : "비동의",
      data.name,
      data.phone,
      data.birthYear,
      data.gender === "male" ? "남자" : "여자",
    ].map(field => `"${field}"`).join(",") + "\n";

    // 기존 CSV 가져오기
    let existingContent = CSV_HEADERS;
    let existingBlobUrl: string | null = null;

    try {
      const blobs = await list({ prefix: CSV_FILENAME });
      if (blobs.blobs.length > 0) {
        existingBlobUrl = blobs.blobs[0].url;
        const response = await fetch(existingBlobUrl);
        existingContent = await response.text();
      }
    } catch {
      // 파일이 없으면 헤더만 있는 새 파일 시작
    }

    // 기존 파일 삭제 (있으면)
    if (existingBlobUrl) {
      await del(existingBlobUrl);
    }

    // 새 데이터 추가
    const newContent = existingContent + csvRow;

    // 새 Blob 저장
    await put(CSV_FILENAME, newContent, {
      access: "public",
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
    const blobs = await list({ prefix: CSV_FILENAME });

    if (blobs.blobs.length === 0) {
      return new NextResponse(CSV_HEADERS, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${CSV_FILENAME}"`,
        },
      });
    }

    const response = await fetch(blobs.blobs[0].url);
    const csvContent = await response.text();

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${CSV_FILENAME}"`,
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
