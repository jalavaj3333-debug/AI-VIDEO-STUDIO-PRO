
/* ==========================================
   AI VIDEO STUDIO PRO
   AUDIO STUDIO + MICROPHONE + VIDEO BRIDGE
========================================== */

(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    // HTML elements الموجودة في index.html
    const videoInput = $("originalVideo");
    const musicInput = $("musicInput");
    const voiceInput = $("voiceInput");

    const videoPreview = $("originalVideoPreview");
    const musicPreview = $("musicPreview");
    const voicePreview = $("voicePreview");

    const audioStatus = $("audioStatus");

    const startButton = $("startMicRecording");
    const stopButton = $("stopMicRecording");
    const deleteButton = $("deleteMicRecording");

    const micStatus = $("micStatus");
    const micTimer = $("micTimer");
    const micWaveform = $("micWaveform");
    const recordedPreview = $("recordedVoicePreview");

    const musicVolume = $("musicVolume");
    const voiceVolume = $("voiceVolume");

    let selectedVideo = null;
    let selectedMusic = null;
    let selectedVoice = null;

    let videoURL = null;
    let musicURL = null;
    let voiceURL = null;

    let recorder = null;
    let microphoneStream = null;
    let recordedChunks = [];

    let recordingURL = null;
    let recordingStartedAt = 0;
    let timerInterval = null;

    let audioContext = null;
    let analyser = null;
    let animationFrame = null;

    let recordingMimeType = "audio/webm";

    function setAudioStatus(message) {
        if (audioStatus) audioStatus.textContent = message;
        console.log("[Audio Studio]", message);
    }

    function setMicStatus(message) {
        if (micStatus) micStatus.textContent = message;
    }

    function revokeURL(url) {
        if (url) URL.revokeObjectURL(url);
    }

    function makePreview(file, preview, oldURL) {
        revokeURL(oldURL);

        const url = URL.createObjectURL(file);

        if (preview) {
            preview.replaceChildren();

            const element = document.createElement(
                file.type.startsWith("video/") ? "video" : "audio"
            );

            element.src = url;
            element.controls = true;
            element.preload = "metadata";
            element.style.width = "100%";
            element.style.maxWidth = "100%";

            if (element.tagName === "VIDEO") {
                element.playsInline = true;
            }

            preview.appendChild(element);
        }

        return url;
    }

    // --------------------------------------
    // FILE SELECTION
    // --------------------------------------

    if (videoInput) {
        videoInput.addEventListener("change", () => {
            const file = videoInput.files?.[0];
            if (!file) return;

            if (!file.type.startsWith("video/")) {
                setAudioStatus("اختار ملف فيديو صالح.");
                videoInput.value = "";
                return;
            }

            selectedVideo = file;
            videoURL = makePreview(file, videoPreview, videoURL);

            setAudioStatus("تم اختيار الفيديو: " + file.name);
        });
    }

    if (musicInput) {
        musicInput.addEventListener("change", () => {
            const file = musicInput.files?.[0];
            if (!file) return;

            if (!file.type.startsWith("audio/")) {
                setAudioStatus("اختار ملف موسيقى صالح.");
                musicInput.value = "";
                return;
            }

            selectedMusic = file;
            musicURL = makePreview(file, musicPreview, musicURL);

            setAudioStatus("تم اختيار الموسيقى: " + file.name);
        });
    }

    if (voiceInput) {
        voiceInput.addEventListener("change", () => {
            const file = voiceInput.files?.[0];
            if (!file) return;

            if (!file.type.startsWith("audio/")) {
                setAudioStatus("اختار ملف صوتي صالح.");
                voiceInput.value = "";
                return;
            }

            selectedVoice = file;
            voiceURL = makePreview(file, voicePreview, voiceURL);

            if (recordedPreview) {
                recordedPreview.hidden = true;
            }

            setAudioStatus("تم اختيار التعليق الصوتي: " + file.name);
        });
    }

    // --------------------------------------
    // AUDIO BRIDGE FOR TEXT TO VIDEO
    // --------------------------------------

    window.AIVideoAudio = {
        getMusic: () => selectedMusic,
        getVoice: () => selectedVoice,

        getMusicVolume: () => {
            const value = Number(musicVolume?.value ?? 25);
            return Math.max(0, Math.min(1, value / 100));
        },

        getVoiceVolume: () => {
            const value = Number(voiceVolume?.value ?? 95);

            // يدعم slider من 0 إلى 1 أو من 0 إلى 100
            return Math.max(
                0,
                Math.min(1, value > 1 ? value / 100 : value)
            );
        }
    };

    // --------------------------------------
    // TIMER
    // --------------------------------------

    function showTimer(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
        const remaining = String(seconds % 60).padStart(2, "0");

        if (micTimer) {
            micTimer.textContent = `${minutes}:${remaining}`;
        }
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // --------------------------------------
    // MICROPHONE CLEANUP
    // --------------------------------------

    function releaseMicrophone() {
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
            microphoneStream = null;
        }
    }

    function stopWaveform() {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        if (audioContext) {
            const oldContext = audioContext;
            audioContext = null;
            oldContext.close().catch(() => {});
        }

        analyser = null;

        const ctx = micWaveform?.getContext("2d");

        if (ctx && micWaveform) {
            ctx.clearRect(0, 0, micWaveform.width, micWaveform.height);
        }
    }

    // --------------------------------------
    // LIVE WAVEFORM
    // --------------------------------------

    function startWaveform(stream) {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass || !micWaveform) return;

        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();

        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.8;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const canvasContext = micWaveform.getContext("2d");
        const buffer = new Uint8Array(analyser.fftSize);

        function draw() {
            if (!analyser || !canvasContext) return;

            analyser.getByteTimeDomainData(buffer);

            const width = micWaveform.width;
            const height = micWaveform.height;

            canvasContext.clearRect(0, 0, width, height);

            canvasContext.beginPath();
            canvasContext.strokeStyle = "#d6b76b";
            canvasContext.lineWidth = 3;

            const step = width / buffer.length;

            for (let i = 0; i < buffer.length; i++) {
                const x = i * step;
                const y = (buffer[i] / 255) * height;

                if (i === 0) {
                    canvasContext.moveTo(x, y);
                } else {
                    canvasContext.lineTo(x, y);
                }
            }

            canvasContext.stroke();
            animationFrame = requestAnimationFrame(draw);
        }

        draw();
    }

    // --------------------------------------
    // RECORDING SUPPORT
    // --------------------------------------

    function chooseRecordingType() {
        const types = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return "";
    }

    function saveRecording() {
        stopTimer();
        stopWaveform();
        releaseMicrophone();

        const type = recorder?.mimeType || recordingMimeType;
        const blob = new Blob(recordedChunks, { type });

        if (!blob.size) {
            setMicStatus("التسجيل فارغ. حاول مرة أخرى.");
            if (startButton) startButton.disabled = false;
            if (stopButton) stopButton.disabled = true;
            return;
        }

        selectedVoice = new File(
            [blob],
            "microphone-recording." +
                (type.includes("mp4") ? "m4a" : "webm"),
            { type }
        );

        revokeURL(recordingURL);
        revokeURL(voiceURL);

        recordingURL = URL.createObjectURL(blob);
        voiceURL = recordingURL;

        if (recordedPreview) {
            recordedPreview.src = recordingURL;
            recordedPreview.hidden = false;
            recordedPreview.load();
        }

        if (voicePreview) {
            voicePreview.replaceChildren();

            const audio = document.createElement("audio");
            audio.controls = true;
            audio.src = recordingURL;
            audio.style.width = "100%";

            voicePreview.appendChild(audio);
        }

        if (deleteButton) deleteButton.hidden = false;

        if (startButton) startButton.disabled = false;
        if (stopButton) stopButton.disabled = true;

        setMicStatus("تم حفظ التسجيل. تقدر تسمعو أو تستعملو فالفيديو.");
        setAudioStatus("التسجيل الصوتي واجد للاستعمال.");
    }

    // --------------------------------------
    // START RECORDING
    // --------------------------------------

    if (startButton) {
        startButton.addEventListener("click", async () => {
            if (recorder?.state === "recording") return;

            if (!navigator.mediaDevices?.getUserMedia ||
                !window.MediaRecorder) {
                setMicStatus("التسجيل يحتاج متصفحاً يدعم الميكروفون وHTTPS أو localhost.");
                return;
            }

            try {
                startButton.disabled = true;
                setMicStatus("كنطلبو الإذن للميكروفون...");

                microphoneStream =
                    await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });

                recordedChunks = [];

                const mimeType = chooseRecordingType();
                recordingMimeType = mimeType || "audio/webm";

                recorder = mimeType
                    ? new MediaRecorder(microphoneStream, { mimeType })
                    : new MediaRecorder(microphoneStream);

                recorder.addEventListener("dataavailable", event => {
                    if (event.data?.size > 0) {
                        recordedChunks.push(event.data);
                    }
                });

                recorder.addEventListener("stop", saveRecording, { once: true });

                recorder.addEventListener("error", event => {
                    console.error(event.error);
                    stopTimer();
                    stopWaveform();
                    releaseMicrophone();

                    setMicStatus("وقع خطأ أثناء التسجيل.");
                    startButton.disabled = false;
                    stopButton.disabled = true;
                });

                recorder.start(500);

                startWaveform(microphoneStream);

                recordingStartedAt = Date.now();
                showTimer(0);

                timerInterval = setInterval(() => {
                    showTimer(Date.now() - recordingStartedAt);
                }, 500);

                if (deleteButton) deleteButton.hidden = true;

                startButton.disabled = true;
                stopButton.disabled = false;

                setMicStatus("🔴 التسجيل جاري...");

            } catch (error) {
                console.error("Microphone error:", error);

                stopTimer();
                stopWaveform();
                releaseMicrophone();

                startButton.disabled = false;
                stopButton.disabled = true;

                setMicStatus(
                    "تعذر تشغيل الميكروفون. تحقق من الإذن وإعدادات المتصفح."
                );
            }
        });
    }

    // --------------------------------------
    // STOP RECORDING
    // --------------------------------------

    if (stopButton) {
        stopButton.addEventListener("click", () => {
            if (recorder?.state !== "recording") return;

            stopButton.disabled = true;
            setMicStatus("جاري حفظ التسجيل...");

            recorder.stop();
        });
    }

    // --------------------------------------
    // DELETE RECORDING
    // --------------------------------------

    if (deleteButton) {
        deleteButton.addEventListener("click", () => {
            if (recorder?.state === "recording") {
                setMicStatus("وقف التسجيل قبل الحذف.");
                return;
            }

            selectedVoice = null;

            revokeURL(recordingURL);
            recordingURL = null;

            revokeURL(voiceURL);
            voiceURL = null;

            if (recordedPreview) {
                recordedPreview.pause();
                recordedPreview.removeAttribute("src");
                recordedPreview.load();
                recordedPreview.hidden = true;
            }

            if (voicePreview) {
                voicePreview.replaceChildren();
            }

            if (voiceInput) voiceInput.value = "";

            deleteButton.hidden = true;

            if (micTimer) micTimer.textContent = "00:00";

            setMicStatus("تم حذف التسجيل.");
            setAudioStatus("تم حذف التعليق الصوتي.");
        });
    }

    // --------------------------------------
    // INITIALIZE
    // --------------------------------------

    if (stopButton) stopButton.disabled = true;
    if (deleteButton) deleteButton.hidden = true;

    setAudioStatus("Audio Studio واجد.");

    console.log("AI VIDEO STUDIO PRO - AUDIO STUDIO READY");
})();
