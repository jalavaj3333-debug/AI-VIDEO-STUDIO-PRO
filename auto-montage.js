
document.addEventListener("DOMContentLoaded", () => {

    const startButton = document.getElementById("smartAutoMontage");
    const progressBar = document.getElementById("autoMontageProgress");
    const statusText = document.getElementById("autoMontageStatus");
    const downloadLink = document.getElementById("autoMontageDownload");

    if (!startButton) {
        console.warn("Smart Auto Montage button not found.");
        return;
    }

    let isProcessing = false;

    function updateStatus(message) {
        if (statusText) statusText.textContent = message;
    }

    function updateProgress(value) {
        if (progressBar) {
            progressBar.style.width =
                Math.max(0, Math.min(100, value)) + "%";
        }
    }

    function safeName(index) {
        return `montage_clip_${String(index).padStart(3, "0")}.mp4`;
    }

    function getExtension(file) {
        const name = file.name || "";
        const match = name.match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : "mp4";
    }

    async function waitForFFmpeg() {

        if (
            window.videoFFmpeg &&
            window.videoFFmpegLoaded
        ) {
            return window.videoFFmpeg;
        }

        throw new Error(
            "محرك FFmpeg غير جاهز. حمّل المحرك أولاً من أداة قص الفيديو."
        );
    }

    async function createMontage() {

        if (isProcessing) return;

        const clips = window.getStudioClips?.() || [];

        if (!clips.length) {
            updateStatus("أضف فيديوهات إلى Timeline أولاً.");
            return;
        }

        const invalidClip = clips.find(clip =>
            !clip.file ||
            !clip.file.type.startsWith("video/")
        );

        if (invalidClip) {
            updateStatus("كاين ملف غير صالح داخل Timeline.");
            return;
        }

        if (clips.some(clip => !clip.duration || clip.duration <= 0)) {
            updateStatus("انتظر حتى يتم تحميل معلومات مدة جميع الفيديوهات.");
            return;
        }

        isProcessing = true;
        startButton.disabled = true;
        startButton.textContent = "⏳ جاري إنشاء الفيديو...";

        updateProgress(0);

        if (downloadLink) {
            downloadLink.hidden = true;
            downloadLink.removeAttribute("href");
        }

        let ffmpeg;
        let outputURL = null;
        const inputNames = [];
        const outputName = "SMART_AUTO_MONTAGE.mp4";

        try {

            updateStatus("المرحلة 1/4: تجهيز محرك المونتاج...");

            ffmpeg = await waitForFFmpeg();

            const { fetchFile } = await import(
                "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js"
            );

            updateProgress(5);

            // Clean old temporary files
            const oldFiles = await ffmpeg.listDir("/");

            for (const entry of oldFiles) {
                if (
                    entry.name.startsWith("montage_clip_") ||
                    entry.name === "SMART_AUTO_MONTAGE.mp4"
                ) {
                    try {
                        await ffmpeg.deleteFile(entry.name);
                    } catch (error) {
                        console.warn("Could not remove old file:", entry.name);
                    }
                }
            }

            // Write videos to FFmpeg memory
            updateStatus("المرحلة 2/4: تحميل المقاطع...");

            for (let i = 0; i < clips.length; i++) {

                const clip = clips[i];
                const extension = getExtension(clip.file);
                const inputName =
                    `montage_clip_${String(i + 1).padStart(3, "0")}.${extension}`;

                const data = await fetchFile(clip.file);

                await ffmpeg.writeFile(inputName, data);

                inputNames.push(inputName);

                updateProgress(
                    5 + ((i + 1) / clips.length) * 35
                );

                updateStatus(
                    `تحميل المقطع ${i + 1} من ${clips.length}...`
                );

            }

            // Build FFmpeg filter
            updateStatus("المرحلة 3/4: تركيب الفيديوهات...");

            const inputs = [];

            inputNames.forEach(name => {
                inputs.push("-i", name);
            });

            const filters = [];

            clips.forEach((clip, index) => {

                filters.push(
                    `[${index}:v:0]` +
                    `scale=1280:720:force_original_aspect_ratio=decrease,` +
                    `pad=1280:720:(ow-iw)/2:(oh-ih)/2,` +
                    `setsar=1,fps=30,format=yuv420p[v${index}]`
                );

            });

            const videoLabels = clips
                .map((clip, index) => `[v${index}]`)
                .join("");

            filters.push(
                `${videoLabels}concat=n=${clips.length}:v=1:a=0[outv]`
            );

            const args = [
                "-y",
                ...inputs,
                "-filter_complex",
                filters.join(";"),
                "-map",
                "[outv]",
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "23",
                "-movflags",
                "+faststart",
                outputName
            ];

            await ffmpeg.exec(args);

            updateProgress(85);

            // Export result
            updateStatus("المرحلة 4/4: تجهيز الفيديو النهائي...");

            const outputData = await ffmpeg.readFile(outputName);

            const blob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            outputURL = URL.createObjectURL(blob);

            if (downloadLink) {

                downloadLink.href = outputURL;
                downloadLink.download = outputName;
                downloadLink.hidden = false;

            }

            updateProgress(100);

            updateStatus(
                "تم إنشاء المونتاج بنجاح! اضغط على تحميل الفيديو."
            );

        } catch (error) {

            console.error("AUTO MONTAGE ERROR:", error);

            updateProgress(0);

            updateStatus(
                "وقع خطأ: " + (error.message || "تعذر إنشاء الفيديو.")
            );

        } finally {

            if (ffmpeg) {

                for (const name of inputNames) {
                    try {
                        await ffmpeg.deleteFile(name);
                    } catch (error) {
                        console.warn(error);
                    }
                }

                try {
                    await ffmpeg.deleteFile(outputName);
                } catch (error) {
                    console.warn(error);
                }

            }

            isProcessing = false;
            startButton.disabled = false;
            startButton.textContent = "✨ ابدأ المونتاج التلقائي";

        }

    }

    startButton.addEventListener("click", createMontage);

    console.log("SMART AUTO MONTAGE READY!");

});
