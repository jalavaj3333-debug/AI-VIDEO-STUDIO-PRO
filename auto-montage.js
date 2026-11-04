
/* =================================
   SMART AUTO MONTAGE ENGINE
   AI VIDEO STUDIO PRO
================================= */

const montageButton = document.getElementById("smartAutoMontage");
const montageStatus = document.getElementById("autoMontageStatus");
const montageProgress = document.getElementById("autoMontageProgress");
const montageDownload = document.getElementById("autoMontageDownload");

let montageBusy = false;
let montageURL = null;

function montageMessage(message) {
    montageStatus.textContent = message;
}

function montagePercent(value) {
    montageProgress.style.width = value + "%";
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForFFmpeg() {
    if (window.videoFFmpegLoaded && window.videoFFmpeg) {
        return window.videoFFmpeg;
    }

    montageMessage("جاري تحميل محرك المونتاج...");

    const loadButton = document.getElementById("loadFFmpeg");

    if (loadButton && !loadButton.disabled) {
        loadButton.click();
    }

    for (let i = 0; i < 360; i++) {
        if (window.videoFFmpegLoaded && window.videoFFmpeg) {
            return window.videoFFmpeg;
        }

        await wait(1000);
    }

    throw new Error("تعذر تحميل FFmpeg. حاول تحميل المحرك يدوياً.");
}

function getSafeExtension(file) {
    const ext = file.name.split(".").pop().toLowerCase();

    return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "mp4";
}

if (montageButton) {
    montageButton.addEventListener("click", async () => {

        if (montageBusy) return;

        const clips = window.getStudioClips?.() || [];

        if (clips.length < 2) {
            montageMessage("خاصك ترفع جوج فيديوهات على الأقل.");
            return;
        }

        montageBusy = true;
        montageButton.disabled = true;
        montageDownload.hidden = true;
        montagePercent(0);

        const engineFiles = [];

        try {
            montageMessage("جاري تجهيز محرك المونتاج...");

            const engine = await waitForFFmpeg();

            montagePercent(10);

            const inputNames = [];

            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i];

                if (!clip.file.type.startsWith("video/")) {
                    continue;
                }

                const name = `auto_clip_${i}.${getSafeExtension(clip.file)}`;

                await engine.writeFile(
                    name,
                    new Uint8Array(await clip.file.arrayBuffer())
                );

                inputNames.push(name);
                engineFiles.push(name);

                montagePercent(
                    10 + Math.round((i + 1) / clips.length * 25)
                );
            }

            if (inputNames.length < 2) {
                throw new Error("خاصك جوج فيديوهات صالحين على الأقل.");
            }

            montageMessage("جاري تحليل وتجهيز المقاطع...");

            const command = [];
            const filters = [];
            const videoLabels = [];

            inputNames.forEach((name, index) => {
                command.push("-i", name);

                filters.push(
                    `[${index}:v:0]` +
                    `setpts=PTS-STARTPTS,` +
                    `scale=1280:720:force_original_aspect_ratio=decrease,` +
                    `pad=1280:720:(ow-iw)/2:(oh-ih)/2,` +
                    `setsar=1,fps=30,format=yuv420p[v${index}]`
                );

                videoLabels.push(`[v${index}]`);
            });

            filters.push(
                `${videoLabels.join("")}` +
                `concat=n=${inputNames.length}:v=1:a=0[vout]`
            );

            const outputName = "SMART_AUTO_MONTAGE.mp4";
            engineFiles.push(outputName);

            command.push(
                "-filter_complex",
                filters.join(";"),
                "-map",
                "[vout]",
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "23",
                "-movflags",
                "+faststart",
                outputName
            );

            montagePercent(40);
            montageMessage("جاري تركيب الفيديوهات... المرجو الانتظار.");

            const result = await engine.exec(command);

            if (result !== 0) {
                throw new Error("وقع مشكل أثناء تركيب المقاطع.");
            }

            montagePercent(85);
            montageMessage("جاري تجهيز الفيديو النهائي...");

            const data = await engine.readFile(outputName);

            const blob = new Blob(
                [data],
                { type: "video/mp4" }
            );

            if (montageURL) {
                URL.revokeObjectURL(montageURL);
            }

            montageURL = URL.createObjectURL(blob);

            montageDownload.href = montageURL;
            montageDownload.hidden = false;

            montagePercent(100);

            montageMessage(
                "تم تركيب الفيديو بنجاح! اضغط على تحميل الفيديو النهائي."
            );

        } catch (error) {
            console.error("Smart Montage Error:", error);

            montageMessage("خطأ: " + error.message);
            montagePercent(0);

        } finally {
            const engine = window.videoFFmpeg;

            if (engine) {
                for (const file of engineFiles) {
                    try {
                        await engine.deleteFile(file);
                    } catch (error) {
                        // Ignore missing files.
                    }
                }
            }

            montageButton.disabled = false;
            montageBusy = false;
        }
    });
}
