// Rough check for school / district email addresses. Their filters often
// quarantine sign-up emails or "pre-click" the links, so we show extra help.
export function isSchoolEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!domain.includes(".")) return false;
  return /\.edu$|\.edu\.|k12|\.isd\.|^isd|schools?\.|\.sch\.|\.ac\./.test(domain);
}

export const SCHOOL_EMAIL_TIP =
  "School and district email often holds messages from new senders in quarantine or spam. Check there, ask your IT team to allow boutcasts.com, or sign up with a personal email instead.";
