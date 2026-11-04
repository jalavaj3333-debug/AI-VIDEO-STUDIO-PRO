
import { FFmpeg } from
    "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";

import { fetchFile, toBlobURL } from
    "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

// ELEMENTS
const input = document.getElementById("trimInput");
const preview = document.getElementById("trimPreview");
const fileName = document.getElementById("trimFileName");

const startInput = document.getElementById("trimStart");
const endInput = document.getElementById("trimEnd");

const loadButton = document.getElementById("loadFFmpeg");
const exportButton = document.getElementById("exportTrim");

const status = document.getElementById("trimStatus");
const progressBar = document.getElementById("trimProgressBar");

const downloadLink = document.getElementById("downloadTrim");

let ffmpeg = null;
let loaded = false;
let selectedFile = null;
let inputURL = null;
let outputURL = null;
let processing = false;

// STATUS
function setStatus(message) {
    status.textContent = message;
}

// LOAD VIDEO
input.addEventListener("change", () => {

    const file = input.files[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
        setStatus("المرجو اختيار ملف فيديو.");
        return;
    }

    selectedFile = file;

    if (inputURL) URL.revokeObjectURL(inputURL);
    if (outputURL) URL.revokeObjectURL(outputURL);

    inputURL = URL.createObjectURL(file);
    outputURL = null;

    preview.src = inputURL;

    fileName.textContent = file.name;

    downloadLink.hidden = true;

    preview.onloadedmetadata = () => {
        startInput.value = 0;
        endInput.value = preview.duration.toFixed(1);

        endInput.max = preview.duration;

        setStatus(
            "مدة الفيديو: " + preview.duration.toFixed(2) + " ثانية"
        );
    };

    if (loaded) exportButton.disabled = false;

});

// LOAD FFMPEG ENGINE
loadButton.addEventListener("click", async () => {

    if (loaded || processing) return;

    try {

        loadButton.disabled = true;

        setStatus("جاري تحميل محرك FFmpeg...");

        progressBar.style.width = "5%";

        ffmpeg = new FFmpeg();
        console.log("STEP 1: FFmpeg created");
        ffmpeg.on("log", ({ message }) => {
            console.log("[FFmpeg]", message);
        });

        ffmpeg.on("progress", ({ progress }) => {

            const percentage = Math.max(
                0,
                Math.min(100, Math.round(progress * 100))
            );

            progressBar.style.width = percentage + "%";

        });

       
const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

const ffmpegURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm";

// تحميل Worker من خلال Blob لتفادي مشكل Cross-Origin
const classWorkerURL = await toBlobURL(
    `${ffmpegURL}/worker.js`,
    "text/javascript"
);

// تحميل محرك FFmpeg
await ffmpeg.load({
    classWorkerURL: classWorkerURL,

    coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript"
    ),

    wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
    )
});


        loaded = true;

        progressBar.style.width = "100%";

        setStatus("✓ محرك المونتاج جاهز!");

        loadButton.textContent = "✓ المحرك جاهز";

        exportButton.disabled = !selectedFile;

    } catch (error) {

        console.error(error);

        setStatus(
            "تعذر تحميل المحرك. تأكد من الإنترنت ثم أعد المحاولة."
        );

        loadButton.disabled = false;

    }

});

// EXPORT TRIMMED VIDEO
exportButton.addEventListener("click", async () => {

    if (!loaded || !selectedFile || processing) return;

    const start = Number(startInput.value);
    const end = Number(endInput.value);

    const duration = preview.duration;

    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end <= start ||
        end > duration
    ) {

        alert("تأكد من وقت البداية والنهاية.");

        return;
    }

    try {

        processing = true;

        exportButton.disabled = true;
        loadButton.disabled = true;

        downloadLink.hidden = true;

        progressBar.style.width = "0%";

        setStatus("جاري تجهيز الفيديو...");

        const extension =
            selectedFile.name.split(".").pop().toLowerCase();

        const safeExtension = /^[a-z0-9]+$/.test(extension)
            ? extension
            : "mp4";

        const inputName = `source.${safeExtension}`;
        const outputName = "AI_VIDEO_FINAL.mp4";

        await ffmpeg.writeFile(
            inputName,
            await fetchFile(selectedFile)
        );

        setStatus("جاري قص الفيديو وتحويله إلى MP4...");

        await ffmpeg.exec([
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

        setStatus("جاري تجهيز ملف التحميل...");

        const data = await ffmpeg.readFile(outputName);

        const blob = new Blob(
            [data],
            { type: "video/mp4" }
        );

        if (outputURL) URL.revokeObjectURL(outputURL);

        outputURL = URL.createObjectURL(blob);

        downloadLink.href = outputURL;
        downloadLink.hidden = false;

        downloadLink.download = "AI-VIDEO-TRIMMED.mp4";

        progressBar.style.width = "100%";

        setStatus(
            "✓ تم تصدير الفيديو بنجاح! الحجم: " +
            (blob.size / 1024 / 1024).toFixed(2) +
            " MB"
        );

    } catch (error) {

        console.error(error);

        setStatus(
            "وقع خطأ أثناء المعالجة. جرب فيديو أصغر أو صيغة أخرى."
        );

    } finally {

        processing = false;

        exportButton.disabled = !selectedFile || !loaded;
        loadButton.disabled = loaded;

    }

});

// CLEANUP ON PAGE EXIT
window.addEventListener("beforeunload", () => {

    if (inputURL) URL.revokeObjectURL(inputURL);
    if (outputURL) URL.revokeObjectURL(outputURL);

});
