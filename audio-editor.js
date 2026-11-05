
/* ==========================================
   AI VIDEO STUDIO PRO
   PROFESSIONAL AUDIO MIXER + MICROPHONE
========================================== */

/* ------------------------------------------
   1. AUDIO STUDIO ELEMENTS
------------------------------------------ */

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

/* ------------------------------------------
   2. GLOBAL AUDIO VARIABLES
------------------------------------------ */

let selectedVideo = null;
let selectedMusic = null;
let selectedVoice = null;

let previewURLs = {};
let outputURL = null;
let processing = false;

/* ------------------------------------------
   3. STATUS AND PROGRESS
------------------------------------------ */

function setStatus(message) {
    if (statusText) {
        statusText.textContent = message;
    }
}

function setProgress(value) {
    if (progressBar) {
        progressBar.style.width =
            `${Math.max(0, Math.min(100, value))}%`;
    }
}

function updateVolume(slider, output) {
    if (!slider || !output) return;

    const value = Number(slider.value);

    output.textContent = Math.round(value * 100) + "%";
}

/* ------------------------------------------
   4. FILE EXTENSION HELPERS
------------------------------------------ */

function getSafeExtension(filename, fallback) {
    const match = String(filename || "").match(/\.([a-zA-Z0-9]{2,5})$/);

    return match ? match[1].toLowerCase() : fallback;
}

function getAudioExtension(mimeType) {
    const type = String(mimeType || "").toLowerCase();

    if (type.includes("webm")) return "webm";
    if (type.includes("mp4")) return "m4a";
    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";
    if (type.includes("mpeg")) return "mp3";
    if (type.includes("aac")) return "aac";

    return "webm";
}

/* ------------------------------------------
   5. PREVIEW FILES
------------------------------------------ */

function setupPreview(input, preview, nameElement, type) {
    if (!input || !preview || !nameElement) return;

    input.addEventListener("change", () => {
        const file = input.files?.[0];

        if (!file) return;

        if (type === "video" && !file.type.startsWith("video/")) {
            setStatus("اختار ملف فيديو صالح.");
            input.value = "";
            return;
        }

        if (
            (type === "music" || type === "voice") &&
            !file.type.startsWith("audio/")
        ) {
            setStatus("اختار ملف صوتي صالح.");
            input.value = "";
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

        invalidateAudioExport();

        setStatus("تم اختيار الملف: " + file.name);
        setProgress(0);
    });
}

function invalidateAudioExport() {
    if (outputURL) {
        URL.revokeObjectURL(outputURL);
        outputURL = null;
    }

    if (downloadLink) {
        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");
    }
}

setupPreview(videoInput, videoPreview, videoName, "video");
setupPreview(musicInput, musicPreview, musicName, "music");
setupPreview(voiceInput, voicePreview, voiceName, "voice");

/* ------------------------------------------
   6. VOLUME CONTROLS
------------------------------------------ */

if (originalVolume) {
    originalVolume.addEventListener("input", () => {
        updateVolume(originalVolume, originalVolumeValue);
    });

    updateVolume(originalVolume, originalVolumeValue);
}

if (musicVolume) {
    musicVolume.addEventListener("input", () => {
        updateVolume(musicVolume, musicVolumeValue);
    });

    updateVolume(musicVolume, musicVolumeValue);
}

if (voiceVolume) {
    voiceVolume.addEventListener("input", () => {
        updateVolume(voiceVolume, voiceVolumeValue);
    });

    updateVolume(voiceVolume, voiceVolumeValue);
}

/* ------------------------------------------
   7. FFMPEG CLEANUP
------------------------------------------ */

async function cleanFFmpegFiles(engine, files) {
    if (!engine) return;

    for (const file of files) {
        try {
            await engine.deleteFile(file);
        } catch (error) {
            // Temporary file may not exist.
        }
    }
}

/* ------------------------------------------
   8. AUDIO MIX EXPORT
------------------------------------------ */

if (exportButton) {
    exportButton.addEventListener("click", async () => {

        if (processing) return;

        if (!selectedVideo || !selectedMusic) {
            setStatus("اختار الفيديو والموسيقى أولاً.");
            return;
        }

        const engine = window.videoFFmpeg;

        if (!engine || !window.videoFFmpegLoaded) {
            setStatus("حمّل محرك FFmpeg أولاً من أداة تقطيع الفيديو.");
            return;
        }

        processing = true;
        exportButton.disabled = true;

        const videoFile =
            "audio_source_video." +
            getSafeExtension(selectedVideo.name, "mp4");

        const musicFile =
            "audio_background_music." +
            getSafeExtension(selectedMusic.name, "mp3");

        const voiceExtension = selectedVoice instanceof Blob
            ? getAudioExtension(selectedVoice.type)
            : getSafeExtension(selectedVoice?.name, "webm");

        const voiceFile = "audio_voice_track." + voiceExtension;

        const outputFile = "audio_final_video.mp4";

        const filesToClean = [
            videoFile,
            musicFile,
            voiceFile,
            outputFile
        ];

        try {
            invalidateAudioExport();

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
                setProgress(30);

                await engine.writeFile(
                    voiceFile,
                    new Uint8Array(await selectedVoice.arrayBuffer())
                );
            }

            const originalLevel =
                Number(originalVolume?.value ?? 1);

            const musicLevel =
                Number(musicVolume?.value ?? 0.5);

            const voiceLevel =
                Number(voiceVolume?.value ?? 1);

            const keepOriginalAudio =
                Boolean(keepOriginal?.checked);

            const command = ["-i", videoFile];

            // Loop the background music.
            command.push("-stream_loop", "-1", "-i", musicFile);

            let voiceInputIndex = -1;

            if (hasVoice) {
                voiceInputIndex = 2;
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
                    `${audioLabels.join("")}` +
                    `amix=inputs=${audioLabels.length}:` +
                    `duration=longest:dropout_transition=2:` +
                    `normalize=0[aout]`
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
                    "تعذر تركيب الصوت. راجع صيغ الملفات وإعدادات الصوت الأصلي."
                );
            }

            setProgress(85);
            setStatus("جاري تجهيز الفيديو النهائي...");

            const outputData = await engine.readFile(outputFile);

            const outputBlob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            outputURL = URL.createObjectURL(outputBlob);

            if (downloadLink) {
                downloadLink.href = outputURL;
                downloadLink.download = "AI-VIDEO-STUDIO-AUDIO.mp4";
                downloadLink.hidden = false;
            }

            setProgress(100);
            setStatus("تم إنشاء الفيديو بنجاح! يمكنك تحميله الآن.");

        } catch (error) {
            console.error("Audio Studio Error:", error);

            setProgress(0);

            setStatus(
                "خطأ: " +
                (error.message || String(error)) +
                ". إذا كان الفيديو بلا صوت أصلي، أزل علامة الاحتفاظ بالصوت الأصلي."
            );

        } finally {
            await cleanFFmpegFiles(engine, filesToClean);

            exportButton.disabled = false;
            processing = false;
        }
    });
}

