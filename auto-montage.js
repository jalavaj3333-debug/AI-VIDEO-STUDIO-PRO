
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // SMAILLY - AI VIDEO STUDIO PRO
    // SMART AUTO MONTAGE ENGINE
    // ==========================================

    const startButton = document.getElementById("smartAutoMontage");
    const progressBar = document.getElementById("autoMontageProgress");
    const statusText = document.getElementById("autoMontageStatus");
    const downloadLink = document.getElementById("autoMontageDownload");

    const musicInput = document.getElementById("musicInput");
    const musicVolume = document.getElementById("musicVolume");

    if (!startButton) {
        console.warn("Smart Auto Montage button not found.");
        return;
    }

    let isProcessing = false;
    let lastOutputURL = null;

    const OUTPUT_NAME = "SMAILLY_AI_AUTO_MONTAGE.mp4";

    // ==========================================
    // UI HELPERS
    // ==========================================

    function updateStatus(message) {
        if (statusText) {
            statusText.textContent = message;
        }
    }

    function updateProgress(value) {
        if (progressBar) {
            const percentage = Math.max(0, Math.min(100, value));
            progressBar.style.width = percentage + "%";
        }
    }

    function getExtension(file) {
        const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : "mp4";
    }

    function safeDuration(value) {
        return Number(Number(value).toFixed(3));
    }

    function getSafeName(index, file) {
        const extension = getExtension(file);
        return `auto_video_${String(index + 1).padStart(3, "0")}.${extension}`;
    }

    // ==========================================
    // CHECK INPUTS
    // ==========================================

    function validateClips(clips) {

        if (!Array.isArray(clips) || clips.length === 0) {
            throw new Error("أضف فيديوهات إلى Timeline أولاً.");
        }

        for (let i = 0; i < clips.length; i++) {

            const clip = clips[i];

            if (!clip || !clip.file) {
                throw new Error(`المقطع رقم ${i + 1} لا يحتوي على ملف فيديو.`);
            }

            if (
                !clip.file.type ||
                !clip.file.type.startsWith("video/")
            ) {
                throw new Error(`المقطع رقم ${i + 1} ليس فيديو صالحاً.`);
            }

            if (
                !Number.isFinite(Number(clip.duration)) ||
                Number(clip.duration) <= 0
            ) {
                throw new Error(`مدة المقطع رقم ${i + 1} غير صالحة.`);
            }
        }
    }

    // ==========================================
    // BUILD VIDEO FILTERS
    // ==========================================

    function buildVideoFilters(durations, useTransitions) {

        const filters = [];

        // Normalize all videos

        durations.forEach((duration, index) => {

            filters.push(
                `[${index}:v:0]` +
                `trim=duration=${duration},` +
                `setpts=PTS-STARTPTS,` +
                `scale=1280:720:force_original_aspect_ratio=decrease,` +
                `pad=1280:720:(ow-iw)/2:(oh-ih)/2,` +
                `setsar=1,` +
                `fps=30,` +
                `format=yuv420p,` +
                `settb=AVTB[v${index}]`
            );

        });

        // Single video

        if (durations.length === 1) {
            filters.push("[v0]null[outv]");

            return {
                filters,
                finalDuration: durations[0]
            };
        }

        // Normal concat fallback

        if (!useTransitions) {

            const inputs = durations
                .map((_, index) => `[v${index}]`)
                .join("");

            filters.push(
                `${inputs}concat=n=${durations.length}:v=1:a=0[outv]`
            );

            return {
                filters,
                finalDuration: durations.reduce((a, b) => a + b, 0)
            };
        }

        // Cinematic transitions

        const transitionDuration = Math.min(
            0.8,
            Math.min(...durations) * 0.2
        );

        if (transitionDuration <= 0) {
            throw new Error("مدة الانتقال غير صالحة.");
        }

        let previousLabel = "v0";
        let accumulatedDuration = durations[0];

        for (let i = 1; i < durations.length; i++) {

            const offset = Math.max(
                0,
                accumulatedDuration - transitionDuration
            );

            const nextLabel =
                i === durations.length - 1
                    ? "outv"
                    : `fade${i}`;

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

        return {
            filters,
            finalDuration: durations.reduce((a, b) => a + b, 0) -
                transitionDuration * (durations.length - 1)
        };
    }

    // ==========================================
    // RUN FFMPEG
    // ==========================================

    async function runMontage(ffmpeg, inputNames, musicName, durations, outputName, useTransitions, musicLevel) {

        const videoConfig = buildVideoFilters(
            durations,
            useTransitions
        );

        const filters = [...videoConfig.filters];

        const finalDuration = videoConfig.finalDuration;

        if (musicName) {

            const musicInputIndex = inputNames.length;

            filters.push(
                `[${musicInputIndex}:a:0]` +
                `atrim=duration=${finalDuration},` +
                `asetpts=PTS-STARTPTS,` +
                `volume=${musicLevel},` +
                `afade=t=out:st=${Math.max(0, finalDuration - 2)}:d=${Math.min(2, finalDuration)}` +
                `[outa]`
            );
        }

        const inputArguments = [];

        inputNames.forEach(name => {
            inputArguments.push("-i", name);
        });

        if (musicName) {
            inputArguments.push(
                "-stream_loop", "-1",
                "-i", musicName
            );
        }

        const args = [
            "-y",
            ...inputArguments,
            "-filter_complex",
            filters.join(";"),
            "-map",
            "[outv]"
        ];

        if (musicName) {
            args.push(
                "-map", "[outa]",
                "-c:a", "aac",
                "-b:a", "192k"
            );
        } else {
            args.push("-an");
        }

        args.push(
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-t", String(finalDuration),
            "-movflags", "+faststart",
            outputName
        );

        const result = await ffmpeg.exec(args);

        if (result !== 0) {
            throw new Error(
                useTransitions
                    ? "فشل تطبيق الانتقالات السينمائية."
                    : "فشل دمج الفيديوهات."
            );
        }

        return finalDuration;
    }

    // ==========================================
    // CREATE AUTOMATIC MONTAGE
    // ==========================================

    async function createMontage() {

        if (isProcessing) return;

        const clips = window.getStudioClips?.() || [];

        const musicFile = musicInput?.files?.[0] || null;

        let ffmpeg = null;

        const temporaryFiles = [];

        let outputCreated = false;

        try {

            validateClips(clips);

            if (
                musicFile &&
                (!musicFile.type || !musicFile.type.startsWith("audio/"))
            ) {
                throw new Error("اختار ملف صوتي صالح للموسيقى.");
            }

            if (!window.videoFFmpeg || !window.videoFFmpegLoaded) {
                throw new Error(
                    "محرك FFmpeg غير جاهز. حمّلو أولاً من Video Trimmer."
                );
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

            ffmpeg = window.videoFFmpeg;

            const { fetchFile } = await import(
                "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js"
            );

            // STEP 1: LOAD CLIPS

            updateStatus("1/5: تجهيز الفيديوهات...");

            const durations = clips.map(clip =>
                safeDuration(clip.duration)
            );

            const inputNames = [];

            for (let i = 0; i < clips.length; i++) {

                const file = clips[i].file;

                const name = getSafeName(i, file);

                await ffmpeg.writeFile(
                    name,
                    await fetchFile(file)
                );

                inputNames.push(name);
                temporaryFiles.push(name);

                updateProgress(
                    5 + ((i + 1) / clips.length) * 25
                );

                updateStatus(
                    `تحميل الفيديو ${i + 1} من ${clips.length}...`
                );
            }

            // STEP 2: LOAD MUSIC

            let musicName = null;

            if (musicFile) {

                updateStatus("2/5: تحميل الموسيقى...");

                musicName =
                    "auto_background_music." +
                    getExtension(musicFile);

                await ffmpeg.writeFile(
                    musicName,
                    await fetchFile(musicFile)
                );

                temporaryFiles.push(musicName);
            }

            // MUSIC VOLUME

            const musicLevel = Math.max(
                0,
                Math.min(
                    1,
                    Number(musicVolume?.value ?? 30) / 100
                )
            );

            // STEP 3: CINEMATIC MONTAGE

            updateStatus("3/5: إنشاء الانتقالات السينمائية...");

            let finalDuration;

            try {

                // First attempt: xfade transitions

                finalDuration = await runMontage(
                    ffmpeg,
                    inputNames,
                    musicName,
                    durations,
                    OUTPUT_NAME,
                    true,
                    musicLevel
                );

                updateStatus("تم تطبيق الانتقالات السينمائية.");

            } catch (transitionError) {

                console.warn(
                    "Transition failed. Trying normal montage:",
                    transitionError
                );

                try {
                    await ffmpeg.deleteFile(OUTPUT_NAME);
                } catch (_) {}

                // Fallback: normal concat

                updateStatus(
                    "الانتقالات غير مدعومة. جاري الدمج بالطريقة العادية..."
                );

                finalDuration = await runMontage(
                    ffmpeg,
                    inputNames,
                    musicName,
                    durations,
                    OUTPUT_NAME,
                    false,
                    musicLevel
                );
            }

            // STEP 4: READ OUTPUT

            updateStatus("4/5: تجهيز الفيديو النهائي...");

            updateProgress(85);

            const outputData = await ffmpeg.readFile(OUTPUT_NAME);

            if (!outputData || outputData.length === 0) {
                throw new Error("الفيديو الناتج فارغ.");
            }

            const blob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            lastOutputURL = URL.createObjectURL(blob);

            outputCreated = true;

            // STEP 5: DOWNLOAD

            if (downloadLink) {

                downloadLink.href = lastOutputURL;

                downloadLink.download = OUTPUT_NAME;

                downloadLink.hidden = false;
            }

            updateProgress(100);

            updateStatus(
                "✓ نجح المونتاج! المدة النهائية: " +
                finalDuration.toFixed(1) +
                " ثانية."
            );

        } catch (error) {

            console.error(
                "SMAILLY AUTO MONTAGE ERROR:",
                error
            );

            updateProgress(0);

            updateStatus(
                "خطأ في المونتاج: " +
                (error.message || "تعذر إنشاء الفيديو.")
            );

        } finally {

            // CLEAN TEMPORARY FILES

            if (ffmpeg) {

                for (const name of temporaryFiles) {

                    try {
                        await ffmpeg.deleteFile(name);
                    } catch (error) {
                        console.warn(
                            "Temporary file cleanup:",
                            error
                        );
                    }
                }

                try {
                    await ffmpeg.deleteFile(OUTPUT_NAME);
                } catch (error) {
                    console.warn(
                        "Output cleanup:",
                        error
                    );
                }
            }

            if (!outputCreated && downloadLink) {
                downloadLink.hidden = true;
            }

            isProcessing = false;

            startButton.disabled = false;

            startButton.textContent =
                "✨ ابدأ المونتاج التلقائي";
        }
    }

    // ==========================================
    // BUTTON EVENT
    // ==========================================

    startButton.addEventListener(
        "click",
        createMontage
    );

    console.log(
        "SMAILLY AUTO MONTAGE SYSTEM READY!"
    );

});
