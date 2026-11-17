import type { Metadata } from "next";
import DailyGame, { type DailyQ } from "@/components/DailyGame";
import BreadcrumbLd from "@/components/BreadcrumbLd";
import { getChampions, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { laneLabel } from "@/lib/lanes";
import { topMatchups } from "@/lib/matchups";
import { getLang, langAlternates } from "@/lib/server";

export const dynamic = "force-dynamic";

// 매일 하는 승률 맞히기 (2026-11-17). 큰 사이트는 검색보다 "매일 다시 오는 습관"으로 커서(loldle 방문의 42%가 직접 접속),
// 매일 문제가 바뀌고 결과를 한 줄로 공유할 수 있는 게임을 뒀어요. 수집해 둔 상성 데이터만 써요 (Riot 호출 없음).
const FIRST_DAY = Date.UTC(2026, 10, 17);
const ROUNDS = 5;

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    alternates: await langAlternates("/daily"),
    title: ko ? "오늘의 승률 맞히기 - 매일 5문제 롤 상성 퀴즈" : "Daily Matchup Quiz - Guess Who Wins the Lane (5 a day)",
    description: ko
      ? "두 챔피언 중 누가 더 많이 이길까요? 실제 랭크 게임 승률로 매일 5문제가 새로 나와요. 결과를 친구와 비교해 보세요."
      : "Which champion wins the lane more often? Five new questions every day from real ranked games. Compare your score with friends.",
  };
}

// 날짜로 정해지는 순서 (같은 날에는 모두 같은 문제)
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default async function DailyPage() {
  const lang = await getLang();
  const ko = lang === "ko";
  const { version, champions } = await getChampions(ddLocale(lang));
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const now = Date.now();
  const dayNo = Math.floor((now - FIRST_DAY) / 86_400_000) + 1;
  const date = new Date(now).toISOString().slice(0, 10);

  // 표본이 충분하고(150게임 이상) 승률 차이가 분명한(50%에서 3%p 이상) 상성만, 같은 두 챔피언은 한 번만
  const seen = new Set<string>();
  const pool = topMatchups()
    .slice(0, 1500)
    .filter((m) => {
      const r = (m.wins / m.games) * 100;
      const pair = [m.a, m.b].sort().join(":") + m.lane;
      if (m.games < 150 || Math.abs(r - 50) < 3 || !byKey.has(m.a) || !byKey.has(m.b) || seen.has(pair)) return false;
      seen.add(pair);
      return true;
    });
  const rnd = seeded(dayNo * 7919 + 17);
  const picked: typeof pool = [];
  const used = new Set<string>();
  for (let guard = 0; picked.length < ROUNDS && guard < 400 && pool.length; guard++) {
    const m = pool[Math.floor(rnd() * pool.length)];
    // 하루 안에 같은 챔피언이 두 번 나오지 않게
    if (used.has(m.a) || used.has(m.b)) continue;
    used.add(m.a);
    used.add(m.b);
    picked.push(m);
  }
  const questions: DailyQ[] = picked.map((m) => {
    // 왼쪽·오른쪽 자리도 날짜로 섞어요 (표본 많은 쪽이 늘 왼쪽이면 티가 나서)
    const flip = rnd() < 0.5;
    const [x, y] = flip ? [m.b, m.a] : [m.a, m.b];
    const A = byKey.get(x)!;
    const B = byKey.get(y)!;
    const aRate = flip ? 100 - (m.wins / m.games) * 100 : (m.wins / m.games) * 100;
    return {
      a: { id: A.id, name: A.name, img: img.champion(version, A.image.full) },
      b: { id: B.id, name: B.name, img: img.champion(version, B.image.full) },
      lane: m.lane,
      laneName: laneLabel(m.lane, lang),
      aRate: Math.round(aRate * 10) / 10,
      games: m.games,
    };
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BreadcrumbLd items={[{ name: ko ? "오늘의 승률 맞히기" : "Daily matchup quiz", path: "/daily" }]} />
      <div>
        <h1 className="text-2xl font-bold">{ko ? "오늘의 승률 맞히기" : "Daily matchup quiz"}</h1>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? "같은 라인에서 만났을 때 누가 더 많이 이길까요? 실제 랭크 게임 기록으로 매일 5문제가 새로 나와요."
            : "When these two meet in lane, who wins more often? Five new questions every day from real ranked games."}
        </p>
      </div>
      {questions.length < ROUNDS ? (
        <p className="rounded-lg bg-panel p-4 text-sm text-muted">{ko ? "오늘 문제를 만들 데이터가 아직 부족해요. 잠시 뒤에 다시 와 주세요." : "Not enough data for today's quiz yet. Please come back a little later."}</p>
      ) : (
        <DailyGame questions={questions} date={date} dayNo={dayNo} ko={ko} />
      )}
    </div>
  );
}
