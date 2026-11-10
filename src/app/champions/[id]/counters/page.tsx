import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Icon, Panel, Tabs, WinRate } from "@/components/ui";
import { getChampion, getChampions, img, type Champion } from "@/lib/ddragon";
import { LANES, laneLabel, serverLabel, type Lane } from "@/lib/lanes";
import { getLang, getServer, langAlternates } from "@/lib/server";
import { ddLocale, numLocale, timeAgo, type Lang } from "@/lib/i18n";
import { realLanes } from "@/lib/real";
import { latest, MIN_GAMES, rows } from "@/lib/counters";

export const dynamic = "force-dynamic";

// "야스오 카운터"처럼 검색이 많은 키워드용 페이지.
// 챔피언 페이지에는 쉬운/어려운 상대 5명씩만 있어서, 여기서는 표본이 충분한 상대를 전부 보여줘요.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ lane?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, sp, lang] = await Promise.all([params, searchParams, getLang()]);
  const data = await getChampion(id, ddLocale(lang));
  if (!data) return {};
  const ko = lang === "ko";
  const ln = LANES.find((l) => l.id === sp.lane)?.id;
  const n = ln ? `${data.champion.name} ${laneLabel(ln, lang)}` : data.champion.name;
  return {
    alternates: await langAlternates(`/champions/${data.champion.id}/counters${ln ? `?lane=${ln}` : ""}`),
    title: ko ? `${n} 카운터 - 상대하기 쉬운·어려운 챔피언` : `${n} Counters - Best Picks Against ${data.champion.name}`,
    description: ko
      ? `${n} 카운터 챔피언과 ${data.champion.name}(으)로 이기기 쉬운 상대를 이번 패치 실제 랭크 게임 승률로 정리했어요.`
      : `Champions that counter ${n} and the matchups ${data.champion.name} wins, ranked by real ranked win rates this patch.`,
  };
}

export default async function CountersPage({ params, searchParams }: Props) {
  const [{ id }, sp, lang, server] = await Promise.all([params, searchParams, getLang(), getServer()]);
  const ko = lang === "ko";
  const nl = numLocale(lang);
  const data = await getChampion(id, ddLocale(lang));
  if (!data) notFound();
  const { version, champion } = data;
  const { champions } = await getChampions(ddLocale(lang));
  const patch = latest(server);
  const lanes = patch ? realLanes(patch, champion) : [];
  const lane: Lane | undefined = lanes.includes(sp.lane as Lane) ? (sp.lane as Lane) : lanes[0];
  const r = patch && lane ? rows(patch, champion, lane, champions) : null;
  const name = champion.name;
  const laneName = lane ? laneLabel(lane, lang) : "";

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <Icon src={img.champion(version, champion.image.full)} alt={name} size={64} className="rounded-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{ko ? `${name} 카운터` : `${name} counters`}</h1>
            <p className="mt-1 text-sm text-muted">
              {r && patch
                ? ko
                  ? `${serverLabel(server, lang)} 에메랄드+ · ${patch.patch} 패치 · ${laneName} ${name} ${r.games.toLocaleString(nl)}판 (평균 승률 ${r.base.toFixed(1)}%)`
                  : `${serverLabel(server, lang)} Emerald+ · patch ${patch.patch} · ${r.games.toLocaleString(nl)} ${laneName} ${name} games (avg win rate ${r.base.toFixed(1)}%)`
                : ko
                  ? "아직 이 챔피언의 표본이 부족해요."
                  : "Not enough games for this champion yet."}
            </p>
          </div>
          <Link href={`/champions/${champion.id}${lane ? `?lane=${lane}` : ""}`} className="rounded-md bg-panel-2 px-3 py-2 text-sm font-semibold hover:text-accent">
            {ko ? `${name} 빌드 보기 →` : `${name} build →`}
          </Link>
        </div>
        {lanes.length > 1 && (
          <div className="mt-3">
            <Tabs
              active={lane}
              items={LANES.filter((l) => lanes.includes(l.id)).map((l) => ({ id: l.id, label: laneLabel(l.id, lang), href: `/champions/${champion.id}/counters?lane=${l.id}` }))}
            />
          </div>
        )}
      </Panel>

      {r && lane && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={ko ? `${name} 카운터 (상대하기 어려움)` : `Champions that counter ${name}`}>
            <p className="mb-3 text-xs text-muted">{ko ? `이 챔피언을 만나면 ${name} 승률이 떨어져요. 오른쪽 숫자는 상대 챔피언의 승률이에요.` : `${name} loses more often against these. The number is the counter's win rate.`}</p>
            <List rows={r.counters} flip me={champion.id} lane={lane} version={version} lang={lang} />
          </Panel>
          <Panel title={ko ? `${name}(으)로 이기기 쉬운 상대` : `Champions ${name} beats`}>
            <p className="mb-3 text-xs text-muted">{ko ? `이 상대를 만나면 ${name} 승률이 올라가요. 오른쪽 숫자는 ${name}의 승률이에요.` : `${name} wins more often against these. The number is ${name}'s win rate.`}</p>
            <List rows={r.victims} me={champion.id} lane={lane} version={version} lang={lang} />
          </Panel>
        </div>
      )}
      {r && patch && (
        <p className="text-xs text-muted">
          {ko
            ? `같은 라인에서 ${MIN_GAMES}판 이상 만난 상대 ${r.total}명 기준이에요. 판수가 적은 상대는 평균 쪽으로 보정해서 순위를 매겨요. 업데이트 ${timeAgo(patch.updatedAt, lang)}.`
            : `Based on ${r.total} lane opponents with ${MIN_GAMES}+ games. Small samples are pulled toward the average before ranking. Updated ${timeAgo(patch.updatedAt, lang)}.`}
        </p>
      )}
    </div>
  );
}

function List({
  rows,
  flip = false,
  me,
  lane,
  version,
  lang,
}: {
  rows: { champion: Champion; games: number; winRate: number }[];
  flip?: boolean;
  me: string;
  lane: Lane;
  version: string;
  lang: Lang;
}) {
  const ko = lang === "ko";
  if (!rows.length) return <p className="text-sm text-muted">{ko ? "표본이 부족해요." : "Not enough games yet."}</p>;
  return (
    <ol className="space-y-2">
      {rows.map((m, i) => (
        <li key={m.champion.id} className="flex items-center gap-2">
          <span className="w-5 text-right text-xs tabular-nums text-muted">{i + 1}</span>
          <Link href={`/champions/${m.champion.id}/counters?lane=${lane}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-accent">
            <Icon src={img.champion(version, m.champion.image.full)} alt={m.champion.name} size={32} />
            <span className="truncate text-sm font-medium">{m.champion.name}</span>
          </Link>
          <Link href={`/matchup?a=${me}&b=${m.champion.id}&lane=${lane}`} className="text-right text-xs hover:text-accent">
            <span className="block text-sm font-bold tabular-nums">
              <WinRate value={flip ? 100 - m.winRate : m.winRate} />
            </span>
            <span className="text-muted">{ko ? `${m.games.toLocaleString("ko-KR")}판` : `${m.games.toLocaleString("en-US")} games`}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
