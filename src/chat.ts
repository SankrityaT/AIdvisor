import type { DegreePlan, QuizAnswers } from "./types.js";

interface ChatContext {
  message: string;
  quizAnswers: QuizAnswers;
  activePlan: DegreePlan;
  disruption?: { disruptions: Array<{ courseCode: string; status: string }>; explanation: string };
}

export function fallbackChatAnswer(context: ChatContext): string {
  const question = context.message.toLowerCase();
  const plan = context.activePlan;

  if (/graduat|finish|delay|on time/.test(question)) {
    return `You are still on track for ${plan.graduationTarget}. The reroute preserves every prerequisite in this core pathway.`;
  }
  if (/why|what (changed|broke)|reroute|happen/.test(question) && context.disruption) {
    return context.disruption.explanation;
  }
  if (/semester 3|next semester|taking next/.test(question)) {
    const semester = plan.semesters.find((item) => item.semester === 3);
    const names = semester?.courses.map((course) => course.code).join(" and ") ?? "no courses";
    return `Your Semester 3 core pathway now contains ${names}.`;
  }
  if (/hard|difficult|workload|gpa/.test(question)) {
    const hardest = plan.semesters
      .flatMap((semester) => semester.courses.map((course) => ({ ...course, semester: semester.semester })))
      .sort((a, b) => b.workload - a.workload)[0];
    return hardest
      ? `${hardest.code} in Semester ${hardest.semester} has the highest modeled workload. Its course note says: ${hardest.sentimentBlurb}`
      : "This pathway does not contain workload information.";
  }

  return `Compass has validated your ${plan.major} core pathway through ${plan.graduationTarget}. Ask me about a semester, workload, prerequisites, or the registration reroute.`;
}

export function buildChatGrounding(context: ChatContext): string {
  return JSON.stringify({
    quizAnswers: context.quizAnswers,
    activePlan: context.activePlan,
    disruption: context.disruption ?? null
  });
}
