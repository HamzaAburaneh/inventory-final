---
paths:
  - src/lib/sectionPager.js
  - src/lib/sectionPager.test.js
  - src/routes/+page.svelte
  - tests/home-scroll.test.js
---

Scroll direction always matches user intent — on the landing page's section pager
(`src/routes/+page.svelte`), a wheel/trackpad gesture moves exactly one section in the
gesture's direction; scrolling up must never move the page down (and vice versa), and
trailing trackpad inertia must never re-trigger a page turn. The direction/inertia rules
are pure functions in `src/lib/sectionPager.js`, guarded by `src/lib/sectionPager.test.js`
(unit) and `tests/home-scroll.test.js` (Playwright). Rules for any change: derive direction
from the sign of the current gesture (never from a signed accumulator that can mix
opposite-direction deltas), re-arm gesture state on direction flips, and pick targets as
"next snap point strictly above/below the current scroll position" — keep this logic in
`sectionPager.js`, not inline in the page.
