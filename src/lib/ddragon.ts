// Riot Data Dragon: 챔피언·아이템·룬·스펠 같은 정적 게임 데이터 (API 키 불필요)
const BASE = process.env.DDRAGON_BASE ?? "https://ddragon.leagueoflegends.com";
// 기본 로케일은 영어, 페이지에서 ddLocale(lang)을 넘겨 바꿉니다
const DEFAULT_LOCALE = "en_US";
// 새 패치가 나오면 1시간 안에 자동으로 반영됩니다
const REVALIDATE = 60 * 60;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Data Dragon ${path} 요청 실패: ${res.status}`);
  return res.json() as Promise<T>;
}

// 전적 페이지가 매번 쓰는 작은 파일들(버전·챔피언 목록·룬·스펠)은 읽은 결과를 10분 동안 메모리에 들고 있어요.
// 무료 서버는 CPU가 느려서 요청마다 캐시 파일을 다시 읽고 JSON을 푸는 데만 수백 ms가 들었어요.
// 아이템처럼 큰 파일은 메모리(힙 한도)가 빠듯해서 넣지 않아요.
const MEMO_MS = 10 * 60_000;
const MEMO_OK = /^\/api\/versions\.json$|\/(champion|runesReforged|summoner)\.json$/;
// 2026-11-13: 10분이 지나면 다시 받을 때까지 기다려서, 그 순간 전적 검색이 2초 넘게 멈췄어요.
// 이제는 10분이 지나도 들고 있던 값을 바로 쓰고, 새 값은 뒤에서 받아 바꿔 넣어요.
const memo = new Map<string, { at: number; value: Promise<unknown>; refreshing?: boolean }>();
function getJson<T>(path: string): Promise<T> {
  if (!MEMO_OK.test(path)) return fetchJson<T>(path);
  const hit = memo.get(path);
  if (hit) {
    if (Date.now() - hit.at >= MEMO_MS && !hit.refreshing) {
      hit.refreshing = true;
      fetchJson<T>(path).then(
        (v) => memo.set(path, { at: Date.now(), value: Promise.resolve(v) }),
        () => {
          hit.refreshing = false;
          hit.at = Date.now();
        },
      );
    }
    return hit.value as Promise<T>;
  }
  const value = fetchJson<T>(path);
  memo.set(path, { at: Date.now(), value });
  value.catch(() => memo.delete(path));
  return value;
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
  cooldown?: number[];
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

export async function getChampions(locale = DEFAULT_LOCALE): Promise<{
  version: string;
  champions: Champion[];
}> {
  const version = await getVersion();
  const data = await getJson<{ data: Record<string, Champion> }>(
    `/cdn/${version}/data/${locale}/champion.json`,
  );
  const champions = Object.values(data.data).sort((a, b) =>
    a.name.localeCompare(b.name, locale.slice(0, 2)),
  );
  return { version, champions };
}

export async function getChampion(
  id: string,
  locale = DEFAULT_LOCALE,
): Promise<{ version: string; champion: ChampionDetail } | null> {
  const version = await getVersion();
  const res = await fetch(
    `${BASE}/cdn/${version}/data/${locale}/champion/${encodeURIComponent(id)}.json`,
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

export async function getItems(
  version: string,
  locale = DEFAULT_LOCALE,
): Promise<Item[]> {
  const data = await getJson<{ data: Record<string, Omit<Item, "id">> }>(
    `/cdn/${version}/data/${locale}/item.json`,
  );
  return Object.entries(data.data).map(([id, item]) => ({ ...item, id }));
}

export async function getRuneTrees(
  version: string,
  locale = DEFAULT_LOCALE,
): Promise<RuneTree[]> {
  return getJson<RuneTree[]>(
    `/cdn/${version}/data/${locale}/runesReforged.json`,
  );
}

export async function getSummonerSpells(
  version: string,
  locale = DEFAULT_LOCALE,
): Promise<SummonerSpell[]> {
  const data = await getJson<{ data: Record<string, SummonerSpell> }>(
    `/cdn/${version}/data/${locale}/summoner.json`,
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
  // 로딩 화면 그림 (308x560): 공유 카드처럼 서버에서 그림을 다룰 때 스플래시(1215x717)보다 메모리를 훨씬 덜 써요
  loading: (id: string, skin = 0) => `${BASE}/cdn/img/champion/loading/${id}_${skin}.jpg`,
  splash: (id: string, skin = 0) =>
    `${BASE}/cdn/img/champion/splash/${id}_${skin}.jpg`,
  profileIcon: (v: string, id: number) =>
    `${BASE}/cdn/${v}/img/profileicon/${id}.png`,
};

// 패치 표기: "15.20.1" -> "15.20"
export const patchLabel = (version: string) =>
  version.split(".").slice(0, 2).join(".");
