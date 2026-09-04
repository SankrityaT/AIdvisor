import { describe, expect, it } from "vitest";
import { buildBaselinePlan, validatePlan } from "../src/planner.js";
import { rerouteRegistrationScenario } from "../src/reroute.js";
import type { QuizAnswers } from "../src/types.js";

const quiz: QuizAnswers = {
  major: "Computer Science, BS",
  goal: "software engineering career",
  riskTolerance: "balanced",
  priority: "protect_gpa"
};

describe("deterministic planner", () => {
  it("builds a valid eight-semester baseline for every quiz profile", () => {
    const riskLevels: QuizAnswers["riskTolerance"][] = [
      "conservative",
      "balanced",
      "ambitious"
    ];
    const priorities: QuizAnswers["priority"][] = ["learn_deeply", "protect_gpa"];

    for (const riskTolerance of riskLevels) {
      for (const priority of priorities) {
        const plan = buildBaselinePlan({ ...quiz, riskTolerance, priority });
        expect(plan.semesters).toHaveLength(8);
        expect(validatePlan(plan)).toEqual([]);
      }
    }
  });

  it("flags a downstream course placed before its prerequisites", () => {
    const plan = structuredClone(buildBaselinePlan(quiz));
    const source = plan.semesters[4]!;
    const destination = plan.semesters[2]!;
    const index = source.courses.findIndex((course) => course.code === "CSE310");
    destination.courses.push(source.courses.splice(index, 1)[0]!);

    expect(validatePlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PREREQUISITE_ORDER", courseCode: "CSE310" })
      ])
    );
  });

  it("flags duplicate and missing courses", () => {
    const plan = structuredClone(buildBaselinePlan(quiz));
    plan.semesters[1]!.courses[0] = plan.semesters[0]!.courses[0]!;

    const issues = validatePlan(plan);
    expect(issues.some((issue) => issue.code === "DUPLICATE_COURSE")).toBe(true);
    expect(issues.some((issue) => issue.code === "MISSING_COURSE")).toBe(true);
  });
});

describe("registration reroute", () => {
  it("moves the four courses without delaying graduation", () => {
    const original = buildBaselinePlan(quiz);
    const result = rerouteRegistrationScenario(original);

    expect(result.newPlan.graduationTarget).toBe(original.graduationTarget);
    expect(result.changes).toHaveLength(4);
    expect(result.disruptions).toEqual([
      { courseCode: "CSE240", semester: 3, status: "full" },
      { courseCode: "MAT243", semester: 3, status: "not_offered" }
    ]);
    expect(result.newPlan.semesters[2]!.courses.map((course) => course.code)).toEqual([
      "CSE230",
      "HUAD-ELECTIVE"
    ]);
    expect(result.newPlan.semesters[3]!.courses.map((course) => course.code)).toEqual([
      "CSE240",
      "MAT243"
    ]);
    expect(validatePlan(result.newPlan)).toEqual([]);
    expect(original.semesters[2]!.courses.map((course) => course.code)).toEqual([
      "CSE240",
      "MAT243"
    ]);
  });
});
