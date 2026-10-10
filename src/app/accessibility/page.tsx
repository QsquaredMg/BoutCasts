import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "BoutCasts' commitment to an accessible experience, and how to tell us about a barrier.",
};

const SECTION_HEADING = "mb-2 mt-8 text-lg font-bold";
const BODY = "text-sm leading-relaxed";

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Accessibility
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Last updated October 9, 2026
      </p>

      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        BoutCasts is for everyone, including people with disabilities. We aim to meet the Web Content
        Accessibility Guidelines (WCAG) 2.1 Level AA on boutcasts.com, and we keep working to improve.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        What we do
      </h2>
      <ul className={`${BODY} list-disc space-y-1 pl-5`} style={{ color: "var(--text-dim)" }}>
        <li>A &quot;Skip to main content&quot; link and clear keyboard focus outlines on every control.</li>
        <li>Pages work with a keyboard and with screen readers, and scale with your browser zoom and text size.</li>
        <li>Animations respect your device&apos;s &quot;reduce motion&quot; setting.</li>
        <li>Form fields have labels, and errors are explained in plain words.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Known limits
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Clips, videos and images are uploaded by users and may not have captions, transcripts or
        descriptions. Embedded players from YouTube, TikTok and Instagram follow those services&apos;
        own accessibility features. If you need a caption, transcript or description for a specific
        clip, ask us and we will work with the creator to provide one.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Tell us about a barrier
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        If something on BoutCasts is hard to use, email{" "}
        <a href="mailto:support@boutcasts.com" className="underline">support@boutcasts.com</a> with
        the page address, what happened, and the device or assistive technology you use. We reply within
        five business days and will offer another way to get the same information or service while we fix it.
      </p>
    </div>
  );
}
