
import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

/* ==========================================
   AI VIDEO STUDIO PRO
   FFmpeg Video Trimmer - GitHub Pages Fix
========================================== */

const input = document.getElementById("trimInput");
const previewBox = document.getElementById("trimPreview");
const loadButton = document.getElementById("loadFFmpeg");
const exportButton = document.getElementById("exportTrim");
const status = document.getElementById("trimStatus");

if (!input || !previewBox || !loadButton || !exportButton || !status) {
    console.error("FFmpeg: Some required HTML elements are missing.");
} else {
    let ffmpeg = null;
    let loaded = false;
    let selectedFile = null;
    let inputURL = null;
    let outputURL = null;
    let processing = false;

    // FFmpeg core: single-thread version
    const CORE_BASE =
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

    // IMPORTANT:
    // Worker must be served from the SAME GitHub Pages origin.
    // worker.js, const.js and errors.js must exist in /ffmpeg/
    const CLASS_WORKER_URL = new URL(
        "./ffmpeg/worker.js",
        window.location.href
    ).href;

    // Create video preview
    previewBox.innerHTML = "";

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.width = "100%";
    video.style.maxHeight = "400px";
    video.style.objectFit = "contain";

    previewBox.appendChild(video);

    // Create trim controls
    const controls = document.createElement("div");

    controls.style.display = "grid";
    controls.style.gridTemplateColumns = "repeat(2,minmax(0,1fr))";
    controls.style.gap = "12px";
    controls.style.marginTop = "15px";

    function createTimeInput(id, label) {
        const wrapper = document.createElement("label");

        wrapper.textContent = label;
        wrapper.style.display = "block";
        wrapper.style.color = "#d8ad55";
        wrapper.style.fontSize = "13px";

        const field = document.createElement("input");

        field.type = "number";
        field.id = id;
        field.min = "0";
        field.step = "0.1";
        field.value = "0";

        field.style.width = "100%";
        field.style.padding = "10px";
        field.style.marginTop = "7px";
        field.style.background = "#111";
        field.style.color = "#fff";
        field.style.border = "1px solid #705322";
        field.style.borderRadius = "8px";

        wrapper.appendChild(field);

        return { wrapper, field };
    }

    const start = createTimeInput(
        "trimStart",
        "وقت البداية (ثانية)"
    );

    const end = createTimeInput(
        "trimEnd",
        "وقت النهاية (ثانية)"
    );

    controls.append(start.wrapper, end.wrapper);
    previewBox.after(controls);

    // Progress bar
    const progress = document.createElement("div");

    progress.style.height = "8px";
    progress.style.background = "#292929";
    progress.style.borderRadius = "20px";
    progress.style.marginTop = "15px";
    progress.style.overflow = "hidden";

    const progressBar = document.createElement("div");

    progressBar.style.width = "0%";
    progressBar.style.height = "100%";
    progressBar.style.background =
        "linear-gradient(90deg,#9b702b,#f4d58a)";
    progressBar.style.transition = "width .2s";

    progress.appendChild(progressBar);
    status.after(progress);

    // Download link
    const download = document.createElement("a");

    download.textContent = "⬇ تحميل الفيديو بعد القص";
    download.hidden = true;
    download.style.display = "inline-block";
    download.style.marginTop = "15px";
    download.style.color = "#f4d58a";
    download.style.fontWeight = "bold";

    progress.after(download);

    function setStatus(message) {
        status.textContent = message;
    }

    function setProgress(value) {
        const percentage = Math.max(0, Math.min(100, value));
        progressBar.style.width = percentage + "%";
    }

    function releaseOutput() {
        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }

        download.removeAttribute("href");
        download.hidden = true;
    }

    // ======================================
    // SELECT VIDEO
    // ======================================

    input.addEventListener("change", () => {
        const file = input.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("video/")) {
            setStatus("المرجو اختيار ملف فيديو صالح.");
            input.value = "";
            return;
        }

        selectedFile = file;

        if (inputURL) {
            URL.revokeObjectURL(inputURL);
        }

        releaseOutput();

        inputURL = URL.createObjectURL(file);
        video.src = inputURL;

        setStatus("جاري قراءة معلومات الفيديو...");

        video.onloadedmetadata = () => {
            start.field.value = "0";
            end.field.value = video.duration.toFixed(1);

            end.field.max = video.duration;

            setStatus(
                "تم تحميل الفيديو. المدة: " +
                video.duration.toFixed(1) +
                " ثانية."
            );

            exportButton.disabled = !loaded;
        };

        video.onerror = () => {
            setStatus("تعذر فتح الفيديو. جرب ملف MP4.");
        };
    });

    // ======================================
    // LOAD FFMPEG ENGINE
    // ======================================

    loadButton.addEventListener("click", async () => {
        if (loaded || processing) return;

        try {
            loadButton.disabled = true;
            setProgress(5);

            setStatus("جاري تحميل محرك التحرير...");

            console.log("FFmpeg worker URL:", CLASS_WORKER_URL);

            // Check local worker availability
            const workerResponse = await fetch(CLASS_WORKER_URL);

            if (!workerResponse.ok) {
                throw new Error(
                    "ملف worker.js غير موجود في مجلد ffmpeg. تأكد من المسار."
                );
            }

            const workerText = await workerResponse.text();

            if (!workerText.includes("import")) {
                console.warn(
                    "تأكد أن worker.js هو ملف FFmpeg الأصلي."
                );
            }

            setProgress(20);
            setStatus("جاري تحميل ملفات FFmpeg...");

            // Download core files as Blob URLs
            const [coreURL, wasmURL] = await Promise.all([
                toBlobURL(
                    `${CORE_BASE}/ffmpeg-core.js`,
                    "text/javascript"
                ),
                toBlobURL(
                    `${CORE_BASE}/ffmpeg-core.wasm`,
                    "application/wasm"
                )
            ]);

            setProgress(65);

            // Create FFmpeg instance
            ffmpeg = new FFmpeg();

            ffmpeg.on("log", ({ message }) => {
                console.log("[FFmpeg]", message);
            });

            ffmpeg.on("progress", ({ progress }) => {
                if (processing) {
                    setProgress(65 + Math.round(progress * 30));
                }
            });

            setStatus("جاري تشغيل محرك التحرير...");

            // CRITICAL FIX:
            // classWorkerURL points to the local same-origin worker.
            await ffmpeg.load({
                coreURL,
                wasmURL,
                classWorkerURL: CLASS_WORKER_URL
            });

            loaded = true;

            window.videoFFmpeg = ffmpeg;
            window.videoFFmpegLoaded = true;

            setProgress(100);
            setStatus("✓ محرك التحرير جاهز!");

            loadButton.textContent = "✓ المحرك جاهز";
            exportButton.disabled = !selectedFile;

            console.log("FFmpeg loaded successfully.");

        } catch (error) {
            console.error("FFmpeg loading error:", error);

            setProgress(0);

            setStatus(
                "فشل تحميل المحرك: " +
                (error.message || String(error))
            );

            if (ffmpeg) {
                try {
                    ffmpeg.terminate();
                } catch (e) {
                    console.warn(e);
                }
            }

            ffmpeg = null;
            loaded = false;

            window.videoFFmpeg = null;
            window.videoFFmpegLoaded = false;

            loadButton.disabled = false;
            exportButton.disabled = true;
        }
    });

    // ======================================
    // EXPORT TRIMMED VIDEO
    // ======================================

    exportButton.addEventListener("click", async () => {
        if (!loaded || !ffmpeg || !selectedFile || processing) {
            setStatus(
                "اختار فيديو وحمّل محرك التحرير أولا."
            );
            return;
        }

        const from = Number(start.field.value);
        const to = Number(end.field.value);

        if (
            !Number.isFinite(from) ||
            !Number.isFinite(to) ||
            from < 0 ||
            to <= from ||
            to > video.duration
        ) {
            setStatus("تأكد من وقت البداية والنهاية.");
            return;
        }

        processing = true;
        exportButton.disabled = true;
        loadButton.disabled = true;

        releaseOutput();
        setProgress(0);

        const extension =
            selectedFile.name.split(".").pop().toLowerCase();

        const safeExtension =
            /^[a-z0-9]+$/.test(extension) ? extension : "mp4";

        const inputName = `source.${safeExtension}`;
        const outputName = "AI_VIDEO_FINAL.mp4";

        try {
            setStatus("جاري تجهيز الفيديو...");

            await ffmpeg.writeFile(
                inputName,
                await fetchFile(selectedFile)
            );

            setStatus("جاري قص الفيديو...");

            const result = await ffmpeg.exec([
                "-ss", String(from),
                "-i", inputName,
                "-t", String(to - from),
                "-map", "0:v:0",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                outputName
            ]);

            if (result !== 0) {
                throw new Error("تعذر تصدير الفيديو.");
            }

            const data = await ffmpeg.readFile(outputName);

            const blob = new Blob([data], {
                type: "video/mp4"
            });

            outputURL = URL.createObjectURL(blob);

            download.href = outputURL;
            download.download = "AI-VIDEO-TRIMMED.mp4";
            download.hidden = false;

            setProgress(100);
            setStatus("✓ تم قص الفيديو بنجاح!");

        } catch (error) {
            console.error("Video export error:", error);

            setStatus(
                "خطأ أثناء القص: " +
                (error.message || String(error))
            );

        } finally {
            try {
                await ffmpeg.deleteFile(inputName);
            } catch (e) {}

            try {
                await ffmpeg.deleteFile(outputName);
            } catch (e) {}

            processing = false;
            exportButton.disabled = !loaded || !selectedFile;
            loadButton.disabled = loaded;
        }
    });

    // Initial state
    exportButton.disabled = true;

    console.log("AI VIDEO STUDIO PRO - TRIMMER READY");
}
