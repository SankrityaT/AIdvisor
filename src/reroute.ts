import { AppError } from "./errors.js";
import { assertValidPlan, rebuildSemesterTotals } from "./planner.js";
import type { DegreePlan, Disruption, PlanChange, RerouteResult } from "./types.js";

export const REGISTRATION_SCENARIO_ID = "semester-3-registration" as const;

export const REGISTRATION_DISRUPTIONS: Disruption[] = [
  { courseCode: "CSE240", semester: 3, status: "full" },
  { courseCode: "MAT243", semester: 3, status: "not_offered" }
];

const moves = [
  { courseCode: "CSE240", from: 3, to: 4 },
  { courseCode: "MAT243", from: 3, to: 4 },
  { courseCode: "CSE230", from: 4, to: 3 },
  { courseCode: "HUAD-ELECTIVE", from: 4, to: 3 }
] as const;

function moveCourse(plan: DegreePlan, code: string, from: number, to: number): void {
  const source = plan.semesters.find((semester) => semester.semester === from);
  const destination = plan.semesters.find((semester) => semester.semester === to);
  const courseIndex = source?.courses.findIndex((course) => course.code === code) ?? -1;

  if (!source || !destination || courseIndex < 0) {
    throw new AppError(
      409,
      "SCENARIO_INCOMPATIBLE",
      `The registration scenario expected ${code} in semester ${from}`
    );
  }

  const [course] = source.courses.splice(courseIndex, 1);
  if (!course) {
    throw new AppError(500, "REROUTE_ERROR", `Unable to move ${code}`);
  }
  destination.courses.push(course);
}

export function fallbackRerouteExplanation(): string {
  return "CSE 240 filled and MAT 243 was not offered, so Compass moved both to Semester 4 and pulled CSE 230 plus a humanities requirement forward; every prerequisite still clears and graduation remains May 2028.";
}

export function rerouteRegistrationScenario(currentPlan: DegreePlan): RerouteResult {
  assertValidPlan(currentPlan);
  const newPlan = structuredClone(currentPlan);

  for (const move of moves) {
    moveCourse(newPlan, move.courseCode, move.from, move.to);
  }

  const normalizedPlan = rebuildSemesterTotals(newPlan);
  assertValidPlan(normalizedPlan);

  if (normalizedPlan.graduationTarget !== currentPlan.graduationTarget) {
    throw new AppError(500, "REROUTE_ERROR", "Reroute changed the graduation target");
  }

  const changes: PlanChange[] = [
    {
      kind: "moved",
      courseCode: "CSE240",
      fromSemester: 3,
      toSemester: 4,
      reason: "The Semester 3 section is full"
    },
    {
      kind: "moved",
      courseCode: "MAT243",
      fromSemester: 3,
      toSemester: 4,
      reason: "The course is not offered in Semester 3"
    },
    {
      kind: "moved",
      courseCode: "CSE230",
      fromSemester: 4,
      toSemester: 3,
      reason: "Prerequisites are complete and the course keeps degree progress on track"
    },
    {
      kind: "moved",
      courseCode: "HUAD-ELECTIVE",
      fromSemester: 4,
      toSemester: 3,
      reason: "The flexible requirement balances the replacement semester"
    }
  ];

  return {
    originalPlan: currentPlan,
    newPlan: normalizedPlan,
    disruptions: REGISTRATION_DISRUPTIONS,
    changes,
    explanation: fallbackRerouteExplanation()
  };
}
