// 소환사 검색창: 일반 GET 폼이라 자바스크립트 없이도 동작합니다
import { dict, type Lang } from "@/lib/i18n";
import { serverLabel, type Server } from "@/lib/lanes";
import { DEFAULT_TAG } from "@/lib/riot";

export default function SummonerSearch({
  lang,
  server,
  defaultValue = "",
  large = false,
}: {
  lang: Lang;
  server: Server;
  defaultValue?: string;
  large?: boolean;
}) {
  const t = dict(lang).summoner;
  return (
    <form action="/summoner" method="get" role="search" className="w-full">
      <label htmlFor="summoner-id" className="sr-only">
        {t.inputLabel}
      </label>
      <div className="flex gap-2">
        <input
          id="summoner-id"
          name="id"
          type="search"
          required
          maxLength={40}
          defaultValue={defaultValue}
          placeholder={t.placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`min-w-0 flex-1 rounded-md border border-line bg-panel-2 px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none ${large ? "h-12 text-base" : "h-10 text-sm"}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-md bg-accent px-4 font-semibold text-black hover:brightness-110 ${large ? "h-12" : "h-10 text-sm"}`}
        >
          {t.search}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {t.searching(serverLabel(server, lang))} {t.tagHint(DEFAULT_TAG[server])}
      </p>
    </form>
  );
}
