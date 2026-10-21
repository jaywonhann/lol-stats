// 페이지를 옮길 때 서버가 데이터를 준비하는 동안 바로 보여주는 뼈대 화면
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="loading">
      <div className="h-8 w-56 animate-pulse rounded-md bg-panel-2" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-panel-2" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-panel-2" />
        <div className="h-48 animate-pulse rounded-xl bg-panel-2" />
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-panel-2" />
    </div>
  );
}
