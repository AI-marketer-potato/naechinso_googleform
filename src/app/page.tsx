"use client";

import { useState, FormEvent } from "react";

declare global {
  interface Window {
    fbq: (action: string, event: string, params?: Record<string, unknown>) => void;
  }
}

interface FormData {
  agreement1: string;
  privacyAgreement: boolean;
  smsAgreement: string;
  name: string;
  phone: string;
  birthYear: string;
  gender: string;
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    agreement1: "",
    privacyAgreement: false,
    smsAgreement: "",
    name: "",
    phone: "",
    birthYear: "",
    gender: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Meta Pixel Lead 이벤트 트래킹
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "Lead");
        }
        setSubmitMessage("신청이 완료되었습니다! 감사합니다.");
        handleReset();
      } else {
        setSubmitMessage("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } catch {
      setSubmitMessage("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      agreement1: "",
      privacyAgreement: false,
      smsAgreement: "",
      name: "",
      phone: "",
      birthYear: "",
      gender: "",
    });
  };

  return (
    <div className="min-h-screen py-6 px-4" style={{ background: "#f0ebf8" }}>
      <div className="max-w-[640px] mx-auto">
        <form onSubmit={handleSubmit}>
          {/* 헤더 카드 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 overflow-hidden">
            <div className="h-2.5 bg-green-600" />
            <div className="p-6">
              <h1 className="text-3xl font-normal text-gray-900 mb-4">
                💌 [슈중위X차세린] 콜라보 소개팅 신청서
              </h1>

              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <p className="font-medium">📌 소개팅 신청 마감</p>
                  <p className="ml-4">➡️ 1월 15일 목요일 저녁 8시 마감</p>
                </div>

                <div>
                  <p className="font-medium">📌소개팅 오픈 예정일</p>
                  <p className="ml-4">➡️ 1월 4주차 오픈 예정 (추후 @cha_serinn / @cha_serinn_event 계정 및 문자로 안내드리겠습니다!)</p>
                </div>

                <div>
                  <p className="font-medium text-red-500">📌 소개팅 신청 상세안내 (이건 꼭 확인해주셔야 합니다!) ⭐⭐⭐⭐⭐</p>
                  <p className="ml-4">
                    ➡️ <a href="#" className="text-blue-600 underline">지금 바로 보러가기</a>
                  </p>
                </div>

                <div>
                  <p className="font-medium">📌 소개팅 이벤트 관련 문의</p>
                  <p className="ml-4">
                    ➡️ <a href="#" className="text-blue-600 underline">@cha_serinn_event</a> 계정으로 DM 주세요!
                  </p>
                </div>

                <div>
                  <p className="font-medium">📌 내친소 앱 오류 문의</p>
                  <p className="ml-4">
                    ➡️ <a href="#" className="text-blue-600 underline">내친소 채널톡(링크클릭)</a> 으로 바로 문의주세요!
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-red-500 text-sm">* 표시는 필수 질문임</p>
              </div>
            </div>
          </div>

          {/* 사전 공지사항 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-gray-900 mb-2">
              📌 [슈중위 X 차세린] 콜라보 소개팅 사전 공지사항 (필독!) <span className="text-red-500">*</span>
            </h2>

            <div className="text-sm text-gray-700 space-y-3 mb-4">
              <div>
                <p className="font-semibold">1. 참여 자격 (꼭 이런 분들만 신청해주세요!)</p>
                <p>- 만 20세 이상 성인이신 분</p>
                <p>- 슈중위(@suechaehwa) 인스타그램 팔로워이신 분!</p>
                <p>- 진짜 괜찮은, 믿을 수 있는 분들과의 만남을 원하시는 분! ❤️</p>
              </div>

              <div>
                <p className="font-semibold">2. 프리미엄 소수 매칭 소개팅</p>
                <p>- 신원/소속 인증을 완료한 분들 중, <strong>슈중위 & 차세린이 직접 선별한 팔로워분들끼리만 연결</strong>됩니다.</p>
                <p>- <strong>구글폼 + [내친소] 앱 프로필, 자기소개 모두 작성 완료 시 신청이 최종 확정</strong>됩니다.</p>
                <p>- 제출해주신 내친소 앱 프로필과 자기소개를 기반으로 가장 잘 어울릴 것 같은 <strong>3~N0분을 선별해 소개</strong>해 드립니다.</p>
                <p className="text-gray-500">(거주 지역 및 신청 인원에 따라 상이)</p>
                <p>- 여러분의 프로필은 <strong>소개받는 소수의 사람들에게만 공개</strong>되며, 불특정 다수에게는 절대 노출되지 않으니 안심하세요 :)</p>
              </div>

              <div>
                <p className="font-semibold">3. 선발 기준 및 유의사항</p>
                <p>- 서로에게 잘 어울릴 분들로만 신중하게 연결해드릴 예정입니다.</p>
                <p>- 신청자가 많을 시, 꼼꼼한 검토 과정으로 인해 <strong>전원 선정이 어려울 수 있음</strong>을 미리 양해 부탁드립니다🥹</p>
                <p>- 미선정되신 분들께는 <strong>3차 소개팅 기회를 별도로 안내</strong>드릴게요 🥹❤️</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="agreement1"
                  value="agree"
                  checked={formData.agreement1 === "agree"}
                  onChange={(e) => setFormData({ ...formData, agreement1: e.target.value })}
                  className="w-5 h-5 text-green-600"
                  required
                />
                <span className="text-sm">모두 확인하였으며, 동의합니다.</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="agreement1"
                  value="disagree"
                  checked={formData.agreement1 === "disagree"}
                  onChange={(e) => setFormData({ ...formData, agreement1: e.target.value })}
                  className="w-5 h-5"
                />
                <span className="text-sm">동의하지 않습니다. (소개팅 참여 불가)</span>
              </label>
            </div>
          </div>

          {/* 개인정보 수집·이용 안내 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-red-500 mb-2">
              📌 개인정보 수집·이용 안내 <span>*</span>
            </h2>

            <div className="text-sm text-gray-700 space-y-2 mb-4">
              <p>본 설문은 소개팅 매칭 서비스 제공을 위해 필요한 최소한의 개인정보를 수집·이용합니다.</p>
              <p><strong>- 수집 목적 :</strong> 소개팅 매칭 서비스 제공 및 연락</p>
              <p><strong>- 수집 항목 :</strong> 이름, 연락처, 나이, 성별 등 신청자가 입력한 모든 항목</p>
              <p><strong>- 보유·이용 기간 :</strong> 서비스 종료 후 12개월 후 혹은 신청자 요청 시 즉시 삭제</p>
              <p><strong>- 동의 거부권 :</strong> 개인정보 수집·이용에 대한 동의를 거부할 수 있으나, 이 경우 서비스 신청이 제한됩니다.</p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.privacyAgreement}
                  onChange={(e) => setFormData({ ...formData, privacyAgreement: e.target.checked })}
                  className="w-5 h-5 text-green-600 rounded"
                  required
                />
                <span className="text-sm font-medium text-green-700">
                  본인은 위 내용을 충분히 이해하였으며, 개인정보 수집 및 이용에 동의합니다. (비동의 시 신청 불가)
                </span>
              </label>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="privacyRadio"
                checked={formData.privacyAgreement}
                onChange={() => setFormData({ ...formData, privacyAgreement: true })}
                className="w-5 h-5"
              />
              <span className="text-sm">동의합니다.</span>
            </label>
          </div>

          {/* 마케팅 정보(SMS) 수신 동의 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-red-500 mb-2">
              📌 마케팅 정보(SMS) 수신 동의 <span>*</span>
            </h2>

            <div className="text-sm text-gray-700 space-y-1 mb-4">
              <p>* 소개팅 오픈 일정 및 참여 안내 등 소개팅 진행에 필요한 중요한 안내는 모두 문자로 보내드릴 예정입니다.</p>
              <p>* 동의하지 않으실 경우, 관련 개별 안내를 받아보실 수 없습니다.</p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="smsAgreement"
                value="agree"
                checked={formData.smsAgreement === "agree"}
                onChange={(e) => setFormData({ ...formData, smsAgreement: e.target.value })}
                className="w-5 h-5"
                required
              />
              <span className="text-sm">네, 동의합니다.</span>
            </label>
          </div>

          {/* 성함 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-gray-900 mb-1">
              성함을 적어주세요. <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">(양식: 홍길동)</p>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="내 답변"
              className="w-full border-b border-gray-300 py-2 text-sm focus:outline-none focus:border-green-600"
              required
            />
          </div>

          {/* 번호 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-gray-900 mb-1">
              번호를 적어주세요. <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">(양식: 010-1234-1234)</p>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="내 답변"
              className="w-full border-b border-gray-300 py-2 text-sm focus:outline-none focus:border-green-600"
              required
            />
          </div>

          {/* 나이 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-gray-900 mb-1">
              나이가 어떻게 되시나요? (출생연도 기준) <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">(양식: 1996)</p>
            <input
              type="text"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
              placeholder="내 답변"
              className="w-full border-b border-gray-300 py-2 text-sm focus:outline-none focus:border-green-600"
              required
            />
          </div>

          {/* 성별 */}
          <div className="bg-white rounded-lg border border-gray-200 mb-3 p-6">
            <h2 className="text-base font-normal text-gray-900 mb-4">
              성별을 알려주세요. <span className="text-red-500">*</span>
            </h2>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === "male"}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-5 h-5"
                  required
                />
                <span className="text-sm">남자</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === "female"}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-5 h-5"
                />
                <span className="text-sm">여자</span>
              </label>
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="flex justify-between items-center mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? "제출 중..." : "제출"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              양식 지우기
            </button>
          </div>

          {submitMessage && (
            <div className={`mt-4 p-4 rounded-lg text-center ${
              submitMessage.includes("완료") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {submitMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
