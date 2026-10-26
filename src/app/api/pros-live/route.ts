// 지금 게임 중인 프로·스트리머·챌린저 계정.
// scripts/pro-builds.mjs 가 pro-data 브랜치에 모아둔 계정 목록에서 한 번에 30개씩 돌려가며 확인하고,
// 최근 10분 안에 확인된 "게임 중" 결과만 돌려줘요 (Riot 요청 한도를 지키려고 조금씩 나눠서 확인).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Acc = { server: string; who: string; puuid: string; label: string; kind: string };
type Seen = { at: number; live: null | { champ: number; start: number; queue: number } };

const BATCH = 30;
const FRESH_MS = 10 * 60_000;
const key = () =>
  process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/gi)?.at(-1) ?? process.env.RIOT_API_KEY?.trim();

let accounts: { at: number; list: Acc[] } | null = null;
const seen = new Map<string, Seen>();
let lastBatch = 0;

async function loadAccounts(): Promise<Acc[]> {
  if (accounts && Date.now() - accounts.at < 30 * 60_000) return accounts.list;
  const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/pro-data/builds.json", {
    next: { revalidate: 600 },
  });
  if (!res.ok) return accounts?.list ?? [];
  const data = (await res.json()) as {
    builds: { who: string; label: string; kind: string; s: string }[];
    accounts: Record<string, { puuid: string }>;
  };
  const meta = new Map(data.builds.map((b) => [`${b.s}|${b.who}`, b]));
  const list: Acc[] = Object.entries(data.accounts).flatMap(([k, v]) => {
    const [server, who] = [k.split("|")[0], k.slice(k.indexOf("|") + 1)];
    const m = meta.get(k);
    return v?.puuid ? [{ server, who, puuid: v.puuid, label: m?.label ?? who, kind: m?.kind ?? "pro" }] : [];
  });
  accounts = { at: Date.now(), list };
  return list;
}

export async function GET() {
  if (!key()) return NextResponse.json({ available: false, reason: "no-key" });
  try {
    const list = await loadAccounts();
    if (!list.length) return NextResponse.json({ available: false, reason: "no-accounts" });

    // 45초에 한 번만 새로 확인하고, 가장 오래 확인 안 한 계정부터
    if (Date.now() - lastBatch > 45_000) {
      lastBatch = Date.now();
      const batch = [...list].sort((a, b) => (seen.get(a.puuid)?.at ?? 0) - (seen.get(b.puuid)?.at ?? 0)).slice(0, BATCH);
      await Promise.all(
        batch.map(async (a) => {
          const res = await fetch(
            `https://${a.server}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${a.puuid}`,
            { headers: { "X-Riot-Token": key()! }, cache: "no-store" },
          );
          if (res.status === 401 || res.status === 403) throw new Error("key");
          if (res.status === 200) {
            const g = (await res.json()) as {
              gameStartTime: number;
              gameQueueConfigId: number;
              participants: { puuid: string; championId: number }[];
            };
            const me = g.participants.find((p) => p.puuid === a.puuid);
            seen.set(a.puuid, { at: Date.now(), live: me ? { champ: me.championId, start: g.gameStartTime, queue: g.gameQueueConfigId } : null });
          } else if (res.status === 404) seen.set(a.puuid, { at: Date.now(), live: null });
        }),
      );
    }

    const live = list.flatMap((a) => {
      const s = seen.get(a.puuid);
      return s?.live && Date.now() - s.at < FRESH_MS ? [{ server: a.server, who: a.who, label: a.label, kind: a.kind, ...s.live }] : [];
    });
    const checked = list.filter((a) => Date.now() - (seen.get(a.puuid)?.at ?? 0) < FRESH_MS).length;
    return NextResponse.json(
      { available: true, total: list.length, checked, live, at: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30" } },
    );
  } catch (e) {
    return NextResponse.json({ available: false, reason: e instanceof Error && e.message === "key" ? "key-rejected" : "error" });
  }
}
