
document.addEventListener("DOMContentLoaded", () => {

    const startButton = document.getElementById("smartAutoMontage");
    const progressBar = document.getElementById("autoMontageProgress");
    const statusText = document.getElementById("autoMontageStatus");
    const downloadLink = document.getElementById("autoMontageDownload");

    if (!startButton) return;

    let isProcessing = false;
    let lastOutputURL = null;

    function updateStatus(message) {
        if (statusText) statusText.textContent = message;
    }

    function updateProgress(value) {
        if (progressBar) {
            progressBar.style.width =
                Math.max(0, Math.min(100, value)) + "%";
        }
    }

    function getExtension(file) {
        const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : "mp4";
    }

    async function createMontage() {

        if (isProcessing) return;

        const clips = window.getStudioClips?.() || [];

        if (!clips.length) {
            updateStatus("أضف فيديوهات إلى Timeline أولاً.");
            return;
        }

        if (clips.some(clip =>
            !clip.file ||
            !clip.file.type.startsWith("video/") ||
            !Number.isFinite(clip.duration) ||
            clip.duration <= 0
        )) {
            updateStatus("تأكد من أن جميع المقاطع فيديو صالحة وأن مدتها معروفة.");
            return;
        }

        isProcessing = true;
        startButton.disabled = true;
        startButton.textContent = "⏳ جاري المونتاج...";

        updateProgress(0);

        if (downloadLink) {
            downloadLink.hidden = true;
            downloadLink.removeAttribute("href");
        }

        if (lastOutputURL) {
            URL.revokeObjectURL(lastOutputURL);
            lastOutputURL = null;
        }

        let ffmpeg = null;
        let outputCreated = false;
        const inputNames = [];
        const outputName = "SMART_AUTO_MONTAGE.mp4";

        try {

            // STEP 1: FFmpeg
            updateStatus("1/5: تجهيز محرك المونتاج...");

            if (
                !window.videoFFmpeg ||
                !window.videoFFmpegLoaded
            ) {
                throw new Error(
                    "FFmpeg غير جاهز. حمّلو أولاً من Video Trimmer."
                );
            }

            ffmpeg = window.videoFFmpeg;

            const { fetchFile } = await import(
                "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js"
            );

            // STEP 2: Upload clips
            updateStatus("2/5: تحميل المقاطع...");

            for (let i = 0; i < clips.length; i++) {

                const clip = clips[i];

                const name =
                    `transition_clip_${String(i + 1).padStart(3, "0")}.` +
                    getExtension(clip.file);

                const data = await fetchFile(clip.file);

                await ffmpeg.writeFile(name, data);

                inputNames.push(name);

                updateProgress(
                    5 + ((i + 1) / clips.length) * 30
                );

                updateStatus(
                    `تحميل الفيديو ${i + 1} من ${clips.length}...`
                );
            }

            // STEP 3: Prepare video filters
            updateStatus("3/5: تجهيز الانتقالات السينمائية...");

            const durations = clips.map(clip =>
                Number(clip.duration.toFixed(3))
            );

            const shortestDuration = Math.min(...durations);

            const transitionDuration = Math.min(
                0.8,
                shortestDuration * 0.2
            );

            const filters = [];

            clips.forEach((clip, index) => {

                filters.push(
                    `[${index}:v:0]` +
                    `trim=duration=${durations[index]},` +
                    `setpts=PTS-STARTPTS,` +
                    `scale=1280:720:force_original_aspect_ratio=decrease,` +
                    `pad=1280:720:(ow-iw)/2:(oh-ih)/2,` +
                    `setsar=1,fps=30,format=yuv420p,` +
                    `settb=AVTB[v${index}]`
                );

            });

            // STEP 4: Automatic fade transitions
            let previousLabel = "v0";
            let accumulatedDuration = durations[0];

            if (clips.length === 1) {

                filters.push("[v0]null[outv]");

            } else {

                for (let i = 1; i < clips.length; i++) {

                    const offset = Math.max(
                        0,
                        accumulatedDuration - transitionDuration
                    );

                    const nextLabel =
                        i === clips.length - 1
                            ? "outv"
                            : `transition${i}`;

                    filters.push(
                        `[${previousLabel}][v${i}]` +
                        `xfade=transition=fade:` +
                        `duration=${transitionDuration}:` +
                        `offset=${offset}[${nextLabel}]`
                    );

                    previousLabel = nextLabel;

                    accumulatedDuration +=
                        durations[i] - transitionDuration;

                }
            }

            // STEP 5: Export MP4
            updateStatus("4/5: تركيب الفيديو والانتقالات...");

            const inputArguments = [];

            inputNames.forEach(name => {
                inputArguments.push("-i", name);
            });

            const argumentsList = [
                "-y",
                ...inputArguments,
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
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                outputName
            ];

            await ffmpeg.exec(argumentsList);

            updateProgress(90);

            updateStatus("5/5: تجهيز ملف MP4 النهائي...");

            const outputData = await ffmpeg.readFile(outputName);

            const blob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            lastOutputURL = URL.createObjectURL(blob);
            outputCreated = true;

            if (downloadLink) {
                downloadLink.href = lastOutputURL;
                downloadLink.download = outputName;
                downloadLink.hidden = false;
            }

            updateProgress(100);

            updateStatus(
                "نجاح! تم إنشاء الفيديو مع الانتقالات السينمائية. حمّلو الآن."
            );

        } catch (error) {

            console.error("AUTO MONTAGE ERROR:", error);

            updateProgress(0);

            updateStatus(
                "وقع خطأ أثناء المونتاج: " +
                (error.message || "خطأ غير معروف")
            );

        } finally {

            if (ffmpeg) {

                for (const name of inputNames) {
                    try {
                        await ffmpeg.deleteFile(name);
                    } catch (error) {
                        console.warn("Cleanup:", error);
                    }
                }

                try {
                    await ffmpeg.deleteFile(outputName);
                } catch (error) {
                    console.warn("Output cleanup:", error);
                }

            }

            if (!outputCreated && downloadLink) {
                downloadLink.hidden = true;
            }

            isProcessing = false;
            startButton.disabled = false;
            startButton.textContent = "✨ ابدأ المونتاج التلقائي";

        }
    }

    startButton.addEventListener("click", createMontage);

    console.log("SMART AUTO MONTAGE WITH FADE TRANSITIONS READY!");

});
