import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 수집한 랭크 게임 데이터(data/patches/*.json)를 서버 함수에 같이 배포
  async redirects() {
    return [{ source: "/download", destination: "/", permanent: false }];
  },
  // 무료 서버(512MB)라서 페이지 캐시는 메모리 대신 디스크(.next/cache)에 둬요
  cacheMaxMemorySize: 0,
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
};

export default nextConfig;
