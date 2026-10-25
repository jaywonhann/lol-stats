import { Icon, Panel } from "@/components/ui";
import { img } from "@/lib/ddragon";
import type { Lang } from "@/lib/i18n";
import type { realWinRates } from "@/lib/real";

type WR = ReturnType<typeof realWinRates>;

// 가장 많이 쓰는 선택보다 승률이 확실히 높은데 덜 쓰이는 선택을 찾습니다 (표본은 realWinRates가 걸러줌)
function hidden<T>(rows: { value: T; winRate: number; games: number }[]) {
  if (rows.length < 2) return null;
  const main = rows.reduce((a, b) => (b.games > a.games ? b : a));
  const best = rows
    .filter((r) => r !== main && r.games >= 30 && r.games < main.games)
    .sort((a, b) => b.winRate - a.winRate)[0];
  return best && best.winRate - main.winRate >= 2 ? { main, best } : null;
}

// "숨은 꿀팁": 우리 통계에서 뽑은, 덜 알려졌지만 승률이 높은 선택. 지어낸 팁이 아니라 실제 집계 기반이에요.
export default function HiddenTips({
  wr,
  version,
  lang,
  champName,
}: {
  wr: WR;
  version: string;
  lang: Lang;
  champName: string;
}) {
  const ko = lang === "ko";
  const tips: { key: string; icon: React.ReactNode; text: string }[] = [];

  const core = hidden(wr.core);
  if (core) {
    const names = core.best.value.map((i) => i.name).join(" → ");
    tips.push({
      key: "core",
      icon: core.best.value.map((i) => <Icon key={i.id} src={img.item(version, i.id)} alt={i.name} size={28} />),
      text: ko
        ? `${names} 순서로 가면 승률이 ${core.best.winRate.toFixed(1)}%예요. 가장 많이 가는 빌드(${core.main.winRate.toFixed(1)}%)보다 ${(core.best.winRate - core.main.winRate).toFixed(1)}%p 높아요. (${core.best.games}게임)`
        : `${names} wins ${core.best.winRate.toFixed(1)}%, ${(core.best.winRate - core.main.winRate).toFixed(1)} points above the most common build (${core.main.winRate.toFixed(1)}%). (${core.best.games} games)`,
    });
  }
  const spell = hidden(wr.spells);
  if (spell) {
    const names = spell.best.value.map((s) => s.name).join(" + ");
    tips.push({
      key: "spell",
      icon: spell.best.value.map((s) => <Icon key={s.id} src={img.spell(version, s.image.full)} alt={s.name} size={28} />),
      text: ko
        ? `스펠을 ${names}로 하면 승률 ${spell.best.winRate.toFixed(1)}%예요. 주로 쓰는 조합보다 ${(spell.best.winRate - spell.main.winRate).toFixed(1)}%p 높아요. (${spell.best.games}게임)`
        : `Spells ${names} win ${spell.best.winRate.toFixed(1)}%, ${(spell.best.winRate - spell.main.winRate).toFixed(1)} points above the usual pair. (${spell.best.games} games)`,
    });
  }
  const rune = hidden(wr.runes);
  if (rune) {
    const { keystone, secondary } = rune.best.value;
    tips.push({
      key: "rune",
      icon: [
        <Icon key="k" src={img.rune(keystone.icon)} alt={keystone.name} size={28} className="rounded-full bg-bg" />,
        <Icon key="s" src={img.rune(secondary.icon)} alt={secondary.name} size={20} />,
      ],
      text: ko
        ? `${keystone.name} + ${secondary.name} 룬은 승률 ${rune.best.winRate.toFixed(1)}%로, 가장 흔한 룬보다 ${(rune.best.winRate - rune.main.winRate).toFixed(1)}%p 높아요. (${rune.best.games}게임)`
        : `${keystone.name} + ${secondary.name} wins ${rune.best.winRate.toFixed(1)}%, ${(rune.best.winRate - rune.main.winRate).toFixed(1)} points above the most common runes. (${rune.best.games} games)`,
    });
  }

  const q = encodeURIComponent(ko ? `${champName} 꿀팁 쇼츠` : `${champName} tips shorts`);
  if (tips.length === 0) return null;
  return (
    <Panel title={ko ? "숨은 꿀팁" : "Hidden tips"}>
      <p className="mb-3 text-xs text-muted">
        {ko
          ? "덜 쓰이지만 승률이 확실히 높은 선택을 집계에서 골랐어요."
          : "Less-used picks that win clearly more, taken from our data."}
      </p>
      <ul className="space-y-3">
        {tips.map((tip) => (
          <li key={tip.key} className="flex items-center gap-3 text-sm">
            <span className="flex shrink-0 items-center gap-1">{tip.icon}</span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
      <a
        href={`https://www.youtube.com/results?search_query=${q}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-text"
      >
        ▶ {ko ? `${champName} 꿀팁 쇼츠 보기` : `Watch ${champName} tips shorts`}
      </a>
    </Panel>
  );
}
