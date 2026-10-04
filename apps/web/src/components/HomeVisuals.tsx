"use client";

import { useReveal } from "./useReveal";

// Two illustrations for the home page, drawn in plain HTML/CSS so they follow the site's fonts and never go stale:
// a fan of three phone screens, and a scatter of tilted paper and chat cards. Decorative: hidden from screen readers.

const GREEN = "#0b4d3a";
const GOLD = "#c9a24a";

const TABS = ["Home", "Services", "Give", "Learn"];

/** An Android handset: thin bezel, punch-hole camera, status bar and the Material bottom navigation bar the app really has. */
function Phone({ title, active, children, className = "", style }: { title: string; active: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`absolute w-[10.5rem] overflow-hidden rounded-[1.35rem] border-[4px] border-[#070c09] bg-[#fbfcfb] text-[#1d2a24] shadow-[0_24px_50px_rgba(0,0,0,0.55)] sm:w-[12.5rem] ${className}`} style={style}>
      <div className="relative flex items-center justify-between px-3 pb-0.5 pt-1.5 text-[8px] font-semibold text-[#3b4a42]">
        <span>10:42</span>
        <span className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#070c09]" />
        <span>5G ▮</span>
      </div>
      <p className="border-b border-[#e3e8e5] px-3 pb-1.5 pt-1 text-[10px] font-semibold text-[#5d6e65]">{title}</p>
      <div className="space-y-2 p-2.5">{children}</div>
      <div className="mt-1 flex border-t border-[#e3e8e5] bg-[#f3f6f4] px-1 pb-2 pt-1.5">
        {TABS.map((t) => (
          <span key={t} className="flex flex-1 flex-col items-center gap-0.5 text-[7px] font-semibold" style={{ color: t === active ? GREEN : "#5d6e65" }}>
            <span className="h-3 w-6 rounded-full" style={{ background: t === active ? "#cfe4d9" : "transparent" }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Hero({ title, line }: { title: string; line: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-3 text-white" style={{ background: GREEN }}>
      <p className="font-display text-base leading-tight">{title}</p>
      <p className="mt-1 max-w-[70%] text-[9px] leading-snug text-white/75">{line}</p>
      <svg aria-hidden viewBox="0 0 200 300" className="absolute -right-1 bottom-0 h-[85%]" fill="none" stroke={GOLD} strokeWidth="5" opacity=".8">
        <path d="M20 300V130C20 70 70 25 100 8c30 17 80 62 80 122v170" />
        <path d="M100 56v26M100 112l12-12-12-12-12 12Z" />
      </svg>
    </div>
  );
}

const Row = ({ a, b }: { a: string; b?: string }) => (
  <div className="flex items-center justify-between rounded-lg border border-[#e3e8e5] px-2 py-1.5 text-[9px]">
    <span>{a}</span>
    {b && <span className="font-semibold">{b}</span>}
  </div>
);

export function PhoneFan() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} aria-hidden className="reveal relative mx-auto h-[24rem] w-full max-w-[34rem] sm:h-[28rem]">
      <Phone title="Home" active="Home" className="left-0 top-10 z-0 sm:left-2" style={{ rotate: "-9deg" }}>
        <Hero title="Salaam, Fatema" line="Everything from the Jamaat, in one place." />
        <p className="text-[8px] font-semibold uppercase tracking-wider text-[#5d6e65]">For you</p>
        <Row a="Your request is with a trustee" />
        <p className="text-[8px] font-semibold uppercase tracking-wider text-[#5d6e65]">Announcements</p>
        <Row a="Khums and Lawajam now in the app" />
        <Row a="Welcome to KS1J" />
      </Phone>
      <Phone title="Give" active="Give" className="left-1/2 top-0 z-10 -translate-x-1/2 scale-[1.06]">
        <Hero title="Give" line="Every rupee goes through the Jamaat's account and is recorded." />
        <p className="text-[8px] font-semibold uppercase tracking-wider text-[#5d6e65]">Khums</p>
        <div className="rounded-lg border border-[#e3e8e5] p-2 text-[9px]">
          <p className="font-semibold">Khums estimate</p>
          <div className="mt-1 rounded border-2 border-[#1d2a24] px-2 py-1">100000</div>
          <div className="mt-1.5 flex justify-between"><span>Khums due (20%)</span><b>₹20,000</b></div>
          <div className="mt-1.5 flex h-5 overflow-hidden rounded text-[8px] font-bold text-white">
            <span className="flex flex-1 items-center justify-center bg-[#1e4f9c]">Imam</span>
            <span className="flex flex-1 items-center justify-center" style={{ background: GOLD }}>Sadaat</span>
          </div>
        </div>
        <Row a="Sehme Imam" b="₹10,000" />
        <Row a="Sehme Sadaat" b="₹10,000" />
      </Phone>
      <Phone title="Helpdesk" active="Learn" className="right-0 top-12 z-0 sm:right-2" style={{ rotate: "9deg" }}>
        <p className="font-display text-sm">Jamaat helpdesk</p>
        <p className="text-[9px] text-[#5d6e65]">Answers come only from texts the Jamaat has approved.</p>
        <div className="rounded-lg border border-[#e3e8e5] p-2 text-[9px] text-[#5d6e65]">Is there interest on education loans?</div>
        <div className="rounded-lg bg-[#9fc8b6] py-1.5 text-center text-[10px] font-semibold text-white">Ask</div>
        <p className="text-[9px]">Education loans (Qard-e-Hasana): no interest and no late fees.</p>
      </Phone>
    </div>
  );
}

function Tilt({ rotate, className = "", children }: { rotate: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={`tilt-card absolute rounded-2xl p-4 shadow-[0_14px_30px_rgba(0,0,0,0.4)] ${className}`} style={{ rotate: `${rotate}deg` }}>
      {children}
    </div>
  );
}

const Bar = ({ w }: { w: string }) => <div className="mt-2 h-2.5 rounded-full bg-[#d9d3c5]" style={{ width: w }} />;

export function PaperCollage() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} aria-hidden className="reveal relative mx-auto h-[26rem] w-full max-w-[32rem] text-[#1d2a24] sm:h-[30rem]">
      <Tilt rotate={-5} className="left-0 top-4 w-[48%] bg-[#fffdf7]">
        <p className="text-xs font-bold text-[#6b5a2c]">Application form</p>
        <Bar w="90%" /><Bar w="75%" /><Bar w="62%" />
        <p className="mt-3 text-xs font-bold text-[#a23b2c]">Status: ?</p>
      </Tilt>
      <Tilt rotate={3} className="right-0 top-0 w-[46%] bg-[#d8f0d2]">
        <p className="text-sm">Has anyone looked at my form yet?</p>
        <p className="mt-3 text-right text-[10px] text-[#5d6e65]">10:42</p>
      </Tilt>
      <Tilt rotate={-3} className="left-1 top-[9.5rem] w-[44%] bg-[#f7e3a1]">
        <p className="text-sm font-bold">Who approved this one?</p>
      </Tilt>
      <Tilt rotate={4} className="right-1 top-[9rem] w-[50%] bg-[#fffdf7]">
        <p className="text-xs font-bold text-[#6b5a2c]">Ledger book</p>
        <p className="mt-1 text-sm">Sehme Imam? Sehme Sadaat? General?</p>
        <p className="mt-2 text-xs font-bold text-[#a23b2c]">Which fund was this?</p>
      </Tilt>
      <Tilt rotate={-3} className="bottom-2 left-[18%] w-[52%] bg-[#d8f0d2]">
        <p className="text-sm">Can you send the receipt photo again?</p>
        <p className="mt-3 text-right text-[10px] text-[#5d6e65]">18:05</p>
      </Tilt>
    </div>
  );
}
