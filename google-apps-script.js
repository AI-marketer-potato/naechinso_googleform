/**
 * Google Apps Script - 소개팅 신청서 데이터 저장
 *
 * 설정 방법:
 * 1. Google Sheets에서 새 스프레드시트 생성
 * 2. 첫 번째 행에 다음 헤더 입력:
 *    타임스탬프 | 사전공지동의 | 개인정보동의 | SMS동의 | 성함 | 전화번호 | 출생연도 | 성별
 * 3. 확장 프로그램 > Apps Script 클릭
 * 4. 아래 코드를 붙여넣기
 * 5. 배포 > 새 배포 > 웹 앱 선택
 * 6. 다음 설정으로 배포:
 *    - 설명: 소개팅 신청서 API
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 7. 배포 후 생성된 URL을 복사하여 .env.local의 GOOGLE_SCRIPT_URL에 입력
 */

function doPost(e) {
  try {
    // 스프레드시트 열기 (현재 스크립트가 연결된 시트)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // POST 데이터 파싱
    const data = JSON.parse(e.postData.contents);

    // 새 행 추가
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.agreement1 || '',
      data.privacyAgreement || '',
      data.smsAgreement || '',
      data.name || '',
      data.phone || '',
      data.birthYear || '',
      data.gender || ''
    ]);

    // 성공 응답
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // 오류 응답
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 요청 처리 (테스트용)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ message: "소개팅 신청서 API가 작동 중입니다." }))
    .setMimeType(ContentService.MimeType.JSON);
}
