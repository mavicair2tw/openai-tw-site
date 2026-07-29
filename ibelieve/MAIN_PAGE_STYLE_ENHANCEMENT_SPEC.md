# iBelieve Main Page Style Enhancement

Status: Draft for review  
Scope: Main page presentation only (`ibelieve/index.html`)  
Related feature: Daily Cloud Map Summary and localized Today’s Signal

## Objective

Make the iBelieve homepage feel like a daily reflective publication rather than a dense analytics dashboard. The latest Cloud Map image and its generated daily insight should become the primary visual entry point, while the existing feed and interaction behavior remain intact.

## Non-goals

- No changes to post, reply, login, or feed APIs.
- No changes to Worker schedules or AI generation logic.
- No changes to Admin, Cloud Map data, or database schema.
- No replacement of the existing iBelieve identity or content.
- No permanent redesign of the dark/cosmic visual direction without a separate approval.

## Experience hierarchy

The first viewport should communicate the following in order:

1. iBelieve identity and language selector.
2. Latest Cloud Map summary image.
3. Localized daily insight (`Today’s Signal` / `本日暗示`).
4. Feed controls and topic filters.
5. Latest posts and replies.

The graph, statistics, hubs, and link filters remain available but should visually support the feed instead of competing with the daily summary.

## Visual direction

- Preserve the existing deep-space palette and starfield.
- Use the summary image as the strongest visual surface on the page.
- Increase breathing room around the summary section.
- Use display serif typography for titles and reflection text.
- Use monospace typography for timestamps, labels, filters, and technical metadata.
- Reduce unnecessary borders and heavy shadows around secondary panels.
- Use one restrained accent glow derived from the existing accent palette.
- Keep motion slow, brief, and optional; no continuous distracting animation.

## Proposed layout

### Desktop

- Keep the existing three-zone structure.
- Add a visually dominant summary module above the feed.
- Summary image should use a wide aspect ratio when space allows, with `object-fit: cover`.
- Daily insight should sit directly below the image as a readable text block.
- Sidebars should begin below or beside the summary module, depending on available width.

### Mobile

- Stack content in this order: identity, summary image, daily insight, filters, feed, context tools.
- Summary image should use the full available content width.
- Daily insight should remain readable without horizontal scrolling.
- Sidebars should collapse below the feed or into existing collapsible behavior.

## Daily insight behavior

- The homepage must render the latest saved summary’s generated insight.
- The label and content must follow the selected language.
- If the latest summary has no insight, hide the insight block rather than showing stale content from another day.
- Long insight text must wrap naturally and remain readable on small screens.
- Rendering must escape server-provided text before inserting it into the page.

## Accessibility requirements

- Summary image must retain meaningful alt text.
- Daily insight must use a semantic heading or labelled region.
- Text/background contrast must meet WCAG AA for normal text.
- All summary controls must be keyboard reachable.
- Respect `prefers-reduced-motion: reduce`.
- Do not communicate meaning through color alone.

## Performance requirements

- Do not add a new JavaScript framework or dependency.
- Do not add a blocking network request before the feed renders.
- Lazy-load the summary image when it is below the first viewport.
- Avoid layout shift by reserving image space before loading.
- Keep the enhancement limited to the existing homepage file unless a separate shared component is required.

## Acceptance criteria

- The latest summary image is visually dominant without obscuring the feed.
- The daily insight appears immediately below the matching image.
- Switching language updates both the insight label and the insight text.
- A missing insight does not display stale or hard-coded daily content.
- Desktop and mobile layouts do not clip, overlap, or introduce horizontal scrolling.
- Existing post, reply, filter, login, and image-lightbox interactions continue to work.
- No Worker, API, Admin, or database behavior changes are required for the style implementation.

## Validation plan

1. Load `/ibelieve/` with a summary that has an image and insight.
2. Confirm the summary image and insight appear in the first meaningful viewport.
3. Switch through English, Traditional Chinese, Japanese, and one European language.
4. Test a summary with no insight and confirm the block is hidden.
5. Verify desktop and mobile widths for clipping and readability.
6. Confirm post loading, filters, replies, and image lightbox still work.

## Implementation sequence after approval

1. Refine summary module spacing and hierarchy.
2. Simplify secondary panel borders/shadows.
3. Add responsive summary layout and reserved image space.
4. Add reduced-motion and contrast refinements.
5. Run the validation plan and review screenshots before deployment.
