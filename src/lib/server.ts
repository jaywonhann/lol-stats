import { cookies } from "next/headers";
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
