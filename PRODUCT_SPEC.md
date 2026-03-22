# LearnCardio — Product Specification v1.0

## Vision
A clean, professional web app (PWA) that helps cardiology residents master all 25 ESC clinical practice guidelines through structured browsing and AI-generated clinical vignette MCQs. Installable on iPhone. Free to build and run.

---

## Guidelines in Scope (25 PDFs)
1. Acute Coronary Syndrome
2. Acute Pulmonary Embolism
3. Adult Congenital Heart Disease
4. Atrial Fibrillation
5. Cardio-Oncology
6. Cardiomyopathies
7. Cardiovascular Disease and Pregnancy
8. Chronic Coronary Syndromes
9. Diabetes
10. Dyslipidaemias
11. Endocarditis
12. Heart Failure
13. Hypertension
14. Mental Health
15. Myocarditis and Pericarditis
16. Non-Cardiac Surgery
17. Pacing and CRT
18. Peripheral Arterial and Aortic Disease
19. Prevention
20. Pulmonary Hypertension
21. Sports Cardiology
22. Supraventricular Tachycardia
23. Syncope
24. VA and SCD
25. Valvular Heart Disease

---

## Core User Flow

```
Login (Google)
    ↓
Dashboard
    ↓
Select Guideline(s) → Select Study Mode
    ↓
[Browse Figures] [Browse Recommendations] [Clinical Vignette MCQ]
    ↓
Progress tracked → Spaced repetition queue updated
```

---

## Study Modes (v1)

### Mode 1 — Browse Figures
- View every figure image (extracted from PDF) in order for a selected guideline
- Each figure shows:
  - The actual image (PNG extracted from PDF)
  - Original caption from the guideline
  - AI-generated plain-English explanation
  - Source: guideline name + page number
- Navigation: Previous / Next / Jump to figure number
- User can bookmark figures and add personal notes
- User can mark figure as "known" or "needs review"

### Mode 2 — Browse Recommendations
- View every recommendation in order for a selected guideline
- Each recommendation card shows:
  - Class badge: Class I / IIa / IIb / III (color coded: green / light green / orange / red)
  - Level of Evidence badge: A / B / C
  - Original recommendation text (verbatim from guideline)
  - AI-generated plain-English rephrasing
  - AI-generated clinical explanation (why this matters, mechanism, clinical context)
  - Optional: a single illustrative mini-vignette
- Filter by Class and/or Level of Evidence
- User can bookmark and add notes
- User can mark as "known" or "needs review"

### Mode 3 — Clinical Vignette MCQ
- AI-pre-generated clinical vignette questions drawn from guideline content
- Each question includes:
  - Clinical vignette stem (realistic patient scenario)
  - 4 answer options (A–D), one correct
  - Difficulty level: Easy / Intermediate / Hard
  - After answering: correct answer revealed + explanation + link to source recommendation
- User selects:
  - Which guideline(s) to draw questions from
  - Difficulty level (Easy / Intermediate / Hard / Mixed)
  - Session length (10 / 20 / 50 questions / Endless)
- Spaced repetition: questions due for review are prioritized
- Question history is stored (what was asked, when, what user answered)
- New questions are auto-served from the pre-generated bank; no repeats until bank is exhausted

### Mode 4 — Recommendations MCQ
- MCQs where the source material is the recommendation itself (not a vignette)
- Question types (AI-generated, mixed per session):
  - Given a recommendation text → identify its Class (I / IIa / IIb / III)
  - Given a recommendation text → identify its Level of Evidence (A / B / C)
  - Given a partial recommendation with a blank → select the correct completion
  - Given 4 recommendations → identify which one is Class I (or any target class)
  - Given a clinical context → which recommendation applies?
- Difficulty controls subtlety: Easy = clear-cut Class I vs III; Hard = nuanced IIa vs IIb distinctions
- Same session config as Mode 3 (guideline selection, difficulty, session length)
- After answering: shows correct Class/LOE + full recommendation text + AI explanation
- Spaced repetition and history tracked per question

