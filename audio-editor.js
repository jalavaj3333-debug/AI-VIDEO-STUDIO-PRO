
/* =====================================
   AI VIDEO STUDIO PRO
   AUDIO MIXER ENGINE
===================================== */

const videoInput = document.getElementById("audioVideoInput");
const musicInput = document.getElementById("musicInput");
const voiceInput = document.getElementById("voiceInput");

const videoPreview = document.getElementById("audioVideoPreview");
const musicPreview = document.getElementById("musicPreview");
const voicePreview = document.getElementById("voicePreview");

const videoName = document.getElementById("audioVideoName");
const musicName = document.getElementById("musicName");
const voiceName = document.getElementById("voiceName");

const originalVolume = document.getElementById("originalVolume");
const musicVolume = document.getElementById("musicVolume");
const voiceVolume = document.getElementById("voiceVolume");

const originalVolumeValue = document.getElementById("originalVolumeValue");
const musicVolumeValue = document.getElementById("musicVolumeValue");
const voiceVolumeValue = document.getElementById("voiceVolumeValue");

const keepOriginal = document.getElementById("keepOriginalAudio");

const exportButton = document.getElementById("exportAudioMix");
const progressBar = document.getElementById("audioProgressBar");
const statusText = document.getElementById("audioStatus");
const downloadLink = document.getElementById("audioDownload");

let selectedVideo = null;
let selectedMusic = null;
let selectedVoice = null;

let previewURLs = {};
let outputURL = null;
let processing = false;

function setStatus(message) {
    if (statusText) statusText.textContent = message;
}

function setProgress(value) {
    if (progressBar) {
        progressBar.style.width = `${value}%`;
    }
}

function updateVolume(slider, output) {
    if (!slider || !output) return;

    output.textContent =
        Math.round(Number(slider.value) * 100) + "%";
}

function setupPreview(input, preview, nameElement, type) {
    if (!input || !preview || !nameElement) return;

    input.addEventListener("change", () => {
        const file = input.files?.[0];

        if (!file) return;

        if (type === "video" && !file.type.startsWith("video/")) {
            setStatus("اختار ملف فيديو صالح.");
            return;
        }

        if (
            (type === "music" || type === "voice") &&
            !file.type.startsWith("audio/")
        ) {
            setStatus("اختار ملف صوتي صالح.");
            return;
        }

        if (type === "video") selectedVideo = file;
        if (type === "music") selectedMusic = file;
        if (type === "voice") selectedVoice = file;

        if (previewURLs[type]) {
            URL.revokeObjectURL(previewURLs[type]);
        }

        const url = URL.createObjectURL(file);
        previewURLs[type] = url;

        preview.src = url;
        preview.hidden = false;
        nameElement.textContent = file.name;

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }

        if (downloadLink) {
            downloadLink.hidden = true;
            downloadLink.removeAttribute("href");
        }

        setStatus("تم اختيار الملف: " + file.name);
        setProgress(0);
    });
}

setupPreview(
    videoInput,
    videoPreview,
    videoName,
    "video"
);

setupPreview(
    musicInput,
    musicPreview,
    musicName,
    "music"
);

setupPreview(
    voiceInput,
    voicePreview,
    voiceName,
    "voice"
);

/* VOLUME CONTROLS */

if (originalVolume) {
    originalVolume.addEventListener("input", () => {
        updateVolume(originalVolume, originalVolumeValue);
    });
}

if (musicVolume) {
    musicVolume.addEventListener("input", () => {
        updateVolume(musicVolume, musicVolumeValue);
    });
}

if (voiceVolume) {
    voiceVolume.addEventListener("input", () => {
        updateVolume(voiceVolume, voiceVolumeValue);
    });
}

/* FFmpeg CLEANUP */

async function cleanFFmpegFiles(engine, files) {
    for (const file of files) {
        try {
            await engine.deleteFile(file);
        } catch (error) {
            // File may not exist.
        }
    }
}

/* EXPORT AUDIO MIX */

