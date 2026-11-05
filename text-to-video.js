
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // HTML elements الموجودة في index.html
    const scriptInput = $("videoScript");
    const generateButton = $("generateScenes");
    const clearButton = $("clearScript");
    const sceneList = $("sceneList");
    const exportButton = $("exportVideo");

    // إعدادات الفيديو الموجودة في HTML
    const styleInput = $("videoStyle");
    const ratioInput = $("videoRatio");
    const languageInput = $("videoLanguage");

    // عناصر اختيارية: الكود يشتغل حتى إلا ما كانوش موجودين
    const durationInput = $("sceneDuration");
    const progressBar = $("textVideoProgress");
    const statusElement = $("textVideoStatus");
    const downloadLink = $("textVideoDownload");
    const sceneCount = $("sceneCount");
    const totalDuration = $("sceneTotalDuration");

    if (
        !scriptInput ||
        !generateButton ||
        !clearButton ||
        !sceneList ||
        !exportButton
    ) {
        console.error("Text to Video: عناصر HTML الأساسية ناقصة.");
        return;
    }

    let scenes = [];
    let outputURL = null;
    let searching = false;
    let exporting = false;

    const FPS = 30;
    const DEFAULT_SCENE_DURATION = 5;
    const FADE_TIME = 0.6;

    // ---------------------------------------
    // STATUS AND PROGRESS
    // ---------------------------------------

    function setStatus(message) {
        if (statusElement) {
            statusElement.textContent = message;
        }

        console.log("[Text to Video]", message);
    }

    function setProgress(value) {
        const percentage = Math.max(0, Math.min(100, value));

        if (!progressBar) return;

        if (progressBar.tagName === "PROGRESS") {
            progressBar.value = percentage;
        } else {
            progressBar.style.width = `${percentage}%`;
        }
    }

    function getSceneDuration() {
        if (!durationInput) {
            return DEFAULT_SCENE_DURATION;
        }

        const value = Number(durationInput.value);

        if (!Number.isFinite(value) || value <= 0) {
            return DEFAULT_SCENE_DURATION;
        }

        return Math.max(2, Math.min(30, value));
    }

    function formatTime(seconds) {
        const safe = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(safe / 60);
        const remaining = safe % 60;

        return (
            `${String(minutes).padStart(2, "0")}:` +
            `${String(remaining).padStart(2, "0")}`
        );
    }

    function clearDownload() {
        if (!downloadLink) return;

        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");

        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }
    }

    // ---------------------------------------
    // SCRIPT PROCESSING
    // ---------------------------------------

    function splitScript(text) {
        return text
            .split(/\n+|(?<=[.!؟?])\s+/)
            .map(part => part.trim())
            .filter(part => part.length > 0)
            .map(part => ({
                text: part,
                image: null,
                imageURL: null,
                imageError: null
            }));
    }

    function getSearchQuery(text) {
        return text
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 8)
            .join(" ");
    }

    // ---------------------------------------
    // IMAGE LOADING
    // ---------------------------------------

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.crossOrigin = "anonymous";

            img.onload = () => {
                if (!img.naturalWidth || !img.naturalHeight) {
                    reject(new Error("الصورة غير صالحة."));
                    return;
                }

                resolve(img);
            };

            img.onerror = () => {
                reject(new Error("تعذر تحميل الصورة."));
            };

            img.src = url;
        });
    }

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
            gsrlimit: "20",
            prop: "imageinfo",
            iiprop: "url|mime",
            iiurlwidth: "1400",
            format: "json",
            origin: "*"
        });

        const apiURL =
            "https://commons.wikimedia.org/w/api.php?" +
            params.toString();

        const response = await fetch(apiURL);

        if (!response.ok) {
            throw new Error("مكتبة الصور لم تستجب.");
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(
                data.error.info || "خطأ أثناء البحث عن الصور."
            );
        }

        const pages = Object.values(data.query?.pages || {});

        const candidates = pages
            .map(page => page.imageinfo?.[0])
            .filter(info => info && (info.thumburl || info.url));

        if (!candidates.length) {
            throw new Error(`لم يتم العثور على صورة: ${query}`);
        }

        for (const info of candidates) {
            const url = info.thumburl || info.url;

            try {
                const image = await loadImage(url);

                return {
                    image,
                    url,
                    source: info.descriptionurl || ""
                };
            } catch (error) {
                console.warn("تعذر تحميل صورة، تجربة صورة أخرى:", error);
            }
        }

        throw new Error("تم العثور على صور ولكن تعذر تحميلها.");
    }

    // ---------------------------------------
    // SCENES DISPLAY
    // ---------------------------------------

    function renderScenes() {
        sceneList.innerHTML = "";

        if (!scenes.length) {
            const empty = document.createElement("p");

            empty.className = "empty-message";
            empty.textContent = "المشاهد ديالك غادي يظهرو هنا.";

            sceneList.appendChild(empty);

            if (sceneCount) {
                sceneCount.textContent = "0 مشهد";
            }

            if (totalDuration) {
                totalDuration.textContent = "00:00";
            }

            return;
        }

        const duration = getSceneDuration();

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
            info.textContent = `${duration} ثوانٍ`;

            card.append(heading, paragraph, preview, info);
            sceneList.appendChild(card);
        });

        if (sceneCount) {
            sceneCount.textContent = `${scenes.length} مشهد`;
        }

        if (totalDuration) {
            totalDuration.textContent = formatTime(
                scenes.length * duration
            );
        }
    }

    // ---------------------------------------
    // SEARCH IMAGES FOR ALL SCENES
    // ---------------------------------------

    generateButton.addEventListener("click", async () => {
        if (searching || exporting) return;

        const text = scriptInput.value.trim();

        if (!text) {
            setStatus("⚠️ كتب السكريبت أولاً.");
            scriptInput.focus();
            return;
        }

        scenes = splitScript(text);

        clearDownload();
        renderScenes();
        setProgress(0);

        searching = true;
        generateButton.disabled = true;
        exportButton.disabled = true;

        let successful = 0;

        try {
            for (let i = 0; i < scenes.length; i++) {
                setStatus(
                    `🔎 البحث عن صورة المشهد ${i + 1} من ${scenes.length}...`
                );

                try {
                    const result = await searchSceneImage(
                        scenes[i].text
                    );

                    scenes[i].image = result.image;
                    scenes[i].imageURL = result.url;

                    successful++;
                } catch (error) {
                    console.error(`Scene ${i + 1}:`, error);

                    scenes[i].imageError =
                        error.message || "تعذر العثور على الصورة.";
                }

                renderScenes();

                setProgress(
                    Math.round(((i + 1) / scenes.length) * 100)
                );
            }

            if (successful === scenes.length) {
                setStatus(
                    `✅ تم العثور على صور جميع المشاهد (${successful}).`
                );
            } else {
                setStatus(
                    `⚠️ تم العثور على ${successful} صورة من أصل ${scenes.length}.`
                );
            }
        } catch (error) {
            console.error(error);
            setStatus("❌ حدث خطأ أثناء البحث عن الصور.");
        } finally {
            searching = false;
            generateButton.disabled = false;
            exportButton.disabled = false;
        }
    });

    // ---------------------------------------
    // CLEAR PROJECT
    // ---------------------------------------

    clearButton.addEventListener("click", () => {
        if (exporting || searching) return;

        scenes = [];
        scriptInput.value = "";

        clearDownload();
        renderScenes();
        setProgress(0);

        setStatus("تم مسح السكريبت والمشاهد.");
    });

    if (durationInput) {
        durationInput.addEventListener("change", renderScenes);
    }

    // ---------------------------------------
    // TEXT WRAPPING
    // ---------------------------------------

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

    // ---------------------------------------
    // CREATE IMAGE FOR VIDEO SCENE
    // ---------------------------------------

    async function createSceneImage(scene, index, width, height) {
        if (!scene.image) {
            throw new Error(
                `المشهد ${index + 1} لا يحتوي على صورة.`
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

        // تدرج داكن
        const overlay = ctx.createLinearGradient(
            0,
            height * 0.35,
            0,
            height
        );

        overlay.addColorStop(0, "rgba(0,0,0,0.05)");
        overlay.addColorStop(0.5, "rgba(0,0,0,0.45)");
        overlay.addColorStop(1, "rgba(0,0,0,0.85)");

        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        // إطار ذهبي
        ctx.strokeStyle = "#d6b76b";
        ctx.lineWidth = 4;

        ctx.strokeRect(
            25,
            25,
            width - 50,
            height - 50
        );

        // اسم الاستوديو
        ctx.fillStyle = "#f1d28a";
        ctx.font = "bold 25px Arial";
        ctx.textAlign = "center";
        ctx.direction = "ltr";

        ctx.fillText(
            "AI VIDEO STUDIO PRO",
            width / 2,
            height * 0.12
        );

        // النص
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

        const startY =
            height * 0.68 -
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

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, "image/png");
        });

        if (!blob) {
            throw new Error("تعذر إنشاء صورة الفيديو.");
        }

        return new Uint8Array(await blob.arrayBuffer());
    }

    // ---------------------------------------
    // EXPORT VIDEO
    // ---------------------------------------

    async function exportVideo() {
        if (exporting || searching) return;

        if (!scenes.length) {
            setStatus("⚠️ قسم السكريبت إلى مشاهد أولاً.");
            return;
        }

        const missingIndex = scenes.findIndex(
            scene => !scene.image
        );

        if (missingIndex !== -1) {
            setStatus(
                `⚠️ المشهد ${missingIndex + 1} لا يحتوي على صورة. أعد البحث عن الصور.`
            );
            return;
        }

        const ffmpeg = window.videoFFmpeg;

        if (
            !ffmpeg ||
            !window.videoFFmpegLoaded ||
            typeof ffmpeg.exec !== "function"
        ) {
            setStatus(
                "⚠️ محرك FFmpeg غير جاهز. حمّله من قسم قص الفيديو أولاً."
            );
            return;
        }

        if (window.videoFFmpegBusy) {
            setStatus("⏳ محرك FFmpeg مشغول بأداة أخرى.");
            return;
        }

        exporting = true;
        window.videoFFmpegBusy = true;

        exportButton.disabled = true;
        generateButton.disabled = true;
        clearButton.disabled = true;

        clearDownload();
        setProgress(0);

        const duration = getSceneDuration();
        const frames = Math.round(duration * FPS);

        const format = ratioInput
            ? ratioInput.value
            : "16:9";

        const dimensions = {
            "16:9": [1280, 720],
            "9:16": [720, 1280],
            "1:1": [720, 720]
        };

        const [width, height] =
            dimensions[format] || dimensions["16:9"];

        const createdFiles = [];
        const videoFiles = [];

        const outputName = "AI-CINEMATIC-VIDEO.mp4";
        const concatName = "cinema_scenes.txt";

        try {
            try {
                await ffmpeg.deleteFile(outputName);
            } catch (_) {}

            try {
                await ffmpeg.deleteFile(concatName);
            } catch (_) {}

            // انتظار تحميل الخطوط قبل الرسم
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }

            // إنشاء مشاهد الفيديو
            for (let i = 0; i < scenes.length; i++) {
                const imageName = `cinema_scene_${i}.png`;
                const videoName = `cinema_scene_${i}.mp4`;

                setStatus(
                    `🎨 تجهيز صورة المشهد ${i + 1}/${scenes.length}...`
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
                    `🎥 إنشاء الفيديو للمشهد ${i + 1}/${scenes.length}...`
                );

                const fadeTime = Math.min(
                    FADE_TIME,
                    duration / 3
                );

                const fadeOutStart = Math.max(
                    0,
                    duration - fadeTime
                );

                const zoomFilter =
                    `zoompan=z='min(zoom+0.0015,1.12)'` +
                    `:d=${frames}` +
                    `:s=${width}x${height}` +
                    `:fps=${FPS},` +
                    `fade=t=in:st=0:d=${fadeTime},` +
                    `fade=t=out:st=${fadeOutStart}:d=${fadeTime},` +
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
                        `فشل إنشاء المشهد ${i + 1}.`
                    );
                }

                createdFiles.push(videoName);
                videoFiles.push(videoName);

                setProgress(
                    Math.round(((i + 1) / scenes.length) * 65)
                );
            }

            // دمج الفيديوهات
            setStatus("✨ دمج المشاهد...");

            const concatContent = videoFiles
                .map(file => `file '${file}'`)
                .join("\n");

            await ffmpeg.writeFile(
                concatName,
                new TextEncoder().encode(concatContent)
            );

            createdFiles.push(concatName);

            const mergeResult = await ffmpeg.exec([
                "-f", "concat",
                "-safe", "0",
                "-i", concatName,
                "-c", "copy",
                "-movflags", "+faststart",
                outputName
            ]);

            if (mergeResult !== 0) {
                throw new Error("فشل دمج المشاهد.");
            }

            createdFiles.push(outputName);

            setProgress(90);
            setStatus("📦 تجهيز الفيديو للتحميل...");

            const outputData = await ffmpeg.readFile(outputName);

            if (!outputData || outputData.length === 0) {
                throw new Error("ملف الفيديو الناتج فارغ.");
            }

            const blob = new Blob(
                [outputData],
                { type: "video/mp4" }
            );

            outputURL = URL.createObjectURL(blob);

            if (downloadLink) {
                downloadLink.href = outputURL;
                downloadLink.download = outputName;
                downloadLink.hidden = false;
            } else {
                // بديل إذا لم يكن رابط التحميل موجوداً في HTML
                const temporaryLink = document.createElement("a");

                temporaryLink.href = outputURL;
                temporaryLink.download = outputName;
                temporaryLink.textContent = "تحميل الفيديو النهائي";
                temporaryLink.className = "primary-btn";
                temporaryLink.style.display = "inline-block";

                sceneList.appendChild(temporaryLink);
            }

            setProgress(100);

            setStatus(
                `✅ الفيديو واجد! المدة التقريبية: ${formatTime(scenes.length * duration)}`
            );

        } catch (error) {
            console.error("Text to Video Export Error:", error);

            setProgress(0);

            setStatus(
                "❌ " +
                (error.message || "وقع خطأ أثناء تصدير الفيديو.")
            );

        } finally {
            for (const file of createdFiles) {
                try {
                    await ffmpeg.deleteFile(file);
                } catch (error) {
                    console.warn(
                        "تعذر حذف الملف المؤقت:",
                        file
                    );
                }
            }

            exporting = false;
            window.videoFFmpegBusy = false;

            exportButton.disabled = false;
            generateButton.disabled = false;
            clearButton.disabled = false;
        }
    }

    exportButton.addEventListener("click", exportVideo);

    // ---------------------------------------
    // INITIALIZE
    // ---------------------------------------

    renderScenes();
    setProgress(0);
    setStatus("واجد لكتابة السكريبت.");

    console.log("AI VIDEO STUDIO PRO - TEXT TO VIDEO READY");
});
