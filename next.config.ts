import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 수집한 랭크 게임 데이터(data/patches/*.json)를 서버 함수에 같이 배포
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
};

export default nextConfig;
