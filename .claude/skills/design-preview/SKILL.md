---
name: design-preview
description: Use when proposing any visual/design change (colors, badges, icons, button/pill styles, layout treatments, etc.) in this app. Widget previews are opt-in — only shown when the user explicitly asks for previews.
---

Preview options are opt-in: only run the preview flow below when the user explicitly asks for previews (for example by saying "previews" or writing `/make_a_preview`). Otherwise skip the widget and make (or propose) the change directly.

When previews are requested:

- Render options with the inline preview/visualization widget tool (`show_widget`), never as a static description, so the change can actually be seen before it's built.
- Show 5 options unless the user asks for a different count.
- Show light and dark mode side by side for every option (the app themes via `[data-theme]`; both must be judged), using the real surface colors from `src/styles/global.css` so the preview matches production.
- Number/label each option so the user can pick by number or mix-and-match (e.g. "freezer icon from 3, color from 7").
- Only after the user picks do you implement it in the codebase.

Always (with or without previews): keep theme-dependent colors in CSS variables / `[data-theme]` rules, not hardcoded inline styles, so both themes stay correct.