### Mode 5 — Figures MCQ
- MCQs where the source material is a guideline figure image
- Question types (AI-generated, mixed per session):
  - Show figure → ask what clinical scenario/algorithm it represents
  - Show figure with one step/element highlighted → identify what it means
  - Show figure with one element hidden/blurred → select the correct label
  - Describe a clinical scenario in text → which figure/algorithm applies? (shows 4 figure thumbnails)
  - Show a step in a figure → what is the correct next action per the guideline?
- Figure image always visible during the question (this is a visual learning mode)
- Difficulty controls how much contextual information is given in the stem
- After answering: full figure shown with explanation of every step/element
- Spaced repetition and history tracked per question

---

## Features

### Progress Tracking
- Per guideline: % of figures seen, % of recommendations seen, % of questions answered
- Per question: correct/incorrect history, last seen date, next review date (spaced repetition)
- Overall dashboard: global stats across all guidelines
- Streak tracking (daily study streak)

### Spaced Repetition
- Uses SM-2 algorithm (same as Anki)
- Tracks per item: ease factor, review interval, repetition count
- "Due today" queue shown on dashboard and in MCQ mode
- Items answered correctly pushed further out; incorrect items resurface sooner

### Bookmarks & Notes
- Bookmark any figure, recommendation, or question
- Add free-text personal notes to any bookmarked item
- Bookmarks accessible from a dedicated "My Bookmarks" section

### Progress Dashboard (home screen)
- Guidelines overview cards: progress ring per guideline
- Today's due reviews count
- Current streak
- Recent session history
- Quick-start buttons: "Resume", "Due Reviews", "New Questions"

---

## Technical Architecture

### Stack (100% Free Tier)

| Layer | Technology | Free Tier |
|---|---|---|
| Frontend | Next.js 14 + Tailwind CSS | — |
| Hosting | Vercel | Free (hobby) |
| Database | Supabase PostgreSQL | 500MB free |
| Auth | Supabase Auth (Google OAuth) | Free |
| File Storage | Supabase Storage | 1GB free |
| AI (question gen) | Google Gemini Flash API | 15 RPM, 1M tokens/day free |
| PDF Processing | pdfjs-dist + pdf2pic | open source |
| PWA | next-pwa | open source |

### Data Model

```
guidelines
  id, name, year, version, pdf_filename, created_at

figures
  id, guideline_id, figure_number, image_path (supabase storage url),
  caption_original, caption_explanation (AI), page_number, created_at

recommendations
  id, guideline_id, recommendation_number, class (I/IIa/IIb/III),
  loe (A/B/C), original_text, rephrased_text (AI), explanation (AI),
  mini_vignette (AI), topic_tags[], page_number, created_at

questions
  id, guideline_id, source_recommendation_id (nullable), source_figure_id (nullable),
  difficulty (easy/intermediate/hard), stem, options (jsonb: {A,B,C,D}),
  correct_option, explanation, generated_at

user_progress_items
  id, user_id, item_type (figure/recommendation/question), item_id,
  status (unseen/known/needs_review), correct_count, incorrect_count,
  ease_factor, interval_days, next_review_at, last_seen_at

sessions
  id, user_id, mode, guideline_ids[], difficulty, started_at, ended_at,
  questions_answered, correct_count

bookmarks
  id, user_id, item_type, item_id, notes, created_at
```

### Content Pipeline (one-time setup scripts)

Run in this order before launching the app:

1. **`scripts/extract-figures.js`**
   - Reads each PDF, extracts every embedded image/figure
   - Saves as PNG to `/pipeline/figures/{guideline}/fig_{n}.png`
   - Outputs manifest: `figures.json` (guideline, figure_number, page, caption)

2. **`scripts/extract-recommendations.js`**
   - Reads each PDF text layer
   - Detects and parses recommendation blocks (Class I/IIa/IIb/III + LOE patterns)
   - Outputs: `recommendations.json`

