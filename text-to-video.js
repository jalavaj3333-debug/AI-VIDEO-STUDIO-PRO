
document.addEventListener("DOMContentLoaded", () => {
    const scriptInput = document.getElementById("videoScript");
    const generateButton = document.getElementById("generateScenes");
    const clearButton = document.getElementById("clearScript");
    const sceneList = document.getElementById("sceneList");
    const sceneCount = document.getElementById("sceneCount");
    const durationInput = document.getElementById("sceneDuration");
    const totalDuration = document.getElementById("sceneTotalDuration");
    const formatInput = document.getElementById("sceneFormat");
    const status = document.getElementById("textVideoStatus");

    if (!scriptInput || !generateButton || !sceneList) {
        console.error("Text to Video: بعض عناصر HTML غير موجودة.");
        return;
    }

    let scenes = [];

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }

    function renderScenes() {
        sceneList.innerHTML = "";

        if (scenes.length === 0) {
            sceneList.innerHTML = `
                <div class="scene-empty">
                    <span>🎞️</span>
                    <p>كتب السكريبت واضغط على تقسيم النص إلى مشاهد.</p>
                </div>`;
            sceneCount.textContent = "0 مشهد";
            totalDuration.textContent = "00:00";
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

        sceneCount.textContent = `${scenes.length} مشهد`;

        const seconds = scenes.length * Number(durationInput.value);
        totalDuration.textContent = formatTime(seconds);
    }

    generateButton.addEventListener("click", () => {
        const text = scriptInput.value.trim();

        if (!text) {
            status.textContent = "⚠️ كتب السكريبت أولاً.";
            scriptInput.focus();
            return;
        }

        // تقسيم النص حسب الفقرات أو الجمل
        scenes = text
            .split(/\n+|(?<=[.!؟?])\s+/)
            .map(part => part.trim())
            .filter(part => part.length > 0);

        if (scenes.length === 0) {
            status.textContent = "ما قدرناش نلقاو مشاهد في النص.";
            return;
        }

        renderScenes();

        const format = formatInput ? formatInput.value : "16:9";

        status.textContent =
            `✅ تم إنشاء ${scenes.length} مشهد. شكل الفيديو: ${format}.`;
    });

    clearButton.addEventListener("click", () => {
        scriptInput.value = "";
        scenes = [];
        renderScenes();
        status.textContent = "تم مسح السكريبت والمشاهد.";
    });

    durationInput.addEventListener("change", () => {
        renderScenes();
    });

    // التصدير غير مربوط بمحرك الفيديو في هذه المرحلة
    const exportButton = document.getElementById("exportTextVideo");

    if (exportButton) {
        exportButton.addEventListener("click", () => {
            if (scenes.length === 0) {
                status.textContent = "⚠️ خاصك تقسّم السكريبت إلى مشاهد أولاً.";
                return;
            }

            status.textContent =
                "المشاهد واجدة. خاصنا نربطوها بمحرك FFmpeg قبل تصدير الفيديو.";
        });
    }

    renderScenes();
});
