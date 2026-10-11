import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없어요</h1>
      <Link href="/" className="mt-4 inline-block text-accent hover:underline">
        홈으로
      </Link>
    </div>
  );
}
