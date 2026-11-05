
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // HTML elements
    const scriptInput = $("videoScript");
    const generateButton = $("generateScenes");
    const clearButton = $("clearScript");
    const sceneList = $("sceneList");
    const exportButton = $("exportVideo");

    const styleInput = $("videoStyle");
    const ratioInput = $("videoRatio");
    const languageInput = $("videoLanguage");

    // Optional elements
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
        console.error(
            "[Text to Video] عناصر HTML الأساسية ناقصة."
        );
        return;
    }

    let scenes = [];
    let outputURL = null;
    let searching = false;
    let exporting = false;

    const FPS = 30;
    const DEFAULT_SCENE_DURATION = 5;
    const FADE_TIME = 0.6;

    // =========================================
    // STATUS AND PROGRESS
    // =========================================

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
        if (outputURL) {
            URL.revokeObjectURL(outputURL);
            outputURL = null;
        }

        if (downloadLink) {
            downloadLink.hidden = true;
            downloadLink.removeAttribute("href");
        }

        const oldLink = sceneList.querySelector(
            ".temporary-video-download"
        );

        if (oldLink) {
            oldLink.remove();
        }
    }

    // =========================================
    // SCRIPT PROCESSING
    // =========================================

    function splitScript(text) {
        const normalized = text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();

        if (!normalized) return [];

        // First, split by empty lines.
        let blocks = normalized
            .split(/\n\s*\n+/)
            .map(block => block.trim())
            .filter(Boolean);

        // If there are no paragraph breaks,
        // treat each non-empty line as a scene.
        if (blocks.length === 1) {
            const lines = normalized
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean);

            if (lines.length > 1) {
                blocks = lines;
            }
        }

        const cleanedScenes = [];

        for (let block of blocks) {
            // Remove headings such as:
            // Scene 1:
            // المشهد 1:
            block = block
                .replace(
                    /^(?:المشهد|مشهد|scene)\s*\d+\s*[:：\-–—]?\s*/gim,
                    ""
                )
                .trim();

            // Remove standalone heading lines.
            block = block
                .split("\n")
                .filter(line => {
                    return !/^(?:المشهد|مشهد|scene)\s*\d+\s*[:：\-–—]?\s*$/i.test(
                        line.trim()
                    );
                })
                .join(" ")
                .trim();

            // Remove bullet symbols.
            block = block.replace(/^[•\-*]\s*/, "").trim();

            if (block.length < 3) continue;

            cleanedScenes.push({
                text: block,
                image: null,
                imageURL: null,
                imageError: null,
                imageSource: ""
            });
        }

        return cleanedScenes;
    }

    // =========================================
    // SEARCH QUERY TRANSLATION
    // =========================================

    function getSearchQueries(text) {
        const value = text.toLowerCase();

        const dictionary = [
            {
                words: [
                    "شروق",
                    "الشمس",
                    "الصباح",
                    "sunrise",
                    "sunset"
                ],
                query: "sunrise landscape photography"
            },
            {
                words: [
                    "الأطلس",
                    "جبال",
                    "جبل",
                    "mountain",
                    "atlas"
                ],
                query: "Atlas Mountains Morocco landscape"
            },
            {
                words: [
                    "مراكش",
                    "المدينة القديمة",
                    "أزقة",
                    "medina",
                    "marrakech"
                ],
                query: "Marrakech old medina Morocco"
            },
            {
                words: [
                    "باب",
                    "أبواب",
                    "عمارة",
                    "معمار",
                    "architecture"
                ],
                query: "Moroccan traditional architecture"
            },
            {
                words: [
                    "حرفي",
                    "صناعة",
                    "تقليدي",
                    "صناعة تقليدية",
                    "artisan",
                    "craft"
                ],
                query: "Moroccan artisan traditional crafts"
            },
            {
                words: [
                    "ملابس",
                    "أزياء",
                    "عارض",
                    "عارضة",
                    "fashion",
                    "model"
                ],
                query: "luxury fashion model photography"
            },
            {
                words: [
                    "أسود",
                    "ذهبي",
                    "فاخرة",
                    "منتوجات",
                    "luxury",
                    "gold",
                    "black"
                ],
                query: "black gold luxury product photography"
            },
            {
                words: [
                    "شعار",
                    "لوغو",
                    "تاج",
                    "logo",
                    "crown",
                    "smailly"
                ],
                query: "golden crown black background"
            },
            {
                words: [
                    "بحر",
                    "شاطئ",
                    "محيط",
                    "sea",
                    "beach",
                    "ocean"
                ],
                query: "ocean beach landscape photography"
            },
            {
                words: [
                    "غابة",
                    "أشجار",
                    "طبيعة",
                    "forest",
                    "trees",
                    "nature"
                ],
                query: "beautiful forest nature photography"
            },
            {
                words: [
                    "سيارة",
                    "سيارات",
                    "car",
                    "cars"
                ],
                query: "luxury car photography"
            },
            {
                words: [
                    "مدينة",
                    "مباني",
                    "شارع",
                    "city",
                    "street"
                ],
                query: "modern city street photography"
            },
            {
                words: [
                    "طفل",
                    "أطفال",
                    "لعب",
                    "children",
                    "kids"
                ],
                query: "children playing photography"
            },
            {
                words: [
                    "طعام",
                    "أكل",
                    "طبخ",
                    "food",
                    "cooking"
                ],
                query: "food photography"
            }
        ];

        const matchedQueries = dictionary
            .filter(item =>
                item.words.some(word => value.includes(word))
            )
            .map(item => item.query);

        // Use original English words if available.
        const englishWords = value
            .replace(/[^\w\s-]/g, " ")
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 7)
            .join(" ");

        const queries = [];

        if (englishWords && /[a-z]/i.test(englishWords)) {
            queries.push(englishWords);
        }

        queries.push(...matchedQueries);

        // General backup searches.
        queries.push("Morocco photography");
        queries.push("cinematic landscape photography");

        return [...new Set(queries)].slice(0, 5);
    }

    // =========================================
    // LOAD IMAGE
    // =========================================

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

    // =========================================
    // SEARCH IMAGE ON WIKIMEDIA COMMONS
    // =========================================

    async function searchSceneImage(text) {
        const queries = getSearchQueries(text);

        if (!queries.length) {
            throw new Error("لم يتم إنشاء كلمات البحث.");
        }

        for (const query of queries) {
            setStatus(`🔎 البحث عن الصورة: ${query}`);

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
                "https://commons.wikimedia.org/w/api.php?" +
                params.toString();

            try {
                const response = await fetch(apiURL);

                if (!response.ok) {
                    console.warn(
                        "Wikimedia response error:",
                        response.status
                    );
                    continue;
                }

                const data = await response.json();

                if (data.error) {
                    console.warn("Wikimedia API:", data.error);
                    continue;
                }

                const pages = Object.values(
                    data.query?.pages || {}
                );

                const candidates = pages
                    .map(page => page.imageinfo?.[0])
                    .filter(info => {
                        const url = info?.thumburl || info?.url;

                        return (
                            url &&
                            (
                                !info.mime ||
                                info.mime.startsWith("image/")
                            )
                        );
                    });

                for (const info of candidates) {
                    const imageURL = info.thumburl || info.url;

                    try {
                        const image = await loadImage(imageURL);

                        return {
                            image,
                            url: imageURL,
                            source: info.descriptionurl || "",
                            query
                        };
                    } catch (error) {
                        console.warn(
                            "تعذر تحميل الصورة، تجربة صورة أخرى:",
                            imageURL
                        );
                    }
                }
            } catch (error) {
                console.warn(
                    "فشل البحث باستعمال:",
                    query,
                    error
                );
            }
        }

        throw new Error(
            "لم يتم العثور على صورة حقيقية مناسبة. جرّب وصفاً أبسط أو أعد المحاولة."
        );
    }

    // =========================================
    // DISPLAY SCENES
    // =========================================

    function renderScenes() {
        sceneList.innerHTML = "";

        if (!scenes.length) {
            const empty = document.createElement("p");

            empty.className = "empty-message";
            empty.textContent =
                "المشاهد ديالك غادي يظهرو هنا.";

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

                img.src = scene.imageURL;
                img.alt = `صورة المشهد ${index + 1}`;
                img.style.width = "100%";
                img.style.display = "block";
                img.style.aspectRatio = "16 / 9";
                img.style.objectFit = "cover";

                preview.appendChild(img);

                if (scene.imageSource) {
                    const source = document.createElement("small");

                    source.textContent = "مصدر الصورة: Wikimedia Commons";
                    source.style.display = "block";
                    source.style.padding = "6px";
                    source.style.color = "#aaa";

                    preview.appendChild(source);
                }
            } else {
                const message = document.createElement("div");

                message.textContent = scene.imageError
                    ? `❌ ${scene.imageError}`
                    : "⏳ جاري البحث عن صورة حقيقية...";

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

    // =========================================
    // GENERATE SCENES AND SEARCH IMAGES
    // =========================================

    generateButton.addEventListener("click", async () => {
        if (searching || exporting) return;

        const text = scriptInput.value.trim();

        if (!text) {
            setStatus("⚠️ كتب السكريبت أولاً.");
            scriptInput.focus();
            return;
        }

        scenes = splitScript(text);

        if (!scenes.length) {
            setStatus("⚠️ ما قدرناش نستخرجو مشاهد من النص.");
            return;
        }

        clearDownload();
        renderScenes();
        setProgress(0);

        searching = true;

        generateButton.disabled = true;
        exportButton.disabled = true;
        clearButton.disabled = true;

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
                    scenes[i].imageSource = result.source;

                    successful++;
                } catch (error) {
                    console.error(
                        `Scene ${i + 1}:`,
                        error
                    );

                    scenes[i].imageError =
                        error.message || "تعذر العثور على الصورة.";
                }

                renderScenes();

                setProgress(
                    Math.round(
                        ((i + 1) / scenes.length) * 100
                    )
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

            setStatus(
                "❌ حدث خطأ أثناء البحث عن الصور."
            );
        } finally {
            searching = false;

            generateButton.disabled = false;
            clearButton.disabled = false;

            exportButton.disabled = successful === 0;
        }
    });

    // =========================================
    // CLEAR PROJECT
    // =========================================

    clearButton.addEventListener("click", () => {
        if (exporting || searching) return;

        scenes = [];
        scriptInput.value = "";

        clearDownload();
        renderScenes();
        setProgress(0);

        exportButton.disabled = false;

        setStatus("تم مسح السكريبت والمشاهد.");
    });

    if (durationInput) {
        durationInput.addEventListener(
            "change",
            renderScenes
        );
    }

    // =========================================
    // TEXT WRAPPING
    // =========================================

    function wrapText(ctx, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];

        let line = "";

        for (const word of words) {
            const test = line
                ? `${line} ${word}`
                : word;

            if (
                ctx.measureText(test).width > maxWidth &&
                line
            ) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }

        if (line) {
            lines.push(line);
        }

        return lines;
    }

    // =========================================
    // CREATE IMAGE FOR VIDEO SCENE
    // =========================================

    async function createSceneImage(
        scene,
        index,
        width,
        height
    ) {
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

        // Dark cinematic gradient
        const overlay = ctx.createLinearGradient(
            0,
            height * 0.35,
            0,
            height
        );

        overlay.addColorStop(
            0,
            "rgba(0,0,0,0.05)"
        );

        overlay.addColorStop(
            0.5,
            "rgba(0,0,0,0.45)"
        );

        overlay.addColorStop(
            1,
            "rgba(0,0,0,0.85)"
        );

        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        // Gold frame
        ctx.strokeStyle = "#d6b76b";
        ctx.lineWidth = 4;

        ctx.strokeRect(
            25,
            25,
            width - 50,
            height - 50
        );

        // Studio title
        ctx.fillStyle = "#f1d28a";
        ctx.font = "bold 25px Arial";
        ctx.textAlign = "center";
        ctx.direction = "ltr";

        ctx.fillText(
            "AI VIDEO STUDIO PRO",
            width / 2,
            height * 0.12
        );

        // Scene text
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
            throw new Error(
                "تعذر إنشاء صورة الفيديو."
            );
        }

        return new Uint8Array(
            await blob.arrayBuffer()
        );
    }

    // =========================================
    // EXPORT VIDEO
    // =========================================

    async function exportVideo() {
        if (exporting || searching) return;

        if (!scenes.length) {
            setStatus(
                "⚠️ قسم السكريبت إلى مشاهد أولاً."
            );
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
            setStatus(
                "⏳ محرك FFmpeg مشغول بأداة أخرى."
            );
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

            if (document.fonts?.ready) {
                await document.fonts.ready;
            }

            // Create each scene video
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

                await ffmpeg.writeFile(
                    imageName,
                    imageData
                );

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
                    Math.round(
                        ((i + 1) / scenes.length) * 65
                    )
                );
            }

            // Merge scenes
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

            const outputData = await ffmpeg.readFile(
                outputName
            );

            if (!outputData || outputData.length === 0) {
                throw new Error(
                    "ملف الفيديو الناتج فارغ."
                );
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
                const temporaryLink =
                    document.createElement("a");

                temporaryLink.href = outputURL;
                temporaryLink.download = outputName;
                temporaryLink.textContent =
                    "⬇ تحميل الفيديو النهائي";

                temporaryLink.className = "primary-btn";
                temporaryLink.style.display = "inline-block";

                temporaryLink.classList.add(
                    "temporary-video-download"
                );

                sceneList.appendChild(temporaryLink);
            }

            setProgress(100);

            setStatus(
                `✅ الفيديو واجد! المدة التقريبية: ${formatTime(scenes.length * duration)}`
            );

        } catch (error) {
            console.error(
                "Text to Video Export Error:",
                error
            );

            setProgress(0);

            setStatus(
                "❌ " +
                (error.message ||
                    "وقع خطأ أثناء تصدير الفيديو.")
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

    exportButton.addEventListener(
        "click",
        exportVideo
    );

    // =========================================
    // INITIALIZE
    // =========================================

    renderScenes();
    setProgress(0);

    setStatus("واجد لكتابة السكريبت.");

    console.log(
        "AI VIDEO STUDIO PRO - TEXT TO VIDEO READY"
    );
});
