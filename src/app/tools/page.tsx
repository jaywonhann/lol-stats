import type { Metadata } from "next";
import GameTimers from "@/components/GameTimers";
import { getSummonerSpells, getVersion, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { getLang } from "@/lib/server";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "게임 도구와 방송 채팅 명령어" : "Game tools and stream chat commands",
    description: ko ? "상대 스펠 쿨타임과 오브젝트 리스폰 타이머를 한 화면에서 확인해요." : "Enemy summoner spell cooldowns and objective respawn timers in one place.",
  };
}

export default async function ToolsPage() {
  const lang = await getLang();
  const ko = lang === "ko";
  const version = await getVersion();
  const spells = (await getSummonerSpells(version, ddLocale(lang)))
    .filter((s) => s.modes.includes("CLASSIC") && s.cooldown?.[0])
    .map((s) => ({ id: s.id, name: s.name, icon: img.spell(version, s.image.full), cd: s.cooldown![0] }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  const labels = ko
    ? {
        spells: "상대 소환사 주문 쿨타임",
        spellsNote: "상대가 주문을 쓰면 그 아이콘을 눌러요. 쿨타임이 끝날 때까지 시간이 줄어들고 다시 누르면 지워져요.",
        haste: "이오니아 장화 등 소환사 주문 쿨감 12",
        objectives: "오브젝트 리스폰 타이머",
        objectivesNote: "처치하는 순간에 눌러요. 리스폰 시간은 패치마다 바뀔 수 있어서 게임 내 값과 다르면 그걸 따라 주세요.",
        reset: "초기화",
        lanes: ["탑", "정글", "미드", "원딜", "서폿"],
        objs: [
          { id: "dragon", name: "드래곤", secs: 300 },
          { id: "baron", name: "내셔 남작", secs: 360 },
          { id: "elder", name: "장로 드래곤", secs: 360 },
          { id: "blue", name: "블루 버프", secs: 300 },
          { id: "red", name: "레드 버프", secs: 300 },
        ],
        ready: "준비",
        start: "쿨타임 시작",
      }
    : {
        spells: "Enemy summoner spell cooldowns",
        spellsNote: "Tap an icon when the enemy uses that spell. It counts down until it's back; tap again to clear it.",
        haste: "Summoner spell haste 12 (e.g. Ionian Boots)",
        objectives: "Objective respawn timers",
        objectivesNote: "Tap the moment it dies. Respawn times can change with patches, so trust the in-game value if it differs.",
        reset: "Reset",
        lanes: ["Top", "Jungle", "Mid", "ADC", "Support"],
        objs: [
          { id: "dragon", name: "Dragon", secs: 300 },
          { id: "baron", name: "Baron Nashor", secs: 360 },
          { id: "elder", name: "Elder Dragon", secs: 360 },
          { id: "blue", name: "Blue buff", secs: 300 },
          { id: "red", name: "Red buff", secs: 300 },
        ],
        ready: "Ready",
        start: "start cooldown",
      };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ko ? "게임 도구" : "Game tools"}</h1>
      <p className="text-sm text-muted">
        {ko
          ? "게임 옆 화면이나 휴대폰에 띄워 두고 쓰는 타이머예요. 설치도, 로그인도 필요 없고 기록은 이 브라우저에서만 돌아가요."
          : "Timers to keep on a second screen or your phone. No install, no login, and nothing leaves this browser."}
      </p>
      <GameTimers spells={spells} labels={labels} />
      {/* 방송 채팅 명령어: 스트리머가 한 줄 붙여 넣으면 시청자가 채팅에서 상성·카운터를 물어볼 수 있어요 */}
      <section id="stream" className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-lg font-bold">{ko ? "방송 채팅 명령어 (스트리머용)" : "Stream chat commands (for streamers)"}</h2>
        <p className="mt-1 text-sm text-muted">
          {ko
            ? "Nightbot을 쓰는 방송이면 아래 줄을 채팅에 한 번 붙여 넣으세요. 가입도 키도 필요 없어요. 그다음부터 시청자가 \"!상성 야스오 요네\"라고 치면 이번 패치 실제 승률이 채팅에 나와요."
            : "If your channel uses Nightbot, paste a line below into chat once. No signup, no key. After that, viewers can type \"!matchup yasuo yone\" and get the real win rate for this patch in chat."}
        </p>
        <div className="mt-3 space-y-3 text-sm">
          {(ko
            ? [
                ["상성 (!상성 야스오 요네)", `!addcom !상성 $(urlfetch ${SITE}/api/chat?lang=ko&q=$(querystring))`],
                ["카운터 (!카운터 아리)", `!addcom !카운터 $(urlfetch ${SITE}/api/chat?lang=ko&q=counter%20$(querystring))`],
              ]
            : [
                ["Matchup (!matchup yasuo yone)", `!addcom !matchup $(urlfetch ${SITE}/api/chat?q=$(querystring))`],
                ["Counters (!counter ahri)", `!addcom !counter $(urlfetch ${SITE}/api/chat?q=counter%20$(querystring))`],
              ]
          ).map(([label, cmd]) => (
            <div key={label}>
              <div className="font-semibold">{label}</div>
              <code className="mt-1 block select-all overflow-x-auto whitespace-nowrap rounded bg-black/30 px-3 py-2 text-xs">{cmd}</code>
            </div>
          ))}
          <p className="text-xs text-muted">
            {ko
              ? "한국 서버 에메랄드 이상 랭크 게임 기준이에요. 북미는 주소 끝에 &s=na, 유럽은 &s=euw를 붙이세요. StreamElements는 $(urlfetch ...) 대신 $(customapi ...)를 쓰면 돼요."
              : "Based on Emerald+ ranked games on the KR server. Add &s=na or &s=euw to the address for other servers. On StreamElements use $(customapi ...) instead of $(urlfetch ...)."}
          </p>
        </div>
      </section>
    </div>
  );
}