if (exportButton) {
    exportButton.addEventListener("click", async () => {

        if (processing) return;

        if (!selectedVideo || !selectedMusic) {
            setStatus("اختار الفيديو والموسيقى أولاً.");
            return;
        }

        const engine = window.videoFFmpeg;

        if (!engine || !window.videoFFmpegLoaded) {
            setStatus(
                "حمّل محرك FFmpeg من أداة تقطيع الفيديو أولاً."
            );
            return;
        }

        processing = true;
        exportButton.disabled = true;

        const videoFile = "audio_source_video.mp4";
        const musicFile = "audio_background_music";
        const voiceFile = "audio_voice_track";
        const outputFile = "audio_final_video.mp4";

        const filesToClean = [
            videoFile,
            musicFile,
            voiceFile,
            outputFile
        ];

        try {
            setProgress(5);
            setStatus("جاري تجهيز الفيديو...");

            await engine.writeFile(
                videoFile,
                new Uint8Array(await selectedVideo.arrayBuffer())
            );

            setProgress(20);

            setStatus("جاري تجهيز الموسيقى...");

            await engine.writeFile(
                musicFile,
                new Uint8Array(await selectedMusic.arrayBuffer())
            );

            const hasVoice = Boolean(selectedVoice);

            if (hasVoice) {
                await engine.writeFile(
                    voiceFile,
                    new Uint8Array(await selectedVoice.arrayBuffer())
                );
            }

            setProgress(35);

            const originalLevel = Number(originalVolume?.value ?? 1);
            const musicLevel = Number(musicVolume?.value ?? 0.5);
            const voiceLevel = Number(voiceVolume?.value ?? 1);

            const keepOriginalAudio = Boolean(keepOriginal?.checked);

            const command = ["-i", videoFile];

            // Repeat background music so it can cover the video.
            command.push("-stream_loop", "-1", "-i", musicFile);

            if (hasVoice) {
                command.push("-i", voiceFile);
            }

            const filters = [];
            const audioLabels = [];

            if (keepOriginalAudio) {
                filters.push(
                    `[0:a]volume=${originalLevel}[original]`
                );
                audioLabels.push("[original]");
            }

            filters.push(
                `[1:a]volume=${musicLevel}[music]`
            );
            audioLabels.push("[music]");

            if (hasVoice) {
                const voiceInputIndex = 2;

                filters.push(
                    `[${voiceInputIndex}:a]volume=${voiceLevel}[voice]`
                );

                audioLabels.push("[voice]");
            }

            if (audioLabels.length === 1) {
                filters.push(
                    `${audioLabels[0]}anull[aout]`
                );
            } else {
                filters.push(
                    `${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=2:normalize=0[aout]`
                );
            }

            command.push(
                "-filter_complex",
                filters.join(";"),
                "-map",
                "0:v:0",
                "-map",
                "[aout]",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-t",
                "999999",
                "-shortest",
                "-movflags",
                "+faststart",
                outputFile
            );

            setProgress(45);
            setStatus("جاري تركيب الموسيقى والتعليق الصوتي...");

            const result = await engine.exec(command);

            if (result !== 0) {
                throw new Error(
                    "تعذر تركيب الصوت. تأكد من صيغة الملفات."
                );
            }

            setProgress(85);
            setStatus("جاري تجهيز الفيديو النهائي...");

            const outputData = await engine.readFile(outputFile);

            const outputBlob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            if (outputURL) {
                URL.revokeObjectURL(outputURL);
            }

            outputURL = URL.createObjectURL(outputBlob);

            downloadLink.href = outputURL;
            downloadLink.download = "AI-VIDEO-STUDIO-AUDIO.mp4";
            downloadLink.hidden = false;

            setProgress(100);
            setStatus("تم إنشاء الفيديو بنجاح! يمكنك تحميله الآن.");

        } catch (error) {
            console.error("Audio Studio Error:", error);

            setProgress(0);

            setStatus(
                "خطأ: " +
                (error.message || String(error)) +
                " إذا كان الفيديو بلا صوت أصلي، أزل علامة الاحتفاظ بالصوت الأصلي."
            );

        } finally {
            await cleanFFmpegFiles(engine, filesToClean);

            exportButton.disabled = false;
            processing = false;
        }
    });
}
