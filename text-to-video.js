
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

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

    if (!scriptInput || !generateButton || !clearButton ||
        !sceneList || !durationInput || !exportButton || !downloadLink) {
        console.error("Text to Video: عناصر HTML ناقصة.");
        return;
    }

    let scenes = [];
    let outputURL = null;
    let exporting = false;

    const FPS = 30;
    const TRANSITION = 0.8;

    function setStatus(message) {
        if (status) status.textContent = message;
    }

    function setProgress(value) {
        if (progressBar) {
            progressBar.style.width =
                `${Math.max(0, Math.min(100, value))}%`;
        }
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
                </div>`;
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
            paragraph.textContent = scene.text;

            const imageInfo = document.createElement("small");
            imageInfo.textContent = scene.image
                ? "🖼️ الصورة جاهزة"
                : "🔎 سيتم البحث عن صورة عند التصدير";

            card.append(heading, paragraph, imageInfo);
            sceneList.appendChild(card);
        });

        if (sceneCount) {
            sceneCount.textContent = `${scenes.length} مشهد`;
        }

        if (totalDuration) {
            totalDuration.textContent = formatTime(
                scenes.length * Number(durationInput.value)
            );
        }
    }

    // كلمات بحث بسيطة من نص المشهد
    function getSearchQuery(text) {
        const stopWords = new Set([
            "من", "في", "على", "إلى", "عن", "مع", "هذا", "هذه",
            "كان", "كانت", "هو", "هي", "ثم", "بعد", "قبل",
            "the", "and", "for", "with", "from", "that", "this",
            "was", "were", "are", "you", "your", "into"
        ]);

        const words = text
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()));

        return words.slice(0, 7).join(" ") || text.slice(0, 80);
    }

    // البحث عن صورة مجانية في Wikimedia Commons
    async function searchSceneImage(text) {
        const query = getSearchQuery(text);

        const apiURL = new URL(
            "https://commons.wikimedia.org/w/api.php"
        );

        apiURL.search = new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: query,
            gsrnamespace: "6",
            gsrlimit: "8",
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: "1600",
            format: "json",
            origin: "*"
        });

        const response = await fetch(apiURL.toString());

        if (!response.ok) {
            throw new Error("تعذر الاتصال بمكتبة الصور.");
        }

        const data = await response.json();
        const pages = Object.values(data.query?.pages || {});

        const imagePage = pages.find(page => {
            const info = page.imageinfo?.[0];
            const url = info?.thumburl || info?.url;
            return url && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
        });

        if (!imagePage) {
            throw new Error("لم يتم العثور على صورة مناسبة.");
        }

        const imageURL =
            imagePage.imageinfo[0].thumburl ||
            imagePage.imageinfo[0].url;

        const imageResponse = await fetch(imageURL);

        if (!imageResponse.ok) {
            throw new Error("تعذر تحميل الصورة.");
        }

        const blob = await imageResponse.blob();

        return await createImageBitmap(blob);
    }

    // كتابة النص فوق الصورة
    function wrapText(ctx, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];
        let line = "";

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;

            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }

        if (line) lines.push(line);
        return lines;
    }

    async function createSceneImage(scene, index, width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("تعذر إنشاء Canvas.");

        let bitmap = null;

        try {
            setStatus(`🔎 البحث عن صورة المشهد ${index + 1}...`);
            bitmap = await searchSceneImage(scene.text);
        } catch (error) {
            console.warn("Image search:", error);
        }

        // خلفية احتياطية إذا لم توجد صورة
        if (bitmap) {
            const scale = Math.max(
                width / bitmap.width,
                height / bitmap.height
            );

            const drawWidth = bitmap.width * scale;
            const drawHeight = bitmap.height * scale;

            ctx.drawImage(
                bitmap,
                (width - drawWidth) / 2,
                (height - drawHeight) / 2,
                drawWidth,
                drawHeight
            );

            bitmap.close();
        } else {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, "#111827");
            gradient.addColorStop(0.5, "#302044");
            gradient.addColorStop(1, "#080808");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = "#d6b76b";
            ctx.font = "bold 35px Arial";
            ctx.textAlign = "center";
            ctx.fillText("AI VIDEO STUDIO PRO", width / 2, height * 0.25);
        }

        // طبقة داكنة لظهور النص
        const overlay = ctx.createLinearGradient(
            0, height * 0.35, 0, height
        );

        overlay.addColorStop(0, "rgba(0,0,0,0.05)");
        overlay.addColorStop(0.45, "rgba(0,0,0,0.35)");
        overlay.addColorStop(1, "rgba(0,0,0,0.85)");

        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        // إطار ذهبي
        ctx.strokeStyle = "#d6b76b";
        ctx.lineWidth = 4;
        ctx.strokeRect(25, 25, width - 50, height - 50);

        // عنوان الاستوديو
        ctx.fillStyle = "#f1d28a";
        ctx.font = "bold 25px Arial";
        ctx.textAlign = "center";
        ctx.direction = "ltr";
        ctx.fillText("AI VIDEO STUDIO PRO", width / 2, height * 0.12);

        // النص العربي
        ctx.direction = "rtl";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";

        const fontSize = width > height ? 42 : 38;
        ctx.font = `bold ${fontSize}px Cairo, Arial`;

        const lines = wrapText(
            ctx,
            scene.text,
            width * 0.82
        ).slice(0, 7);

        const lineHeight = fontSize * 1.6;
        const startY = height * 0.68 -
            ((lines.length - 1) * lineHeight) / 2;

        // خلفية خفيفة للنص
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 12;

        lines.forEach((line, i) => {
            ctx.fillText(
                line,
                width / 2,
                startY + i * lineHeight,
                width * 0.84
            );
        });

        ctx.shadowBlur = 0;

        ctx.direction = "ltr";
        ctx.fillStyle = "#e4c477";
        ctx.font = "20px Arial";
        ctx.fillText(
            `SCENE ${index + 1}`,
            width / 2,
            height * 0.92
        );

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/png")
        );

        if (!blob) throw new Error("تعذر إنشاء صورة المشهد.");

        return new Uint8Array(await blob.arrayBuffer());
    }

    // تقسيم السكريبت
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
            .filter(part => part.length > 0)
            .map(part => ({ text: part, image: null }));

        clearDownload();
        renderScenes();
        setProgress(0);

        setStatus(`✅ تم إنشاء ${scenes.length} مشهد.`);
    });

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

    // تصدير الفيديو السينمائي
    async function exportVideo() {
        if (exporting) return;

        if (!scenes.length) {
            setStatus("⚠️ قسم السكريبت إلى مشاهد أولاً.");
            return;
        }

        const ffmpeg = window.videoFFmpeg;

        if (!ffmpeg || !window.videoFFmpegLoaded ||
            typeof ffmpeg.exec !== "function") {
            setStatus("⚠️ محرك FFmpeg غير جاهز. حمّلو من قسم قص الفيديو أولاً.");
            return;
        }

        if (window.videoFFmpegBusy) {
            setStatus("⏳ FFmpeg مشغول بأداة أخرى. انتظر حتى تنتهي.");
            return;
        }

        exporting = true;
        window.videoFFmpegBusy = true;
        exportButton.disabled = true;

        clearDownload();
        setProgress(0);

        const duration = Math.max(
            2,
            Number(durationInput.value) || 5
        );

        const format = formatInput ? formatInput.value : "16:9";

        const dimensions = {
            "16:9": [1280, 720],
            "9:16": [720, 1280],
            "1:1": [720, 720]
        };

        const [width, height] =
            dimensions[format] || dimensions["16:9"];

        const createdFiles = [];
        const videoFiles = [];

        try {
            setStatus("🎬 بدء إعداد الفيديو السينمائي...");

            // إنشاء صورة وفيديو لكل مشهد
            for (let i = 0; i < scenes.length; i++) {
                const imageName = `cinema_scene_${i}.png`;
                const videoName = `cinema_scene_${i}.mp4`;

                const imageData = await createSceneImage(
                    scenes[i],
                    i,
                    width,
                    height
                );

                await ffmpeg.writeFile(imageName, imageData);
                createdFiles.push(imageName);

                setStatus(
                    `🎥 إضافة الحركة السينمائية للمشهد ${i + 1}/${scenes.length}...`
                );

                // حركة Zoom تدريجية داخل الصورة
                const frames = duration * FPS;

                const zoomFilter =
                    `zoompan=z='min(zoom+0.0015,1.12)'` +
                    `:d=${frames}:s=${width}x${height}:fps=${FPS},` +
                    `setsar=1,format=yuv420p`;

                const result = await ffmpeg.exec([
                    "-loop", "1",
                    "-framerate", String(FPS),
                    "-i", imageName,
                    "-vf", zoomFilter,
                    "-t", String(duration),
                    "-r", String(FPS),
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-pix_fmt", "yuv420p",
                    "-an",
                    "-movflags", "+faststart",
                    videoName
                ]);

                if (result !== 0) {
                    throw new Error(
                        `فشل إنشاء المشهد ${i + 1}. تحقق من دعم libx264 وzoompan.`
                    );
                }

                createdFiles.push(videoName);
                videoFiles.push(videoName);

                setProgress(
                    Math.round(((i + 1) / scenes.length) * 65)
                );
            }

            // دمج المشاهد مع انتقالات Crossfade
            setStatus("✨ إضافة الانتقالات السينمائية بين المشاهد...");

            let finalInputArgs = [];
            let filterGraph = "";
            let finalVideoLabel = "";

            if (videoFiles.length === 1) {
                finalInputArgs = ["-i", videoFiles[0]];
                finalVideoLabel = "0:v";
            } else {
                videoFiles.forEach(file => {
                    finalInputArgs.push("-i", file);
                });

                let previousLabel = "0:v";

                for (let i = 1; i < videoFiles.length; i++) {
                    const outputLabel = `v${i}`;
                    const offset = duration * i - TRANSITION * i;

                    filterGraph +=
                        `[${previousLabel}][${i}:v]` +
                        `xfade=transition=fade:` +
                        `duration=${TRANSITION}:` +
                        `offset=${offset.toFixed(3)}` +
                        `[${outputLabel}];`;

                    previousLabel = outputLabel;
                }

                finalVideoLabel = previousLabel;
                filterGraph = filterGraph.replace(/;$/, "");
            }

            const outputName = "AI-CINEMATIC-VIDEO.mp4";

            const mergeArgs = [
                ...finalInputArgs
            ];

            if (videoFiles.length > 1) {
                mergeArgs.push("-filter_complex", filterGraph);
            }

            mergeArgs.push(
                "-map", `[${finalVideoLabel}]`,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                outputName
            );

            const mergeResult = await ffmpeg.exec(mergeArgs);

            if (mergeResult !== 0) {
                throw new Error(
                    "فشل دمج المشاهد. ربما نسخة FFmpeg لا تدعم xfade."
                );
            }

            createdFiles.push(outputName);

            setProgress(90);
            setStatus("📦 تجهيز ملف MP4 للتحميل...");

            const outputData = await ffmpeg.readFile(outputName);

            if (!outputData || !outputData.length) {
                throw new Error("ملف الفيديو فارغ.");
            }

            const blob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            outputURL = URL.createObjectURL(blob);

            downloadLink.href = outputURL;
            downloadLink.download = "AI-CINEMATIC-VIDEO.mp4";
            downloadLink.hidden = false;

            setProgress(100);
            setStatus(
                "✅ الفيديو السينمائي واجد! حمّلو وجربو."
            );

        } catch (error) {
            console.error("Cinematic Video Error:", error);

            setProgress(0);
            setStatus(
                "❌ خطأ: " + (error.message || "خطأ غير معروف")
            );

        } finally {
            for (const file of createdFiles) {
                try {
                    await ffmpeg.deleteFile(file);
                } catch (_) {}
            }

            exporting = false;
            window.videoFFmpegBusy = false;
            exportButton.disabled = false;
        }
    }

    exportButton.addEventListener("click", exportVideo);

    renderScenes();
});
