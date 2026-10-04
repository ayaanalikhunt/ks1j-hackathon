import Link from "next/link";

/** Star mark plus the KS1J wordmark, with the gold "1" from the brand pack. */
export function Brand({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <Link href="/" aria-label="KS1J home" className="inline-flex items-center gap-2.5">
      {/* The mark is on white, so it sits on a white tile and reads in both themes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ks1j-logo-96.png"
        alt=""
        width={size}
        height={size}
        className="rounded-lg bg-white p-0.5"
        style={{ width: size, height: size }}
      />
      <span
        className="text-[1.65rem] font-extrabold leading-none tracking-tight"
        style={{ color: light ? "#ffffff" : "var(--wordmark)" }}
      >
        KS<span style={{ color: "var(--gold)" }}>1</span>J
      </span>
    </Link>
  );
}
