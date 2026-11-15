# Phase 0 — Frontend compatibility audit

Branch: `autopilot-foundation`
Audit date: 2026-11-15
Status: static source inspection only; no browser/runtime test has been performed.

## Confirmed findings

### 1. The current HTML and dashboard script are from different UI structures

The current `index.html` uses a simple RTL layout with:
- `.layout`
- `header`
- `aside`
- `main`
- sections including `home`, `mergeStudio`, `textVideo`, `exportSection`, and `audioStudio`

The current `script.js` expects a different dashboard:
- `.sidebar`, `.menu-item`, `.hero`
- views named `create`, `text-to-video`, `editor`, `trim-editor`, `mergeStudio`, `audio`, and `projects`

The HTML has none of the expected `.sidebar`, `.menu-item`, or `.hero` structures, and only `mergeStudio` overlaps with the expected view IDs. As a result, the dashboard navigation cannot reliably display the existing HTML sections.

### 2. The main media editor controls are missing from the current HTML

Static scan of `script.js` found references to these IDs, none of which exist in `index.html`:
- `mediaInput`, `uploadArea`, `chooseMedia`
- `previewScreen`, `fileList`, `mediaInfo`, `playBtn`
- `timelineTracks`, `clipCounter`, `totalDuration`
- `addMoreClips`, `clearTimeline`, `menuToggle`

The media editor and timeline therefore do not have their required HTML controls in the current page.

### 3. The trim editor controls are not present in the current HTML

`ffmpeg-editor.js` expects `trimInput`, `trimPreview`, `loadFFmpeg`, `exportTrim`, and `trimStatus`; none are present in the current `index.html`. The trim section needs to be restored or the HTML must be reconciled with the intended trim UI before this tool can be considered connected.

### 4. Video merge has matching element IDs

All seven IDs used by `merge-editor.js` are present in `index.html`:
`mergeInput`, `mergeFileList`, `loadMergeFFmpeg`, `exportMerge`, `mergeProgress`, `mergeStatus`, and `mergeDownload`.

This confirms static HTML/JS wiring for the merge controls only. It does not prove that FFmpeg loads or that arbitrary video files merge successfully in a browser.

### 5. Existing tools should be preserved

The page includes the text-to-video and audio studio sections, and their separate scripts are loaded. Their full runtime behavior has not been tested. Avoid replacing these modules until their DOM dependencies and event wiring have been audited.

## Recommended repair order

1. Reconcile navigation first: either adapt `script.js` to the existing RTL HTML or deliberately restore the matching dashboard markup. Prefer the smallest safe change.
2. Restore/connect the trim editor section and verify its required IDs.
3. Decide whether the main media editor/timeline is intended to be part of the current page; if yes, add its complete UI and connect it deliberately rather than adding isolated placeholder IDs.
4. Verify audio and text-to-video controls against their HTML dependencies.
5. Test merge with a small set of compatible MP4 files, then improve robustness by normalizing input streams before concatenation if needed.
6. Only after the existing studio is stable, begin the content planning and scheduled automation backend.

## Verification limits

- This audit used source inspection and static ID matching.
- No browser automation, live GitHub Pages test, FFmpeg execution, or actual video export was performed.
- No production files were changed as part of this audit.
