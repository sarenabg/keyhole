import Link from "next/link";
import { Header } from "@/components/Header";
import { context } from "@/lib/store";

export default async function NotFound() {
  const ctx = await context();
  return (
    <>
      <Header ctx={ctx} />
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center">
        <h1 className="m-0 font-display text-3xl font-semibold">Nothing here</h1>
        <p className="m-0 text-muted">That trader or page doesn&apos;t exist.</p>
        <Link href="/" className="flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-white no-underline">See traders</Link>
      </main>
    </>
  );
}
