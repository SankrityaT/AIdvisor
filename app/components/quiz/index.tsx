"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Priority, QuizAnswers, RiskTolerance } from "@/lib/types";
import { OptionCard } from "./OptionCard";
import { RouteLoader } from "./RouteLoader";
import {
  DEFAULT_NAME,
  GOAL_OPTIONS,
  MAJOR_OPTIONS,
  PRIORITY_OPTIONS,
  RISK_OPTIONS,
  STEPS,
  priorityLabel,
  riskLabel,
} from "./options";

export interface QuizProps {
  onComplete: (answers: QuizAnswers) => void;
  /** true while the plan is generating — disables inputs, shows pending state */
  submitting?: boolean;
}

interface ActiveOption {
  key: string;
  label: string;
  hint?: string;
  note?: string;
  selected: boolean;
  disabled?: boolean;
  select: () => void;
}

export default function Quiz({ onComplete, submitting = false }: QuizProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  // Only one major is live, so pre-select it — the step is a one-tap confirm.
  const [major, setMajor] = useState<string>(MAJOR_OPTIONS[0].value);
  const [goal, setGoal] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [risk, setRisk] = useState<RiskTolerance | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  const meta = STEPS[step];
  const pending = submitting || handedOff;
  const progress = ((step + 1) / STEPS.length) * 100;

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const firedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Keep the latest callback without re-running effects on parent re-renders.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // If the parent turns `submitting` back off (generation failed), let the
  // student try again rather than stranding them on the loader.
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !submitting && firedRef.current) {
      firedRef.current = false;
      setHandedOff(false);
    }
    wasSubmitting.current = submitting;
  }, [submitting]);

  const goNext = useCallback(
    () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
    [],
  );
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (STEPS[step].key === "name") nameInputRef.current?.focus();
  }, [step]);

  /**
   * The only exit. Refuses to emit a partial QuizAnswers — if anything
   * upstream is missing it bounces back to that step instead.
   */
  const finish = useCallback(
    (finalPriority: Priority) => {
      if (firedRef.current) return;
      if (!goal) {
        setStep(2);
        return;
      }
      if (!risk) {
        setStep(3);
        return;
      }
      const answers: QuizAnswers = {
        major,
        goal,
        risk_tolerance: risk,
        priority: finalPriority,
        name: name.trim() || DEFAULT_NAME,
      };
      firedRef.current = true;
      setHandedOff(true);
      // Small beat so the gold selection registers before the view swaps.
      timerRef.current = window.setTimeout(
        () => onCompleteRef.current(answers),
        200,
      );
    },
    [goal, risk, major, name],
  );

  const activeOptions = useMemo<ActiveOption[]>(() => {
    switch (STEPS[step].key) {
      case "major":
        return MAJOR_OPTIONS.map((o) => ({
          key: o.value,
          label: o.value,
          hint: o.hint,
          note: o.available ? undefined : "coming soon",
          disabled: !o.available,
          selected: o.available && major === o.value,
          select: () => {
            setMajor(o.value);
            goNext();
          },
        }));
      case "goal":
        return GOAL_OPTIONS.map((o) => ({
          key: o.value,
          label: o.label,
          hint: o.hint,
          selected: goal === o.value,
          select: () => {
            setGoal(o.value);
            setCustomGoal("");
            goNext();
          },
        }));
      case "risk":
        return RISK_OPTIONS.map((o) => ({
          key: o.value,
          label: o.label,
          hint: o.hint,
          selected: risk === o.value,
          select: () => {
            setRisk(o.value);
            goNext();
          },
        }));
      case "priority":
        return PRIORITY_OPTIONS.map((o) => ({
          key: o.value,
          label: o.label,
          hint: o.hint,
          selected: priority === o.value,
          select: () => {
            setPriority(o.value);
            finish(o.value);
          },
        }));
      default:
        return [];
    }
  }, [step, major, goal, risk, priority, goNext, finish]);

  const submitCustomGoal = useCallback(() => {
    const value = customGoal.trim();
    if (!value) return;
    setGoal(value);
    goNext();
  }, [customGoal, goNext]);

  // Keyboard: 1-9 picks an option, Enter advances, Esc goes back.
  useEffect(() => {
    if (pending) return;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (step > 0) {
          e.preventDefault();
          goBack();
        }
        return;
      }
      if (typing) return; // inputs handle their own Enter

      if (e.key === "Enter") {
        const selected = activeOptions.find((o) => o.selected && !o.disabled);
        if (selected) {
          e.preventDefault();
          selected.select();
        } else if (STEPS[step].key === "name") {
          e.preventDefault();
          goNext();
        }
        return;
      }

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= activeOptions.length) {
        const option = activeOptions[n - 1];
        if (!option.disabled) {
          e.preventDefault();
          option.select();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, step, activeOptions, goBack, goNext]);

  const chips = useMemo(() => {
    const out = [major];
    if (goal) out.push(goal);
    if (risk) out.push(riskLabel(risk));
    if (priority) out.push(priorityLabel(priority));
    return out;
  }, [major, goal, risk, priority]);

  const customSelected =
    !!goal && goal === customGoal.trim() && customGoal.trim().length > 0;

  return (
    <section
      aria-label="Compass onboarding"
      className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12"
    >
      <Header compact={step > 0 || pending} />

      {/* progress rail — gold fill on an ink track */}
      <div className="mt-7">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-mist/70">
          <span>{pending ? "Building your plan" : meta.eyebrow}</span>
          <span className="font-mono">
            {pending ? "5 / 5" : `${step + 1} / ${STEPS.length}`}
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
            style={{ width: `${pending ? 100 : progress}%` }}
          />
        </div>
      </div>

      {pending ? (
        <div className="mt-8">
          <RouteLoader name={name.trim() || DEFAULT_NAME} chips={chips} />
        </div>
      ) : (
        <div key={step} className="animate-rise mt-8">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-[28px]">
            {meta.title}
          </h2>
          <p className="mt-2 text-[15px] text-mist">{meta.helper}</p>

          <div className="mt-6">
            {meta.key === "name" ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  maxLength={40}
                  autoComplete="given-name"
                  placeholder="Your first name"
                  aria-label="Your first name"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-850/70 px-4 py-3.5 text-base text-white outline-none transition-colors placeholder:text-mist/50 hover:border-maroon-300 focus:border-gold focus:shadow-[0_0_28px_-10px_rgba(255,198,39,0.8)]"
                />
                <button
                  type="button"
                  onClick={goNext}
                  className="shrink-0 rounded-xl bg-gold px-5 py-3.5 text-[15px] font-semibold text-ink-950 transition-colors hover:bg-gold-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
                >
                  {name.trim() ? "Continue" : `Continue as ${DEFAULT_NAME}`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {activeOptions.map((option, i) => (
                  <OptionCard
                    key={option.key}
                    index={i + 1}
                    label={option.label}
                    hint={option.hint}
                    note={option.note}
                    selected={option.selected}
                    disabled={option.disabled}
                    onSelect={option.select}
                  />
                ))}
              </div>
            )}

            {meta.key === "goal" ? (
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink-700" />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-mist/60">
                    or something else
                  </span>
                  <span className="h-px flex-1 bg-ink-700" />
                </div>
                <div
                  className={`mt-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors ${
                    customSelected
                      ? "border-gold bg-gold/10"
                      : "border-ink-700 bg-ink-850/70 focus-within:border-gold hover:border-maroon-300"
                  }`}
                >
                  <input
                    type="text"
                    value={customGoal}
                    maxLength={80}
                    placeholder="e.g. game development, robotics, med school"
                    aria-label="Another career goal"
                    onChange={(e) => setCustomGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCustomGoal();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-mist/50"
                  />
                  <button
                    type="button"
                    onClick={submitCustomGoal}
                    disabled={!customGoal.trim()}
                    aria-label="Use this goal"
                    className="shrink-0 rounded-lg border border-ink-700 p-1.5 text-mist transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-700 disabled:hover:text-mist"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                      <path
                        d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-mist transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M16 10H5M9.5 5.5L5 10l4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back
              </button>
            ) : (
              <span />
            )}

            <p className="text-right text-[12px] text-mist/60">
              {meta.key === "name" ? (
                <>
                  Press <Key>Enter</Key> to continue
                </>
              ) : (
                <>
                  Press <Key>1</Key>&ndash;<Key>{activeOptions.length}</Key> to
                  pick{step > 0 ? <>, <Key>Esc</Key> to go back</> : null}
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-ink-700 bg-ink-850 px-1.5 py-0.5 font-mono text-[11px] text-mist">
      {children}
    </kbd>
  );
}

function Header({ compact }: { compact: boolean }) {
  return (
    <header className={compact ? "flex items-center gap-3" : "flex items-start gap-4"}>
      {/* ── MASCOT SLOT: lead drops the AIVISOR mascot in here at integration ── */}
      <div
        data-slot="mascot"
        className={compact ? "h-11 w-11 shrink-0" : "h-20 w-20 shrink-0"}
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <CompassMark className={compact ? "h-5 w-5 text-gold" : "h-7 w-7 text-gold"} />
          <span
            className={
              compact
                ? "text-lg font-semibold tracking-tight text-white"
                : "text-3xl font-semibold tracking-tight text-white sm:text-4xl"
            }
          >
            Compass
          </span>
          {!compact ? (
            <span className="rounded-full border border-maroon-300/40 bg-maroon/30 px-2.5 py-1 text-[11px] font-medium tracking-wide text-maroon-50">
              ASU AIR Spark Challenge
            </span>
          ) : null}
        </div>
        {!compact ? (
          <p className="mt-2.5 text-[15px] leading-relaxed text-mist sm:text-base">
            Your route to graduation &mdash; rerouted the moment reality gets in
            the way.
          </p>
        ) : null}
      </div>
    </header>
  );
}

function CompassMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle
        cx="12"
        cy="12"
        r="9.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5 5-2.2z" fill="currentColor" />
    </svg>
  );
}

export { OptionCard } from "./OptionCard";
export { RouteLoader } from "./RouteLoader";
