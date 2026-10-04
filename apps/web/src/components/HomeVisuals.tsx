"use client";

import { useReveal } from "./useReveal";

// The "before KS1J" illustration for the home page: a scatter of tilted paper and chat cards, drawn in plain HTML/CSS.
// Decorative: hidden from screen readers.


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
