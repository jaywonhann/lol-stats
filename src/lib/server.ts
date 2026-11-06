import { cookies, headers } from "next/headers";
import { parseServer } from "./lanes";
import { parseLang } from "./i18n";

// 서버 선택은 상단 메뉴에서 고르고 쿠키로 기억합니다
export async function getServer() {
  return parseServer((await cookies()).get("server")?.value);
}

// 언어 선택도 상단 메뉴에서 고르고 쿠키로 기억합니다 (기본 영어)
export async function getLang() {
  return parseLang((await cookies()).get("lang")?.value);
}

// 검색엔진용 언어별 주소: 영어는 그대로, 한국어는 ?lang=ko 를 붙여요 (server.mjs가 이 값을 쿠키보다 먼저 씁니다)
export const koUrl = (path: string) => `${path}${path.includes("?") ? "&" : "?"}lang=ko`;

// 지금 보는 주소가 ?lang=ko 로 들어왔으면 canonical도 한국어 주소로, 두 언어를 서로 hreflang으로 이어요
// path가 "./"이면 지금 페이지 경로(server.mjs가 x-pathname으로 넘김)를 써요. "./?lang=ko"는 끝에 /가 붙어 버려서요.
export async function langAlternates(path: string) {
  const h = await headers();
  const viaUrl = h.get("x-lang-url");
  if (path === "./") path = h.get("x-pathname") ?? "./";
  // Next는 첫 화면("/") 주소에 붙은 ?lang=ko 를 지워 버려서, 첫 화면은 레이아웃이 <link>를 직접 써요 (homeLangLinks)
  if (path === "/") return {};
  return {
    canonical: viaUrl === "ko" ? koUrl(path) : path,
    languages: { en: path, ko: koUrl(path), "x-default": path },
  };
}

// 첫 화면 전용 canonical·hreflang (위 langAlternates 설명 참고). 첫 화면이 아니면 null
export async function homeLangLinks(site: string) {
  const h = await headers();
  if (h.get("x-pathname") !== "/") return null;
  const ko = `${site}/?lang=ko`;
  return { canonical: h.get("x-lang-url") === "ko" ? ko : site, en: site, ko };
}
