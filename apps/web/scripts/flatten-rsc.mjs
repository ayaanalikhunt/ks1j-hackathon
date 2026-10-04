// Next's static export writes route payloads as `<route>/__next.<seg>/__PAGE__.txt`, but the client
// prefetches `<route>/__next.<seg>.__PAGE__.txt`. Static hosts don't rewrite between the two, so the
// prefetch 404s on every Link. Copy each payload to the flattened name the client asks for.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = new URL("../out", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let n = 0;

function walk(dir, rel = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p, [...rel, name]);
    } else if (name.endsWith(".txt")) {
      const i = rel.findIndex((s) => s.startsWith("__next."));
      if (i === -1) continue;
      // dir holding the first __next.* segment; flatten the rest into one dotted file name
      const base = join(OUT, ...rel.slice(0, i));
      copyFileSync(p, join(base, [...rel.slice(i), name].join(".")));
      n++;
    }
  }
}

walk(OUT);
console.log(`flatten-rsc: wrote ${n} flattened payload files`);
