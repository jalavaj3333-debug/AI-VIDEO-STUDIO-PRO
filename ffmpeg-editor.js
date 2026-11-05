
import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

// =====================================
// AI VIDEO STUDIO PRO - SHARED FFMPEG ENGINE
// =====================================

const $ = (id) => document.getElementById(id);

// HTML ELEMENTS
const input = $("trimInput");
const preview = $("trimPreview");
const fileName = $("trimFileName");
const startInput = $("trimStart");
const endInput = $("trimEnd");
const loadButton = $("loadFFmpeg");
const exportButton = $("exportTrim");
const status = $("trimStatus");
const progressBar = $("trimProgressBar");
const downloadLink = $("downloadTrim");

// CHECK ELEMENTS
if (
    !input || !preview || !fileName ||
    !startInput || !endInput ||
    !loadButton || !exportButton ||
    !status || !progressBar || !downloadLink
) {
    console.error("Video Trimmer: HTML elements are missing.");
} else {

    // =====================================
    // SHARED ENGINE STATE
    // =====================================

    let ffmpeg = null;
    let loaded = false;
    let loading = false;
    let processing = false;
    let selectedFile = null;

    let inputURL = null;
    let outputURL = null;
    let loadPromise = null;

    // Share the engine with other studio tools
    window.videoFFmpeg = null;
    window.videoFFmpegLoaded = false;
    window.videoFFmpegLoading = false;
    window.videoFFmpegBusy = false;

    // =====================================
    // HELPERS
    // =====================================

    function setStatus(message) {
        status.textContent = message;
    }

    function setProgress(value) {
        const percentage = Math.max(0, Math.min(100, value));
        progressBar.style.width = percentage + "%";
    }

    function clearDownload() {
        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }
    }

    function updateButtons() {
        exportButton.disabled = !loaded || !selectedFile || processing;
        loadButton.disabled = loaded || loading || processing;
    }

    function getSafeExtension(filename) {
        const extension = filename.split(".").pop().toLowerCase();

        return /^[a-z0-9]+$/.test(extension)
            ? extension
            : "mp4";
    }

    // =====================================
    // SELECT VIDEO
    // =====================================

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

        clearDownload();

        inputURL = URL.createObjectURL(file);

        preview.onloadedmetadata = () => {
            startInput.value = "0";
            endInput.value = preview.duration.toFixed(1);
            endInput.max = preview.duration;

            setStatus(
                "مدة الفيديو: " +
                preview.duration.toFixed(2) +
                " ثانية"
            );
        };

        preview.onerror = () => {
            setStatus("تعذر فتح الفيديو للمعاينة.");
        };

        preview.src = inputURL;
        fileName.textContent = file.name;

        updateButtons();
    });

    // =====================================
    // LOAD FFMPEG ENGINE
    // =====================================

    async function loadFFmpegEngine() {

        if (loaded && ffmpeg) {
            return ffmpeg;
        }

        if (loadPromise) {
            return loadPromise;
        }

        loading = true;
        window.videoFFmpegLoading = true;
        updateButtons();

        loadPromise = (async () => {
            try {
                setStatus("جاري تجهيز محرك المونتاج...");
                setProgress(5);

                console.log("FFmpeg: Creating engine");

                const engine = new FFmpeg();

                engine.on("log", ({ message }) => {
                    console.log("[FFmpeg]", message);
                });

                engine.on("progress", ({ progress }) => {
                    if (processing) {
                        setProgress(Math.round(progress * 100));
                    }
                });

                const coreBaseURL =
                    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

                // Local worker
                const classWorkerURL = new URL(
                    "./ffmpeg/worker.js",
                    window.location.href
                ).href;

                console.log("FFmpeg worker:", classWorkerURL);

                setProgress(20);
                setStatus("جاري تحميل ملفات FFmpeg...");

                const coreURL = await toBlobURL(
                    `${coreBaseURL}/ffmpeg-core.js`,
                    "text/javascript"
                );

                setProgress(45);

                const wasmURL = await toBlobURL(
                    `${coreBaseURL}/ffmpeg-core.wasm`,
                    "application/wasm"
                );

                setProgress(70);
                setStatus("جاري تشغيل محرك المونتاج...");

                await engine.load({
                    classWorkerURL,
                    coreURL,
                    wasmURL
                });

                ffmpeg = engine;
                loaded = true;

                // Publish the ready engine
                window.videoFFmpeg = engine;
                window.videoFFmpegLoaded = true;

                console.log("FFmpeg engine loaded successfully.");

                setProgress(100);
                setStatus("✓ محرك المونتاج جاهز!");

                loadButton.textContent = "✓ المحرك جاهز";

                return engine;

            } catch (error) {
                console.error("FFmpeg Loading Error:", error);

                if (ffmpeg) {
                    try {
                        ffmpeg.terminate();
                    } catch (_) {}
                }

                ffmpeg = null;
                loaded = false;

                window.videoFFmpeg = null;
                window.videoFFmpegLoaded = false;

                setProgress(0);

                setStatus(
                    "تعذر تحميل المحرك: " +
                    (error?.message || String(error))
                );

                throw error;

            } finally {
                loading = false;
                window.videoFFmpegLoading = false;
                loadPromise = null;
                updateButtons();
            }
        })();

        return loadPromise;
    }

    loadButton.addEventListener("click", async () => {
        try {
            await loadFFmpegEngine();
        } catch (error) {
            console.error(error);
        }
    });

    // =====================================
    // EXPORT TRIMMED VIDEO
    // =====================================

    exportButton.addEventListener("click", async () => {

        if (!loaded || !ffmpeg || !selectedFile || processing) {
            return;
        }

        if (window.videoFFmpegBusy) {
            setStatus("⚠️ محرك FFmpeg مستعمل حالياً من أداة أخرى.");
            return;
        }

        const start = Number(startInput.value);
        const end = Number(endInput.value);
        const duration = preview.duration;

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            !Number.isFinite(duration) ||
            start < 0 ||
            end <= start ||
            end > duration
        ) {
            alert("تأكد من وقت البداية والنهاية.");
            return;
        }

        const inputName =
            `source.${getSafeExtension(selectedFile.name)}`;

        const outputName = "AI_VIDEO_FINAL.mp4";

        try {
            processing = true;
            window.videoFFmpegBusy = true;

            updateButtons();
            clearDownload();
            setProgress(0);

            setStatus("جاري تجهيز الفيديو...");

            await ffmpeg.deleteFile(inputName).catch(() => {});
            await ffmpeg.deleteFile(outputName).catch(() => {});

            await ffmpeg.writeFile(
                inputName,
                await fetchFile(selectedFile)
            );

            setStatus("جاري قص الفيديو وتحويله إلى MP4...");

            const result = await ffmpeg.exec([
                "-ss", String(start),
                "-i", inputName,
                "-t", String(end - start),
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
                throw new Error("FFmpeg failed to export the video.");
            }

            setStatus("جاري تجهيز ملف التحميل...");

            const data = await ffmpeg.readFile(outputName);

            if (!data || data.length === 0) {
                throw new Error("ملف الفيديو الناتج فارغ.");
            }

            const blob = new Blob(
                [data],
                { type: "video/mp4" }
            );

            outputURL = URL.createObjectURL(blob);

            downloadLink.href = outputURL;
            downloadLink.download = "AI-VIDEO-TRIMMED.mp4";
            downloadLink.hidden = false;

            setProgress(100);

            setStatus(
                "✓ تم تصدير الفيديو بنجاح! الحجم: " +
                (blob.size / 1024 / 1024).toFixed(2) +
                " MB"
            );

        } catch (error) {
            console.error("Video Export Error:", error);

            setProgress(0);

            setStatus(
                "خطأ أثناء التصدير: " +
                (error?.message || String(error))
            );

        } finally {
            try {
                await ffmpeg.deleteFile(inputName);
                await ffmpeg.deleteFile(outputName);
            } catch (_) {}

            processing = false;
            window.videoFFmpegBusy = false;

            updateButtons();
        }
    });

    // =====================================
    // CLEANUP
    // =====================================

    window.addEventListener("beforeunload", () => {

        if (inputURL) {
            URL.revokeObjectURL(inputURL);
        }

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
        }

        if (ffmpeg && loaded) {
            ffmpeg.terminate();
        }

    });

    updateButtons();

    console.log("AI VIDEO STUDIO PRO - FFMPEG EDITOR READY");
}
