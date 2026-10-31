"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 어느 페이지에서든 "/" 를 누르면 소환사 검색창으로 가요 (검색창이 없는 페이지면 검색 페이지로 이동)
export default function SlashSearch() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      const input = document.getElementById("summoner-id") as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.select();
      } else {
        router.push("/summoner#search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
