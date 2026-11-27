/** Up to two initials from a name, for an avatar. "Ada Lovelace" is "AL"; "Team Platform" is "TP"; one word gives one letter. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = [...words[0]!][0]!;
  const last = words.length > 1 ? [...words[words.length - 1]!][0]! : "";
  return (first + last).toLocaleUpperCase();
}
