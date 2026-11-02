// Starter question banks for voter surveys, one for middle school and one for high school.
// Standard format: six rating questions, two pick-your-top-three questions, one open question, plus grade.

export type SurveyQuestion =
  | { id: string; type: "rating"; text: string }
  | { id: string; type: "top3"; text: string; options: string[] }
  | { id: string; type: "open"; text: string };

export type GradeLevel = "middle" | "high";

export const GRADES: Record<GradeLevel, string[]> = {
  middle: ["6th", "7th", "8th"],
  high: ["9th", "10th", "11th", "12th"],
};

const MIDDLE_ISSUES = [
  "Lunch quality and time", "Hall passes and bathroom access", "Phone rules", "Homework load and test scheduling", "Dress code",
  "Recess and free time", "Bullying and kindness", "Clubs, dances and spirit weeks", "School safety", "Chromebooks and school tech", "Sports and PE", "Bus and pickup",
];
const HIGH_ISSUES = [
  "Phone rules", "School start time", "Lunch", "Dress code", "Homework and testing stress", "Mental health support", "College and career prep",
  "Clubs, prom and homecoming", "School safety", "AI and tech policy", "Sports and arts funding", "Cyberbullying and respect",
];
const MIDDLE_EVENTS = ["Dances", "Spirit weeks", "Field day", "Talent show", "Service projects", "Clubs and after-school activities", "Sports games", "Movie or game nights"];
const HIGH_EVENTS = ["Homecoming and prom", "Pep rallies", "Talent show", "Service projects", "Clubs and after-school activities", "Sports games", "College and career fairs", "Student-led assemblies"];

export function starterQuestions(level: GradeLevel): SurveyQuestion[] {
  const issues = level === "middle" ? MIDDLE_ISSUES : HIGH_ISSUES;
  const events = level === "middle" ? MIDDLE_EVENTS : HIGH_EVENTS;
  const ratingTopics = issues.slice(0, 6);
  return [
    ...ratingTopics.map((t, i): SurveyQuestion => ({ id: `r${i + 1}`, type: "rating", text: `How important is this to you: ${t.charAt(0).toLowerCase()}${t.slice(1)}?` })),
    { id: "t1", type: "top3", text: "Pick the 3 things you most want student government to work on this year.", options: issues },
    { id: "t2", type: "top3", text: "Pick the 3 events or activities you want more of.", options: events },
    { id: "o1", type: "open", text: "If you could change one thing about our school, what would it be? (Please don't name people.)" },
  ];
}

export const MAX_CUSTOM_QUESTIONS = 3;

/** Validates a list of survey answers against the survey's questions. Returns cleaned answers or an error. */
export function cleanAnswers(questions: SurveyQuestion[], raw: unknown): { ok: true; answers: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Answer at least one question." };
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const v = input[q.id];
    if (v == null || v === "") continue;
    if (q.type === "rating") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: "Ratings are 1 to 5." };
      out[q.id] = n;
    } else if (q.type === "top3") {
      if (!Array.isArray(v)) return { ok: false, error: "Check your answers." };
      const picks = [...new Set(v.filter((x): x is string => typeof x === "string" && q.options.includes(x)))].slice(0, 3);
      if (picks.length) out[q.id] = picks;
    } else {
      const t = typeof v === "string" ? v.trim().slice(0, 300) : "";
      if (t) out[q.id] = t;
    }
  }
  if (!Object.keys(out).length) return { ok: false, error: "Answer at least one question." };
  return { ok: true, answers: out };
}
