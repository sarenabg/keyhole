import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, KeyIcon, LockIcon, ShieldIcon, Verified } from "@/components/ui";
import { context } from "@/lib/store";
import { keysContract } from "@/lib/near";
import { confidentialEnabled } from "@/lib/oneclick";

export const dynamic = "force-dynamic";

export default async function HowPage() {
  const ctx = await context();
  const contract = keysContract();
  const rows: [string, string, string][] = [
    ["Traders and their records", "Simulated, clearly labelled", "Real traders; records read from their private NEAR Intents balances"],
    ["Prices", "Real, from NEAR Intents", "Real, from NEAR Intents"],
    ["Buying a key", "Demo money", "Real payment through NEAR Intents, from any coin"],
    ["Seeing trades", "Simulated trades", "Real changes in the trader's private balances"],
    ["Copying a trade", "Demo money at today's real price", "Real swap through NEAR Intents into your own balance"],
  ];
  return (
    <>
      <Header ctx={ctx} />
      <main className="mx-auto flex max-w-[880px] flex-col gap-8 px-4 pb-16 pt-12 sm:px-8">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">How Keyhole works</h1>
          <p className="m-0 text-lg text-muted">Public record. Private trades. A key to see them.</p>
        </div>

        <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          <Card className="flex flex-col gap-3 p-5">
            <Verified size={28} />
            <span className="font-semibold">Records can&apos;t be faked</span>
            <span className="text-sm leading-normal text-muted">A trader signs once with their wallet. Keyhole then reads their private NEAR Intents balances every few minutes and works out the return from those, not from anything the trader types.</span>
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <span className="text-ink"><LockIcon size={28} /></span>
            <span className="font-semibold">Trades stay private</span>
            <span className="text-sm leading-normal text-muted">Trades on NEAR Intents&apos; private mode don&apos;t show on the public chain. Keyhole shows them only to people holding a key, and never shows coins or timing on the public page.</span>
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <span className="text-accent"><KeyIcon size={28} /></span>
            <span className="font-semibold">Keys pay traders instantly</span>
            <span className="text-sm leading-normal text-muted">Pay with any coin. NEAR Intents turns it into USDC{contract ? ", the keys contract records your key on NEAR and passes 95% straight to the trader" : " and pays the trader directly"}.</span>
          </Card>
        </section>

        <Card className="overflow-hidden">
          <div className="border-b border-line-soft px-6 py-4 font-semibold">Demo and Live</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="px-6 py-3 font-medium" scope="col"></th>
                  <th className="px-6 py-3 font-medium" scope="col">Demo</th>
                  <th className="px-6 py-3 font-medium" scope="col">Live (NEAR mainnet)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([a, b, c]) => (
                  <tr key={a} className="border-t border-line-soft">
                    <th scope="row" className="px-6 py-3 font-semibold">{a}</th>
                    <td className="px-6 py-3 text-muted">{b}</td>
                    <td className="px-6 py-3">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <span className="flex items-center gap-2 font-semibold"><ShieldIcon size={18} /> What you still have to trust</span>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-sm leading-normal text-muted">
            <li>Keyhole&apos;s server sees a trader&apos;s holdings in order to show them to key holders. Next step: run it inside a sealed, verifiable machine (a TEE) so nobody, us included, can look.</li>
            <li>Records come from what NEAR Intents reports for the trader&apos;s account. Money the trader keeps elsewhere isn&apos;t counted.</li>
            <li>{confidentialEnabled() ? "Copies use NEAR Intents' private mode." : "Copies settle through NEAR Intents and are listed on its public explorer. Fully private copies need a NEAR partner key, which is invite-only."}</li>
            <li>Someone with a key could share what they see. Keys are short and cheap on purpose.</li>
            <li>NEAR&apos;s own &quot;view keys&quot; aren&apos;t live yet. When they ship, Keyhole can hand them out instead.</li>
          </ul>
        </Card>

        {contract && (
          <p className="m-0 text-sm text-muted">
            Keys contract: <a href={`https://nearblocks.io/address/${contract}`} className="font-mono text-accent-ink">{contract}</a>
          </p>
        )}
        <Link href="/" className="self-start font-semibold text-accent-ink no-underline">See traders</Link>
      </main>
      <Footer mode={ctx.mode} />
    </>
  );
}
