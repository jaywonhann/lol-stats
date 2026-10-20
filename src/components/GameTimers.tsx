"use client";
import { useEffect, useState } from "react";

type Spell = { id: string; name: string; icon: string; cd: number };
type Labels = {
  spells: string; spellsNote: string; haste: string; objectives: string; objectivesNote: string;
  reset: string; lanes: string[]; objs: { id: string; name: string; secs: number }[]; ready: string; start: string;
};

const DEFAULTS = ["SummonerFlash", "SummonerTeleport"];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// 상대 소환사 주문 쿨타임과 오브젝트 리스폰을 눌러서 재는 타이머 (브라우저 안에서만 동작, 서버로 아무것도 보내지 않아요)
export default function GameTimers({ spells, labels }: { spells: Spell[]; labels: Labels }) {
  const [now, setNow] = useState(() => Date.now());
  const [haste, setHaste] = useState(false);
  const [pick, setPick] = useState<string[][]>(() =>
    labels.lanes.map(() => [DEFAULTS[0], DEFAULTS[1]]),
  );
  const [ends, setEnds] = useState<Record<string, number>>({});
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const byId = new Map(spells.map((s) => [s.id, s]));
  const toggle = (key: string, secs: number) =>
    setEnds((e) => {
      const n = { ...e };
      if (n[key] && n[key] > Date.now()) delete n[key];
      else n[key] = Date.now() + secs * 1000;
      return n;
    });
  const left = (key: string) => Math.max(0, Math.ceil(((ends[key] ?? 0) - now) / 1000));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-panel p-4">
        <h2 className="text-lg font-bold">{labels.spells}</h2>
        <p className="mb-3 text-xs text-muted">{labels.spellsNote}</p>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={haste} onChange={(e) => setHaste(e.target.checked)} />
          {labels.haste}
        </label>
        <ul className="space-y-2">
          {labels.lanes.map((lane, i) => (
            <li key={lane} className="flex flex-wrap items-center gap-3">
              <span className="w-16 shrink-0 text-sm text-muted">{lane}</span>
              {[0, 1].map((slot) => {
                const sp = byId.get(pick[i][slot]);
                const key = `s${i}-${slot}`;
                const l = left(key);
                const cd = sp ? Math.round(haste ? (sp.cd * 100) / 112 : sp.cd) : 0;
                return (
                  <div key={slot} className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!sp}
                      onClick={() => sp && toggle(key, cd)}
                      className="relative h-11 w-11 overflow-hidden rounded-md border border-line"
                      aria-label={sp ? `${sp.name} ${labels.start}` : ""}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {sp && <img src={sp.icon} alt="" width={44} height={44} className={l ? "opacity-40" : ""} />}
                      {l > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold tabular-nums text-white">
                          {mmss(l)}
                        </span>
                      )}
                    </button>
                    <select
                      value={pick[i][slot]}
                      onChange={(e) =>
                        setPick((p) => p.map((row, r) => (r === i ? row.map((v, s) => (s === slot ? e.target.value : v)) : row)))
                      }
                      className="h-9 w-24 rounded-md border border-line bg-panel-2 px-1 text-xs text-text"
                    >
                      {spells.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <h2 className="text-lg font-bold">{labels.objectives}</h2>
        <p className="mb-3 text-xs text-muted">{labels.objectivesNote}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {labels.objs.map((o) => {
            const l = left(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id, o.secs)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left ${l ? "border-accent" : "border-line"}`}
              >
                <span className="font-semibold">{o.name}</span>
                <span className="tabular-nums text-lg font-bold">{l ? mmss(l) : labels.ready}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
