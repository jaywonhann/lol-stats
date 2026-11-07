// 지금 게임 중인 프로·스트리머·챌린저 계정.
// scripts/pro-builds.mjs 가 pro-data 브랜치에 모아둔 계정 목록에서 한 번에 30개씩 돌려가며 확인하고,
// 최근 10분 안에 확인된 "게임 중" 결과만 돌려줘요 (Riot 요청 한도를 지키려고 조금씩 나눠서 확인).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Acc = { server: string; who: string; puuid: string; label: string; kind: string };
type Seen = { at: number; live: null | { champ: number; start: number; queue: number }; riotId?: string };

const BATCH = 30;
const FRESH_MS = 10 * 60_000;
const key = () =>
  process.env.RIOT_API_KEY?.match(/RGAPI-[0-9a-f-]{36}/gi)?.at(-1) ?? process.env.RIOT_API_KEY?.trim();

let accounts: { at: number; list: Acc[] } | null = null;
const seen = new Map<string, Seen>();
let lastBatch = 0;
// 마지막 확인 묶음의 응답 코드별 개수 (문제 진단용, 키 값은 담지 않아요)
let lastStatus: Record<string, number> = {};

async function loadAccounts(): Promise<Acc[]> {
  if (accounts && Date.now() - accounts.at < 30 * 60_000) return accounts.list;
  const res = await fetch("https://raw.githubusercontent.com/jaywonhann/lol-stats/pro-data/builds.json", {
    next: { revalidate: 600 },
  });
  if (!res.ok) return accounts?.list ?? [];
  const data = (await res.json()) as {
    builds: { who: string; label: string; kind: string; s: string }[];
    accounts: Record<string, { puuid: string; ok?: boolean }>;
  };
  const meta = new Map(data.builds.map((b) => [`${b.s}|${b.who}`, b]));
  // 수집기가 지금 키로 확인한(ok) 계정만 써요. 예전 키의 계정 ID는 Riot이 400으로 거절해요
  const entries = Object.entries(data.accounts);
  const checkedOk = entries.some(([, v]) => v.ok !== undefined);
  const list: Acc[] = entries.filter(([, v]) => !checkedOk || v.ok).flatMap(([k, v]) => {
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
      lastStatus = {};
      const batch = [...list].sort((a, b) => (seen.get(a.puuid)?.at ?? 0) - (seen.get(b.puuid)?.at ?? 0)).slice(0, BATCH);
      await Promise.all(
        batch.map(async (a) => {
          const res = await fetch(
            `https://${a.server}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${a.puuid}`,
            { headers: { "X-Riot-Token": key()! }, cache: "no-store" },
          );
          lastStatus[res.status] = (lastStatus[res.status] ?? 0) + 1;
          if (res.status === 401 || res.status === 403) throw new Error("key");
          if (res.status === 200) {
            const g = (await res.json()) as {
              gameStartTime: number;
              gameQueueConfigId: number;
              participants: { puuid: string; championId: number; riotId?: string }[];
            };
            const me = g.participants.find((p) => p.puuid === a.puuid);
            // 관전 응답의 riotId는 지금 닉네임이에요. 프로가 닉네임을 바꿔도 전적 링크가 열리게 이걸 써요
            seen.set(a.puuid, { at: Date.now(), live: me ? { champ: me.championId, start: g.gameStartTime, queue: g.gameQueueConfigId } : null, riotId: me?.riotId?.includes("#") ? me.riotId : undefined });
          } else if (res.status === 404) seen.set(a.puuid, { at: Date.now(), live: null });
        }),
      );
    }

    const live = list.flatMap((a) => {
      const s = seen.get(a.puuid);
      return s?.live && Date.now() - s.at < FRESH_MS ? [{ server: a.server, who: s.riotId ?? a.who, label: a.label, kind: a.kind, ...s.live }] : [];
    });
    const checked = list.filter((a) => Date.now() - (seen.get(a.puuid)?.at ?? 0) < FRESH_MS).length;
    return NextResponse.json(
      { available: true, total: list.length, checked, live, lastStatus, at: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30" } },
    );
  } catch (e) {
    return NextResponse.json({ available: false, reason: e instanceof Error && e.message === "key" ? "key-rejected" : "error" });
  }
}
