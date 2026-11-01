// Student roles for School Elections. Shared by the server (seat creation, plan checks) and the browser (role
// screen, role cards), so keep it free of server-only imports. See docs/sql/election_roles.sql.
//
// The first three keys (check_in, judge, observer) predate the Student Roles plan and stay free.

export const STUDENT_ROLES_PLAN = {
  priceCents: 75000,
  label: "Student Roles",
  seatCap: 60,
  freeSeatCap: 10,
} as const;

export type RoleGroup = "Running the election" | "Before voting" | "Voting day" | "After voting";

export type RoleDef = {
  key: string;
  label: string;
  group: RoleGroup;
  /** Free roles work on any school election. The rest need the Student Roles plan. */
  free: boolean;
  /** Where a student with this role works. "desk" = the booth desk page, "debate" = the debate timer page, "station" = tools on the role screen. */
  tool: "desk" | "station" | "debate";
  can: string[];
  cannot: string[];
  lesson: { why: string; job: string; tryIt: string };
};

export const ROLES: RoleDef[] = [
  {
    key: "commission_chair",
    label: "Commission chair",
    group: "Running the election",
    free: false,
    tool: "station",
    can: ["Run the Commission meeting", "Advise the Supervisor on eligibility, the calendar and disputes"],
    cannot: ["Decide anything (the Supervisor decides)", "See votes", "Change the roster"],
    lesson: {
      why: "Real elections have a board so no one person controls the rules.",
      job: "Lead the meeting, keep it fair, and give the Supervisor clear advice.",
      tryIt: "Hold a 5-minute meeting, vote on one question, and record who voted which way.",
    },
  },
  {
    key: "commission_secretary",
    label: "Commission secretary",
    group: "Running the election",
    free: false,
    tool: "station",
    can: ["Write the Commission's minutes", "Record the Commission's advice next to the Supervisor's decision"],
    cannot: ["Decide anything", "See votes", "Change the roster"],
    lesson: {
      why: "If it isn't written down, no one can check that the process was fair.",
      job: "Take minutes of every meeting and record each piece of advice and who gave it.",
      tryIt: "Take minutes of a 5-minute meeting: who spoke, what was decided, what is next.",
    },
  },
  {
    key: "commission_member",
    label: "Commission member",
    group: "Running the election",
    free: false,
    tool: "station",
    can: ["Advise the Supervisor on eligibility, the calendar and disputes", "Flag a concern"],
    cannot: ["Decide anything", "See votes", "Change the roster"],
    lesson: {
      why: "Several voices catch mistakes one person would miss.",
      job: "Study each question, give your honest advice, and respect the final decision.",
      tryIt: "Give advice on one question in two sentences: what you recommend and why.",
    },
  },
  {
    key: "registrar",
    label: "Registrar",
    group: "Running the election",
    free: false,
    tool: "station",
    can: ["Keep the roster accurate", "Issue and reissue voter codes"],
    cannot: ["See results", "Approve candidates"],
    lesson: {
      why: "Only eligible students should vote, and every eligible student should be able to.",
      job: "Keep the roster accurate and make sure each student has a code.",
      tryIt: "Find one name that is spelled two ways and decide how to fix it without losing anyone.",
    },
  },
  {
    key: "qualification_clerk",
    label: "Qualification clerk",
    group: "Before voting",
    free: false,
    tool: "station",
    can: ["Check each candidate filing against the written requirements", "Mark a filing complete or incomplete"],
    cannot: ["Edit a candidate's page", "Approve a candidate (the Supervisor decides)"],
    lesson: {
      why: "Rules only work if they apply the same way to everyone.",
      job: "Compare each filing to the written requirements and mark it complete or incomplete.",
      tryIt: "Check two filings using only the written rules, with no opinions about the people.",
    },
  },
  {
    key: "candidate",
    label: "Candidate",
    group: "Before voting",
    free: false,
    tool: "station",
    can: ["Edit your own campaign page", "Add your speech video"],
    cannot: ["Edit another candidate", "See results early"],
    lesson: {
      why: "Voters choose best when they hear a clear, honest message.",
      job: "Build your page, record your speech, and say what you will actually do.",
      tryIt: "Write your one-sentence promise, then ask a friend whether it could be kept.",
    },
  },
  {
    key: "campaign_manager",
    label: "Campaign manager",
    group: "Before voting",
    free: false,
    tool: "station",
    can: ["Help one candidate with their page and shared links"],
    cannot: ["See anything outside that candidate", "Break the rules the candidate follows"],
    lesson: {
      why: "Good campaigns organize volunteers and keep the message consistent.",
      job: "Help one candidate, following the same rules they do.",
      tryIt: "List three fair and kind ways to reach voters.",
    },
  },
  {
    key: "debate_moderator",
    label: "Debate moderator",
    group: "Before voting",
    free: false,
    tool: "debate",
    can: ["Run the debate: question order and the timer"],
    cannot: ["Edit candidate content"],
    lesson: {
      why: "A debate is fair only if every candidate gets equal time and the same questions.",
      job: "Ask the questions in the agreed order and keep the clock.",
      tryIt: "Practice a hard question in a calm voice, then politely stop a speaker at the time limit.",
    },
  },
  {
    key: "press",
    label: "Press and fact-checker",
    group: "Before voting",
    free: false,
    tool: "station",
    can: ["Write election coverage", "Flag a claim with a source for the Commission"],
    cannot: ["Approve or remove candidate content"],
    lesson: {
      why: "A free press helps voters see past slogans.",
      job: "Report what happened, cite your sources, and flag claims that need checking.",
      tryIt: "Take one candidate claim and find the evidence that supports or contradicts it.",
    },
  },
  {
    key: "chief_poll_worker",
    label: "Chief poll worker",
    group: "Voting day",
    free: false,
    tool: "station",
    can: ["Open and close a booth", "Run the kiosk", "Lead the poll workers"],
    cannot: ["See results", "Change the roster"],
    lesson: {
      why: "Smooth, private voting builds trust in the result.",
      job: "Set up the booth, lead the team, keep the line moving and guard privacy.",
      tryIt: "Walk through the booth as a voter would and note one thing that could confuse someone.",
    },
  },
  {
    key: "poll_worker",
    label: "Poll worker",
    group: "Voting day",
    free: false,
    tool: "station",
    can: ["Greet voters", "Help at the booth and kiosk"],
    cannot: ["See results", "Change the roster"],
    lesson: {
      why: "Voters trust an election when the people at the booth are helpful and neutral.",
      job: "Greet voters, point them to the right place, and never look at a ballot.",
      tryIt: "Practice greeting a nervous first-time voter in two sentences.",
    },
  },
  {
    key: "check_in",
    label: "Check-in clerk",
    group: "Voting day",
    free: true,
    tool: "desk",
    can: ["Find a student on the roster", "Mark them checked in"],
    cannot: ["Cast or see votes"],
    lesson: {
      why: "One person, one vote starts at the check-in table.",
      job: "Find each voter on the roster and mark them checked in.",
      tryIt: "Check in a voter with a close name match and confirm the right one before you mark it.",
    },
  },
  {
    key: "judge",
    label: "Election judge",
    group: "Voting day",
    free: true,
    tool: "desk",
    can: ["Resolve booth problems like a wrong name or a lost code", "Log and close incidents", "Approve forum questions"],
    cannot: ["Change the tally"],
    lesson: {
      why: "Problems happen on voting day, and they need to be fixed the same way every time.",
      job: "Handle wrong names and lost codes, and log every incident.",
      tryIt: "Write a log entry that covers who, what, when and what you did.",
    },
  },
  {
    key: "observer",
    label: "Poll watcher",
    group: "Voting day",
    free: true,
    tool: "desk",
    can: ["Watch check-in counts and the incident log", "Log an incident"],
    cannot: ["Change anything", "See the roster"],
    lesson: {
      why: "Watching the process, without touching it, builds trust.",
      job: "Observe, and raise any concern through the right person.",
      tryIt: "Name one thing you saw done correctly and one question you would ask.",
    },
  },
  {
    key: "tabulator",
    label: "Tabulator",
    group: "After voting",
    free: false,
    tool: "station",
    can: ["Count the results on your own after voting closes"],
    cannot: ["See results before voting closes", "Compare notes with the other tabulator before submitting"],
    lesson: {
      why: "Two independent counts that match are strong evidence the result is right.",
      job: "Count on your own, write down your numbers, and do not compare until both are in.",
      tryIt: "Count 20 slips apart from a partner, then compare and explain any difference.",
    },
  },
  {
    key: "auditor",
    label: "Auditor",
    group: "After voting",
    free: false,
    tool: "station",
    can: ["See whether the tabulators' counts match"],
    cannot: ["Change a count", "See results before voting closes"],
    lesson: {
      why: "A second pair of eyes catches mistakes before they become the official result.",
      job: "Compare the tabulators' counts and report any difference.",
      tryIt: "Compare two lists of numbers and write down exactly where they disagree.",
    },
  },
  {
    key: "canvass_member",
    label: "Canvass board member",
    group: "After voting",
    free: false,
    tool: "station",
    can: ["Review turnout, differences and incidents", "Vote on whether to certify"],
    cannot: ["Edit votes"],
    lesson: {
      why: "Results become official only after a careful review.",
      job: "Review turnout, differences and incidents, then vote on certifying. A majority is needed.",
      tryIt: "List two questions you would ask before certifying a close result.",
    },
  },
  {
    key: "announcer",
    label: "Results announcer",
    group: "After voting",
    free: false,
    tool: "station",
    can: ["Publish the certified results page"],
    cannot: ["Publish before certification"],
    lesson: {
      why: "How results are shared matters to winners and losers alike.",
      job: "Share results only after certification, and thank everyone who ran.",
      tryIt: "Draft a 30-second announcement that is accurate and gracious.",
    },
  },
  {
    key: "ombudsman",
    label: "Ombudsman",
    group: "After voting",
    free: false,
    tool: "station",
    can: ["Receive complaints", "Keep the incident log", "Refer a complaint to the Commission"],
    cannot: ["Rule on a dispute"],
    lesson: {
      why: "People need a safe place to raise a concern and know it will be heard.",
      job: "Listen, log what you hear, and pass it to the Commission without judging.",
      tryIt: "Restate a complaint back in neutral words.",
    },
  },
];

/** Roles tied to exactly one candidate. */
export const CANDIDATE_ROLE_KEYS = ["candidate", "campaign_manager"];

export const ROLE_KEYS: string[] = ROLES.map((r) => r.key);
export const FREE_ROLE_KEYS: string[] = ROLES.filter((r) => r.free).map((r) => r.key);

export function roleByKey(key: string | null | undefined): RoleDef | undefined {
  return ROLES.find((r) => r.key === key);
}

export function roleLabel(key: string | null | undefined): string {
  return roleByKey(key)?.label ?? String(key ?? "");
}

/** The voter's own mini lesson, shown on the vote page footer and the printed guide. */
export const VOTER_LESSON = {
  why: "An election is only as good as the people who show up informed.",
  job: "Learn about the candidates, vote once for each office, and keep your ballot private.",
  tryIt: "Name one thing you learned about each candidate before you vote.",
};

export const ROLE_GROUPS: RoleGroup[] = ["Running the election", "Before voting", "Voting day", "After voting"];
