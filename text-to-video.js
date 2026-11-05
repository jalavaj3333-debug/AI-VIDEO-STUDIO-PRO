
document.addEventListener("DOMContentLoaded", () => {
    const scriptInput = document.getElementById("videoScript");
    const generateButton = document.getElementById("generateScenes");
    const clearButton = document.getElementById("clearScript");
    const sceneList = document.getElementById("sceneList");
    const sceneCount = document.getElementById("sceneCount");
    const durationInput = document.getElementById("sceneDuration");
    const formatInput = document.getElementById("sceneFormat");
    const totalDuration = document.getElementById("sceneTotalDuration");
    const exportButton = document.getElementById("exportTextVideo");
    const progressBar = document.getElementById("textVideoProgress");
    const status = document.getElementById("textVideoStatus");
    const downloadLink = document.getElementById("textVideoDownload");

    if (!scriptInput || !generateButton || !sceneList) {
        console.error("Text to Video: HTML elements missing.");
        return;
    }

    let scenes = [];
    let outputURL = null;
    let exporting = false;

    function setStatus(message) {
        if (status) status.textContent = message;
    }

    function setProgress(value) {
        if (progressBar) {
            progressBar.style.width = `${value}%`;
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }

    function renderScenes() {
        sceneList.innerHTML = "";

        if (!scenes.length) {
            sceneList.innerHTML = `
                <div class="scene-empty">
                    <span>🎞️</span>
                    <p>كتب السكريبت واضغط على تقسيم النص إلى مشاهد.</p>
                </div>
            `;

            if (sceneCount) sceneCount.textContent = "0 مشهد";
            if (totalDuration) totalDuration.textContent = "00:00";
            return;
        }

        scenes.forEach((scene, index) => {
            const card = document.createElement("div");
            card.className = "scene-card";

            const heading = document.createElement("h4");
            heading.textContent = `🎬 المشهد ${index + 1}`;

            const paragraph = document.createElement("p");
            paragraph.textContent = scene;

            const duration = document.createElement("small");
            duration.textContent = `${durationInput.value} ثوانٍ`;

            card.append(heading, paragraph, duration);
            sceneList.appendChild(card);
        });

        if (sceneCount) {
            sceneCount.textContent = `${scenes.length} مشهد`;
        }

        const seconds = scenes.length * Number(durationInput.value);

        if (totalDuration) {
            totalDuration.textContent = formatTime(seconds);
        }
    }

    generateButton.addEventListener("click", () => {
        const text = scriptInput.value.trim();

        if (!text) {
            setStatus("⚠️ كتب السكريبت أولاً.");
            scriptInput.focus();
            return;
        }

        scenes = text
            .split(/\n+|(?<=[.!؟?])\s+/)
            .map(part => part.trim())
            .filter(part => part.length > 0);

        renderScenes();

        setProgress(0);

        if (downloadLink) {
            downloadLink.hidden = true;
        }

        setStatus(`✅ تم إنشاء ${scenes.length} مشهد. واجد للتصدير.`);
    });

    clearButton.addEventListener("click", () => {
        scenes = [];
        scriptInput.value = "";

        renderScenes();
        setProgress(0);

        if (downloadLink) {
            downloadLink.hidden = true;
        }

        setStatus("تم مسح السكريبت والمشاهد.");
    });

    durationInput.addEventListener("change", renderScenes);

    // تقسيم النص إلى أسطر مناسبة داخل الصورة
    function wrapText(context, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];
        let line = "";

        for (const word of words) {
            const testLine = line ? `${line} ${word}` : word;

            if (context.measureText(testLine).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = testLine;
            }
        }

        if (line) lines.push(line);

        return lines;
    }

    // إنشاء صورة سينمائية لكل مشهد
    async function createSceneImage(scene, index, width, height) {
        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#111827");
        gradient.addColorStop(0.5, "#302044");
        gradient.addColorStop(1, "#080808");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // دوائر ضوئية للديكور
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#d6ad55";

        ctx.beginPath();
        ctx.arc(width * 0.15, height * 0.2, width * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width * 0.85, height * 0.8, width * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;

        // الإطار
        ctx.strokeStyle = "#c9a34d";
        ctx.lineWidth = 4;
        ctx.strokeRect(35, 35, width - 70, height - 70);

        // اسم الاستوديو
        ctx.fillStyle = "#d6b76b";
        ctx.font = "bold 25px Cairo, Arial";
        ctx.textAlign = "center";
        ctx.direction = "ltr";
        ctx.fillText("AI VIDEO STUDIO PRO", width / 2, height * 0.22);

        // رقم المشهد
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Cairo, Arial";
        ctx.fillText(`SCENE ${index + 1}`, width / 2, height * 0.32);

        // نص المشهد
        ctx.direction = "rtl";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${width > height ? 42 : 38}px Cairo, Arial`;

        const maxWidth = width * 0.78;
        const lines = wrapText(ctx, scene, maxWidth);
        const lineHeight = width > height ? 65 : 58;

        const maxLines = 8;
        const visibleLines = lines.slice(0, maxLines);

        const startY = height / 2 -
            ((visibleLines.length - 1) * lineHeight) / 2;

        visibleLines.forEach((line, lineIndex) => {
            ctx.fillText(
                line,
                width / 2,
                startY + lineIndex * lineHeight,
                maxWidth
            );
        });

        // التذييل
        ctx.fillStyle = "#d6b76b";
        ctx.font = "20px Cairo, Arial";
        ctx.fillText("CREATED WITH AI VIDEO STUDIO PRO", width / 2, height * 0.9);

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, "image/png");
        });

        if (!blob) {
            throw new Error("تعذر إنشاء صورة المشهد.");
        }

        return new Uint8Array(await blob.arrayBuffer());
    }

    // تصدير المشاهد بواسطة FFmpeg
    async function exportVideo() {
        if (exporting) return;

        if (!scenes.length) {
            setStatus("⚠️ خاصك تقسّم السكريبت إلى مشاهد أولاً.");
            return;
        }

        const ffmpeg = window.videoFFmpeg;

        if (!ffmpeg || !window.videoFFmpegLoaded) {
            setStatus("⚠️ حمّل محرك FFmpeg أولاً من قسم قص الفيديو، ثم عاود التصدير.");
            return;
        }

        exporting = true;
        exportButton.disabled = true;

        if (downloadLink) {
            downloadLink.hidden = true;
        }

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }

        setProgress(0);
        setStatus("⏳ جاري تجهيز الفيديو...");

        const duration = Number(durationInput.value);

        const format = formatInput ? formatInput.value : "16:9";

        const dimensions = {
            "16:9": [1280, 720],
            "9:16": [720, 1280],
            "1:1": [720, 720]
        };

        const [width, height] = dimensions[format] || dimensions["16:9"];

        const createdFiles = [];

        try {
            for (let i = 0; i < scenes.length; i++) {
                const imageName = `scene_${i}.png`;
                const videoName = `scene_${i}.mp4`;

                const imageData = await createSceneImage(
                    scenes[i],
                    i,
                    width,
                    height
                );

                await ffmpeg.writeFile(imageName, imageData);
                createdFiles.push(imageName);

                setStatus(`🎨 تجهيز المشهد ${i + 1} من ${scenes.length}...`);

                const result = await ffmpeg.exec([
                    "-loop", "1",
                    "-framerate", "30",
                    "-i", imageName,
                    "-t", String(duration),
                    "-r", "30",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-pix_fmt", "yuv420p",
                    "-an",
                    videoName
                ]);

                if (result !== 0) {
                    throw new Error(`فشل إنشاء الفيديو للمشهد ${i + 1}.`);
                }

                createdFiles.push(videoName);

                setProgress(Math.round(((i + 1) / scenes.length) * 75));
            }

            // ملف ترتيب المشاهد
            const concatContent = scenes
                .map((_, index) => `file 'scene_${index}.mp4'`)
                .join("\n");

            await ffmpeg.writeFile(
                "scenes_list.txt",
                new TextEncoder().encode(concatContent)
            );

            createdFiles.push("scenes_list.txt");

            setStatus("🎬 جاري دمج المشاهد في فيديو واحد...");

            const mergeResult = await ffmpeg.exec([
                "-f", "concat",
                "-safe", "0",
                "-i", "scenes_list.txt",
                "-c", "copy",
                "-movflags", "+faststart",
                "AI-TEXT-VIDEO.mp4"
            ]);

            if (mergeResult !== 0) {
                throw new Error("فشل دمج المشاهد.");
            }

            const outputData = await ffmpeg.readFile("AI-TEXT-VIDEO.mp4");

            outputURL = URL.createObjectURL(
                new Blob([outputData], { type: "video/mp4" })
            );

            downloadLink.href = outputURL;
            downloadLink.hidden = false;

            setProgress(100);
            setStatus("✅ تم إنشاء الفيديو بنجاح! تقدر تحمّلو دابا.");

        } catch (error) {
            console.error("Text to Video Export Error:", error);

            setStatus(
                "❌ وقع خطأ أثناء التصدير: " +
                (error.message || "خطأ غير معروف")
            );

        } finally {
            for (const file of createdFiles) {
                try {
                    await ffmpeg.deleteFile(file);
                } catch (_) {}
            }

            try {
                await ffmpeg.deleteFile("AI-TEXT-VIDEO.mp4");
            } catch (_) {}

            exporting = false;
            exportButton.disabled = false;
        }
    }

    exportButton.addEventListener("click", exportVideo);

    renderScenes();
});
