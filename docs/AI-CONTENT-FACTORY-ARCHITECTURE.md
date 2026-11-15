# AI Video Studio Pro — AI Content Factory Architecture

## Product direction

AI Video Studio Pro is evolving from a browser-based video editor into an AI-assisted content production system. The target operating mode is **full automation with scheduled publishing**, while keeping human approval and platform permissions explicit wherever required.

The system should eventually support this workflow:

1. Configure content topics, target audiences, languages, channels, and a publishing schedule.
2. Plan content ideas and build a production calendar.
3. Draft scripts and split them into scenes.
4. Prepare or generate visual assets, voice-over, captions, and music.
5. Assemble and render platform-specific video versions.
6. Queue content for scheduled publishing through supported official platform APIs.
7. Collect available performance metrics and use them to inform future planning.

## Current repository baseline

The repository currently contains a static web application and browser-side media tools, including:

- Text-to-video scene preparation
- FFmpeg-based trimming
- FFmpeg-based video merging
- Audio editing utilities
- Existing editor and montage-related files

The current application is not yet a complete autonomous publishing service. A static GitHub Pages site cannot safely store API secrets or run reliable background schedules by itself.

## Target architecture

### 1. Frontend studio

Keep the browser application responsible for user-facing configuration and preview:

- Workspace and project dashboard
- Content strategy and channel settings
- Production calendar and queue
- Script and scene editor
- Media library and asset review
- Video editor, trim, merge, audio, and export tools
- Publishing status and analytics views

### 2. Backend orchestration

Add a separate server-side application for tasks that must continue when the browser is closed:

- Secure authentication and session management
- Project and schedule persistence
- Job queue and retry handling
- Content pipeline orchestration
- Rendering coordination
- Publishing adapters
- Analytics ingestion

The backend must own secrets. API keys, OAuth refresh tokens, and provider credentials must never be committed to this repository or exposed in frontend JavaScript.

### 3. Production pipeline

Represent each content item as a tracked job with explicit states, for example:

`draft → planned → scripted → assets_ready → rendered → awaiting_publish → scheduled → published`

Failures should be recorded with a useful message and a safe retry path. Long-running jobs must not depend on a browser tab staying open.

### 4. Publishing integrations

Use official APIs and supported authorization flows only. Each platform adapter must document:

- Required account type and permissions
- OAuth scopes and token refresh behavior
- Supported media formats and limits
- Scheduling or publishing restrictions
- Rate limits and error handling

Publishing must remain disabled until the account owner has explicitly connected and authorized the relevant platform. Where an official API does not support the desired action, the system should prepare an export and clearly report the limitation rather than simulate or bypass the platform.

### 5. Scheduling and reliability

Use a server-side scheduler and persistent job queue. A scheduled item should include its timezone, target channel, planned time, content version, and current status. The system should avoid duplicate publishing after retries by using idempotency keys or equivalent safeguards where supported.

## Delivery roadmap

### Phase 0 — Stabilize the existing studio
- Audit HTML, CSS, and JavaScript element IDs and module loading.
- Resolve navigation and view mismatches without discarding existing tools.
- Verify trim, merge, audio, and text-to-video integrations.
- Add lightweight checks and a repeatable manual test checklist.

### Phase 1 — Content planning foundation
- Define project, channel, content idea, script, scene, asset, and schedule data models.
- Build a content planner and production calendar.
- Add editable workflow states and local preview data before connecting paid or external AI services.

### Phase 2 — Assisted content production
- Add script drafting and scene breakdown interfaces.
- Add provider-independent interfaces for text, image, and voice services.
- Keep provider credentials server-side and make cost/usage limits visible.

### Phase 3 — Automatic editing and rendering
- Connect generated assets to the existing FFmpeg workflow.
- Normalize media before concatenation where necessary.
- Add reusable output presets for vertical, square, and landscape formats.
- Produce captions and reusable project manifests.

### Phase 4 — Scheduled publishing
- Add backend deployment, database, secure secret storage, OAuth connections, and a persistent queue.
- Implement official platform adapters one at a time.
- Add preview/approval controls and publishing audit logs.

### Phase 5 — Analytics and improvement loop
- Collect metrics available through authorized APIs.
- Compare performance by topic, format, and channel.
- Use results to suggest future topics and production changes; do not silently change account settings or publish unapproved experiments.

## Engineering principles

- Preserve the current working application while changes are developed on a feature branch.
- Prefer small, reviewable commits over large rewrites.
- Do not claim a feature is tested until it has been exercised in a browser or an automated test.
- Do not promise zero-cost AI generation or unlimited publishing; provider quotas, hosting, and platform policies apply.
- Make failures visible and recoverable.
- Keep the frontend usable on desktop and mobile, with Arabic RTL support.

## Immediate next engineering task

Complete the Phase 0 audit. In particular, compare the actual HTML structure with the selectors and view IDs expected by the JavaScript modules, then repair the smallest confirmed mismatches and test each tool independently before expanding the application.
