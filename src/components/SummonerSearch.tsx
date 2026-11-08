// 소환사 검색창: next/form 이라 페이지를 새로 받지 않고 이동해서, 결과를 기다리는 동안 뼈대 화면이 바로 떠요 (자동완성은 클라이언트 입력창이 담당)
import Form from "next/form";
import Link from "./Link";
import { dict, type Lang } from "@/lib/i18n";
import { serverLabel, type Server } from "@/lib/lanes";
import { DEFAULT_TAG } from "@/lib/riot";
import SummonerInput from "./SummonerInput";
import RecentSummoners from "./RecentSummoners";

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
    // 미리 불러오기는 꺼요: 검색창이 보이는 모든 페이지에서 서버가 전적 페이지 뼈대를 따로 만들어서, 무료 서버의 줄이 길어져요
    <Form action="/summoner" prefetch={false} role="search" className="w-full">
      <label htmlFor="summoner-id" className="sr-only">
        {t.inputLabel}
      </label>
      <div className="flex gap-2">
        <SummonerInput
          defaultValue={defaultValue}
          placeholder={t.placeholder}
          server={server}
          recentLabel={lang === "ko" ? "최근 검색" : "Recent"}
          className={`w-full rounded-md border border-line bg-panel-2 px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none ${large ? "h-12 text-base" : "h-10 text-sm"}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-md bg-accent px-4 font-semibold text-black hover:brightness-110 ${large ? "h-12" : "h-10 text-sm"}`}
        >
          {t.search}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {t.searching(serverLabel(server, lang))} {t.tagHint(DEFAULT_TAG[server])}{" "}
        <Link href="/multi" className="whitespace-nowrap text-accent hover:underline">
          {lang === "ko" ? "로비 5명 한 번에 보기 (멀티서치) →" : "Whole lobby at once (multi-search) →"}
        </Link>
      </p>
      {large && <RecentSummoners label={t.recentViewed} />}
    </Form>
  );
}
