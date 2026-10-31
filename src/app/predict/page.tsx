import type { Metadata } from "next";
import { Icon, Panel } from "@/components/ui";
import { getChampions, getPatches, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { laneLabel, serverLabel } from "@/lib/lanes";
import { predict, PREDICT_LANES } from "@/lib/predict";
import { statsSource } from "@/lib/stats";
import { getLang, getServer } from "@/lib/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "승률 예측" : "Win predictor",
    description: ko ? "챔피언 조합과 상성으로 이번 판의 승률을 미리 예측해요." : "Predict your win chance from champion picks and matchups.",
  };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PredictPage({ searchParams }: Props) {
  const [sp, lang, server] = await Promise.all([searchParams, getLang(), getServer()]);
  const ko = lang === "ko";
  const [{ version, champions }, patches] = await Promise.all([getChampions(ddLocale(lang)), getPatches()]);
  const sorted = [...champions].sort((a, b) => a.name.localeCompare(b.name, lang));
  const byKey = new Map(champions.map((c) => [c.key, c]));
  const picks = (side: "b" | "r") => PREDICT_LANES.map((l) => one(sp[`${side}_${l}`]));
  const blue = picks("b");
  const red = picks("r");
  const full = [...blue, ...red].every((k) => byKey.has(k));

  const src = statsSource(patches, { server, rank: "all" });
  const data = src.source === "real" ? src.real.get(src.patches[src.patches.length - 1]) : undefined;
  const result = full && data ? predict(data, blue, red) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ko ? "승률 예측" : "Win predictor"}</h1>
      <p className="text-sm text-muted">
        {ko
          ? "로딩 화면에서 보이는 두 팀의 챔피언을 라인별로 고르면, 우리가 모은 랭크 게임으로 어느 팀이 유리한지 추정해요."
          : "Pick both teams' champions by lane and we estimate which side is favored from our ranked game data."}
      </p>

      <form method="get" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {(["b", "r"] as const).map((side) => (
            <Panel key={side} title={side === "b" ? (ko ? "블루 팀" : "Blue team") : ko ? "레드 팀" : "Red team"}>
              <div className="space-y-2">
                {PREDICT_LANES.map((l, i) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <span className="w-16 shrink-0 text-muted">{laneLabel(l, lang)}</span>
                    <select
                      name={`${side}_${l}`}
                      required
                      defaultValue={(side === "b" ? blue : red)[i]}
                      className="h-9 min-w-0 flex-1 rounded-md border border-line bg-panel-2 px-2 text-text"
                    >
                      <option value="">{ko ? "챔피언 선택" : "Pick a champion"}</option>
                      {sorted.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </Panel>
          ))}
        </div>
        <button type="submit" className="h-10 rounded-md bg-accent px-5 font-semibold text-black hover:brightness-110">
          {ko ? "예측하기" : "Predict"}
        </button>
      </form>

      {full && !data && (
        <Panel>
          <p className="text-sm text-muted">
            {ko ? "이 서버는 아직 수집한 게임이 부족해서 예측할 수 없어요." : "Not enough collected games on this server yet."}
          </p>
        </Panel>
      )}

      {result && (
        <Panel title={ko ? "예측 결과" : "Result"}>
          <div className="mb-1 flex justify-between text-lg font-bold tabular-nums">
            <span style={{ color: "var(--chart-up)" }}>{(result.blue * 100).toFixed(1)}%</span>
            <span style={{ color: "var(--chart-down)" }}>{((1 - result.blue) * 100).toFixed(1)}%</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-line">
            <div style={{ width: `${result.blue * 100}%`, background: "var(--chart-up)" }} />
            <div style={{ flex: 1, background: "var(--chart-down)" }} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {result.edges.map((e, i) => {
              const b = byKey.get(blue[i])!;
              const r = byKey.get(red[i])!;
              return (
                <li key={e.lane} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-muted">{laneLabel(e.lane, lang)}</span>
                  <Icon src={img.champion(version, b.image.full)} alt={b.name} size={28} />
                  <span className="text-muted">vs</span>
                  <Icon src={img.champion(version, r.image.full)} alt={r.name} size={28} />
                  <span className="ml-auto tabular-nums" style={{ color: e.edge >= 0 ? "var(--chart-up)" : "var(--chart-down)" }}>
                    {e.source === "none"
                      ? ko ? "자료 없음" : "no data"
                      : `${e.edge >= 0 ? (ko ? "블루 유리" : "Blue") : ko ? "레드 유리" : "Red"} ${Math.abs(e.edge * 100).toFixed(0)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted">
            {ko
              ? `${serverLabel(server, lang)} 서버 랭크 게임 집계로 만든 추정이에요. 라인 맞상대 승률과 챔피언 평균 승률만 쓰고 플레이어 실력이나 팀 조합 시너지는 반영하지 않아서 30~70%로만 보여줘요. 실제 결과로 보정한 모델은 아니에요.`
              : `A rough estimate from ${serverLabel(server, lang)} ranked games. It only uses lane matchups and champion win rates, ignoring player skill and team synergy, so it is capped at 30–70%. It isn't calibrated against real results.`}
          </p>
        </Panel>
      )}
    </div>
  );
}
