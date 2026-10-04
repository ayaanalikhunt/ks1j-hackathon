import { Text, View } from "react-native";
import { BODY, F } from "@/constants/Type";
import { isRtlText } from "@/lib/askGuide";
import { useTheme } from "@/lib/theme";

type Block = { type: "p" | "ul" | "ol"; items: string[] };

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.type === "ol") last.items.push(numbered[2]);
      else blocks.push({ type: "ol", items: [numbered[2]] });
    } else {
      blocks.push({ type: "p", items: [line.replace(/^#+\s*/, "")] });
    }
  }
  return blocks;
}

/** **bold** and *italic* only. Everything else is plain text: nothing the model writes is ever run or linked. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
        .filter(Boolean)
        .map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <Text key={i} style={{ fontFamily: F.bold }}>{part.slice(2, -2)}</Text>;
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <Text key={i} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</Text>;
          return <Text key={i}>{part}</Text>;
        })}
    </>
  );
}

export function RichText({ text, color }: { text: string; color?: string }) {
  const t = useTheme();
  const rtl = isRtlText(text);
  const style = { fontSize: BODY, lineHeight: 24, fontFamily: F.regular, color: color ?? t.text, ...(rtl ? { textAlign: "right" as const, writingDirection: "rtl" as const } : null) };
  return (
    <View style={{ gap: 8 }}>
      {blocksOf(text).map((b, i) =>
        b.type === "p" ? (
          <Text key={i} style={style}><Inline text={b.items[0]} /></Text>
        ) : (
          <View key={i} style={{ gap: 4 }}>
            {b.items.map((it, j) => (
              <Text key={j} style={style}>{b.type === "ul" ? "•  " : `${j + 1}.  `}<Inline text={it} /></Text>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