3. **`scripts/generate-ai-content.js`**
   - For each figure: calls Gemini Flash → generates explanation
   - For each recommendation: calls Gemini Flash → generates rephrasing + explanation + mini-vignette
   - Respects free tier rate limits (15 RPM), runs overnight if needed
   - Outputs: enriched `figures-enriched.json`, `recommendations-enriched.json`

4. **`scripts/generate-questions.js`**
   - For each recommendation: calls Gemini Flash → generates Easy + Intermediate + Hard MCQ
   - Target: ~3 questions per recommendation × ~20 recommendations per guideline × 25 guidelines = ~1,500 base questions (easily expandable by re-running)
   - Outputs: `questions.json`

5. **`scripts/seed-database.js`**
   - Uploads all figures (PNG) to Supabase Storage
   - Seeds all tables from the generated JSON files

### PWA (iPhone support)
- `next-pwa` configured with service worker
- Web app manifest: standalone display, icon, theme color
- User adds to iPhone home screen via Safari → Share → "Add to Home Screen"
- Behaves like a native app: full screen, no browser bar

---

## UI Design Principles
- Clean, minimal, professional — similar to Amboss/UWorld aesthetic
- Color system based on ESC guideline class colors:
  - Class I → Green
  - Class IIa → Light green / teal
  - Class IIb → Orange
  - Class III → Red
  - LOE A/B/C → Badge system
- Mobile-first layout (primary device: iPhone)
- Dark/light mode toggle
- Typography: clear hierarchy, readable at small sizes

---

## Screen Map

```
/ (root)
├── /login                    Google OAuth login
├── /dashboard                Home: progress rings, streak, due reviews
├── /guidelines               List of all 25 guidelines
├── /guidelines/[id]          Single guideline: stats + start study modes
├── /study/figures/[id]       Browse figures mode
├── /study/recommendations/[id]  Browse recommendations mode
├── /study/mcq                MCQ session config + quiz
├── /bookmarks                All bookmarked items
├── /progress                 Detailed stats and history
└── /settings                 Profile, preferences
```

---

## v1 Scope (what we build first)

| Feature | v1 |
|---|---|
| Google login | ✅ |
| Select guideline | ✅ |
| Browse Figures mode | ✅ |
| Browse Recommendations mode | ✅ |
| Clinical Vignette MCQ mode | ✅ |
| Recommendations MCQ mode | ✅ |
| Figures MCQ mode | ✅ |
| Difficulty levels | ✅ |
| Progress tracking | ✅ |
| Spaced repetition | ✅ |
| Bookmarks + notes | ✅ |
| Progress dashboard | ✅ |
| PWA (iPhone home screen) | ✅ |
| Content pipeline scripts | ✅ |
| Dark/light mode | ✅ |

---

## v2 Roadmap (post-launch)

- Auto-detection of new ESC guidelines (web scraper → auto-pipeline)
- Multi-user support with separate progress per user
- Figure identification quiz (show image, ask user to identify/label steps)
- Free-text answer mode (not just MCQ)
- Export progress / bookmarks to PDF
- Collaborative notes (share with colleagues)
- Push notifications for daily review reminders (PWA notifications)
- Analytics dashboard (weak areas, time-per-question trends)

---

## v1 Build Phases

### Phase 0 — Content Pipeline (before any UI)
- Set up Supabase project
- Write and run all 5 extraction/generation scripts
- Validate data quality manually
- Seed database

### Phase 1 — Foundation
- Next.js project setup + Tailwind + PWA config
- Supabase client + Google Auth
- Layout, navigation, design system components

### Phase 2 — Core Study Modes
- Browse Figures
- Browse Recommendations
- MCQ engine + session flow

### Phase 3 — Intelligence Layer
- Spaced repetition logic
- Progress tracking
- Dashboard

### Phase 4 — Polish
- Bookmarks + notes
- Mobile optimizations
- PWA manifest + install prompt
- Dark mode

### Phase 5 — QA & Launch
- Test on iPhone (Safari → Add to Home Screen)
- Data quality review
- Performance check
