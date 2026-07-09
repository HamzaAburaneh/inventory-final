---
name: design-preview
description: Use when proposing any visual/design change (colors, badges, icons, button/pill styles, layout treatments, etc.) in this app — preview options before implementing.
---

When proposing a visual/design change, do NOT just apply one choice — preview options first:

- Render them with the inline preview/visualization widget tool (`show_widget`), never as a static description, so the change can actually be seen before it's built.
- Always show **10 options** unless the user asks for a different count.
- Show **light and dark mode side by side** for every option (the app themes via `[data-theme]`; both must be judged), and use the app's real surfaces (`#ffffff`-ish light, `#121212`-ish dark) so the preview matches production.
- Number/label each option so the user can pick by number or mix-and-match (e.g. "freezer icon from 3, color from 7").
- Only after the user picks do you implement it in the codebase — then keep theme-dependent colors in CSS variables / `[data-theme]` rules, not hardcoded inline styles, so both themes stay correct.
