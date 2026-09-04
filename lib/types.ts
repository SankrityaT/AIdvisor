// ── Compass shared types ───────────────────────────────────────────────
// SHARED CONTRACT. Feature agents import from here read-only and MUST NOT
// edit this file. If you need a new shape, define it inside your own
// component folder and keep it structurally compatible with these.

export type Difficulty = "easy" | "medium" | "hard";

export interface Course {
  code: string;
  title: string;
  credits: number;
  prereqs: string[];
}

export interface MajorMapSemester {
  semester: number;
  courses: Course[];
}

export interface MajorMap {
  major: string;
  total_semesters: number;
  semesters: MajorMapSemester[];
}

export interface CourseSentiment {
  code: string;
  difficulty: Difficulty;
  blurb: string;
}

// ── Quiz / student ─────────────────────────────────────────────────────
export type RiskTolerance = "easy" | "balanced" | "rigorous";
export type Priority = "protect_gpa" | "learn_deeply" | "graduate_fast";

export interface QuizAnswers {
  major: string;
  goal: string;              // free-text career goal, e.g. "software engineering career"
  risk_tolerance: RiskTolerance;
  priority: Priority;
  name?: string;
}

// ── Generated plan ─────────────────────────────────────────────────────
export type SemesterStatus = "done" | "current" | "future";

export interface PlanSemester {
  semester: number;
  term?: string;             // e.g. "Fall 2026"
  courses: string[];         // course codes
  status: SemesterStatus;
}

export interface FlowchartOutput {
  graduation_target: string; // e.g. "December 2027"
  plan: PlanSemester[];
  rationale?: string;        // one short paragraph, why this ordering
}

// ── Disruption / reroute ───────────────────────────────────────────────
export type BreakReason = "full" | "not_offered" | "cancelled" | "time_conflict";

export interface BrokenCourse {
  code: string;
  status: BreakReason;
}

export interface DisruptionEvent {
  semester: number;
  broken: BrokenCourse[];
}

export interface RerouteProposal {
  persona: string;           // "speed" | "workload" | "career"
  label: string;             // human label, e.g. "Fastest graduation"
  plan: PlanSemester[];
  graduation_target: string;
  tradeoff: string;          // one sentence
  valid: boolean;
  violations: string[];      // deterministic validator output
}

export interface RerouteResult {
  disruption: DisruptionEvent;
  previous_plan: PlanSemester[];
  proposals: RerouteProposal[];
  winner: string;            // persona key of chosen proposal
  judge_rationale: string;   // ONE sentence
  chosen: FlowchartOutput;
  explanation: string;       // one-sentence student-facing summary for chat
  dead_end: boolean;         // true => advisor handoff path
}

// ── Agent activity (real pipeline telemetry) ───────────────────────────
export type AgentKey =
  | "curator" | "planner" | "critic" | "analyst"
  | "persona_speed" | "persona_workload" | "persona_career"
  | "judge" | "narrator" | "relevance" | "handoff" | "chat";

export type AgentPhase = "start" | "done" | "error";

export interface AgentEvent {
  agent: AgentKey;
  label: string;             // plain language, e.g. "Reasoner is evaluating reroute options"
  model: string;             // actual ASU AIR model id used
  phase: AgentPhase;
  detail?: string;
  ms?: number;
  at: number;                // Date.now()
}

// ── Feature-specific ───────────────────────────────────────────────────
export interface CourseRelevance {
  code: string;
  why: string;               // ONE concrete sentence tied to the stated goal
}

export interface ConfidenceSnapshot {
  score: number;             // 0..100
  reasons: string[];
  state: "stable" | "at_risk" | "recovered";
}

export interface AdvisorHandoff {
  student_name: string;
  major: string;
  situation: string;
  what_broke: string[];
  what_was_tried: string[];
  open_question: string;
  generated_at: string;
}

export interface AdvisorEmail {
  to_hint: string;
  subject: string;
  body: string;
}
