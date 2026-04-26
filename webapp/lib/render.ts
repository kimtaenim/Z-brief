export interface SanitizeReport {
  replaced: Record<string, number>;
  violations: string[];
}

const HORIZONTAL_RE = /^\s*([-=*])\1{2,}\s*$/gm;
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]+/gu;

export function sanitize(
  text: string,
  bannedWords: string[] = ["추천"],
): { text: string; report: SanitizeReport } {
  const replaced: Record<string, number> = {};

  const countReplace = (pattern: string, repl: string, src: string): string => {
    const n = src.split(pattern).length - 1;
    if (n > 0) {
      replaced[pattern] = (replaced[pattern] ?? 0) + n;
      return src.split(pattern).join(repl);
    }
    return src;
  };

  let out = text;
  out = countReplace("—", "-", out);
  out = countReplace("~", "-", out);

  let hrCount = 0;
  out = out.replace(HORIZONTAL_RE, () => {
    hrCount += 1;
    return "";
  });
  if (hrCount > 0) replaced.horizontal_rule = hrCount;

  let emojiCount = 0;
  out = out.replace(EMOJI_RE, () => {
    emojiCount += 1;
    return "";
  });
  if (emojiCount > 0) replaced.emoji = emojiCount;

  const violations: string[] = [];
  for (const word of bannedWords) {
    if (out.includes(word)) violations.push(`banned_word:${word}`);
  }

  return { text: out, report: { replaced, violations } };
}
