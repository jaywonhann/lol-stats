"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";

export type DailyQ = {
  a: { id: string; name: string; img: string };
  b: { id: string; name: string; img: string };
  lane: string;
  laneName: string;
  aRate: number; // 왼쪽 챔피언이 이긴 비율 (%)
  games: number;
};

type Saved = { date: string; picks: ("a" | "b")[] };
type Streak = { last: string; n: number; best: number };
const KEY = "daily-quiz";
const STREAK = "daily-quiz-streak";
const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // 저장이 막힌 브라우저에서는 기록만 안 남아요
  }
};
const beacon = (e: string) => {
  try {
    navigator.sendBeacon?.(`/__hit?e=${e}`);
  } catch {
    // 세는 건 실패해도 게임은 계속
  }
};

// 매일 5문제: 두 챔피언 중 같은 라인에서 더 많이 이기는 쪽을 고르면 실제 승률이 나와요.
// 결과와 연속 기록은 이 브라우저에만 저장해요.
export default function DailyGame({ questions, date, dayNo, ko }: { questions: DailyQ[]; date: string; dayNo: number; ko: boolean }) {
  const [picks, setPicks] = useState<("a" | "b")[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState("");
  // 방금 답한 문제는 정답을 보여 준 채로 두고, "다음"을 눌러야 넘어가요
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const s = read<Saved>(KEY);
    if (s?.date === date && Array.isArray(s.picks)) {
      const p = s.picks.slice(0, questions.length);
      setPicks(p);
      // 하다가 나갔으면 이어서, 이미 끝냈으면 결과 화면으로
      setShown(p.length);
    }
    setStreak(read<Streak>(STREAK));
  }, [date, questions.length]);

  // 다음 문제까지 남은 시간 (UTC 자정에 바뀌어요)
  useEffect(() => {
    const tick = () => {
      const ms = 86_400_000 - (Date.now() % 86_400_000);
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(ko ? `${h}시간 ${m}분` : `${h}h ${m}m`);
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [ko]);

  const right = (q: DailyQ, p: "a" | "b") => (p === "a") === q.aRate > 50;
  const done = picks.length >= questions.length;
  const score = picks.filter((p, i) => right(questions[i], p)).length;
  const marks = picks.map((p, i) => (right(questions[i], p) ? "🟩" : "🟥")).join("");

  const pick = (p: "a" | "b") => {
    if (done) return;
    const next = [...picks, p];
    setPicks(next);
    write(KEY, { date, picks: next } satisfies Saved);
    if (next.length === 1) beacon("daily-start");
    if (next.length >= questions.length) {
      beacon("daily-done");
      const prev = read<Streak>(STREAK);
      const yesterday = new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
      const n = prev?.last === date ? prev.n : prev?.last === yesterday ? prev.n + 1 : 1;
      const s = { last: date, n, best: Math.max(n, prev?.best ?? 0) };
      write(STREAK, s);
      setStreak(s);
    }
  };

  const share = async () => {
    beacon("share-daily");
    const url = `${location.origin}/daily`;
    const text = ko ? `롤 승률 맞히기 #${dayNo} ${score}/${questions.length}\n${marks}` : `LoL matchup quiz #${dayNo} ${score}/${questions.length}\n${marks}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 공유 창을 닫은 경우 등은 무시
    }
  };

  const viewing = Math.min(shown, questions.length - 1);
  const q = done && shown >= questions.length ? null : questions[viewing];
  const answered = picks.length > viewing;

  const side = (who: "a" | "b", q: DailyQ) => {
    const c = q[who];
    const rate = who === "a" ? q.aRate : Math.round((100 - q.aRate) * 10) / 10;
    const win = rate > 50;
    const mine = picks[viewing] === who;
    return (
      <button
        type="button"
        onClick={() => !answered && pick(who)}
        disabled={answered}
        className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition ${
          answered ? (win ? "border-[var(--chart-up)] bg-[var(--chart-up)]/10" : "border-line opacity-70") : "border-line bg-panel hover:border-accent"
        } ${mine ? "ring-2 ring-accent" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.img} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-lg" />
        <span className="font-semibold">{c.name}</span>
        <span className={`text-lg font-bold tabular-nums ${answered ? "" : "invisible"}`}>{rate.toFixed(1)}%</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          #{dayNo} · {Math.min(viewing + 1, questions.length)}/{questions.length}
        </span>
        <span aria-label={ko ? "지금까지 결과" : "Results so far"}>{marks || "⬜".repeat(questions.length)}</span>
      </div>

      {q && (
        <div className="space-y-3">
          <p className="text-center text-sm font-semibold">{ko ? `${q.laneName}에서 만나면 누가 더 많이 이길까요?` : `Who wins more often in ${q.laneName}?`}</p>
          <div className="flex items-stretch gap-3">
            {side("a", q)}
            <span className="self-center text-sm font-bold text-muted">VS</span>
            {side("b", q)}
          </div>
          {answered && (
            <div className="space-y-3 text-center text-sm">
              <p>
                <span className="font-semibold">{right(q, picks[viewing]) ? (ko ? "정답!" : "Correct!") : ko ? "아쉬워요." : "Not this time."}</span>{" "}
                <span className="text-muted">{ko ? `${q.games.toLocaleString("en-US")}게임 기준` : `Based on ${q.games.toLocaleString("en-US")} games`}</span>{" "}
                <Link href={`/matchup?a=${q.a.id}&b=${q.b.id}&lane=${q.lane}`} className="underline">
                  {ko ? "상성 자세히" : "See the matchup"}
                </Link>
              </p>
              <button type="button" onClick={() => setShown(viewing + 1)} className="rounded-lg bg-accent px-5 py-2 font-semibold text-black">
                {viewing + 1 >= questions.length ? (ko ? "결과 보기" : "See result") : ko ? "다음 문제" : "Next"}
              </button>
            </div>
          )}
        </div>
      )}

      {!q && (
        <div className="space-y-4 rounded-lg bg-panel p-5 text-center">
          <p className="text-3xl font-bold tabular-nums">
            {score}/{questions.length}
          </p>
          <p className="text-2xl">{marks}</p>
          {streak && streak.n > 0 && (
            <p className="text-sm text-muted">{ko ? `${streak.n}일 연속 참여 중 (최고 ${streak.best}일)` : `${streak.n}-day streak (best ${streak.best})`}</p>
          )}
          <button type="button" onClick={share} className="rounded-lg bg-accent px-5 py-2 font-semibold text-black">
            {copied ? (ko ? "결과를 복사했어요!" : "Result copied!") : ko ? "결과 공유하기" : "Share result"}
          </button>
          <p className="text-sm text-muted">{ko ? `다음 문제까지 ${left}` : `Next quiz in ${left}`}</p>
          <ul className="space-y-1 text-left text-sm">
            {questions.map((x, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <Link href={`/matchup?a=${x.a.id}&b=${x.b.id}&lane=${x.lane}`} className="underline">
                  {right(x, picks[i]) ? "🟩" : "🟥"} {x.a.name} vs {x.b.name} ({x.laneName})
                </Link>
                <span className="tabular-nums text-muted">
                  {x.aRate.toFixed(1)}% : {(100 - x.aRate).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            <Link href="/summoner" className="underline">
              {ko ? "내 전적에서는 누구한테 약한지 보기" : "See who you struggle against in your own games"}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
