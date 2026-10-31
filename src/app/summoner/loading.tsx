// 전적을 불러오는 동안 실제 화면과 같은 모양의 뼈대를 먼저 보여줘요 (왼쪽 랭크·포지션·모스트, 오른쪽 요약·게임 목록)
export default function Loading() {
  const bar = "animate-pulse rounded-lg bg-panel";
  return (
    <div className="space-y-4" role="status" aria-label="loading">
      <div className={`${bar} h-24`} />
      <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className={`${bar} h-28`} />
          <div className={`${bar} h-36`} />
          <div className={`${bar} h-80`} />
        </div>
        <div className="space-y-4">
          <div className={`${bar} h-40`} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${bar} h-24`} />
          ))}
        </div>
      </div>
    </div>
  );
}
