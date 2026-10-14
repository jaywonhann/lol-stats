// 소환사 데이터를 언제 받아왔는지 (업데이트 버튼이 같은 태그로 함께 비움). 서버 전용.
import { unstable_cache } from "next/cache";

export const fetchedAt = (tag: string) =>
  unstable_cache(async () => Date.now(), ["fetched-at", tag], { tags: [tag], revalidate: 10 * 60 })();
