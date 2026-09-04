# Data notes — ASU Computer Science, BS

Owner: data agent. Three files, all hand-authored and machine-verified.

- `major-map.json` — `MajorMap` from `lib/types.ts`. 8 semesters, 31 courses, 94 credits.
- `prereqs.json` — flat `{ code: string[] }` lookup, the "catalog-verified" cross-check source.
  Kept byte-for-byte consistent with the `prereqs` arrays in `major-map.json`.
- `course-sentiment.json` — `CourseSentiment[]`, exactly one entry per course code.

Course codes are uppercase with no space (`CSE110`, not `CSE 110`), which is what
`buildCourseIndex` in `lib/prereq.ts` normalizes to. No extra fields on any course.

## What the demo depends on (do not reshuffle without re-running the checks)

Semester 3 is the disruption target: `CSE240` and `CSE355` both live there.

- `CSE355` prereqs (`CSE205`, `MAT243`) are both in semester 2, so it can legally slide
  to semester 4. Nothing before semester 5 depends on it — dependents are `CSE340` (s5),
  `CSE450` (s6), `CSE471` (s7).
- `CSE240` prereq (`CSE205`) is in semester 2. Its only dependent is `CSE340` (s5), so it
  can also slide to semester 4.
- `CSE230` is the intended substitute for `CSE240`. It sits in semester 4 with prereq
  `CSE205` only, so pulling it forward into semester 3 is always legal.
- All four semester-4 courses (`CSE230`, `CSE310`, `CSE360`, `PHY121`) have prereqs in
  semesters 1-2, so the planner has four valid candidates to pull forward, not just one.
- Credit loads survive the swap: base sem 3 = 13 cr, sem 4 = 12 cr. Swapping the two
  broken courses down for two semester-4 courses leaves sem 3 = 13 and sem 4 = 12.
  Graduation stays at semester 8.

## Provenance: solid vs. approximated

**Real ASU course codes, titles, and credit hours** — these are catalog-accurate and safe
to show a judge:

CSE110 Principles of Programming with Java · CSE205 Object-Oriented Programming and Data
Structures · CSE230 Computer Organization and Assembly Language Programming · CSE240
Introduction to Programming Languages · CSE310 Data Structures and Algorithms · CSE330
Operating Systems · CSE340 Principles of Programming Languages · CSE355 Introduction to
Theoretical Computer Science · CSE360 Introduction to Software Engineering · CSE365
Information Assurance · CSE412 Database Management · CSE434 Computer Networks · CSE450
Design and Analysis of Algorithms · CSE460 Software Analysis and Design · CSE470 Computer
Graphics · CSE471 Introduction to Artificial Intelligence · CSE475 Foundations of Machine
Learning · CSE485/CSE486 Computer Science Capstone Project I/II · MAT265/MAT266 Calculus
for Engineers I/II · MAT243 Discrete Mathematical Structures · MAT342 Linear Algebra ·
PHY121 University Physics I: Mechanics · CHM113 General Chemistry I · ENG101/ENG102
First-Year Composition · COM225 Public Speaking · ECN211 Macroeconomic Principles ·
STP420 Introductory Applied Statistics · PHI101 Introduction to Philosophy.

**Prereq chains that match the real catalog:** CSE110 → CSE205 → {CSE230, CSE240, CSE310,
CSE355, CSE360}; CSE310 → {CSE412, CSE450, CSE471, CSE475}; CSE360 → CSE460; CSE485 →
CSE486; MAT265 → MAT266 → MAT342.

**Reasonable approximations — flagged deliberately:**

1. **`MAT243` prereq is listed as `MAT265`, not `MAT266`.** The real catalog wants MAT266
   (or MAT271). Moving MAT243 into semester 2 is what lets CSE355's prereqs all sit in
   semesters 1-2, which the scripted reroute requires. This is the single most load-bearing
   deviation in the file.
2. **`CSE365` prereqs simplified to `CSE230` + `CSE310`.** The real chain also touches
   CSE340; dropping that keeps CSE365 placeable in semester 5.
3. **`CSE434` prereq simplified to `CSE330`.** Catalog lists a CSE310-or-CSE330 style
   alternative; the graph here only models AND-prereqs, so one was chosen.
4. **`CSE485` prereqs given as `CSE310` + `CSE360`.** The real requirement is senior
   standing plus CSE360; "senior standing" isn't expressible as a course node.
5. **`PHY122` (University Physics Laboratory I, 1 cr) is omitted.** A 1-credit lab pushed
   semester 3/4 credit loads outside the 12-16 band after the reroute swap. `CHM113` (4 cr)
   covers the natural-science slot instead.
6. **General studies are represented by four concrete courses** (COM225, ECN211, PHI101,
   STP420) rather than the catalog's abstract "Humanities elective" placeholders, so every
   node on the route map has a real code and title.
7. **Total is 94 credits, not the real 120.** Free electives and the remaining general
   studies blocks are not modeled — the map shows the CS spine, 3-4 stops per station.
8. **Elective placement is illustrative.** CSE412/434/470/471/475 are upper-division
   electives students choose among; here they are fixed into a representative sequence.

**Sentiment data is fully synthetic.** `course-sentiment.json` is written to sound like
real student chatter (workload, grading, pace) but it is not scraped from RateMyProfessor,
Reddit, or any survey. Difficulty tiers are 6 easy / 18 medium / 7 hard. `CSE355`, `CSE310`,
`CSE330`, `CSE340`, `CSE450`, `CSE471`, `CSE475` are the `hard` tier; CSE355 is written to
read as the proofs-heavy wall, since it is the course the demo breaks.

## Verification

A throwaway script (scratchpad, not committed) asserts on every load:

1. `major-map.json` parses, 8 semesters numbered 1-8, 3-4 courses each, no duplicate codes,
   no field beyond `code`/`title`/`credits`/`prereqs`.
2. Zero dangling prereq references.
3. Every prereq sits in a strictly earlier semester than its dependent.
4. `course-sentiment.json` covers 100% of codes with no extras, duplicates, or bad tiers.
5. `prereqs.json` matches `major-map.json` for every course.
6. Demo constraints: CSE355 + CSE240 in sem 3; CSE230 exists with prereqs ≤ sem 2; nothing
   before sem 5 depends on CSE355 or CSE240; the simulated reroute keeps sem 3/4 loads in
   12-16 and graduation at semester 8.

All pass. If you edit any of the three files, re-run those checks — assertion 3 and the
CSE355 dependent check are the ones that silently break the on-stage demo.
