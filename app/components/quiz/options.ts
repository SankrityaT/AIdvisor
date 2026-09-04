// Quiz content + step metadata. Owned by the quiz agent.
// Values map 1:1 onto QuizAnswers in lib/types.ts — do not drift from them.

import type { Priority, RiskTolerance } from "@/lib/types";

export const DEFAULT_NAME = "Sun Devil";

export type StepKey = "name" | "major" | "goal" | "risk" | "priority";

export interface StepMeta {
  key: StepKey;
  eyebrow: string;
  title: string;
  helper: string;
}

export const STEPS: StepMeta[] = [
  {
    key: "name",
    eyebrow: "Who's riding",
    title: "What should we call you?",
    helper: "First name is plenty. Skip it and you're a Sun Devil.",
  },
  {
    key: "major",
    eyebrow: "Program",
    title: "What are you studying?",
    helper: "One program is live for this demo. The rest are next.",
  },
  {
    key: "goal",
    eyebrow: "Destination",
    title: "Where should this route take you?",
    helper: "We use this to explain why each course is on your map.",
  },
  {
    key: "risk",
    eyebrow: "Workload",
    title: "How hard do you want your semesters?",
    helper: "This sets how many heavy courses land in the same term.",
  },
  {
    key: "priority",
    eyebrow: "Priority",
    title: "What matters most between now and graduation?",
    helper: "When two plans conflict, we break the tie with this.",
  },
];

export interface MajorOption {
  value: string;
  hint: string;
  available: boolean;
}

// Only CS is wired to a real major map for the demo. The rest render
// greyed with a "coming soon" note — honest about scope, right shape.
export const MAJOR_OPTIONS: MajorOption[] = [
  {
    value: "Computer Science, BS",
    hint: "Ira A. Fulton Schools of Engineering",
    available: true,
  },
  {
    value: "Computer Systems Engineering, BSE",
    hint: "Ira A. Fulton Schools of Engineering",
    available: false,
  },
  {
    value: "Data Science, BS",
    hint: "School of Computing and Augmented Intelligence",
    available: false,
  },
  {
    value: "Information Systems, BS",
    hint: "W. P. Carey School of Business",
    available: false,
  },
];

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint: string;
}

// `value` is what lands in QuizAnswers.goal (free text, read by the agents).
export const GOAL_OPTIONS: ChoiceOption<string>[] = [
  {
    value: "software engineering",
    label: "Software engineering",
    hint: "Ship real products — backend, frontend, infrastructure.",
  },
  {
    value: "machine learning / AI research",
    label: "Machine learning / AI research",
    hint: "Models, data, and the math underneath them.",
  },
  {
    value: "cybersecurity",
    label: "Cybersecurity",
    hint: "Break things ethically, then defend them.",
  },
  {
    value: "product management",
    label: "Product management",
    hint: "Sit between users, engineers, and the roadmap.",
  },
];

export const RISK_OPTIONS: ChoiceOption<RiskTolerance>[] = [
  {
    value: "easy",
    label: "Keep it manageable",
    hint: "I'm working, commuting, or just want to breathe.",
  },
  {
    value: "balanced",
    label: "Balanced",
    hint: "A hard class or two per term — not four.",
  },
  {
    value: "rigorous",
    label: "Hit me with the hard ones",
    hint: "Stack the tough courses. I want the challenge.",
  },
];

export const PRIORITY_OPTIONS: ChoiceOption<Priority>[] = [
  {
    value: "protect_gpa",
    label: "Protect my GPA",
    hint: "Grades matter more than speed right now.",
  },
  {
    value: "learn_deeply",
    label: "Learn it properly",
    hint: "I'd rather actually understand it than rush past it.",
  },
  {
    value: "graduate_fast",
    label: "Graduate fast",
    hint: "Get me across that stage as soon as possible.",
  },
];

export function riskLabel(value: RiskTolerance): string {
  return RISK_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function priorityLabel(value: Priority): string {
  return PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
