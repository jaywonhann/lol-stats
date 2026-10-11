// Riot Data Dragon: 챔피언·아이템·룬·스펠 같은 정적 게임 데이터 (API 키 불필요)
const BASE = process.env.DDRAGON_BASE ?? "https://ddragon.leagueoflegends.com";
const LOCALE = "ko_KR";
// 새 패치가 나오면 1시간 안에 자동으로 반영됩니다
const REVALIDATE = 60 * 60;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Data Dragon ${path} 요청 실패: ${res.status}`);
  return res.json() as Promise<T>;
}

export type Champion = {
  id: string; // 영문 키 (예: "Ahri")
  key: string; // 숫자 ID (예: "103")
  name: string;
  title: string;
  tags: string[];
  image: { full: string };
};

export type Spell = {
  id: string;
  name: string;
  description: string;
  image: { full: string };
};

export type ChampionDetail = Champion & {
  lore: string;
  spells: Spell[];
  passive: { name: string; description: string; image: { full: string } };
};

export type Item = {
  id: string;
  name: string;
  plaintext: string;
  gold: { total: number; purchasable: boolean };
  tags: string[];
  into?: string[];
  from?: string[];
  maps: Record<string, boolean>;
  depth?: number;
  requiredChampion?: string;
  requiredAlly?: string;
  inStore?: boolean;
  image: { full: string };
};

export type Rune = {
  id: number;
  key: string;
  name: string;
  icon: string;
  shortDesc: string;
};
export type RuneTree = {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: { runes: Rune[] }[];
};

export type SummonerSpell = {
  id: string;
  key: string;
  name: string;
  modes: string[];
  image: { full: string };
};

export async function getVersion(): Promise<string> {
  const versions = await getJson<string[]>("/api/versions.json");
  return versions[0];
}

// 최근 패치 목록 ("16.20" 형식), 오래된 -> 최신 순서
export async function getPatches(count = 8): Promise<string[]> {
  const versions = await getJson<string[]>("/api/versions.json");
  const patches: string[] = [];
  for (const v of versions) {
    if (!/^\d+\.\d+\.\d+$/.test(v)) continue;
    const p = patchLabel(v);
    if (!patches.includes(p)) patches.push(p);
    if (patches.length === count) break;
  }
  return patches.reverse();
}

export async function getChampions(): Promise<{
  version: string;
  champions: Champion[];
}> {
  const version = await getVersion();
  const data = await getJson<{ data: Record<string, Champion> }>(
    `/cdn/${version}/data/${LOCALE}/champion.json`,
  );
  const champions = Object.values(data.data).sort((a, b) =>
    a.name.localeCompare(b.name, "ko"),
  );
  return { version, champions };
}

export async function getChampion(
  id: string,
): Promise<{ version: string; champion: ChampionDetail } | null> {
  const version = await getVersion();
  const res = await fetch(
    `${BASE}/cdn/${version}/data/${LOCALE}/champion/${encodeURIComponent(id)}.json`,
    {
      next: { revalidate: REVALIDATE },
    },
  );
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok)
    throw new Error(`Data Dragon champion/${id} 요청 실패: ${res.status}`);
  const data = (await res.json()) as { data: Record<string, ChampionDetail> };
  return { version, champion: data.data[id] };
}

export async function getItems(version: string): Promise<Item[]> {
  const data = await getJson<{ data: Record<string, Omit<Item, "id">> }>(
    `/cdn/${version}/data/${LOCALE}/item.json`,
  );
  return Object.entries(data.data).map(([id, item]) => ({ ...item, id }));
}

export async function getRuneTrees(version: string): Promise<RuneTree[]> {
  return getJson<RuneTree[]>(
    `/cdn/${version}/data/${LOCALE}/runesReforged.json`,
  );
}

export async function getSummonerSpells(
  version: string,
): Promise<SummonerSpell[]> {
  const data = await getJson<{ data: Record<string, SummonerSpell> }>(
    `/cdn/${version}/data/${LOCALE}/summoner.json`,
  );
  return Object.values(data.data);
}

export const img = {
  champion: (v: string, file: string) =>
    `${BASE}/cdn/${v}/img/champion/${file}`,
  item: (v: string, id: string) => `${BASE}/cdn/${v}/img/item/${id}.png`,
  spell: (v: string, file: string) => `${BASE}/cdn/${v}/img/spell/${file}`,
  passive: (v: string, file: string) => `${BASE}/cdn/${v}/img/passive/${file}`,
  rune: (icon: string) => `${BASE}/cdn/img/${icon}`,
};

// 패치 표기: "15.20.1" -> "15.20"
export const patchLabel = (version: string) =>
  version.split(".").slice(0, 2).join(".");
