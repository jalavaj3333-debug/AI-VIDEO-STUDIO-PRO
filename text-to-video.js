
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
    let searching = false;

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

    function clearDownload() {
        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function getSearchQuery(text) {
        return text
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 7)
            .join(" ");
    }

    // تحميل الصورة والتأكد أنها صالحة للاستعمال
    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            // السماح باستعمال الصورة داخل Canvas
            img.crossOrigin = "anonymous";

            img.onload = () => {
                if (!img.naturalWidth || !img.naturalHeight) {
                    reject(new Error("الصورة فارغة."));
                    return;
                }
                resolve(img);
            };

            img.onerror = () => {
                reject(new Error("تعذر تحميل الصورة من المصدر."));
            };

            img.src = url;
        });
    }

    // البحث في Wikimedia Commons
    async function searchSceneImage(text) {
        const query = getSearchQuery(text);

        if (!query) {
            throw new Error("النص لا يحتوي على كلمات مناسبة للبحث.");
        }

        const params = new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: query,
            gsrnamespace: "6",
            gsrlimit: "15",
            prop: "imageinfo",
            iiprop: "url|mime",
            iiurlwidth: "1400",
            format: "json",
            origin: "*"
        });

        const apiURL =
            "https://commons.wikimedia.org/w/api.php?" + params.toString();

        const response = await fetch(apiURL);

        if (!response.ok) {
            throw new Error("مكتبة الصور لم تستجب.");
        }

        const data = await response.json();
        const pages = Object.values(data.query?.pages || {});

        const candidates = pages
            .map(page => page.imageinfo?.[0])
            .filter(info => {
                if (!info) return false;

                const mime = info.mime || "";
                return (
                    mime === "image/jpeg" ||
                    mime === "image/png" ||
                    mime === "image/webp"
                );
            });

        if (!candidates.length) {
            throw new Error(`ما تلقاتش صورة للبحث: ${query}`);
        }

        // تجربة أكثر من صورة إذا الأولى لم تتحمل
        for (const info of candidates) {
            const url = info.thumburl || info.url;
            if (!url) continue;

            try {
                const image = await loadImage(url);
                return {
                    image,
                    url,
                    title: info.descriptionurl || "Wikimedia Commons"
                };
            } catch (error) {
                console.warn("تعذر تحميل صورة، تجربة صورة أخرى:", error);
            }
        }

        throw new Error("تم العثور على صور ولكن تعذر تحميلها.");
    }

    // عرض المشاهد والصور
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
            paragraph.textContent = scene.text;

            const preview = document.createElement("div");
            preview.className = "scene-image-preview";

            preview.style.width = "100%";
            preview.style.maxWidth = "420px";
            preview.style.margin = "12px 0";
            preview.style.borderRadius = "12px";
            preview.style.overflow = "hidden";
            preview.style.background = "#171717";

            if (scene.image) {
                const img = document.createElement("img");
                img.src = scene.image.src;
                img.alt = `صورة المشهد ${index + 1}`;
                img.style.width = "100%";
                img.style.display = "block";
                img.style.aspectRatio = "16 / 9";
                img.style.objectFit = "cover";
                preview.appendChild(img);
            } else {
                const message = document.createElement("div");
                message.textContent = scene.imageError
                    ? `❌ ${scene.imageError}`
                    : "⏳ جاري البحث عن الصورة...";

                message.style.padding = "25px";
                message.style.textAlign = "center";
                message.style.color = "#d6b76b";
                preview.appendChild(message);
            }

            const info = document.createElement("small");
            info.textContent = `${durationInput.value} ثوانٍ`;

            card.append(heading, paragraph, preview, info);
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

    // تقسيم النص والبحث عن الصور مباشرة
    generateButton.addEventListener("click", async () => {
        if (searching || exporting) return;

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
            .map(part => ({
                text: part,
                image: null,
                imageError: null
            }));

        clearDownload();
        renderScenes();
        setProgress(0);

        searching = true;
        generateButton.disabled = true;

        let successful = 0;

        try {
            for (let i = 0; i < scenes.length; i++) {
                setStatus(
                    `🔎 البحث عن صورة المشهد ${i + 1} من ${scenes.length}...`
                );

                try {
                    const result = await searchSceneImage(scenes[i].text);
                    scenes[i].image = result.image;
                    scenes[i].imageURL = result.url;
                    successful++;
                } catch (error) {
                    console.error(`Scene ${i + 1}:`, error);
                    scenes[i].imageError = error.message;
                }

                renderScenes();
                setProgress(
                    Math.round(((i + 1) / scenes.length) * 100)
                );
            }

            if (successful === scenes.length) {
                setStatus(`✅ تم العثور على صور لجميع المشاهد (${successful}).`);
            } else {
                setStatus(
                    `⚠️ تم العثور على ${successful} صورة من أصل ${scenes.length}. راجع المشاهد التي لم تنجح.`
                );
            }
        } finally {
            searching = false;
            generateButton.disabled = false;
        }
    });

    // مسح المشروع
    clearButton.addEventListener("click", () => {
        if (exporting || searching) return;

        scenes = [];
        scriptInput.value = "";

        clearDownload();
        renderScenes();
        setProgress(0);
        setStatus("تم مسح السكريبت والمشاهد.");
    });

    durationInput.addEventListener("change", renderScenes);

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

    // تجهيز صورة المشهد من الصورة الحقيقية
    async function createSceneImage(scene, index, width, height) {
        if (!scene.image) {
            throw new Error(
                `المشهد ${index + 1} ما عندوش صورة. أعد البحث عن الصور أولاً.`
            );
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("تعذر إنشاء Canvas.");
        }

        const img = scene.image;

        const scale = Math.max(
            width / img.naturalWidth,
            height / img.naturalHeight
        );

        const drawWidth = img.naturalWidth * scale;
        const drawHeight = img.naturalHeight * scale;

        ctx.drawImage(
            img,
            (width - drawWidth) / 2,
            (height - drawHeight) / 2,
            drawWidth,
            drawHeight
        );

        // تدرج داكن خلف النص
        const overlay = ctx.createLinearGradient(
            0, height * 0.35, 0, height
        );

        overlay.addColorStop(0, "rgba(0,0,0,0.05)");
        overlay.addColorStop(0.5, "rgba(0,0,0,0.45)");
        overlay.addColorStop(1, "rgba(0,0,0,0.85)");

        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        // إطار
        ctx.strokeStyle = "#d6b76b";
        ctx.lineWidth = 4;
        ctx.strokeRect(25, 25, width - 50, height - 50);

        ctx.fillStyle = "#f1d28a";
        ctx.font = "bold 25px Arial";
        ctx.textAlign = "center";
        ctx.direction = "ltr";
        ctx.fillText("AI VIDEO STUDIO PRO", width / 2, height * 0.12);

        // كتابة النص
        ctx.direction = "rtl";
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

        ctx.shadowColor = "rgba(0,0,0,0.95)";
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

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/png")
        );

        if (!blob) {
            throw new Error("تعذر إنشاء صورة الفيديو.");
        }

        return new Uint8Array(await blob.arrayBuffer());
    }

    // تصدير الفيديو
    async function exportVideo() {
        if (exporting || searching) return;

        if (!scenes.length) {
            setStatus("⚠️ قسم السكريبت إلى مشاهد أولاً.");
            return;
        }

        const missing = scenes.findIndex(scene => !scene.image);

        if (missing !== -1) {
            setStatus(
                `⚠️ المشهد ${missing + 1} ما عندوش صورة. أعد تقسيم السكريبت والبحث عن الصور.`
            );
            return;
        }

        const ffmpeg = window.videoFFmpeg;

        if (!ffmpeg || !window.videoFFmpegLoaded ||
            typeof ffmpeg.exec !== "function") {
            setStatus("⚠️ محرك FFmpeg غير جاهز. حمّلو من قسم قص الفيديو أولاً.");
            return;
        }

        if (window.videoFFmpegBusy) {
            setStatus("⏳ محرك FFmpeg مشغول بأداة أخرى.");
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
            for (let i = 0; i < scenes.length; i++) {
                const imageName = `cinema_scene_${i}.png`;
                const videoName = `cinema_scene_${i}.mp4`;

                setStatus(
                    `🎨 تجهيز الصورة الحقيقية للمشهد ${i + 1}/${scenes.length}...`
                );

                const imageData = await createSceneImage(
                    scenes[i],
                    i,
                    width,
                    height
                );

                await ffmpeg.writeFile(imageName, imageData);
                createdFiles.push(imageName);

                setStatus(
                    `🎥 إضافة الحركة السينمائية للمشهد ${i + 1}...`
                );

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

            setStatus("✨ إضافة الانتقالات بين المشاهد...");

            let inputArgs = [];
            let filterGraph = "";
            let finalLabel = "";

            if (videoFiles.length === 1) {
                inputArgs = ["-i", videoFiles[0]];
                finalLabel = "0:v";
            } else {
                videoFiles.forEach(file => {
                    inputArgs.push("-i", file);
                });

                let previous = "0:v";

                for (let i = 1; i < videoFiles.length; i++) {
                    const next = `v${i}`;
                    const offset = duration * i - TRANSITION * i;

                    filterGraph +=
                        `[${previous}][${i}:v]` +
                        `xfade=transition=fade:` +
                        `duration=${TRANSITION}:` +
                        `offset=${offset.toFixed(3)}` +
                        `[${next}];`;

                    previous = next;
                }

                finalLabel = previous;
                filterGraph = filterGraph.replace(/;$/, "");
            }

            const outputName = "AI-CINEMATIC-VIDEO.mp4";

            const mergeArgs = [...inputArgs];

            if (videoFiles.length > 1) {
                mergeArgs.push("-filter_complex", filterGraph);
            }

            mergeArgs.push(
                "-map", `[${finalLabel}]`,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                outputName
            );

            const mergeResult = await ffmpeg.exec(mergeArgs);

            if (mergeResult !== 0) {
                throw new Error("فشل دمج المشاهد والانتقالات.");
            }

            createdFiles.push(outputName);

            setProgress(90);
            setStatus("📦 تجهيز الفيديو للتحميل...");

            const outputData = await ffmpeg.readFile(outputName);

            if (!outputData || !outputData.length) {
                throw new Error("ملف الفيديو الناتج فارغ.");
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
            setStatus("✅ الفيديو السينمائي بالصور والحركة واجد!");

        } catch (error) {
            console.error("Text to Video:", error);
            setProgress(0);
            setStatus("❌ " + (error.message || "وقع خطأ أثناء التصدير."));
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
