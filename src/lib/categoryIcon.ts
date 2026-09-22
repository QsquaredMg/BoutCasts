const ICON_BY_CATEGORY: Record<string, string> = {
  music: "🎸",
  singing: "🎶",
  dance: "💃",
  rap: "🎤",
  debate: "🎙️",
  roasts: "🔥",
  jokes: "😂",
  memes: "😂",
  sports: "🏀",
  gaming: "🎮",
  cooking: "🍳",
  fashion: "👗",
};

export function getCategoryIcon(name: string | null | undefined): string {
  if (!name) return "🥊";
  return ICON_BY_CATEGORY[name.toLowerCase()] ?? "🥊";
}
