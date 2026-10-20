import type { Metadata } from "next";
import FeedbackForm from "@/components/FeedbackForm";
import { Panel } from "@/components/ui";
import type { Lang } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

type Content = {
  title: string;
  intro: string;
  faq: { q: string; a: string }[];
  feedback: Parameters<typeof FeedbackForm>[0]["labels"];
};

const CONTENT: Record<Lang, Content> = {
  en: {
    title: "FAQ & Feedback",
    intro: "Common questions about livelol.stats, and a place to tell us what you think.",
    faq: [
      {
        q: "What is livelol.stats?",
        a: "A League of Legends stats site. It shows champion tiers, winning builds and runes, counters, meta trends, and a summary of any player's recent ranked games.",
      },
      {
        q: "Where does the data come from?",
        a: "From Riot Games' official API. We collect Emerald-and-above Ranked Solo/Duo games on Korea, North America and EU West, and analyze them ourselves.",
      },
      {
        q: "How often is it updated?",
        a: "Champion stats update every 6 hours (00:00, 06:00, 12:00 and 18:00 KST). The live player number refreshes every 2 minutes. Summoner pages refresh when you press Update.",
      },
      {
        q: "Is the live player count every player online?",
        a: "No. Riot doesn't publish how many people are online. We check a sample of Master+ players to see how many are in a game right now and scale that to the whole Master+ ladder, so it's an estimate.",
      },
      {
        q: "Summoner search says it can't find me or isn't available.",
        a: "Enter your full Riot ID with the tag (for example Hide on bush#KR1) and pick the right server at the top right. If it says it's busy, wait a minute and try again, since Riot limits how many requests we can make.",
      },
      {
        q: "How does the Update button work?",
        a: "It fetches your latest rank and games from Riot right away. To stay within Riot's limits, each player can be updated once a minute.",
      },
      {
        q: "Do you store my personal information?",
        a: "No. We don't keep a list of who searched for what. Search results are kept for a few minutes so the page loads faster. Feedback you send below is only seen by the site owner.",
      },
      {
        q: "Is this site run by Riot Games?",
        a: "No. livelol.stats is a fan-made site and isn't endorsed by Riot Games.",
      },
    ],
    feedback: {
      title: "Leave feedback",
      intro: "What did you like, what's missing, what broke? Every message is read.",
      ratingLabel: "How was the site?",
      good: "Good",
      okay: "Okay",
      bad: "Not great",
      message: "Your feedback",
      messagePlaceholder: "e.g. I'd love to see ARAM stats too",
      contact: "Contact (optional)",
      contactPlaceholder: "Email or Discord if you want a reply",
      send: "Send",
      sending: "Sending…",
      thanks: "Thanks! Your feedback was sent.",
      empty: "Pick a rating or write a message first.",
      off: "Feedback isn't open yet. Please check back soon.",
      slow: "You're sending feedback too fast. Try again in a minute.",
      error: "Couldn't send it. Please try again in a moment.",
      privacy: "Only the site owner can see what you send.",
    },
  },
  ko: {
    title: "FAQ · 피드백",
    intro: "livelol.stats에 대해 자주 묻는 질문과, 사이트 의견을 남길 수 있는 곳이에요.",
    faq: [
      {
        q: "livelol.stats는 어떤 사이트인가요?",
        a: "리그 오브 레전드 통계 사이트예요. 챔피언 티어, 승률 높은 빌드와 룬, 카운터, 메타 흐름, 그리고 소환사의 최근 랭크 게임 분석을 보여줘요.",
      },
      {
        q: "데이터는 어디서 가져오나요?",
        a: "Riot Games 공식 API에서 가져와요. 한국·북미·유럽 서버의 에메랄드 이상 솔로랭크 게임을 모아서 직접 분석해요.",
      },
      {
        q: "얼마나 자주 업데이트되나요?",
        a: "챔피언 통계는 6시간마다(한국 시간 0시, 6시, 12시, 18시) 갱신돼요. 실시간 플레이어 수는 2분마다, 소환사 정보는 업데이트 버튼을 누르면 바로 갱신돼요.",
      },
      {
        q: "실시간 플레이어 수는 접속자 전체인가요?",
        a: "아니요. Riot은 접속자 수를 공개하지 않아요. 마스터 이상 랭커 일부가 지금 게임 중인지 확인하고, 그 비율을 마스터 이상 전체에 곱한 추정치예요.",
      },
      {
        q: "소환사 검색이 안 되거나 못 찾는다고 나와요.",
        a: "태그까지 포함한 Riot ID(예: Hide on bush#KR1)를 입력하고, 오른쪽 위에서 서버가 맞는지 확인해 주세요. 요청이 많다고 나오면 Riot 요청 한도 때문이니 1분 뒤에 다시 시도해 주세요.",
      },
      {
        q: "업데이트 버튼은 어떻게 작동하나요?",
        a: "Riot에서 최신 랭크와 게임 기록을 바로 다시 받아와요. Riot 요청 한도를 지키기 위해 같은 소환사는 1분에 한 번만 업데이트할 수 있어요.",
      },
      {
        q: "제 개인정보가 저장되나요?",
        a: "아니요. 누가 무엇을 검색했는지 기록하지 않아요. 검색 결과는 빨리 보여주기 위해 몇 분 동안만 임시로 보관해요. 아래 피드백은 사이트 운영자만 볼 수 있어요.",
      },
      {
        q: "Riot Games가 운영하는 사이트인가요?",
        a: "아니요. livelol.stats는 팬이 만든 사이트이고 Riot Games의 공식 사이트가 아니에요.",
      },
    ],
    feedback: {
      title: "피드백 남기기",
      intro: "좋았던 점, 아쉬운 점, 고장 난 곳, 있으면 좋겠는 기능 뭐든 남겨 주세요. 하나하나 다 읽어요.",
      ratingLabel: "사이트 어땠나요?",
      good: "좋아요",
      okay: "보통이에요",
      bad: "별로예요",
      message: "하고 싶은 말",
      messagePlaceholder: "예: 칼바람 통계도 있으면 좋겠어요",
      contact: "연락처 (선택)",
      contactPlaceholder: "답장을 받고 싶으면 이메일이나 디스코드",
      send: "보내기",
      sending: "보내는 중…",
      thanks: "고마워요! 피드백이 전달됐어요.",
      empty: "평가를 고르거나 내용을 적어 주세요.",
      off: "피드백 받기를 준비 중이에요. 조금만 기다려 주세요.",
      slow: "너무 빨리 보내고 있어요. 1분 뒤에 다시 보내 주세요.",
      error: "보내지 못했어요. 잠시 후 다시 시도해 주세요.",
      privacy: "보낸 내용은 사이트 운영자만 볼 수 있어요.",
    },
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: CONTENT[await getLang()].title };
}

export default async function FaqPage() {
  const lang = await getLang();
  const c = CONTENT[lang];
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section>
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="mt-2 text-muted">{c.intro}</p>
      </section>

      <div className="space-y-3">
        {c.faq.map((f, i) => (
          <details key={f.q} open={i < 2} className="group rounded-lg border border-line bg-panel px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
              <span>
                <span className="mr-2 text-accent">Q.</span>
                {f.q}
              </span>
              <span className="text-muted transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 text-base leading-relaxed text-text/90">{f.a}</p>
          </details>
        ))}
      </div>

      <section id="feedback" className="scroll-mt-6">
        <Panel title={c.feedback.title}>
          <p className="-mt-1 mb-4 text-sm text-muted">{c.feedback.intro}</p>
          <FeedbackForm lang={lang} labels={c.feedback} />
        </Panel>
      </section>
    </div>
  );
}
