import { courseByCode, courses, majorMap } from "./catalog.js";
import { AppError } from "./errors.js";
import type {
  DegreePlan,
  PlannedCourse,
  QuizAnswers,
  SemesterPlan,
  Term,
  ValidationIssue
} from "./types.js";

export const MAX_DEMO_CREDITS_PER_SEMESTER = 9;

export function semesterTerm(semester: number): Term {
  return semester % 2 === 1 ? "fall" : "spring";
}

function plannedCourse(code: string): PlannedCourse {
  const course = courseByCode.get(code);
  if (!course) {
    throw new AppError(500, "CATALOG_ERROR", `Unknown catalog course ${code}`);
  }

  return {
    code: course.code,
    title: course.title,
    credits: course.credits,
    difficulty: course.difficulty,
    workload: course.workload,
    sentimentBlurb: course.sentimentBlurb
  };
}

function withTotals(semester: Omit<SemesterPlan, "credits" | "workload">): SemesterPlan {
  return {
    ...semester,
    credits: semester.courses.reduce((total, course) => total + course.credits, 0),
    workload: semester.courses.reduce((total, course) => total + course.workload, 0)
  };
}

export function buildBaselinePlan(_quiz: QuizAnswers): DegreePlan {
  return {
    catalogVersion: majorMap.catalogVersion,
    planKind: majorMap.planKind,
    major: majorMap.major,
    graduationTarget: majorMap.graduationTarget,
    semesters: majorMap.semesters.map((item) =>
      withTotals({
        semester: item.semester,
        term: semesterTerm(item.semester),
        status: item.semester < 3 ? "done" : item.semester === 3 ? "current" : "planned",
        courses: item.courses.map(plannedCourse)
      })
    )
  };
}

export function rebuildSemesterTotals(plan: DegreePlan): DegreePlan {
  return {
    ...plan,
    semesters: plan.semesters.map((semester) =>
      withTotals({
        semester: semester.semester,
        term: semester.term,
        status: semester.status,
        courses: semester.courses
      })
    )
  };
}

export function validatePlan(plan: DegreePlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const placements = new Map<string, number>();

  for (const semester of plan.semesters) {
    if (semester.semester < 1 || semester.semester > majorMap.totalSemesters) {
      issues.push({
        code: "INVALID_SEMESTER",
        message: `Semester ${semester.semester} is outside the pathway`,
        semester: semester.semester
      });
    }

    const computedCredits = semester.courses.reduce((sum, course) => sum + course.credits, 0);
    if (computedCredits > MAX_DEMO_CREDITS_PER_SEMESTER) {
      issues.push({
        code: "SEMESTER_OVERLOAD",
        message: `Semester ${semester.semester} exceeds ${MAX_DEMO_CREDITS_PER_SEMESTER} pathway credits`,
        semester: semester.semester
      });
    }

    for (const placement of semester.courses) {
      const catalogCourse = courseByCode.get(placement.code);
      if (!catalogCourse) {
        issues.push({
          code: "UNKNOWN_COURSE",
          message: `${placement.code} is not in the catalog`,
          courseCode: placement.code,
          semester: semester.semester
        });
        continue;
      }

      if (placements.has(placement.code)) {
        issues.push({
          code: "DUPLICATE_COURSE",
          message: `${placement.code} appears more than once`,
          courseCode: placement.code,
          semester: semester.semester
        });
      } else {
        placements.set(placement.code, semester.semester);
      }

      if (!catalogCourse.offeredTerms.includes(semester.term)) {
        issues.push({
          code: "TERM_UNAVAILABLE",
          message: `${placement.code} is not normally offered in ${semester.term}`,
          courseCode: placement.code,
          semester: semester.semester
        });
      }
    }
  }

  for (const course of courses) {
    const courseSemester = placements.get(course.code);
    if (courseSemester === undefined) {
      issues.push({
        code: "MISSING_COURSE",
        message: `${course.code} is missing from the pathway`,
        courseCode: course.code
      });
      continue;
    }

    for (const prereq of course.prereqs) {
      const prereqSemester = placements.get(prereq);
      if (prereqSemester === undefined || prereqSemester >= courseSemester) {
        issues.push({
          code: "PREREQUISITE_ORDER",
          message: `${prereq} must be completed before ${course.code}`,
          courseCode: course.code,
          semester: courseSemester
        });
      }
    }
  }

  return issues;
}

export function assertValidPlan(plan: DegreePlan): void {
  const issues = validatePlan(plan);
  if (issues.length > 0) {
    throw new AppError(422, "INVALID_PLAN", "The submitted plan is not valid", issues);
  }
}

export function fallbackPlanExplanation(quiz: QuizAnswers): string {
  const goal = quiz.goal.replace(/[.!?]+$/, "");
  if (quiz.priority === "protect_gpa") {
    return `This core pathway preserves prerequisite order for your ${goal} goal while spreading the heaviest technical courses across later semesters to protect your GPA.`;
  }
  if (quiz.riskTolerance === "ambitious") {
    return `This core pathway builds quickly toward advanced systems and software courses for your ${goal} goal while keeping every prerequisite in sequence.`;
  }
  return `This core pathway keeps prerequisites in sequence and emphasizes the programming, algorithms, and systems courses that support your ${goal} goal.`;
}
