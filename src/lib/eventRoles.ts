export type EventKind = "live_vote" | "school_election";
export type EventRoleName = "moderator" | "owner";

export const KIND_LABEL: Record<EventKind, string> = {
  live_vote: "live vote",
  school_election: "school election",
};

export function eventHref(kind: EventKind, id: string): string {
  return kind === "live_vote" ? `/live-vote/${id}` : `/school-election/${id}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
