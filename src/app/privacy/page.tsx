import type { Metadata } from "next";
import { Panel } from "@/components/ui";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

const TEXT = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: October 20, 2026",
    sections: [
      ["What we collect", "livelol.stats does not require an account. We don't ask for your name, email or password. If you use the feedback form, we store the message you write. If you search a summoner, the Riot ID you type is sent to Riot Games' API to show public ranked data."],
      ["Cookies and local storage", "We use cookies to remember your server and language. Our analytics (Vercel Web Analytics) counts page views without using cookies to track you across sites."],
      ["Advertising", "We may show ads through Google AdSense. Google and its partners may use cookies to show ads based on your visits to this and other sites. You can manage this at https://adssettings.google.com or opt out at https://www.aboutads.info."],
      ["Third parties", "Game data comes from Riot Games' public API. Fonts, images and videos may be loaded from Riot, YouTube and CDN providers, which receive your IP address when you load them."],
      ["Contact", "Questions or deletion requests: use the feedback form on the FAQ page."],
      ["Disclaimer", "livelol.stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties."],
    ],
  },
  ko: {
    title: "개인정보처리방침",
    updated: "최종 수정: 2026년 10월 20일",
    sections: [
      ["수집하는 정보", "livelol.stats는 회원가입이 없고 이름, 이메일, 비밀번호를 받지 않아요. 의견 보내기를 쓰면 작성한 내용이 저장돼요. 소환사 검색을 하면 입력한 라이엇 ID가 공개 랭크 정보를 보여주기 위해 Riot Games API로 전송돼요."],
      ["쿠키와 로컬 저장소", "선택한 서버와 언어를 기억하려고 쿠키를 써요. 방문 통계(Vercel Web Analytics)는 다른 사이트까지 따라다니며 추적하는 쿠키 없이 페이지 조회수를 세요."],
      ["광고", "구글 애드센스로 광고를 보여줄 수 있어요. 구글과 파트너는 이 사이트와 다른 사이트의 방문 기록을 바탕으로 광고를 보여주려고 쿠키를 쓸 수 있어요. https://adssettings.google.com 에서 설정하거나 https://www.aboutads.info 에서 거부할 수 있어요."],
      ["제3자 서비스", "게임 데이터는 Riot Games의 공개 API에서 가져와요. 글꼴, 이미지, 영상은 Riot, YouTube, CDN에서 불러올 수 있고, 이때 방문자의 IP 주소가 해당 서비스에 전달돼요."],
      ["문의", "질문이나 삭제 요청은 FAQ 페이지의 의견 보내기로 남겨 주세요."],
      ["면책", "livelol.stats는 Riot Games의 보증을 받지 않았고, Riot Games 또는 Riot Games 관련 제작·운영에 공식적으로 참여한 누구의 견해도 반영하지 않아요."],
    ],
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = TEXT[await getLang()];
  return { title: t.title };
}

export default async function PrivacyPage() {
  const t = TEXT[await getLang()];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-sm text-muted">{t.updated}</p>
      {t.sections.map(([h, b]) => (
        <Panel key={h}>
          <h2 className="mb-1 font-semibold">{h}</h2>
          <p className="text-sm leading-relaxed text-muted">{b}</p>
        </Panel>
      ))}
    </div>
  );
}
