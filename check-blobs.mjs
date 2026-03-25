import { list } from "@vercel/blob";
import "dotenv/config";

async function checkBlobs() {
  try {
    const blobs = await list({ prefix: "submissions/" });

    console.log(`\n📊 총 ${blobs.blobs.length}개의 JSON 파일이 저장되어 있습니다.\n`);

    if (blobs.blobs.length === 0) {
      console.log("⚠️  아직 저장된 데이터가 없습니다.");
      return;
    }

    console.log("저장된 파일 목록:");
    console.log("─".repeat(60));

    for (const blob of blobs.blobs) {
      const response = await fetch(blob.url);
      const data = await response.json();
      console.log(`📄 ${blob.pathname}`);
      console.log(`   이름: ${data.name}, 전화: ${data.phone}, 시간: ${data.timestamp}`);
    }

    console.log("─".repeat(60));
  } catch (error) {
    console.error("❌ 오류:", error.message);
  }
}

checkBlobs();
