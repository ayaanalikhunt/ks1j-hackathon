"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Signup() {
  const { signUp, google } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const run = (f: () => Promise<void>) =>
    f()
      .then(() => router.push("/"))
      .catch((e) => setErr((e as Error).message));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <PageHeader eyebrow="Join" title="Create account" />
        <Card className="space-y-3">
          <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <Banner kind="error">{err}</Banner>}
          <Button className="w-full" onClick={() => run(() => signUp(name, email, password))}>
            Create account
          </Button>
          <Button className="w-full !bg-card !text-fg border border-line" onClick={() => run(google)}>
            Continue with Google
          </Button>
          <p className="text-sm text-muted">
            Already a member?{" "}
            <Link className="underline" href="/login">
              Sign in
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
