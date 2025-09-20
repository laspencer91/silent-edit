# Syntax Highlighting Architecture Plan

1. Define a `Highlighter` interface that accepts buffer lines plus language configuration and returns token spans. Begin with a simple regex-based strategy but keep the interface pluggable for future engines (e.g., Prism, Tree-sitter bindings).
2. Create a `language-registry.js` that maps file extensions to language metadata (language id, display name, comment styles, highlighter module path). Allow user overrides through a JSON file so adding a language is configuration-only.
3. Update the UI rendering path to call `highlighter.renderLine(line, row)` and convert spans into Blessed tags. Cache tokenized lines and invalidate on edits or when the cursor leaves a line to maintain responsiveness.
4. Ensure highlighters return both raw text and style metadata so other features (selection, search) can request plain text without coupling to highlighting logic.
5. Add a theme definition (token class → Blessed style). Keep theme data separate from language modules so multiple themes can reuse the same token classes.
6. Support asynchronous/high-cost highlighters by queuing work off the main event loop: render plain text first, then re-render lines as highlight results arrive.
7. Implement and register an initial JavaScript/TypeScript highlighter to validate the pipeline, measure performance, and iterate on caching if necessary.
