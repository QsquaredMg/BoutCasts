// Turns an organizer's accent + background colors into the CSS variables the
// voting page already uses (--red for accents, --bg/--surface/--text for the
// page), picking readable text colors automatically.

const HEX = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

// WCAG relative luminance, 0 (black) – 1 (white)
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

export function roomThemeVars(
  accent: string | null,
  background: string | null,
  backgroundImage?: string | null
): Record<string, string> {
  const vars: Record<string, string> = {};
  // A background photo sits under a wash of the background color (84%) so the
  // ballot stays readable whatever the photo looks like.
  if (typeof backgroundImage === "string" && /^https:\/\/[^\s"'()\\]+$/i.test(backgroundImage)) {
    const [r, g, b] = rgb(isHexColor(background) ? background : "#f4f6fb");
    vars.backgroundImage = `linear-gradient(rgba(${r}, ${g}, ${b}, 0.84), rgba(${r}, ${g}, ${b}, 0.84)), url("${backgroundImage}")`;
    vars.backgroundSize = "cover";
    vars.backgroundPosition = "center";
  }
  if (isHexColor(accent)) {
    const [r, g, b] = rgb(accent);
    vars["--red"] = accent;
    vars["--red-soft"] = `rgba(${r}, ${g}, ${b}, 0.1)`;
  }
  if (isHexColor(background)) {
    const dark = luminance(background) < 0.2;
    vars["--bg"] = background;
    vars.backgroundColor = background;
    if (dark) {
      Object.assign(vars, {
        "--surface": "rgba(255, 255, 255, 0.06)",
        "--surface-2": "rgba(255, 255, 255, 0.1)",
        "--border": "rgba(255, 255, 255, 0.16)",
        "--text": "#f5f6f8",
        "--text-dim": "rgba(245, 246, 248, 0.78)",
        "--text-faint": "rgba(245, 246, 248, 0.58)",
        color: "#f5f6f8",
      });
    } else {
      Object.assign(vars, {
        "--surface": "#ffffff",
        "--surface-2": "rgba(0, 0, 0, 0.05)",
        "--border": "rgba(0, 0, 0, 0.12)",
        color: "var(--text)",
      });
    }
  }
  return vars;
}
