"use client";

// 서버에서 그린 목록(data-filter 속성이 있는 줄)을 입력한 글자로 바로 걸러 줍니다
export default function RowFilter({ target, placeholder }: { target: string; placeholder: string }) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => {
        const q = e.target.value.trim().toLowerCase().replace(/\s+/g, "");
        document.querySelectorAll<HTMLElement>(`#${target} [data-filter]`).forEach((el) => {
          el.hidden = !!q && !(el.dataset.filter ?? "").includes(q);
        });
      }}
      className="h-10 w-full rounded-md border border-line bg-panel-2 px-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none sm:w-64"
    />
  );
}
