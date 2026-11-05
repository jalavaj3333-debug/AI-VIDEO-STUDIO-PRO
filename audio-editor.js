
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
/* =====================================
   MICROPHONE RECORDING
   AI VIDEO STUDIO PRO
===================================== */

(() => {
    const startButton = document.getElementById("startMicRecording");
    const stopButton = document.getElementById("stopMicRecording");
    const deleteButton = document.getElementById("deleteMicRecording");

    const micStatus = document.getElementById("micStatus");
    const micTimer = document.getElementById("micTimer");
    const recordedPreview = document.getElementById("recordedVoicePreview");

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

const waveformCanvas = document.getElementById("micWaveform");
const waveformContext = waveformCanvas?.getContext("2d");

function drawMicrophoneWaveform() {
    if (!micAnalyser || !waveformContext || !waveformCanvas) return;

    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    const buffer = new Uint8Array(micAnalyser.fftSize);

    function draw() {
        micAnalyser.getByteTimeDomainData(buffer);

        waveformContext.clearRect(0, 0, width, height);

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

        micAnimationFrame = requestAnimationFrame(draw);
    }

    cancelAnimationFrame(micAnimationFrame);
    draw();
}

function stopMicrophoneWaveform() {
    if (micAnimationFrame) {
        cancelAnimationFrame(micAnimationFrame);
        micAnimationFrame = null;
    }

    if (waveformContext && waveformCanvas) {
        waveformContext.clearRect(
            0, 0,
            waveformCanvas.width,
            waveformCanvas.height
        );
    }

    if (micAudioContext) {
        micAudioContext.close().catch(console.error);
        micAudioContext = null;
    }

    micAnalyser = null;
}


    function showTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");

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

    function releaseMicrophone() {
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
            microphoneStream = null;
        }
    }

    startButton.addEventListener("click", async () => {
        if (recorder && recorder.state === "recording") return;

        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            if (micStatus) {
                micStatus.textContent =
                    "المتصفح لا يدعم التسجيل أو يحتاج إلى HTTPS.";
            }
            return;
        }

        try {
            startButton.disabled = true;

            if (micStatus) {
                micStatus.textContent = "كنطلبو الإذن لاستعمال الميكروفون...";
            }

            microphoneStream = await navigator.mediaDevices.getUserMedia({
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

            recorder.addEventListener("stop", () => {
                stopTimer();
                releaseMicrophone();

                const finalType =
                    recorder.mimeType || mimeType || "audio/webm";

                const recordingBlob = new Blob(recordedChunks, {
                    type: finalType
                });

                if (recordingBlob.size === 0) {
                    if (micStatus) {
                        micStatus.textContent = "التسجيل فارغ، عاود المحاولة.";
                    }
                    startButton.disabled = false;
                    stopButton.disabled = true;
                    return;
                }

                // Use this recording as the voice track in Audio Studio.
                selectedVoice = recordingBlob;

                // Replace the previous recording URL.
                if (recordingURL) {
                    URL.revokeObjectURL(recordingURL);
                }

                if (previewURLs.voice) {
                    URL.revokeObjectURL(previewURLs.voice);
                }

                recordingURL = URL.createObjectURL(recordingBlob);
                previewURLs.voice = recordingURL;

                recordedPreview.src = recordingURL;
                recordedPreview.hidden = false;
                recordedPreview.load();

                // Keep the regular voice preview synchronized.
                if (voicePreview) {
                    voicePreview.src = recordingURL;
                    voicePreview.hidden = true;
                }

                if (voiceName) {
                    voiceName.textContent = "🎙️ تسجيل صوتي من الميكروفون";
                }

                if (deleteButton) {
                    deleteButton.hidden = false;
                }

                if (micStatus) {
                    micStatus.textContent = "تم حفظ التسجيل بنجاح.";
                }

                if (typeof setStatus === "function") {
                    setStatus("تم تسجيل التعليق الصوتي. يمكنك الآن استعماله في الفيديو.");
                }

                if (typeof setProgress === "function") {
                    setProgress(0);
                }

                if (outputURL) {
                    URL.revokeObjectURL(outputURL);
                    outputURL = null;
                }

                if (downloadLink) {
                    downloadLink.hidden = true;
                    downloadLink.removeAttribute("href");
                }

                startButton.disabled = false;
                stopButton.disabled = true;
            });

            recorder.addEventListener("error", event => {
                console.error("Microphone recording error:", event.error);

                if (micStatus) {
                    micStatus.textContent = "وقع خطأ أثناء التسجيل.";
                }

                stopTimer();
                releaseMicrophone();
                startButton.disabled = false;
                stopButton.disabled = true;
            });

            recorder.start();
           micAudioContext = new AudioContext();

if (micAudioContext.state === "suspended") {
    await micAudioContext.resume();
}

micAnalyser = micAudioContext.createAnalyser();
micAnalyser.fftSize = 2048;
micAnalyser.smoothingTimeConstant = 0.75;

const micSource = micAudioContext.createMediaStreamSource(
    microphoneStream
);

micSource.connect(micAnalyser);

drawMicrophoneWaveform();

            recordingStartedAt = Date.now();

            if (micStatus) {
                micStatus.textContent = "🔴 التسجيل جاري...";
            }

            startButton.disabled = true;
            stopButton.disabled = false;

            if (deleteButton) {
                deleteButton.hidden = true;
            }

            showTime(0);

            timerInterval = setInterval(() => {
                showTime(Date.now() - recordingStartedAt);
            }, 500);

        } catch (error) {
            console.error("Microphone permission error:", error);

            releaseMicrophone();
            startButton.disabled = false;
            stopButton.disabled = true;

            if (micStatus) {
                micStatus.textContent =
                    "ما قدرناش نستعملو الميكروفون. سمح للمتصفح باستعماله وحاول مجدداً.";
            }
        }
    });

    stopButton.addEventListener("click", () => {
        if (recorder && recorder.state === "recording") {
            recorder.stop();
            stopButton.disabled = true;

            if (micStatus) {
                micStatus.textContent = "جاري حفظ التسجيل...";
            }
        }
    });

    if (deleteButton) {
        deleteButton.addEventListener("click", () => {
            if (recorder && recorder.state === "recording") {
                recorder.stop();
            }

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

            if (voiceName) {
                voiceName.textContent = "التعليق الصوتي اختياري";
            }

            deleteButton.hidden = true;

            if (micStatus) {
                micStatus.textContent = "تم حذف التسجيل.";
            }

            showTime(0);
        });
    }
})();
