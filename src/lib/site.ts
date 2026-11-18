// 사이트 주소 (검색엔진용 사이트맵·대표 주소·공유 미리보기에 씀). Vercel이 막혀서 2026-11-05부터 Render 주소예요.
// 2026-11-18 Render가 전송량 초과로 멈춰서, Cloudflare 사본을 만들 때는 NEXT_PUBLIC_SITE로 새 주소를 넣어요 (cf-mirror.yml).
export const SITE = process.env.NEXT_PUBLIC_SITE || "https://livelol.onrender.com";
export const SITE_HOST = new URL(SITE).host;