/* ==========================================
   9. MICROPHONE RECORDING STUDIO
========================================== */

(() => {

    const startButton =
        document.getElementById("startMicRecording");

    const stopButton =
        document.getElementById("stopMicRecording");

    const deleteButton =
        document.getElementById("deleteMicRecording");

    const micStatus =
        document.getElementById("micStatus");

    const micTimer =
        document.getElementById("micTimer");

    const recordedPreview =
        document.getElementById("recordedVoicePreview");

    const waveformCanvas =
        document.getElementById("micWaveform");

    const waveformContext =
        waveformCanvas?.getContext("2d");

    if (!startButton || !stopButton || !recordedPreview) {
        console.warn("Microphone controls were not found.");
        return;
    }

    let recorder = null;
    let microphoneStream = null;
    let recordedChunks = [];

    let recordingStartedAt = 0;
    let timerInterval = null;
    let recordingURL = null;

    let micAudioContext = null;
    let micAnalyser = null;
    let micAnimationFrame = null;

    /* --------------------------------------
       10. TIMER
    -------------------------------------- */

    function showTime(milliseconds) {
        const totalSeconds =
            Math.floor(milliseconds / 1000);

        const minutes =
            String(Math.floor(totalSeconds / 60)).padStart(2, "0");

        const seconds =
            String(totalSeconds % 60).padStart(2, "0");

        if (micTimer) {
            micTimer.textContent = `${minutes}:${seconds}`;
        }
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    /* --------------------------------------
       11. MICROPHONE CLEANUP
    -------------------------------------- */

    function releaseMicrophone() {
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => {
                track.stop();
            });

            microphoneStream = null;
        }
    }

    /* --------------------------------------
       12. REAL-TIME WAVEFORM
    -------------------------------------- */

    function drawMicrophoneWaveform() {
        if (!micAnalyser || !waveformContext || !waveformCanvas) {
            return;
        }

        const width = waveformCanvas.width;
        const height = waveformCanvas.height;

        const buffer = new Uint8Array(micAnalyser.fftSize);

        function draw() {
            if (!micAnalyser) return;

            micAnalyser.getByteTimeDomainData(buffer);

            waveformContext.clearRect(
                0,
                0,
                width,
                height
            );

            // Center line.
            waveformContext.beginPath();
            waveformContext.strokeStyle = "rgba(212,175,55,0.15)";
            waveformContext.lineWidth = 1;
            waveformContext.moveTo(0, height / 2);
            waveformContext.lineTo(width, height / 2);
            waveformContext.stroke();

            // Live audio waveform.
            waveformContext.beginPath();
            waveformContext.lineWidth = 3;
            waveformContext.strokeStyle = "#e8c75a";
            waveformContext.shadowColor = "#d4af37";
            waveformContext.shadowBlur = 12;

            const sliceWidth = width / buffer.length;

            let x = 0;

            for (let i = 0; i < buffer.length; i++) {
                const value = buffer[i] / 128;

                const y = (value * height) / 2;

                if (i === 0) {
                    waveformContext.moveTo(x, y);
                } else {
                    waveformContext.lineTo(x, y);
                }

                x += sliceWidth;
            }

            waveformContext.stroke();
            waveformContext.shadowBlur = 0;

            micAnimationFrame =
                requestAnimationFrame(draw);
        }

        if (micAnimationFrame) {
            cancelAnimationFrame(micAnimationFrame);
        }

        draw();
    }

    function stopMicrophoneWaveform() {
        if (micAnimationFrame) {
            cancelAnimationFrame(micAnimationFrame);
            micAnimationFrame = null;
        }

        if (waveformContext && waveformCanvas) {
            waveformContext.clearRect(
                0,
                0,
                waveformCanvas.width,
                waveformCanvas.height
            );
        }

        if (micAudioContext) {
            const context = micAudioContext;
            micAudioContext = null;

            context.close().catch(error => {
                console.warn("AudioContext cleanup:", error);
            });
        }

        micAnalyser = null;
    }

    /* --------------------------------------
       13. START RECORDING
    -------------------------------------- */

    startButton.addEventListener("click", async () => {

        if (recorder && recorder.state === "recording") {
            return;
        }

        if (
            !navigator.mediaDevices?.getUserMedia ||
            !window.MediaRecorder
        ) {
            if (micStatus) {
                micStatus.textContent =
                    "المتصفح لا يدعم التسجيل أو يحتاج إلى HTTPS.";
            }

            return;
        }

        try {
            startButton.disabled = true;

            if (micStatus) {
                micStatus.textContent =
                    "كنطلبو الإذن لاستعمال الميكروفون...";
            }

            microphoneStream =
                await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

            recordedChunks = [];

            let mimeType = "";

            const supportedTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/mp4"
            ];

            for (const type of supportedTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            recorder = mimeType
                ? new MediaRecorder(microphoneStream, { mimeType })
                : new MediaRecorder(microphoneStream);

            recorder.addEventListener("dataavailable", event => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            });

            /* ----------------------------------
               SAVE RECORDING
            ---------------------------------- */

            recorder.addEventListener("stop", () => {

                stopTimer();
                stopMicrophoneWaveform();
                releaseMicrophone();

                const finalType =
                    recorder.mimeType || mimeType || "audio/webm";

                const recordingBlob = new Blob(
                    recordedChunks,
                    { type: finalType }
                );

                if (recordingBlob.size === 0) {
                    if (micStatus) {
                        micStatus.textContent =
                            "التسجيل فارغ، عاود المحاولة.";
                    }

                    startButton.disabled = false;
                    stopButton.disabled = true;

                    return;
                }

                // Store the voice track for Audio Mixer.
                selectedVoice = recordingBlob;

                if (recordingURL) {
                    URL.revokeObjectURL(recordingURL);
                }

                if (previewURLs.voice) {
                    URL.revokeObjectURL(previewURLs.voice);
                }

                recordingURL =
                    URL.createObjectURL(recordingBlob);

                previewURLs.voice = recordingURL;

                recordedPreview.src = recordingURL;
                recordedPreview.hidden = false;
                recordedPreview.load();

                // The recording is available to the mixer.
                if (voicePreview) {
                    voicePreview.src = recordingURL;
                    voicePreview.hidden = true;
                }

                if (voiceName) {
                    voiceName.textContent =
                        "🎙️ تسجيل صوتي من الميكروفون";
                }

                if (deleteButton) {
                    deleteButton.hidden = false;
                }

                if (micStatus) {
                    micStatus.textContent =
                        "تم حفظ التسجيل بنجاح.";
                }

                setStatus(
                    "تم تسجيل التعليق الصوتي. أصبح جاهزاً للاستعمال."
                );

                setProgress(0);
                invalidateAudioExport();

                startButton.disabled = false;
                stopButton.disabled = true;
            });

            /* ----------------------------------
               RECORDING ERROR
            ---------------------------------- */

            recorder.addEventListener("error", event => {
                console.error(
                    "Microphone recording error:",
                    event.error
                );

                stopTimer();
                stopMicrophoneWaveform();
                releaseMicrophone();

                if (micStatus) {
                    micStatus.textContent =
                        "وقع خطأ أثناء التسجيل.";
                }

                startButton.disabled = false;
                stopButton.disabled = true;
            });

            /* ----------------------------------
               START WAVEFORM
            ---------------------------------- */

            recorder.start();

            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) {
                throw new Error(
                    "AudioContext غير مدعوم في هذا المتصفح."
                );
            }

            micAudioContext = new AudioContextClass();

            if (micAudioContext.state === "suspended") {
                await micAudioContext.resume();
            }

            micAnalyser =
                micAudioContext.createAnalyser();

            micAnalyser.fftSize = 2048;
            micAnalyser.smoothingTimeConstant = 0.75;

            const micSource =
                micAudioContext.createMediaStreamSource(
                    microphoneStream
                );

            micSource.connect(micAnalyser);

            drawMicrophoneWaveform();

            /* ----------------------------------
               START TIMER
            ---------------------------------- */

            recordingStartedAt = Date.now();

            if (micStatus) {
                micStatus.textContent =
                    "🔴 التسجيل جاري...";
            }

            startButton.disabled = true;
            stopButton.disabled = false;

            if (deleteButton) {
                deleteButton.hidden = true;
            }

            showTime(0);

            timerInterval = setInterval(() => {
                showTime(
                    Date.now() - recordingStartedAt
                );
            }, 500);

        } catch (error) {
            console.error(
                "Microphone error:",
                error
            );

            stopTimer();
            stopMicrophoneWaveform();
            releaseMicrophone();

            if (recorder && recorder.state === "recording") {
                recorder.stop();
            }

            startButton.disabled = false;
            stopButton.disabled = true;

            if (micStatus) {
                micStatus.textContent =
                    "تعذر تشغيل الميكروفون. تحقق من الإذن وحاول مجدداً.";
            }
        }
    });

    /* --------------------------------------
       14. STOP RECORDING
    -------------------------------------- */

    stopButton.addEventListener("click", () => {

        if (recorder && recorder.state === "recording") {

            stopButton.disabled = true;

            if (micStatus) {
                micStatus.textContent =
                    "جاري حفظ التسجيل...";
            }

            recorder.stop();
        }
    });

    /* --------------------------------------
       15. DELETE RECORDING
    -------------------------------------- */

    if (deleteButton) {
        deleteButton.addEventListener("click", () => {

            if (recorder && recorder.state === "recording") {
                setStatus("وقف التسجيل قبل حذفه.");
                return;
            }

            stopTimer();
            stopMicrophoneWaveform();
            releaseMicrophone();

            selectedVoice = null;

            if (recordingURL) {
                URL.revokeObjectURL(recordingURL);
                recordingURL = null;
            }

            if (previewURLs.voice) {
                URL.revokeObjectURL(previewURLs.voice);
                delete previewURLs.voice;
            }

            recordedPreview.pause();
            recordedPreview.removeAttribute("src");
            recordedPreview.load();
            recordedPreview.hidden = true;

            if (voicePreview) {
                voicePreview.pause();
                voicePreview.removeAttribute("src");
                voicePreview.hidden = true;
            }

            if (voiceInput) {
                voiceInput.value = "";
            }

            if (voiceName) {
                voiceName.textContent =
                    "التعليق الصوتي اختياري";
            }

            deleteButton.hidden = true;

            if (micStatus) {
                micStatus.textContent =
                    "تم حذف التسجيل.";
            }

            showTime(0);
            invalidateAudioExport();

            setStatus("تم حذف التعليق الصوتي.");
            setProgress(0);
        });
    }

})();
