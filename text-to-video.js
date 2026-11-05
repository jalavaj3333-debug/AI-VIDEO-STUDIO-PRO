
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // =========================================
    // HTML ELEMENTS
    // =========================================

    const scriptInput = $("videoScript");
    const generateButton = $("generateScenes");
    const clearButton = $("clearScript");
    const sceneList = $("sceneList");
    const exportButton = $("exportVideo");

    const ratioInput = $("videoRatio");
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
        console.error("[Text to Video] عناصر HTML الأساسية ناقصة.");
        return;
    }

    let scenes = [];
    let outputURL = null;
    let searching = false;
    let exporting = false;

    const FPS = 30;
    const DEFAULT_SCENE_DURATION = 5;
    const FADE_TIME = 0.6;
    const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

    // =========================================
    // STATUS AND PROGRESS
    // =========================================

    function setStatus(message) {
        if (statusElement) statusElement.textContent = message;
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
        if (!durationInput) return DEFAULT_SCENE_DURATION;

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

        return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
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

        if (oldLink) oldLink.remove();
    }

    // =========================================
    // IMAGE CLEANUP
    // =========================================

    function releaseSceneImage(scene) {
        if (!scene) return;

        if (
            scene.imageURL &&
            scene.imageURL.startsWith("blob:")
        ) {
            URL.revokeObjectURL(scene.imageURL);
        }

        scene.image = null;
        scene.imageURL = null;
        scene.imageSource = "";
        scene.imageTitle = "";
        scene.imageError = null;
        scene.imageType = "";
    }

    function releaseAllSceneImages() {
        scenes.forEach(releaseSceneImage);
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

        let blocks = normalized
            .split(/\n\s*\n+/)
            .map(block => block.trim())
            .filter(Boolean);

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
            block = block
                .replace(
                    /^(?:المشهد|مشهد|scene)\s*\d+\s*[:：\-–—]?\s*/gim,
                    ""
                )
                .trim();

            block = block
                .split("\n")
                .filter(line =>
                    !/^(?:المشهد|مشهد|scene)\s*\d+\s*[:：\-–—]?\s*$/i.test(
                        line.trim()
                    )
                )
                .join(" ")
                .trim();

            block = block.replace(/^[•\-*]\s*/, "").trim();

            if (block.length < 3) continue;

            cleanedScenes.push({
                text: block,
                image: null,
                imageURL: null,
                imageError: null,
                imageSource: "",
                imageTitle: "",
                imageType: ""
            });
        }

        return cleanedScenes;
    }

    // =========================================
    // SEARCH KEYWORDS
    // =========================================

    const STOP_WORDS = new Set([
        "the", "and", "with", "from", "into", "over",
        "under", "this", "that", "then", "there",
        "their", "they", "while", "when", "where",
        "which", "what", "about", "after", "before",
        "during", "through", "beautiful", "cinematic",
        "scene", "shot", "video", "image", "a", "an",
        "of", "in", "on", "at", "to", "for", "is",
        "are", "was", "were", "be", "by", "as",
        "من", "في", "على", "إلى", "الى", "عن", "مع",
        "هذا", "هذه", "ذلك", "تلك", "ثم", "بعد",
        "قبل", "و", "أو", "أن", "إن", "كان",
        "تكون", "يكون", "المشهد", "مشهد", "لقطة",
        "صورة", "فيديو", "وسط", "أمام", "خلف",
        "فوق", "تحت"
    ]);

    const CONCEPTS = [
        { words: ["أسد", "الأسد", "اسد", "lion"], query: "lion wildlife animal" },
        { words: ["نمر", "النمر", "tiger"], query: "tiger wild animal" },
        { words: ["فيل", "الفيل", "elephant"], query: "elephant wildlife" },
        { words: ["دب قطبي", "polar bear"], query: "polar bear arctic wildlife" },
        { words: ["ذئب", "الذئب", "wolf"], query: "wolf wildlife" },
        { words: ["حصان", "الحصان", "horse"], query: "horse animal" },
        { words: ["جمل", "الجمل", "camel"], query: "camel desert animal" },
        { words: ["طائر", "طيور", "bird"], query: "wild birds" },
        { words: ["نسر", "النسر", "eagle"], query: "eagle bird wildlife" },
        { words: ["سمك", "أسماك", "سمكة", "fish"], query: "underwater fish" },
        { words: ["قرش", "القرش", "shark"], query: "shark underwater" },
        { words: ["حوت", "الحوت", "whale"], query: "whale ocean" },
        { words: ["دلفين", "الدلفين", "dolphin"], query: "dolphin ocean" },
        { words: ["قطة", "قط", "القط", "cat"], query: "domestic cat" },
        { words: ["كلب", "الكلب", "dog"], query: "domestic dog" },
        { words: ["شروق", "الشمس", "sunrise"], query: "sunrise sun horizon" },
        { words: ["غروب", "الغروب", "sunset"], query: "sunset sun horizon" },
        { words: ["قمر", "القمر", "moon"], query: "moon night sky" },
        { words: ["نجوم", "النجوم", "stars"], query: "stars night sky" },
        { words: ["فضاء", "كواكب", "planet", "space"], query: "outer space planet" },
        { words: ["جبال", "جبل", "mountain"], query: "mountain landscape" },
        { words: ["صحراء", "الصحراء", "رمال", "desert"], query: "desert sand dunes" },
        { words: ["غابة", "الغابة", "أشجار", "forest"], query: "forest trees woodland" },
        { words: ["شلال", "الشلال", "waterfall"], query: "waterfall nature" },
        { words: ["نهر", "النهر", "river"], query: "river landscape" },
        { words: ["بحر", "البحر", "محيط", "ocean", "sea"], query: "ocean sea water" },
        { words: ["شاطئ", "الشاطئ", "beach"], query: "sandy beach sea" },
        { words: ["بركان", "البركان", "volcano"], query: "volcano eruption" },
        { words: ["مطر", "الأمطار", "rain"], query: "rain falling weather" },
        { words: ["ثلج", "الثلوج", "snow"], query: "snow winter landscape" },
        { words: ["مدينة", "المدينة", "city"], query: "city skyline buildings" },
        { words: ["شارع", "الشارع", "street"], query: "urban street" },
        { words: ["سيارة", "سيارات", "car"], query: "car automobile" },
        { words: ["طائرة", "الطائرة", "airplane"], query: "airplane aircraft" },
        { words: ["قطار", "القطار", "train"], query: "railway train" },
        { words: ["سفينة", "السفينة", "ship"], query: "ship vessel sea" },
        { words: ["طفل", "أطفال", "طفلة", "children"], query: "children" },
        { words: ["رجل", "الرجال", "man"], query: "man portrait" },
        { words: ["امرأة", "المرأة", "نساء", "woman"], query: "woman portrait" },
        { words: ["طبخ", "الطبخ", "مطبخ", "cooking"], query: "cooking kitchen" },
        { words: ["طعام", "أكل", "وجبة", "food"], query: "food photography" },
        { words: ["كرة القدم", "مباراة", "football", "soccer"], query: "football soccer match" },
        { words: ["كرة السلة", "basketball"], query: "basketball game" },
        { words: ["مراكش", "marrakech"], query: "Marrakech Morocco" },
        { words: ["المغرب", "مغربي", "morocco", "moroccan"], query: "Morocco" },
        { words: ["فاس", "fes"], query: "Fez Morocco" },
        { words: ["الصويرة", "essaouira"], query: "Essaouira Morocco" },
        { words: ["الرباط", "rabat"], query: "Rabat Morocco" },
        { words: ["مسجد", "المسجد", "mosque"], query: "mosque architecture" },
        { words: ["قصر", "القصور", "palace"], query: "palace architecture" },
        { words: ["باب", "أبواب", "door"], query: "traditional door architecture" },
        { words: ["حرفي", "حرفيون", "artisan"], query: "traditional crafts artisan" },
        { words: ["قفطان", "قفاطين", "caftan"], query: "Moroccan caftan traditional clothing" },
        { words: ["ملابس", "أزياء", "موضة", "fashion"], query: "fashion clothing" },
        { words: ["عارض", "عارضة", "model"], query: "fashion model" },
        { words: ["تاج", "التاج", "crown"], query: "royal crown" },
        { words: ["شعار", "لوغو", "logo"], query: "brand logo" },
        { words: ["زهرة", "زهور", "وردة", "flower"], query: "flower plant" },
        { words: ["نبات", "نباتات", "plant"], query: "green plants" },
        { words: ["روبوت", "الروبوت", "robot"], query: "robot technology" },
        { words: ["حاسوب", "كمبيوتر", "computer"], query: "computer technology" },
        { words: ["هاتف", "الهاتف", "smartphone", "phone"], query: "smartphone mobile phone" }
    ];

    function normalizeText(text) {
        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[أإآٱ]/g, "ا")
            .replace(/ى/g, "ي")
            .replace(/ة/g, "ه")
            .replace(/[^\p{L}\p{N}\s-]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function extractEnglishWords(text) {
        return normalizeText(text)
            .split(/\s+/)
            .filter(word =>
                word.length > 2 &&
                !STOP_WORDS.has(word) &&
                /^[a-z0-9-]+$/i.test(word)
            );
    }

    function getSearchQueries(text) {
        const normalized = normalizeText(text);
        const queries = [];

        const englishWords = extractEnglishWords(text);

        if (englishWords.length) {
            queries.push(englishWords.slice(0, 8).join(" "));
        }

        for (const concept of CONCEPTS) {
            const matched = concept.words.some(word =>
                normalized.includes(normalizeText(word))
            );

            if (matched) {
                queries.push(concept.query);
            }
        }

        return [...new Set(queries)]
            .filter(query => query.length >= 3)
            .slice(0, 5);
    }

    function getSearchTerms(query) {
        return extractEnglishWords(query)
            .filter(word => word.length > 2);
    }

    function scoreImageTitle(title, queries) {
        const normalizedTitle = normalizeText(title);
        const titleWords = new Set(normalizedTitle.split(/\s+/));

        let bestScore = 0;

        for (const query of queries) {
            const terms = getSearchTerms(query);

            if (!terms.length) continue;

            let matches = 0;

            for (const term of terms) {
                if (
                    titleWords.has(term) ||
                    normalizedTitle.includes(term)
                ) {
                    matches++;
                }
            }

            bestScore = Math.max(bestScore, matches / terms.length);
        }

        return bestScore;
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
    // MANUAL IMAGE UPLOAD
    // =========================================

    async function setSceneImage(index, file) {
        const scene = scenes[index];

        if (!scene || !file) return;

        if (!file.type.startsWith("image/")) {
            setStatus("⚠️ اختار ملف صورة فقط.");
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            setStatus("⚠️ حجم الصورة كبير. الحد الأقصى 15 MB.");
            return;
        }

        const newURL = URL.createObjectURL(file);

        try {
            const image = await loadImage(newURL);

            if (scenes[index] !== scene) {
                URL.revokeObjectURL(newURL);
                return;
            }

            releaseSceneImage(scene);

            scene.image = image;
            scene.imageURL = newURL;
            scene.imageTitle = file.name;
            scene.imageSource = "";
            scene.imageType = "manual";
            scene.imageError = null;

            renderScenes();
            updateExportButton();

            setStatus(`✅ تمت إضافة الصورة للمشهد ${index + 1}.`);

        } catch (error) {
            URL.revokeObjectURL(newURL);

            console.error(error);
            setStatus("❌ تعذر فتح الصورة. جرّب صورة أخرى.");
        }
    }

    function removeSceneImage(index) {
        const scene = scenes[index];

        if (!scene) return;

        releaseSceneImage(scene);

        renderScenes();
        updateExportButton();

        setStatus(`🗑️ تم حذف صورة المشهد ${index + 1}.`);
    }

    function updateExportButton() {
        const allHaveImages =
            scenes.length > 0 &&
            scenes.every(scene => !!scene.image);

        exportButton.disabled =
            !allHaveImages || searching || exporting;
    }

    // =========================================
    // WIKIMEDIA IMAGE SEARCH
    // =========================================

    async function searchSceneImage(text) {
        const queries = getSearchQueries(text);

        if (!queries.length) {
            throw new Error(
                "ما قدرناش نستخرجو كلمات بحث واضحة من وصف المشهد."
            );
        }

        let bestCandidate = null;
        const MINIMUM_SCORE = 0.30;

        for (const query of queries) {
            setStatus(`🔎 البحث عن: ${query}`);

            const params = new URLSearchParams({
                action: "query",
                generator: "search",
                gsrsearch: query,
                gsrnamespace: "6",
                gsrlimit: "30",
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

                if (!response.ok) continue;

                const data = await response.json();

                if (data.error) continue;

                const pages = Object.values(
                    data.query?.pages || {}
                );

                const candidates = pages
                    .map(page => {
                        const info = page.imageinfo?.[0];

                        if (!info) return null;

                        const url = info.thumburl || info.url;

                        if (
                            !url ||
                            (info.mime &&
                            !info.mime.startsWith("image/"))
                        ) {
                            return null;
                        }

                        return {
                            url,
                            source: info.descriptionurl || "",
                            title: (page.title || "")
                                .replace(/^File:/i, ""),
                            score: scoreImageTitle(
                                page.title || "",
                                queries
                            )
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.score - a.score);

                for (const candidate of candidates) {
                    if (candidate.score < MINIMUM_SCORE) continue;

                    if (
                        !bestCandidate ||
                        candidate.score > bestCandidate.score
                    ) {
                        bestCandidate = candidate;
                    }

                    if (candidate.score >= 0.5) {
                        try {
                            const image = await loadImage(
                                candidate.url
                            );

                            return {
                                image,
                                url: candidate.url,
                                source: candidate.source,
                                title: candidate.title
                            };
                        } catch (error) {
                            console.warn(
                                "تعذر تحميل الصورة:",
                                candidate.url
                            );
                        }
                    }
                }

            } catch (error) {
                console.warn("فشل البحث:", query, error);
            }
        }

        if (
            bestCandidate &&
            bestCandidate.score >= MINIMUM_SCORE
        ) {
            try {
                const image = await loadImage(
                    bestCandidate.url
                );

                return {
                    image,
                    url: bestCandidate.url,
                    source: bestCandidate.source,
                    title: bestCandidate.title
                };
            } catch (_) {}
        }

        throw new Error(
            "ما لقيناش صورة مناسبة. اختار صورة من الحاسوب."
        );
    }

    // =========================================
    // SCENE DISPLAY
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

            Object.assign(card.style, {
                padding: "16px",
                marginBottom: "18px",
                border: "1px solid #444",
                borderRadius: "14px",
                background: "#171717",
                transition: "border-color .2s, background .2s"
            });

            const heading = document.createElement("h4");
            heading.textContent = `🎬 المشهد ${index + 1}`;

            const paragraph = document.createElement("p");
            paragraph.textContent = scene.text;

            const preview = document.createElement("div");
            preview.className = "scene-image-preview";

            Object.assign(preview.style, {
                width: "100%",
                maxWidth: "520px",
                minHeight: "180px",
                margin: "12px 0",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#222",
                border: "2px dashed #777",
                boxSizing: "border-box",
                transition: "all .2s"
            });

            if (scene.image && scene.imageURL) {
                const img = document.createElement("img");

                img.src = scene.imageURL;
                img.alt =
                    scene.imageTitle || `صورة المشهد ${index + 1}`;

                Object.assign(img.style, {
                    width: "100%",
                    display: "block",
                    aspectRatio: "16 / 9",
                    objectFit: "cover"
                });

                preview.appendChild(img);

                const imageName = document.createElement("small");

                imageName.textContent =
                    `${scene.imageType === "manual" ? "📁 صورة من PC: " : "🌐 صورة: "}${scene.imageTitle || "صورة مختارة"}`;

                Object.assign(imageName.style, {
                    display: "block",
                    padding: "10px",
                    color: "#d6b76b",
                    overflowWrap: "anywhere"
                });

                preview.appendChild(imageName);

                if (scene.imageSource) {
                    const sourceLink =
                        document.createElement("a");

                    sourceLink.href = scene.imageSource;
                    sourceLink.target = "_blank";
                    sourceLink.rel = "noopener noreferrer";
                    sourceLink.textContent = "عرض مصدر الصورة";

                    Object.assign(sourceLink.style, {
                        display: "block",
                        padding: "0 10px 10px",
                        color: "#aaa"
                    });

                    preview.appendChild(sourceLink);
                }

            } else {
                const message = document.createElement("div");

                message.textContent =
                    scene.imageError
                        ? `❌ ${scene.imageError}\n\n📁 جرّ صورة هنا أو اختارها من PC`
                        : "📁 جرّ الصورة من الحاسوب وحطها هنا";

                Object.assign(message.style, {
                    minHeight: "180px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    whiteSpace: "pre-line",
                    padding: "20px",
                    color: "#d6b76b",
                    boxSizing: "border-box"
                });

                preview.appendChild(message);
            }

            // DRAG & DROP EVENTS

            preview.addEventListener("dragenter", event => {
                event.preventDefault();

                preview.style.borderColor = "#d6b76b";
                preview.style.background = "#343024";
                card.style.borderColor = "#d6b76b";
            });

            preview.addEventListener("dragover", event => {
                event.preventDefault();

                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = "copy";
                }

                preview.style.borderColor = "#d6b76b";
            });

            preview.addEventListener("dragleave", event => {
                if (!preview.contains(event.relatedTarget)) {
                    preview.style.borderColor = "#777";
                    preview.style.background = "#222";
                    card.style.borderColor = "#444";
                }
            });

            preview.addEventListener("drop", event => {
                event.preventDefault();

                preview.style.borderColor = "#777";
                preview.style.background = "#222";
                card.style.borderColor = "#444";

                const files = Array.from(
                    event.dataTransfer?.files || []
                );

                const imageFile = files.find(file =>
                    file.type.startsWith("image/")
                );

                if (!imageFile) {
                    setStatus("⚠️ الملف اللي جرّيتي ماشي صورة.");
                    return;
                }

                setSceneImage(index, imageFile);
            });

            // FILE INPUT

            const fileInput = document.createElement("input");

            fileInput.type = "file";
            fileInput.accept = "image/*";
            fileInput.hidden = true;

            fileInput.addEventListener("change", () => {
                const file = fileInput.files?.[0];

                if (file) {
                    setSceneImage(index, file);
                }

                fileInput.value = "";
            });

            // BUTTONS

            const buttons = document.createElement("div");

            Object.assign(buttons.style, {
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                margin: "10px 0"
            });

            const chooseButton = document.createElement("button");

            chooseButton.type = "button";
            chooseButton.textContent = "📁 اختار صورة من PC";

            Object.assign(chooseButton.style, {
                padding: "10px 14px",
                border: "0",
                borderRadius: "8px",
                background: "#d6b76b",
                color: "#171717",
                cursor: "pointer",
                fontWeight: "bold"
            });

            chooseButton.addEventListener("click", () => {
                fileInput.click();
            });

            buttons.appendChild(chooseButton);

            if (scene.image) {
                const removeButton =
                    document.createElement("button");

                removeButton.type = "button";
                removeButton.textContent = "🗑️ حذف الصورة";

                Object.assign(removeButton.style, {
                    padding: "10px 14px",
                    border: "1px solid #b44",
                    borderRadius: "8px",
                    background: "#3a1717",
                    color: "#fff",
                    cursor: "pointer"
                });

                removeButton.addEventListener("click", () => {
                    removeSceneImage(index);
                });

                buttons.appendChild(removeButton);
            }

            const info = document.createElement("small");
            info.textContent = `${duration} ثوانٍ`;

            card.append(
                heading,
                paragraph,
                preview,
                fileInput,
                buttons,
                info
            );

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

        releaseAllSceneImages();
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
                const scene = scenes[i];

                setStatus(
                    `🔎 البحث عن صورة المشهد ${i + 1} من ${scenes.length}...`
                );

                try {
                    const result = await searchSceneImage(
                        scene.text
                    );

                    scene.image = result.image;
                    scene.imageURL = result.url;
                    scene.imageSource = result.source;
                    scene.imageTitle = result.title;
                    scene.imageType = "wikimedia";
                    scene.imageError = null;

                    successful++;

                } catch (error) {
                    console.error(`Scene ${i + 1}:`, error);

                    scene.imageError =
                        error.message ||
                        "تعذر العثور على صورة مناسبة.";
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
                    `✅ تم العثور على صور المشاهد كلها (${successful}).`
                );
            } else {
                setStatus(
                    `⚠️ تم العثور على ${successful} صورة من أصل ${scenes.length}. يمكنك إضافة الباقي من PC.`
                );
            }

        } catch (error) {
            console.error(error);
            setStatus("❌ حدث خطأ أثناء البحث عن الصور.");

        } finally {
            searching = false;

            generateButton.disabled = false;
            clearButton.disabled = false;

            updateExportButton();
        }
    });

    // =========================================
    // CLEAR PROJECT
    // =========================================

    clearButton.addEventListener("click", () => {
        if (exporting || searching) return;

        releaseAllSceneImages();
        scenes = [];

        scriptInput.value = "";

        clearDownload();
        renderScenes();
        setProgress(0);

        exportButton.disabled = true;

        setStatus("تم مسح السكريبت والمشاهد.");
    });

    if (durationInput) {
        durationInput.addEventListener("change", renderScenes);
    }

    // =========================================
    // TEXT WRAPPING
    // =========================================

    function wrapText(ctx, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];

        let line = "";

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;

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

        if (line) lines.push(line);

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

        ctx.strokeStyle = "#d6b76b";
        ctx.lineWidth = 4;
        ctx.strokeRect(25, 25, width - 50, height - 50);

        ctx.fillStyle = "#f1d28a";
        ctx.font = "bold 25px Arial";
        ctx.textAlign = "center";
        ctx.direction = "ltr";

        ctx.fillText(
            "AI VIDEO STUDIO PRO",
            width / 2,
            height * 0.12
        );

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
            setStatus("⚠️ قسم السكريبت إلى مشاهد أولاً.");
            return;
        }

        const missingIndex = scenes.findIndex(
            scene => !scene.image
        );

        if (missingIndex !== -1) {
            setStatus(
                `⚠️ المشهد ${missingIndex + 1} ما عندوش صورة. زيد ليه صورة من PC.`
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

            generateButton.disabled = false;
            clearButton.disabled = false;

            updateExportButton();
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

    exportButton.disabled = true;

    setStatus("واجد لكتابة السكريبت.");

    console.log(
        "AI VIDEO STUDIO PRO - TEXT TO VIDEO READY"
    );
});
