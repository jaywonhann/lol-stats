// 사본(정적 파일)에서 한 페이지가 저장되는 자리. scripts/mirror.mjs(만들 때)와 cf/worker.mjs(보여 줄 때)가 같이 써요.
// 예: /matchup?a=Yasuo&b=Yone&lane=mid&lang=ko → /_p/matchup/~a-Yasuo.b-Yone.lane-mid.lang-ko.html
export const KEEP = ["a", "b", "lane", "mode", "lang"];
export function pageKey(pathname, params) {
  const path = pathname.replace(/\/+$/, "") || "/index";
  const q = KEEP.filter((k) => params.get(k))
    .map((k) => `${k}-${String(params.get(k)).replace(/[^A-Za-z0-9]/g, "_")}`)
    .join(".");
  return `/_p${path}${q ? `/~${q}` : ""}.html`;
}
