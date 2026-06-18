# Prompt: Editorial Redesign of the StockSense Homepage

Update the existing **StockSense** homepage — a **Svelte 5 (runes mode) + SvelteKit + Vite** app — to an editorial, premium landing-page style. Do **not** rebuild in React or add frameworks; work within the existing stack: vanilla CSS with custom properties, **three** (Three.js) for the background scene, **Font Awesome** (`fas` classes) for icons, and `svelte/transition` for fades. Use the exact tokens, timings, and structure below. Do not invent extra design tokens.

==========================================================
PROJECT
==========================================================
StockSense — Your Intelligent Inventory Companion
Single page at `src/routes/+page.svelte`, helper components in `src/components/`.

==========================================================
EXISTING FILE / FOLDER STRUCTURE (all files already exist — modify, don't recreate)
==========================================================
src/
components/
ThreeScene.svelte (theme-aware Three.js warehouse scene: grid floor,
conveyor crates, analytics bars, ticker lines,
particles, mouse parallax, scroll dim to 45%.
KEEP AS IS — do not modify.)
ScrollReveal.svelte (IntersectionObserver reveal wrapper. Already supports
three variants via props — see ANIMATION PRIMITIVES.)
FeatureCard.svelte (glass card with pointer-driven 3D tilt + glow)
TestimonialCarousel.svelte (auto-rotating cross-fade carousel, 5s, pause on hover)
Navbar.svelte (app navbar — KEEP AS IS, rendered by +layout.svelte)
routes/
+page.svelte (the homepage — primary file to modify)
+layout.svelte (wraps page in a centered <main> — KEEP AS IS)
stores/
authStore.js (Firebase auth store — subscription must be preserved)
themes.js (themeStore: 'light' | 'dark' | 'blue' | 'green')
styles/
global.css (design tokens — the --tech-\* block may be extended
only with values listed in this prompt)

==========================================================
DESIGN TOKENS (already defined in global.css — use these, nothing else)
==========================================================
Light (`:root`):
--tech-accent: #0066ff; --tech-accent-rgb: 0, 102, 255;
--tech-bg-start: #f8f9fc; --tech-bg-end: #ffffff;
--tech-glass-bg: rgba(255,255,255,0.93);
--tech-glass-border: #e2e4e8;
--tech-title: #000000; --tech-label: #8b949e;

Dark (`[data-theme='dark']`):
--tech-accent: #ffe260; --tech-accent-rgb: 255, 226, 96;
--tech-bg-start: #16171b; --tech-bg-end: #0c0c0e;
--tech-glass-bg: rgba(13,14,17,0.92);
--tech-glass-border: #25262c;
--tech-title: #ffffff; --tech-label: #55555e;

Also available: --input-text (body text on cards), --border-radius (8px).

Typography: system font stack (already on body). All headings (h1, h2, h3) get
`letter-spacing: -0.025em` and `font-weight: 600` (medium-bold editorial look,
not 800). Eyebrow/strip text: `font-size: 0.72rem; letter-spacing: 0.2em;
text-transform: uppercase; color: var(--tech-label);`.

==========================================================
PAGE STRUCTURE (top to bottom)
==========================================================
<ThreeScene /> (fixed canvas, z-index 0 — untouched)

<main class="page">                     (z-index 1, max-width 1200px, cursor: default)
  1. Hero            (#hero       — editorial, bottom-anchored, full viewport)
  2. Features        (#features   — bento grid, numbered cards, mask reveals)
  3. How It Works    (#how-it-works — 3 numbered steps between hairlines)
  4. Testimonials    (#testimonials — carousel with hover puck)
  5. CTA             (#cta        — only when logged out)
</main>
Back-to-top button   (fixed, appears past 300px scroll — keep existing)

==========================================================

1. # HERO — editorial bottom-anchored layout
   Replace the centered glass card with content anchored to the BOTTOM of the
   viewport (like a magazine cover):

- Section: `min-height: max(540px, calc(100vh - 140px)); display: flex;
flex-direction: column; justify-content: flex-end; padding-bottom: 2rem;`
- Bottom row: flex, `align-items: flex-end; justify-content: space-between;
gap: 2rem; flex-wrap: wrap;`

LEFT column:

- Status badge (keep existing): pulsing dot + "LIVE INVENTORY INTELLIGENCE"
  pill in accent color.
- h1, wrapped in ScrollReveal blur variant:
  "Welcome to" <br> <span class="accent">StockSense</span>
  `font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 1.05;`
- Subtitle below (keep the existing scramble/decode text effect):
  "Your intelligent inventory management solution"
  `font-size: clamp(1.05rem, 2vw, 1.3rem); color: var(--input-text);`
- Because there is no glass card behind the hero text, give h1/subtitle a halo:
  `text-shadow: 0 0 18px var(--tech-bg-start), 0 0 36px var(--tech-bg-start);`

RIGHT column (bottom-aligned with the headline):

- Primary CTA pill with trailing circular arrow badge:
  <a class="btn-primary"><span>Get Started</span>
  <span class="btn-badge"><i class="fas fa-arrow-right"></i></span></a>
  Pill: `background: var(--tech-accent); color: var(--tech-bg-end);
border-radius: 9999px; padding: 0.5rem 0.5rem 0.5rem 1.5rem;
display: inline-flex; align-items: center; gap: 0.9rem; min-height: 52px;
font-weight: 700;` Hover: translateY(-2px) + brightness(1.08) + accent shadow.
  Badge: 38px circle, `background: var(--tech-bg-end); color: var(--tech-accent);`
  icon rotated -45deg (arrow-up-right look using fa-arrow-right).
- Secondary: text link "Learn More" + small -45deg arrow, color var(--tech-title),
  hover → var(--tech-accent). Scrolls to #features.
- Auth conditional (PRESERVE EXACTLY): when `authUser` is set, show a single
  primary pill "Open Your Inventory" → /manageItems instead of the two CTAs.
  Keep the `authStore.subscribe` logic in the script block.

HERO FOOTER STRIP (the signature element — under the bottom row):
`margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid
  var(--tech-glass-border); display: flex; justify-content: space-between;
  gap: 1rem; flex-wrap: wrap;` using the eyebrow type style. Three children: 1. "Intelligent Inventory Management" 2. <span><span style="color: var(--tech-title)">01</span> / 04</span> 3. A <button> "Scroll to Explore" that smooth-scrolls to #features
(transparent, no border, same type style, hover → accent).

# ========================================================== 2) FEATURES — eyebrow + asymmetric head, numbered bento cards

SECTION HEAD (replaces the centered glass chip — use this pattern for sections
2, 3, and 4):

- Eyebrow row, in ScrollReveal (default):
    <p class="eyebrow"><span>StockSense</span><span>Capabilities</span></p>
  flex with `gap: 4rem`.
- Head grid: 1 column on mobile; on ≥768px `grid-template-columns: 7fr 4fr;
align-items: end; gap: 1rem 3rem;`
  LEFT — h2 in ScrollReveal blur: "Key Features"
  `font-size: clamp(1.9rem, 4.5vw, 3rem); text-align: left;` + the same text-shadow halo as the hero.
  RIGHT — intro paragraph in ScrollReveal (delay 150):
  "Everything you need to keep stock accurate, predictable,
  and effortless — in one place."
  `color: var(--input-text); max-width: 36ch;` + small halo.

CARDS: keep the existing bento grid (mobile: 1 column stack; ≥768px: 3 columns,
card 1 spans 2, card 4 spans 2) and the existing FeatureCard tilt/glow. Changes:

- Wrap each card in ScrollReveal **mask** variant, delay = i \* 120.
- Add a small muted index before each card title:
  <span class="num">(01)</span> … (02), (03), (04)
  `font-size: 0.75rem; color: var(--tech-label);` aligned to the title top.
- Keep all four existing feature names, icons, and descriptions unchanged.

# ========================================================== 3) HOW IT WORKS — numbered steps between fading hairlines

- Same section-head pattern: eyebrow "StockSense / Workflow", h2 "How It Works",
  intro "Three steps from messy spreadsheets to a live, self-updating inventory."
- The 3 step cards keep their current content (Add Your Inventory / Track in
  Real Time / Act on Insights), icons, ghost numbers, and hover lift.
- Wrap the steps grid in a hairline frame: horizontal 1px lines above and below
  that FADE OUT toward the edges:
  .hairline::before, .hairline::after {
  content: ''; position: absolute; left: 0; right: 0; height: 1px;
  background: linear-gradient(to right, transparent 0%,
  var(--tech-glass-border) 15%, var(--tech-glass-border) 85%,
  transparent 100%);
  }
  (top: 0 for ::before, bottom: 0 for ::after; wrapper gets
  `position: relative; padding: 2.5rem 0;`)
- Each step in ScrollReveal (default), delay = i \* 120.

# ========================================================== 4) TESTIMONIALS — carousel with central hover puck

- Section head pattern: eyebrow "StockSense / Social proof", h2 "What Our
  Users Say", intro "Teams of every size run their stock on StockSense."
- Keep TestimonialCarousel's data, auto-rotate (5s, pause on hover/focus),
  cross-fade (in:fade 450ms delay 150 / out:fade 300ms), dots, and glass card.
- REPLACE the two side chevron buttons with a central hover puck:
  - Track `hovered` via the existing pointerenter/pointerleave handlers.
  - When hovered, render (with `transition:fade={{ duration: 250 }}`):
      <div class="puck">
        <button aria-label="Previous testimonial"><i class="fas fa-arrow-left"></i></button>
        <button aria-label="Next testimonial"><i class="fas fa-arrow-right"></i></button>
      </div>
    .puck { position: absolute; top: 40%; left: 50%;
      transform: translate(-50%, -50%); width: 126px; height: 126px;
      border-radius: 50%; display: flex; align-items: center;
      justify-content: center; gap: 1rem; z-index: 5;
      background: rgba(72, 72, 72, 0.16);
      backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
      cursor: pointer; }
    Buttons: transparent, no border, `color: var(--tech-title);
    font-size: 1.3rem;` hover → accent. Carousel wraps, so never disabled.
  - Hide the puck on touch devices: `@media (hover: none) { .puck { display:
none; } }` — dots remain the touch/keyboard navigation.

# ========================================================== 5) CTA — keep, restyle button

Keep the existing glass CTA card (logged-out only), heading, copy, and hover
lift. Replace its button with the same pill + circular arrow badge as the hero.

==========================================================
ANIMATION PRIMITIVES (ScrollReveal.svelte — already implemented)
==========================================================
All entrances use `cubic-bezier(0.22, 1, 0.36, 1)` and fire once at 15%
visibility with rootMargin "0px 0px -40px 0px".

<ScrollReveal> default: opacity 0 → 1, translateY(32px) → 0, 0.7s
<ScrollReveal blur> headings: + filter blur(12px) → 0, 0.9s
<ScrollReveal mask> cards/images: clip-path inset(100% 0 0 0) →
inset(0 0 0 0), 1.1s (top-down wipe)
prop `delay` (ms) staggers children: i \* 90–150 depending on section.

Every headline, paragraph, and card on the page enters with one of these three.

==========================================================
INTERACTIONS RECAP
==========================================================

- Feature cards: pointer tilt `perspective(1000px) rotateX/rotateY` (max 8–10deg),
  radial glow following the pointer, accent border + shadow on hover. CSS-only
  border/shadow fallback for non-fine pointers. (Already implemented — keep.)
- Step cards: translateY(-5px) + accent border + glow shadow on hover.
- CTA pills: translateY(-2px) + brightness(1.08) on hover.
- Carousel puck: fades/scales in over 250ms on hover; arrows advance with the
  existing 450ms cross-fade.
- Three.js scene: dims from 100% to 45% opacity over the first viewport of
  scroll (already implemented in ThreeScene — keep).
- Back-to-top: fixed accent circle, appears past 300px (keep).

==========================================================
CONSTRAINTS (unchanged from the original build)
==========================================================

- DO NOT break the auth flow: keep the authStore import, $effect subscription,
  and the `{#if !authUser}` conditionals.
- DO NOT touch ThreeScene.svelte, Navbar.svelte, +layout.svelte, themes.js.
- DO NOT add npm dependencies. Svelte 5 runes ($state, $effect, $props) only.
- Accessibility: ARIA labels on all controls, 44–48px touch targets,
  aria-live on the carousel, focus states, full prefers-reduced-motion support
  (ScrollReveal already shows content immediately; disable hover transforms).
- Responsive: single-column stacks under 768px; hero row and footer strip wrap;
  no horizontal scrolling anywhere; test 320px–1280px+.
- Keep the <svelte:head> title: "StockSense — Intelligent Inventory Management".
- Icons: Font Awesome only (fa-arrow-right, fa-arrow-left, plus the existing
  feature/step icons). No icon libraries.
