import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 수집한 랭크 게임 데이터(data/patches/*.json)를 서버 함수에 같이 배포
  async redirects() {
    return [{ source: "/download", destination: "/", permanent: false }];
  },
  // 무료 서버(512MB)라서 페이지 캐시는 메모리 대신 디스크(.next/cache)에 둬요
  cacheMaxMemorySize: 0,
  // 한 번 열어 본 페이지로 다시 가면 2분 동안은 서버에 다시 묻지 않고 바로 보여 줘요
  experimental: { staleTimes: { dynamic: 120 } },
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
};

export default nextConfig;
