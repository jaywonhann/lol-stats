import type { Metadata } from "next";
import GameTimers from "@/components/GameTimers";
import { getSummonerSpells, getVersion, img } from "@/lib/ddragon";
import { ddLocale } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ko = (await getLang()) === "ko";
  return {
    title: ko ? "게임 도구" : "Game tools",
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
        spellsNote: "상대가 주문을 쓰면 그 아이콘을 눌러요. 쿨타임이 끝날 때까지 시간이 줄어들고, 다시 누르면 지워져요.",
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
    </div>
  );
}
