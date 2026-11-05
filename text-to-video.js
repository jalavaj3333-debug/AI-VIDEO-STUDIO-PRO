
document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const scriptInput = $("videoScript");
    const generateButton = $("generateScenes");
    const clearButton = $("clearScript");
    const sceneList = $("sceneList");
    const sceneCount = $("sceneCount");
    const durationInput = $("sceneDuration");
    const formatInput = $("sceneFormat");
    const totalDuration = $("sceneTotalDuration");
    const exportButton = $("exportTextVideo");
    const progressBar = $("textVideoProgress");
    const status = $("textVideoStatus");
    const downloadLink = $("textVideoDownload");

    if (
        !scriptInput ||
        !generateButton ||
        !clearButton ||
        !sceneList ||
        !durationInput ||
        !exportButton ||
        !downloadLink
    ) {
        console.error("Text to Video: بعض عناصر HTML غير موجودة.");
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
            progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }

    function clearDownload() {
        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }
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

    // تقسيم السكريبت إلى مشاهد
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

        clearDownload();
        renderScenes();
        setProgress(0);

        setStatus(`✅ تم إنشاء ${scenes.length} مشهد. واجد للتصدير.`);
    });

    // مسح السكريبت
    clearButton.addEventListener("click", () => {
        if (exporting) return;

        scenes = [];
        scriptInput.value = "";

        clearDownload();
        renderScenes();
        setProgress(0);

        setStatus("تم مسح السكريبت والمشاهد.");
    });

    durationInput.addEventListener("change", renderScenes);

    // تقسيم النص إلى أسطر
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

    // إنشاء صورة لكل مشهد
    async function createSceneImage(scene, index, width, height) {
        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("المتصفح لم يتمكن من إنشاء Canvas.");
        }

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#111827");
        gradient.addColorStop(0.5, "#302044");
        gradient.addColorStop(1, "#080808");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // ديكور الإضاءة
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#d6ad55";

        ctx.beginPath();
        ctx.arc(width * 0.15, height * 0.2, width * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width * 0.85, height * 0.8, width * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;

        // الإطار الذهبي
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

        const fontSize = width > height ? 42 : 38;
        ctx.font = `bold ${fontSize}px Cairo, Arial`;

        const maxWidth = width * 0.78;
        const lines = wrapText(ctx, scene, maxWidth);
        const visibleLines = lines.slice(0, 8);
        const lineHeight = width > height ? 65 : 58;

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
        ctx.direction = "ltr";
        ctx.fillStyle = "#d6b76b";
        ctx.font = "20px Cairo, Arial";
        ctx.fillText(
            "CREATED WITH AI VIDEO STUDIO PRO",
            width / 2,
            height * 0.9
        );

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, "image/png");
        });

        if (!blob) {
            throw new Error("تعذر إنشاء صورة المشهد.");
        }

        return new Uint8Array(await blob.arrayBuffer());
    }

    // تصدير الفيديو
    async function exportVideo() {
        if (exporting) return;

        if (!scenes.length) {
            setStatus("⚠️ قسم السكريبت إلى مشاهد أولاً.");
            return;
        }

        const ffmpeg = window.videoFFmpeg;

        if (
            !ffmpeg ||
            !window.videoFFmpegLoaded ||
            typeof ffmpeg.exec !== "function"
        ) {
            setStatus(
                "⚠️ محرك FFmpeg غير جاهز. انتقل إلى قسم قص الفيديو واضغط تحميل محرك المونتاج."
            );
            return;
        }

        exporting = true;
        exportButton.disabled = true;
        clearDownload();
        setProgress(0);

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
            setStatus("⏳ جاري تجهيز الفيديو...");

            for (let i = 0; i < scenes.length; i++) {
                const imageName = `scene_${i}.png`;
                const videoName = `scene_${i}.mp4`;

                setStatus(`🎨 إنشاء صورة المشهد ${i + 1} من ${scenes.length}...`);

                const imageData = await createSceneImage(
                    scenes[i],
                    i,
                    width,
                    height
                );

                await ffmpeg.writeFile(imageName, imageData);
                createdFiles.push(imageName);

                setStatus(`🎬 تحويل المشهد ${i + 1} إلى فيديو...`);

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
                    "-movflags", "+faststart",
                    videoName
                ]);

                if (result !== 0) {
                    throw new Error(
                        `FFmpeg فشل في إنشاء المشهد ${i + 1}. تحقق من دعم libx264 في نسخة المحرك.`
                    );
                }

                createdFiles.push(videoName);

                setProgress(
                    Math.round(((i + 1) / scenes.length) * 75)
                );
            }

            // إنشاء قائمة المشاهد
            const concatContent = scenes
                .map((_, index) => `file 'scene_${index}.mp4'`)
                .join("\n");

            await ffmpeg.writeFile(
                "scenes_list.txt",
                new TextEncoder().encode(concatContent)
            );

            createdFiles.push("scenes_list.txt");

            setStatus("⏳ جاري دمج المشاهد...");

            const mergeResult = await ffmpeg.exec([
                "-f", "concat",
                "-safe", "0",
                "-i", "scenes_list.txt",
                "-c", "copy",
                "-movflags", "+faststart",
                "AI-TEXT-VIDEO.mp4"
            ]);

            if (mergeResult !== 0) {
                throw new Error("فشل دمج المشاهد في فيديو واحد.");
            }

            setProgress(90);
            setStatus("📦 جاري تجهيز ملف التحميل...");

            const outputData = await ffmpeg.readFile("AI-TEXT-VIDEO.mp4");

            if (!outputData || outputData.length === 0) {
                throw new Error("ملف الفيديو الناتج فارغ.");
            }

            const videoBlob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            outputURL = URL.createObjectURL(videoBlob);

            downloadLink.href = outputURL;
            downloadLink.download = "AI-TEXT-VIDEO.mp4";
            downloadLink.hidden = false;

            setProgress(100);
            setStatus("✅ تم إنشاء الفيديو بنجاح! اضغط على تحميل الفيديو.");

        } catch (error) {
            console.error("Text to Video Export Error:", error);

            setProgress(0);

            setStatus(
                "❌ خطأ أثناء التصدير: " +
                (error.message || "خطأ غير معروف")
            );

        } finally {
            for (const file of createdFiles) {
                try {
                    await ffmpeg.deleteFile(file);
                } catch (error) {
                    console.warn("تعذر حذف الملف المؤقت:", file, error);
                }
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
