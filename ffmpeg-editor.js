
import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

// AI VIDEO STUDIO PRO - FIXED VIDEO TRIMMER

const input = document.getElementById("trimInput");
const previewBox = document.getElementById("trimPreview");
const loadButton = document.getElementById("loadFFmpeg");
const exportButton = document.getElementById("exportTrim");
const status = document.getElementById("trimStatus");

if (!input || !previewBox || !loadButton || !exportButton || !status) {
    console.error("Video Trimmer: HTML elements missing.");
} else {
    let ffmpeg = null;
    let loaded = false;
    let selectedFile = null;
    let inputURL = null;
    let outputURL = null;
    let processing = false;

    // Create missing interface elements automatically
    previewBox.innerHTML = "";

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.style.width = "100%";
    video.style.maxHeight = "400px";
    video.style.objectFit = "contain";
    previewBox.appendChild(video);

    const controls = document.createElement("div");
    controls.style.display = "grid";
    controls.style.gridTemplateColumns = "repeat(2,minmax(0,1fr))";
    controls.style.gap = "12px";
    controls.style.marginTop = "15px";

    function makeTimeInput(id, label) {
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

    const start = makeTimeInput("trimStart", "وقت البداية (ثانية)");
    const end = makeTimeInput("trimEnd", "وقت النهاية (ثانية)");

    controls.append(start.wrapper, end.wrapper);
    previewBox.after(controls);

    const progress = document.createElement("div");
    progress.style.height = "8px";
    progress.style.background = "#292929";
    progress.style.borderRadius = "20px";
    progress.style.marginTop = "15px";
    progress.style.overflow = "hidden";

    const progressBar = document.createElement("div");
    progressBar.style.width = "0%";
    progressBar.style.height = "100%";
    progressBar.style.background = "linear-gradient(90deg,#9b702b,#f4d58a)";
    progress.appendChild(progressBar);

    status.after(progress);

    const download = document.createElement("a");
    download.textContent = "⬇ تحميل الفيديو بعد القص";
    download.hidden = true;
    download.style.display = "inline-block";
    download.style.marginTop = "15px";
    download.style.color = "#f4d58a";
    download.style.fontWeight = "bold";
    status.after(download);

    function setStatus(message) {
        status.textContent = message;
    }

    function setProgress(value) {
        progressBar.style.width = Math.max(0, Math.min(100, value)) + "%";
    }

    // Select video
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("video/")) {
            setStatus("المرجو اختيار ملف فيديو صالح.");
            input.value = "";
            return;
        }

        selectedFile = file;

        if (inputURL) URL.revokeObjectURL(inputURL);
        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }

        inputURL = URL.createObjectURL(file);
        video.src = inputURL;
        download.hidden = true;

        video.onloadedmetadata = () => {
            start.field.value = "0";
            end.field.value = video.duration.toFixed(1);
            end.field.max = video.duration;
            setStatus("تم تحميل الفيديو. المدة: " + video.duration.toFixed(1) + " ثانية.");
            exportButton.disabled = !loaded;
        };

        video.onerror = () => {
            setStatus("تعذر فتح الفيديو. جرب ملف MP4.");
        };
    });

    // Load FFmpeg
    loadButton.addEventListener("click", async () => {
        if (loaded || processing) return;

        try {
            loadButton.disabled = true;
            setStatus("جاري تحميل محرك التحرير...");
            setProgress(5);

            ffmpeg = new FFmpeg();

            ffmpeg.on("log", ({ message }) => {
                console.log("[FFmpeg]", message);
            });

            ffmpeg.on("progress", ({ progress }) => {
                setProgress(Math.round(progress * 100));
            });

            const baseURL =
                "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

            setStatus("جاري تحميل ملفات المحرك...");

            const coreURL = await toBlobURL(
                `${baseURL}/ffmpeg-core.js`,
                "text/javascript"
            );

            setProgress(40);

            const wasmURL = await toBlobURL(
                `${baseURL}/ffmpeg-core.wasm`,
                "application/wasm"
            );

            setProgress(75);
            setStatus("جاري تشغيل المحرك...");

            await ffmpeg.load({ coreURL, wasmURL });

            loaded = true;
            window.videoFFmpeg = ffmpeg;
            window.videoFFmpegLoaded = true;

            setProgress(100);
            setStatus("✓ محرك التحرير جاهز!");
            loadButton.textContent = "✓ المحرك جاهز";
            exportButton.disabled = !selectedFile;

        } catch (error) {
            console.error("FFmpeg loading error:", error);
            setStatus("فشل تحميل المحرك: " + (error.message || error));
            setProgress(0);
            loadButton.disabled = false;
        }
    });

    // Export trimmed video
    exportButton.addEventListener("click", async () => {
        if (!loaded || !selectedFile || processing) {
            setStatus("اختار فيديو وحمّل محرك التحرير أولا.");
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

        try {
            processing = true;
            exportButton.disabled = true;
            loadButton.disabled = true;
            download.hidden = true;
            setProgress(0);

            setStatus("جاري تجهيز الفيديو...");

            const extension = selectedFile.name.split(".").pop().toLowerCase();
            const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : "mp4";

            const inputName = `source.${safeExtension}`;
            const outputName = "AI_VIDEO_FINAL.mp4";

            await ffmpeg.deleteFile(inputName).catch(() => {});
            await ffmpeg.deleteFile(outputName).catch(() => {});

            await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

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
                throw new Error("FFmpeg export failed.");
            }

            const data = await ffmpeg.readFile(outputName);
            const blob = new Blob([data], { type: "video/mp4" });

            if (outputURL) URL.revokeObjectURL(outputURL);
            outputURL = URL.createObjectURL(blob);

            download.href = outputURL;
            download.download = "AI-VIDEO-TRIMMED.mp4";
            download.hidden = false;

            setProgress(100);
            setStatus("✓ تم قص الفيديو بنجاح!");

        } catch (error) {
            console.error("Video export error:", error);
            setStatus("خطأ أثناء القص: " + (error.message || error));
        } finally {
            processing = false;
            exportButton.disabled = !loaded || !selectedFile;
            loadButton.disabled = loaded;
        }
    });

    window.addEventListener("beforeunload", () => {
        if (inputURL) URL.revokeObjectURL(inputURL);
        if (outputURL) URL.revokeObjectURL(outputURL);
        if (ffmpeg && loaded) ffmpeg.terminate();
    });

    exportButton.disabled = true;
    console.log("AI VIDEO STUDIO PRO - TRIMMER READY");
}
