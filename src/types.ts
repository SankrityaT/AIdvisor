export type Term = "fall" | "spring";
export type Difficulty = "easy" | "medium" | "hard";

export interface Course {
  code: string;
  title: string;
  credits: number;
  prereqs: string[];
  offeredTerms: Term[];
  requirementId: string;
  substitutionGroup?: string;
  careerTags: string[];
  difficulty: Difficulty;
  workload: number;
  sentimentBlurb: string;
}

export interface QuizAnswers {
  major: "Computer Science, BS";
  goal: string;
  riskTolerance: "conservative" | "balanced" | "ambitious";
  priority: "learn_deeply" | "protect_gpa";
}

export type SemesterStatus = "done" | "current" | "planned";

export interface PlannedCourse {
  code: string;
  title: string;
  credits: number;
  difficulty: Difficulty;
  workload: number;
  sentimentBlurb: string;
}

export interface SemesterPlan {
  semester: number;
  term: Term;
  status: SemesterStatus;
  courses: PlannedCourse[];
  credits: number;
  workload: number;
}

export interface DegreePlan {
  catalogVersion: string;
  planKind: "core_pathway";
  major: "Computer Science, BS";
  graduationTarget: string;
  semesters: SemesterPlan[];
}

export interface ValidationIssue {
  code:
    | "UNKNOWN_COURSE"
    | "DUPLICATE_COURSE"
    | "MISSING_COURSE"
    | "PREREQUISITE_ORDER"
    | "TERM_UNAVAILABLE"
    | "SEMESTER_OVERLOAD"
    | "INVALID_SEMESTER";
  message: string;
  courseCode?: string;
  semester?: number;
}

export interface Disruption {
  courseCode: string;
  semester: number;
  status: "full" | "not_offered";
}

export interface PlanChange {
  kind: "added" | "removed" | "moved";
  courseCode: string;
  fromSemester?: number;
  toSemester?: number;
  reason: string;
}

export interface RerouteResult {
  originalPlan: DegreePlan;
  newPlan: DegreePlan;
  disruptions: Disruption[];
  changes: PlanChange[];
  explanation: string;
}

export interface ResponseMeta {
  source: "air" | "fallback" | "deterministic";
  model?: string;
  fallbackReason?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: ResponseMeta;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
