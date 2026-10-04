"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Card, PageHeader } from "@/components/ui";

const APK = "/downloads/ks1j.apk";

const STEPS = [
  "Tap Download for Android below.",
  "Open the downloaded file. If Android asks, allow installs from your browser, just this once.",
  "Tap Install, then Open. Sign in or create an account.",
];

const BTN = "inline-flex min-h-14 items-center rounded-xl px-6 text-lg font-semibold";

export default function GetTheApp() {
  // The APK is a separate upload. Only offer it when the file is really there.
  const [apk, setApk] = useState<"checking" | "ready" | "missing">("checking");
  useEffect(() => {
    let live = true;
    fetch(APK, { method: "HEAD" })
      .then((r) => live && setApk(r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? "ready" : "missing"))
      .catch(() => live && setApk("missing"));
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <PageHeader eyebrow="Mobile app" title="Get the KS1J app" intro="Help, giving and learning in one place. Use it in your browser now, or install it on Android." />

        <Card className="space-y-3">
          <h2 className="font-display text-2xl">Open the app in your browser</h2>
          <p className="text-muted">Works on any phone or computer. Nothing to install. Sign in with your KS1J account.</p>
          <a href="/member/" className={`${BTN} bg-brand text-[var(--bg)]`}>
            Open the app
          </a>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-2xl">Install on Android</h2>
          {apk === "ready" ? (
            <>
              <a href={APK} download="ks1j.apk" className={`${BTN} bg-[#c9a24a] text-[#1d2a24]`}>
                Download for Android (ks1j.apk)
              </a>
              <ol className="list-decimal space-y-2 pl-5">
                {STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-sm text-muted">
                This app is installed directly from this page, not from the Play Store. Only install it from this address.
              </p>
            </>
          ) : apk === "checking" ? (
            <p className="text-muted">Checking…</p>
          ) : (
            <Banner>The Android file is being prepared and is not available yet. Please use the browser version above for now.</Banner>
          )}
        </Card>
      </main>
    </>
  );
}
