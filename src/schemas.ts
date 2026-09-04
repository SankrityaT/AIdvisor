import { z } from "zod";

export const quizAnswersSchema = z.object({
  major: z.literal("Computer Science, BS"),
  goal: z.string().trim().min(2).max(240),
  riskTolerance: z.enum(["conservative", "balanced", "ambitious"]),
  priority: z.enum(["learn_deeply", "protect_gpa"])
});

export const plannedCourseSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  workload: z.number().int().min(1).max(5),
  sentimentBlurb: z.string()
});

export const semesterPlanSchema = z.object({
  semester: z.number().int().min(1).max(8),
  term: z.enum(["fall", "spring"]),
  status: z.enum(["done", "current", "planned"]),
  courses: z.array(plannedCourseSchema).max(6),
  credits: z.number().int().nonnegative(),
  workload: z.number().int().nonnegative()
});

export const degreePlanSchema = z.object({
  catalogVersion: z.string().min(1),
  planKind: z.literal("core_pathway"),
  major: z.literal("Computer Science, BS"),
  graduationTarget: z.string().min(1),
  semesters: z.array(semesterPlanSchema).length(8)
});

export const planRequestSchema = quizAnswersSchema;

export const rerouteRequestSchema = z.object({
  currentPlan: degreePlanSchema,
  scenarioId: z.literal("semester-3-registration")
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000)
});

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  quizAnswers: quizAnswersSchema,
  activePlan: degreePlanSchema,
  disruption: z
    .object({
      disruptions: z.array(
        z.object({
          courseCode: z.string(),
          semester: z.number().int().min(1).max(8),
          status: z.enum(["full", "not_offered"])
        })
      ),
      explanation: z.string().max(1200)
    })
    .optional(),
  history: z.array(chatMessageSchema).max(8).default([])
});

export const speakRequestSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  voice: z.string().trim().min(1).max(80).optional()
});
