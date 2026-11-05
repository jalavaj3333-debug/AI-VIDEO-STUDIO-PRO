
document.addEventListener("DOMContentLoaded", () => {
    // =====================================
    // ELEMENTS
    // =====================================

    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menuToggle");

    const mediaInput = document.getElementById("mediaInput");
    const previewScreen = document.getElementById("previewScreen");
    const fileList = document.getElementById("fileList");
    const mediaInfo = document.getElementById("mediaInfo");
    const playBtn = document.getElementById("playBtn");

    const timelineTracks = document.getElementById("timelineTracks");
    const clipCounter = document.getElementById("clipCounter");
    const totalDuration = document.getElementById("totalDuration");

    // =====================================
    // DASHBOARD NAVIGATION
    // =====================================

    const viewIds = [
        "create",
        "text-to-video",
        "editor",
        "trim-editor",
        "mergeStudio",
        "audio",
        "projects"
    ];

    const views = viewIds
        .map(id => document.getElementById(id))
        .filter(Boolean);

    const hero = document.querySelector(".hero");
    const toolsGrid = document.querySelector(".tools-grid");

    function showView(viewId, updateHash = true) {
        const target = document.getElementById(viewId);

        // Hide all dashboard sections
        views.forEach(view => {
            view.classList.toggle("studio-view-hidden", view.id !== viewId);
        });

        // The home dashboard may use separate hero/tool elements
        const isHome = viewId === "create";

        if (hero) {
            hero.classList.toggle("studio-view-hidden", !isHome);
        }

        if (toolsGrid) {
            toolsGrid.classList.toggle("studio-view-hidden", !isHome);
        }

        // If the requested section doesn't exist, show a clear message
        if (!target && !isHome) {
            console.warn("Dashboard section not found:", viewId);
            return;
        }

        // Update sidebar active state
        document.querySelectorAll(".menu-item").forEach(link => {
            const linkTarget = (link.getAttribute("href") || "").replace("#", "");
            link.classList.toggle("active", linkTarget === viewId);
        });

        sidebar?.classList.remove("open");

        if (updateHash) {
            history.replaceState(null, "", "#" + viewId);
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // Sidebar navigation
    document.querySelectorAll(".menu-item").forEach(link => {
        link.addEventListener("click", event => {
            const href = link.getAttribute("href");

            if (!href || !href.startsWith("#")) return;

            const viewId = href.substring(1);

            if (viewIds.includes(viewId)) {
                event.preventDefault();
                showView(viewId);
            }

        });
    });

    // Open the correct section when the page loads with a hash
    const initialView = window.location.hash.replace("#", "");
    showView(viewIds.includes(initialView) ? initialView : "create", false);

    // Mobile menu
    menuToggle?.addEventListener("click", () => {
        sidebar?.classList.toggle("open");
    });

    // =====================================
    // TOOL CARDS NAVIGATION
    // =====================================

    const toolDestinations = {
        text: "text-to-video",
        editor: "editor",
        audio: "audio"
    };

    document.querySelectorAll(".tool-btn[data-tool]").forEach(button => {
        button.addEventListener("click", () => {
            const tool = button.dataset.tool;
            const destination = toolDestinations[tool];

            if (destination) {
                showView(destination);
                return;
            }

            if (tool === "image") {
                alert("أداة تحريك الصور ما زالت قيد التطوير.");
            } else if (tool === "voice" || tool === "music") {
                showView("audio");
            }
        });
    });

    // =====================================
    // TIMELINE DATA
    // =====================================

    let clips = [];
    let selectedId = null;
    let previewURL = null;
    let previewVideo = null;

    window.getStudioClips = function () {
        return clips.map(clip => ({
            id: clip.id,
            file: clip.file,
            url: clip.url,
            duration: clip.duration
        }));
    };

    // =====================================
    // FILE UPLOAD
    // =====================================

    mediaInput?.addEventListener("change", event => {
        addFiles(Array.from(event.target.files || []));
        mediaInput.value = "";
    });

    document.getElementById("addMoreClips")
        ?.addEventListener("click", () => mediaInput?.click());

    function addFiles(files) {
        const validFiles = files.filter(file =>
            file.type.startsWith("video/") ||
            file.type.startsWith("image/")
        );

        if (!validFiles.length) {
            alert("اختار صورة أو فيديو صالح.");
            return;
        }

        if (fileList) {
            fileList.innerHTML = "";
        }

        validFiles.forEach(file => {
            if (fileList) {
                const item = document.createElement("div");
                item.textContent = "✓ " + file.name;
                fileList.appendChild(item);
            }

            if (file.type.startsWith("video/")) {
                const clip = {
                    id: crypto.randomUUID
                        ? crypto.randomUUID()
                        : String(Date.now() + Math.random()),
                    file,
                    url: URL.createObjectURL(file),
                    duration: 0
                };

                clips.push(clip);
                readDuration(clip);

            } else if (!clips.length) {
                showImage(file);
            }
        });

        if (clips.length && selectedId === null) {
            selectClip(clips[0].id);
        }

        renderTimeline();
    }

    // =====================================
    // READ VIDEO DURATION
    // =====================================

    function readDuration(clip) {
        const video = document.createElement("video");

        video.preload = "metadata";
        video.src = clip.url;

        video.addEventListener("loadedmetadata", () => {
            clip.duration = Number.isFinite(video.duration)
                ? video.duration
                : 0;

            renderTimeline();

            video.removeAttribute("src");
            video.load();
        }, { once: true });

        video.addEventListener("error", () => {
            renderTimeline();
        }, { once: true });
    }

    // =====================================
    // IMAGE PREVIEW
    // =====================================

    function showImage(file) {
        stopPreview();

        previewURL = URL.createObjectURL(file);

        const img = document.createElement("img");
        img.src = previewURL;
        img.alt = "Image preview";

        if (previewScreen) {
            previewScreen.innerHTML = "";
            previewScreen.appendChild(img);
        }

        if (mediaInfo) mediaInfo.textContent = file.name;
        if (playBtn) playBtn.textContent = "▧ صورة";
    }

    // =====================================
    // STOP PREVIEW
    // =====================================

    function stopPreview() {
        if (previewVideo) {
            previewVideo.pause();
            previewVideo.onended = null;
            previewVideo = null;
        }

        if (previewURL) {
            URL.revokeObjectURL(previewURL);
            previewURL = null;
        }
    }

    // =====================================
    // SELECT CLIP
    // =====================================

    function selectClip(id, autoplay = false) {
        const clip = clips.find(item => item.id === id);

        if (!clip || !previewScreen) return;

        selectedId = id;

        stopPreview();
        previewScreen.innerHTML = "";

        previewVideo = document.createElement("video");
        previewVideo.src = clip.url;
        previewVideo.controls = true;
        previewVideo.preload = "metadata";
        previewVideo.playsInline = true;

        previewScreen.appendChild(previewVideo);

        if (mediaInfo) mediaInfo.textContent = clip.file.name;
        if (playBtn) playBtn.textContent = "▶ تشغيل";

        previewVideo.addEventListener("ended", playNextClip);

        if (autoplay) {
            previewVideo.play().catch(() => {
                if (playBtn) playBtn.textContent = "▶ تشغيل";
            });
        }

        renderTimeline();
    }

    // =====================================
    // PLAY NEXT CLIP
    // =====================================

    function playNextClip() {
        const index = clips.findIndex(item => item.id === selectedId);

        if (index >= 0 && index < clips.length - 1) {
            selectClip(clips[index + 1].id, true);
        } else if (playBtn) {
            playBtn.textContent = "▶ تشغيل";
        }
    }

    // =====================================
    // PLAY / PAUSE
    // =====================================

    playBtn?.addEventListener("click", () => {
        if (!previewVideo) {
            alert("اختار فيديو من Timeline أولاً.");
            return;
        }

        if (previewVideo.paused) {
            previewVideo.play().then(() => {
                playBtn.textContent = "❚❚ إيقاف";
            }).catch(() => {
                alert("تعذر تشغيل الفيديو.");
            });
        } else {
            previewVideo.pause();
            playBtn.textContent = "▶ تشغيل";
        }
    });

    // =====================================
    // TIMELINE RENDER
    // =====================================

    function renderTimeline() {
        if (!timelineTracks) return;

        timelineTracks.innerHTML = "";

        if (!clips.length) {
            timelineTracks.innerHTML =
                '<p class="timeline-empty">أضف فيديوهات لبدء المونتاج.</p>';
        }

        clips.forEach((clip, index) => {
            const item = document.createElement("div");

            item.className = "clip-item" +
                (clip.id === selectedId ? " selected" : "");

            const number = document.createElement("span");
            number.className = "clip-number";
            number.textContent = index + 1;

            const details = document.createElement("div");
            details.className = "clip-details";

            const name = document.createElement("strong");
            name.textContent = clip.file.name;

            const duration = document.createElement("small");
            duration.textContent =
                "مدة الفيديو: " + formatTime(clip.duration);

            details.append(name, duration);

            const actions = document.createElement("div");
            actions.className = "clip-actions";

            actions.append(
                makeButton("معاينة", "select", clip.id),
                makeButton("↑", "up", clip.id),
                makeButton("↓", "down", clip.id),
                makeButton("حذف", "delete", clip.id)
            );

            item.append(number, details, actions);

            item.addEventListener("click", event => {
                if (!event.target.closest("button")) {
                    selectClip(clip.id);
                }
            });

            timelineTracks.appendChild(item);
        });

        if (clipCounter) {
            clipCounter.textContent = clips.length + " مقطع";
        }

        const total = clips.reduce(
            (sum, clip) => sum + clip.duration,
            0
        );

        if (totalDuration) {
            totalDuration.textContent = formatTime(total);
        }
    }

    // =====================================
    // TIMELINE BUTTONS
    // =====================================

    function makeButton(label, action, id) {
        const button = document.createElement("button");

        button.textContent = label;
        button.type = "button";

        button.addEventListener("click", event => {
            event.stopPropagation();

            if (action === "select") selectClip(id);
            if (action === "up") moveClip(id, -1);
            if (action === "down") moveClip(id, 1);
            if (action === "delete") deleteClip(id);
        });

        return button;
    }

    // =====================================
    // MOVE CLIP
    // =====================================

    function moveClip(id, direction) {
        const index = clips.findIndex(item => item.id === id);
        const newIndex = index + direction;

        if (index < 0 || newIndex < 0 || newIndex >= clips.length) {
            return;
        }

        [clips[index], clips[newIndex]] =
            [clips[newIndex], clips[index]];

        renderTimeline();
    }

    // =====================================
    // DELETE CLIP
    // =====================================

    function deleteClip(id) {
        const index = clips.findIndex(item => item.id === id);

        if (index < 0) return;

        URL.revokeObjectURL(clips[index].url);

        const wasSelected = selectedId === id;
        clips.splice(index, 1);

        if (wasSelected) {
            stopPreview();
            selectedId = null;

            if (clips.length) {
                selectClip(
                    clips[Math.min(index, clips.length - 1)].id
                );
            } else {
                if (previewScreen) {
                    previewScreen.innerHTML =
                        '<span class="play-icon">▶</span><p>معاينة الفيديو</p>';
                }

                if (mediaInfo) mediaInfo.textContent = "لا يوجد ملف محدد";
                if (playBtn) playBtn.textContent = "▶ تشغيل";
            }
        }

        renderTimeline();
    }

    // =====================================
    // CLEAR TIMELINE
    // =====================================

    document.getElementById("clearTimeline")
        ?.addEventListener("click", () => {
            if (!clips.length) return;

            if (!confirm("واش متأكد بغيتي تحذف جميع المقاطع؟")) {
                return;
            }

            stopPreview();

            clips.forEach(clip => URL.revokeObjectURL(clip.url));

            clips = [];
            selectedId = null;

            if (fileList) fileList.innerHTML = "";

            if (previewScreen) {
                previewScreen.innerHTML =
                    '<span class="play-icon">▶</span><p>معاينة الفيديو</p>';
            }

            if (mediaInfo) mediaInfo.textContent = "لا يوجد ملف محدد";
            if (playBtn) playBtn.textContent = "▶ تشغيل";

            renderTimeline();
        });

    // =====================================
    // FORMAT TIME
    // =====================================

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return "00:00";

        const minutes = Math.floor(seconds / 60);
        const remaining = Math.floor(seconds % 60);

        return String(minutes).padStart(2, "0") +
            ":" +
            String(remaining).padStart(2, "0");
    }

    // =====================================
    // DRAG AND DROP
    // =====================================

    const uploadArea = document.getElementById("uploadArea");

    uploadArea?.addEventListener("dragover", event => {
        event.preventDefault();
        uploadArea.style.borderColor = "#f4d58a";
    });

    uploadArea?.addEventListener("dragleave", () => {
        uploadArea.style.borderColor = "";
    });

    uploadArea?.addEventListener("drop", event => {
        event.preventDefault();
        uploadArea.style.borderColor = "";

        addFiles(Array.from(event.dataTransfer.files || []));
    });

    // =====================================
    // INITIALIZE
    // =====================================

    renderTimeline();

    console.log("AI VIDEO STUDIO PRO EDITOR READY!");
    console.log("DASHBOARD NAVIGATION READY!");
    console.log("AUTO MONTAGE CONNECTION READY!");
});
