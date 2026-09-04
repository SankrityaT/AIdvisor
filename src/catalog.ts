import majorMapJson from "../data/major-map.json" with { type: "json" };
import sentimentJson from "../data/course-sentiment.json" with { type: "json" };
import type { Course, Difficulty, Term } from "./types.js";

interface MajorMapCourse {
  code: string;
  title: string;
  credits: number;
  prereqs: string[];
  offered_terms: Term[];
  requirement_id: string;
  substitution_group?: string;
  career_tags: string[];
}

interface SentimentRecord {
  code: string;
  difficulty: Difficulty;
  workload: number;
  blurb: string;
}

const sentiments = new Map(
  (sentimentJson as SentimentRecord[]).map((item) => [item.code, item])
);

export const courses: Course[] = (majorMapJson.courses as MajorMapCourse[]).map(
  (course) => {
    const sentiment = sentiments.get(course.code);
    if (!sentiment) {
      throw new Error(`Missing sentiment data for ${course.code}`);
    }

    return {
      code: course.code,
      title: course.title,
      credits: course.credits,
      prereqs: course.prereqs,
      offeredTerms: course.offered_terms,
      requirementId: course.requirement_id,
      substitutionGroup: course.substitution_group,
      careerTags: course.career_tags,
      difficulty: sentiment.difficulty,
      workload: sentiment.workload,
      sentimentBlurb: sentiment.blurb
    };
  }
);

export const courseByCode = new Map(courses.map((course) => [course.code, course]));

export const majorMap = {
  catalogVersion: majorMapJson.version,
  major: majorMapJson.major as "Computer Science, BS",
  planKind: majorMapJson.plan_kind as "core_pathway",
  graduationTarget: majorMapJson.graduation_target,
  totalSemesters: majorMapJson.total_semesters,
  semesters: majorMapJson.semesters,
  courses
};

export function getCatalogResponse() {
  return majorMap;
}
