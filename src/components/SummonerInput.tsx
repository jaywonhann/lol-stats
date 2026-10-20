"use client";
import { useEffect, useRef, useState } from "react";

type Item = { who: string; label?: string; server?: string; recent?: boolean };
const KEY = "livelol.recent";

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// 검색창 + 구글식 자동완성 (내 최근 검색 + 프로·챌린저 계정)
export default function SummonerInput({
  defaultValue,
  placeholder,
  server,
  className,
  recentLabel,
}: {
  defaultValue: string;
  placeholder: string;
  server: string;
  className: string;
  recentLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // 현재 보고 있는 검색어를 최근 검색에 저장
  useEffect(() => {
    if (!defaultValue) return;
    try {
      const list = [defaultValue, ...readRecent().filter((x) => x.toLowerCase() !== defaultValue.toLowerCase())];
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
    } catch {}
  }, [defaultValue]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function update(v: string) {
    setValue(v);
    setActive(-1);
    const q = v.trim();
    const recent = readRecent()
      .filter((r) => r.toLowerCase().includes(q.toLowerCase()) && r.toLowerCase() !== q.toLowerCase())
      .slice(0, 4)
      .map((who) => ({ who, recent: true }));
    setItems(recent);
    setOpen(true);
    if (q.length < 2) return;
    const id = ++seq.current;
    fetch(`/api/suggest?q=${encodeURIComponent(q)}&server=${server}`)
      .then((r) => r.json())
      .then((d: { items: Item[] }) => {
        if (id !== seq.current) return;
        const seen = new Set(recent.map((r) => r.who.toLowerCase()));
        setItems([...recent, ...d.items.filter((i) => !seen.has(i.who.toLowerCase()))]);
      })
      .catch(() => {});
  }

  function pick(who: string) {
    setValue(who);
    setOpen(false);
    requestAnimationFrame(() => (box.current?.closest("form") as HTMLFormElement | null)?.requestSubmit());
  }

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <input
        id="summoner-id"
        name="id"
        type="search"
        required
        maxLength={40}
        value={value}
        onChange={(e) => update(e.target.value)}
        onFocus={() => value.trim().length >= 1 ? update(value) : update("")}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(items[active].who);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls="summoner-suggest"
        className={className}
      />
      {open && items.length > 0 && (
        <ul
          id="summoner-suggest"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-line bg-panel shadow-lg"
        >
          {items.map((it, i) => (
            <li key={it.who} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it.who)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? "bg-panel-2" : ""}`}
              >
                <span className="text-muted" aria-hidden>
                  {it.recent ? "↺" : "⌕"}
                </span>
                <span className="truncate text-text">{it.who}</span>
                {it.recent ? (
                  <span className="ml-auto shrink-0 text-xs text-muted">{recentLabel}</span>
                ) : (
                  <span className="ml-auto shrink-0 truncate text-xs text-muted">
                    {it.label} · {it.server?.toUpperCase()}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
