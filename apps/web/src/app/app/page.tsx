import { SiteHeader } from "@/components/SiteHeader";
import { Card, PageHeader } from "@/components/ui";

const STEPS = [
  "Tap Download below on your Android phone.",
  "Open the downloaded file. If Android asks, allow installs from your browser, just this once.",
  "Tap Install, then Open. Sign in or create an account.",
];

export default function GetTheApp() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="Mobile app" title="Get the KS1J app" intro="For Android phones. Help, giving and learning in one place." />
        <Card className="space-y-4">
          <a
            href="/downloads/ks1j.apk"
            download
            className="inline-flex min-h-14 items-center rounded-xl bg-brand px-6 text-lg font-semibold text-[var(--bg)]"
          >
            Download for Android (APK)
          </a>
          <ol className="list-decimal space-y-2 pl-5">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            This app is installed directly from this page, not from the Play Store. Only install it from this address.
          </p>
        </Card>
      </main>
    </>
  );
}
