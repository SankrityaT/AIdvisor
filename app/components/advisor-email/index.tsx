"use client";

// ── Advisor email draft ────────────────────────────────────────────────
// The last stop on the dead-end path: AIDvisor could not solve the break,
// it produced an AdvisorHandoff, and this turns that handoff into an email
// the student can actually send. Composed DETERMINISTICALLY — no model
// call, no fetch, no await. It renders the instant the handoff lands.
//
// composeEmail() is a pure function so it can be tested / reused.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdvisorHandoff } from "@/lib/types";
import { composeEmail, countWords, mailtoHref } from "./compose";

export { composeEmail, mailtoHref } from "./compose";

/* ── component ───────────────────────────────────────────────────────── */

export interface AdvisorEmailProps {
  handoff: AdvisorHandoff | null;
  studentName?: string;
  className?: string;
}

type CopyState = "idle" | "copied" | "manual";

/** An in-progress edit, tied to the handoff CONTENT it started from. */
interface Edit {
  of: string;
  subject: string;
  body: string;
}

/**
 * Content signature of a handoff. Deliberately not object identity: a parent
 * that rebuilds an equal handoff object every render (or streams one in) must
 * not wipe what the student has already typed.
 */
function draftKey(handoff: AdvisorHandoff, studentName?: string): string {
  return JSON.stringify([
    studentName ?? "",
    handoff.student_name,
    handoff.major,
    handoff.situation,
    handoff.what_broke,
    handoff.what_was_tried,
    handoff.open_question,
  ]);
}

const CARD =
  "relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/85 p-5 sm:p-6";

export default function AdvisorEmailDraft({
  handoff,
  studentName,
  className,
}: AdvisorEmailProps) {
  const draft = useMemo(
    () => (handoff ? composeEmail(handoff, studentName) : null),
    [handoff, studentName],
  );

  const key = useMemo(
    () => (handoff ? draftKey(handoff, studentName) : ""),
    [handoff, studentName],
  );

  // The student's edits are held against the handoff they were made on, so a
  // genuinely new handoff re-seeds the fields while a re-render never does.
  const [edit, setEdit] = useState<Edit | null>(null);
  const live = edit && edit.of === key ? edit : null;
  const subject = live ? live.subject : (draft?.subject ?? "");
  const body = live ? live.body : (draft?.body ?? "");

  const [copied, setCopied] = useState<CopyState>("idle");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const edited =
    !!draft && !!live && (live.subject !== draft.subject || live.body !== draft.body);

  const flash = useCallback((state: CopyState) => {
    setCopied(state);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied("idle"), 2400);
  }, []);

  const handleCopy = useCallback(async () => {
    const text = `Subject: ${subject}\n\n${body}`;

    // 1 — the modern path (needs a secure context).
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        flash("copied");
        return;
      }
    } catch {
      /* fall through to the legacy path */
    }

    // 2 — legacy execCommand, works over plain http.
    try {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "");
      scratch.style.position = "fixed";
      scratch.style.top = "-1000px";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      scratch.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(scratch);
      if (ok) {
        flash("copied");
        return;
      }
    } catch {
      /* fall through to manual */
    }

    // 3 — select the text so the student can hit Cmd/Ctrl+C themselves.
    const el = bodyRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    flash("manual");
  }, [subject, body, flash]);

  const href = useMemo(
    () => mailtoHref({ to_hint: draft?.to_hint ?? "", subject, body }),
    [draft, subject, body],
  );

  /* ── empty state ─────────────────────────────────────────────── */
  if (!draft) {
    return (
      <section
        aria-label="Advisor email draft"
        className={[CARD, className ?? ""].join(" ")}
      >
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-600" aria-hidden>
              <rect
                x="3"
                y="5.5"
                width="18"
                height="13"
                rx="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M4 7.5l8 5.5 8-5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-wide text-mist">
              Email your advisor
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mist/70">
              If AIDvisor ever hits a break it cannot route around on its own, it
              writes up the handoff and a ready-to-send email appears here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* ── draft ───────────────────────────────────────────────────── */
  const words = countWords(body);

  return (
    <section
      aria-label="Advisor email draft"
      className={[CARD, "animate-rise", className ?? ""].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(420px 170px at 8% -12%, rgba(255,198,39,.12), transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold/80">
              Step 2 — send it
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              Draft email to your advisor
            </h3>
          </div>
          <span className="rounded-full border border-ink-700 bg-ink-850 px-3 py-1 text-[11px] text-mist">
            To: {draft.to_hint}
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-mist/75">
          Written from the handoff above — every course, every workaround already
          tried. Edit anything, then copy it or open it in your mail app.
        </p>

        {/* subject */}
        <label
          htmlFor="advisor-email-subject"
          className="mt-4 block text-[11px] font-semibold uppercase tracking-[.14em] text-mist/70"
        >
          Subject
        </label>
        <input
          id="advisor-email-subject"
          value={subject}
          onChange={(e) =>
            draft && setEdit({ of: key, subject: e.target.value, body })
          }
          spellCheck={false}
          className="mt-1.5 w-full rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
        />

        {/* body */}
        <div className="mt-3 flex items-baseline justify-between">
          <label
            htmlFor="advisor-email-body"
            className="block text-[11px] font-semibold uppercase tracking-[.14em] text-mist/70"
          >
            Message
          </label>
          <span className="text-[11px] tabular-nums text-mist/50">
            {words} words{edited ? " · edited" : ""}
          </span>
        </div>
        <textarea
          id="advisor-email-body"
          ref={bodyRef}
          value={body}
          onChange={(e) =>
            draft && setEdit({ of: key, subject, body: e.target.value })
          }
          rows={14}
          spellCheck={false}
          className="mt-1.5 w-full resize-y whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-mist outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
        />

        {/* actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2 text-sm font-medium text-white transition hover:border-gold/50 hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <rect
                x="9"
                y="9"
                width="11"
                height="11"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M15 5.5A1.5 1.5 0 0013.5 4H6a2 2 0 00-2 2v7.5A1.5 1.5 0 005.5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Copy
          </button>

          <a
            href={href}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <rect
                x="3"
                y="5.5"
                width="18"
                height="13"
                rx="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M4 7.5l8 5.5 8-5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Open in Mail
          </a>

          {edited && (
            <button
              type="button"
              onClick={() => {
                setEdit(null);
                setCopied("idle");
              }}
              className="rounded-lg px-2.5 py-2 text-xs text-mist/70 underline-offset-4 transition hover:text-mist hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
            >
              Reset to draft
            </button>
          )}

          <span
            aria-live="polite"
            className={[
              "ml-auto text-xs transition-opacity duration-200",
              copied === "idle" ? "opacity-0" : "opacity-100",
              copied === "manual" ? "text-alert" : "text-teal",
            ].join(" ")}
          >
            {copied === "copied"
              ? "Copied to clipboard"
              : copied === "manual"
                ? "Selected — press Cmd/Ctrl+C"
                : " "}
          </span>
        </div>
      </div>
    </section>
  );
}
