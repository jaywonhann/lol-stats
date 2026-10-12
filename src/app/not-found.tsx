import Link from "next/link";
import { dict } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export default async function NotFound() {
  const t = dict(await getLang());
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">{t.notFound}</h1>
      <Link href="/" className="mt-4 inline-block text-accent hover:underline">
        {t.backHome}
      </Link>
    </div>
  );
}
