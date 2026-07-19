---
name: design-preview
description: Use when proposing any visual/design change (colors, badges, icons, button/pill styles, layout treatments, etc.) in this app. Widget previews are opt-in — only shown when the user says the keyword "previews".
---

Preview options are **opt-in via keyword**: only run the preview flow below when the user's message contains the keyword **`previews`** (e.g. "show previews", "previews please"). Without the keyword, skip the widget entirely — just make (or propose) the change directly.

When the keyword IS present:

- Render options with the inline preview/visualization widget tool (`show_widget`), never as a static description, so the change can actually be seen before it's built.
- Show **10 options** unless the user asks for a different count.
- Show **light and dark mode side by side** for every option (the app themes via `[data-theme]`; both must be judged), and use the app's real surfaces (`#ffffff`-ish light, `#121212`-ish dark) so the preview matches production.
- Number/label each option so the user can pick by number or mix-and-match (e.g. "freezer icon from 3, color from 7").
- Only after the user picks do you implement it in the codebase.

Always (with or without previews): keep theme-dependent colors in CSS variables / `[data-theme]` rules, not hardcoded inline styles, so both themes stay correct.
