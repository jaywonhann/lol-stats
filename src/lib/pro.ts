// livelol PRO: 한 번 결제($9.99)로 여는 "내 롤 사용설명서" 딥 리포트. 서버 전용.
//
// 결제는 Lemon Squeezy(판매 대행, 세금 처리 포함)의 라이선스 키로 확인합니다. DB 없이 동작해요:
//   1) 사용자가 PRO_CHECKOUT_URL(Lemon Squeezy 결제 링크)에서 결제 → 이메일로 라이선스 키를 받음
//   2) /pro 에 키를 넣으면 Lemon Squeezy 라이선스 API로 활성화하고, 키를 httpOnly 쿠키에 저장
//   3) 리포트를 볼 때마다 키를 다시 확인 (하루 캐시). 환불·비활성화된 키는 다음 날부터 막혀요.
// 라이선스 API(/v1/licenses/*)는 API 키 없이 부를 수 있어서 비밀값을 따로 둘 필요가 없어요.
//
// 환경 변수 (Vercel):
//   PRO_CHECKOUT_URL  결제 링크 (없으면 "곧 오픈"으로 보이고 구매 버튼이 꺼져요)
//   PRO_PRODUCT_ID    (선택) 이 상품의 키만 받도록 Lemon Squeezy 상품 번호
//   PRO_TEST_KEYS     (선택) 결제 없이 열어 볼 키, 쉼표로 구분 (운영자 미리보기용)
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

export const PRO_PRICE = "$9.99";
export const PRO_COOKIE = "livelol_pro";

const LS = process.env.PRO_LICENSE_API?.replace(/\/+$/, "") || "https://api.lemonsqueezy.com/v1/licenses";

export const checkoutUrl = () => {
  const u = process.env.PRO_CHECKOUT_URL?.trim();
  return u && /^https:\/\//.test(u) ? u : null;
};

const testKeys = () =>
  (process.env.PRO_TEST_KEYS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);

export type ProCookie = { k: string; i?: string };

export const cleanKey = (raw: unknown) =>
  typeof raw === "string" ? raw.trim().slice(0, 100).replace(/[^A-Za-z0-9-]/g, "") : "";

type LsResponse = {
  valid?: boolean;
  activated?: boolean;
  deactivated?: boolean;
  error?: string | null;
  license_key?: { status?: string; activation_limit?: number; activation_usage?: number };
  instance?: { id?: string } | null;
  meta?: { product_id?: number; product_name?: string };
};

async function call(action: "activate" | "validate" | "deactivate", body: Record<string, string>): Promise<LsResponse | null> {
  try {
    const res = await fetch(`${LS}/${action}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json()) as LsResponse;
  } catch {
    return null;
  }
}

const productOk = (r: LsResponse) => {
  const want = process.env.PRO_PRODUCT_ID?.trim();
  return !want || String(r.meta?.product_id ?? "") === want;
};

export type ActivateResult = { ok: true; cookie: ProCookie } | { ok: false; reason: "invalid" | "limit" | "unavailable" };

export async function activate(key: string): Promise<ActivateResult> {
  if (!key) return { ok: false, reason: "invalid" };
  if (testKeys().includes(key)) return { ok: true, cookie: { k: key } };
  const r = await call("activate", { license_key: key, instance_name: "livelol-web" });
  if (!r) return { ok: false, reason: "unavailable" };
  if (r.activated && r.instance?.id && productOk(r)) return { ok: true, cookie: { k: key, i: r.instance.id } };
  if (/limit/i.test(r.error ?? "")) return { ok: false, reason: "limit" };
  return { ok: false, reason: "invalid" };
}

export async function deactivate(c: ProCookie) {
  if (c.i) await call("deactivate", { license_key: c.k, instance_id: c.i });
}

// 같은 키는 하루 한 번만 확인합니다. 확인 서버가 안 될 때는 막지 않아요 (이미 결제한 사람이 피해 보지 않게).
const check = (k: string, i: string) =>
  unstable_cache(
    async () => {
      const r = await call("validate", i ? { license_key: k, instance_id: i } : { license_key: k });
      if (!r) return true;
      return Boolean(r.valid) && r.license_key?.status !== "disabled" && productOk(r);
    },
    ["pro-valid", k, i],
    { revalidate: 24 * 60 * 60 },
  )();

export function readCookie(v: string | undefined): ProCookie | null {
  if (!v) return null;
  try {
    const c = JSON.parse(v) as ProCookie;
    const k = cleanKey(c.k);
    return k ? { k, i: typeof c.i === "string" ? c.i.slice(0, 100) : undefined } : null;
  } catch {
    return null;
  }
}

export async function isPro(): Promise<boolean> {
  const c = readCookie((await cookies()).get(PRO_COOKIE)?.value);
  if (!c) return false;
  if (testKeys().includes(c.k)) return true;
  return check(c.k, c.i ?? "");
}
