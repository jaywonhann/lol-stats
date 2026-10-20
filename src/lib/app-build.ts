// 윈도우 앱이 클라이언트에 넣을 룬·스펠 (추천 빌드의 1순위)
import type { Build } from "./mock";
import { realShards, type ChampAgg } from "./real";

export type RunePayload = { name: string; primaryStyleId: number; subStyleId: number; selectedPerkIds: number[] };

export function applyPayloads(agg: ChampAgg, b: Build, champName: string): { runes: RunePayload | null; spells: number[] | null } {
  const rune = b.runes[0]?.value;
  // 능력치 파편은 모인 데이터가 있으면 그 값, 없으면 빼고 보내요 (앱이 클라이언트의 기본 파편으로 채움)
  const shards = realShards(agg) ?? [];
  const perks = rune ? [rune.keystone, ...rune.primaryRunes, ...rune.secondaryRunes, ...shards] : [];
  const runes =
    rune && rune.primaryRunes.length === 3 && rune.secondaryRunes.length === 2 && (perks.length === 6 || perks.length === 9)
      ? { name: champName, primaryStyleId: rune.primary.id, subStyleId: rune.secondary.id, selectedPerkIds: perks }
      : null;

  // 점멸은 F(두 번째 칸)에 둡니다
  const keys = b.spells[0]?.value.map((x) => Number(x.key)) ?? [];
  const spells = keys.length === 2 && keys.every(Number.isFinite) ? (keys[0] === 4 ? [keys[1], keys[0]] : keys) : null;
  return { runes, spells };
}
