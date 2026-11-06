import NextLink from "next/link";
import type { ComponentProps } from "react";

// 미리 불러오기(prefetch)를 기본으로 끈 링크.
// Render 무료 서버는 CPU가 아주 작아서, 화면에 보이는 링크마다 미리 불러오면 그 계산 때문에 지금 페이지가 늦게 떠요.
// 누를 때 불러오고, 서버가 만들어 둔 페이지를 저장해 둬서(server.mjs) 대부분 바로 와요.
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
