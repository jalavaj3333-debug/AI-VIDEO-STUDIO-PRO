
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // =====================================
    // ELEMENTS
    // =====================================

    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menuToggle");

    const mediaInput = document.getElementById("mediaInput");
    const uploadArea = document.getElementById("uploadArea");
    const chooseMedia = document.getElementById("chooseMedia");

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

    function showView(viewId, updateHash = true) {
        // Support home alias
        if (viewId === "home") {
            viewId = "create";
        }

        // Smart montage is inside the editor
        if (viewId === "smart-montage") {
            viewId = "editor";
        }

        const target = document.getElementById(viewId);

        if (!target || !viewIds.includes(viewId)) {
            console.warn("Dashboard section not found:", viewId);
            return;
        }

        views.forEach(view => {
            view.classList.toggle(
                "studio-view-hidden",
                view.id !== viewId
            );
        });

        if (hero) {
            hero.classList.toggle(
                "studio-view-hidden",
                viewId !== "create"
            );
        }

        document.querySelectorAll(".menu-item").forEach(link => {
            const linkTarget = (link.getAttribute("href") || "")
                .replace("#", "");

            const activeTarget =
                viewId === "create" ? "home" : viewId;

            link.classList.toggle(
                "active",
                linkTarget === activeTarget
            );
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

    // Sidebar links
    document.querySelectorAll(".menu-item").forEach(link => {
        link.addEventListener("click", event => {
            const href = link.getAttribute("href");

            if (!href || !href.startsWith("#")) return;

            event.preventDefault();
            showView(href.substring(1));
        });
    });

    // Internal links and tool-card links
    document.addEventListener("click", event => {
        const link = event.target.closest('a[href^="#"]');

        if (!link || link.classList.contains("menu-item")) return;

        const id = link.getAttribute("href").substring(1);

        if (
            viewIds.includes(id) ||
            id === "home" ||
            id === "smart-montage"
        ) {
            event.preventDefault();
            showView(id);
        }
    });

    // Initial view
    const initialHash = window.location.hash.replace("#", "");

    showView(
        initialHash || "home",
        false
    );

    // Browser back / forward
    window.addEventListener("popstate", () => {
        const id = window.location.hash.replace("#", "");
        showView(id || "home", false);
    });

    // Mobile sidebar
    menuToggle?.addEventListener("click", () => {
        sidebar?.classList.toggle("open");
    });

    // Close sidebar after clicking outside
    document.addEventListener("click", event => {
        if (
            sidebar &&
            menuToggle &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });

    // =====================================
    // TOOL BUTTONS
    // =====================================

    const toolDestinations = {
        text: "text-to-video",
        editor: "editor",
        audio: "audio",
        voice: "audio",
        music: "audio",
        trim: "trim-editor",
        merge: "mergeStudio",
        montage: "editor"
    };

    document.querySelectorAll("[data-tool]").forEach(button => {
        button.addEventListener("click", () => {
            const tool = button.dataset.tool;
            const destination = toolDestinations[tool];

            if (destination) {
                showView(destination);
                return;
            }

            if (tool === "image") {
                alert("أداة تحريك الصور ما زالت قيد التطوير.");
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

    chooseMedia?.addEventListener("click", () => {
        mediaInput?.click();
    });

    mediaInput?.addEventListener("change", event => {
        addFiles(Array.from(event.target.files || []));
        mediaInput.value = "";
    });

    document.getElementById("addMoreClips")
        ?.addEventListener("click", () => {
            mediaInput?.click();
        });

    function addFiles(files) {
        const validFiles = files.filter(file =>
            file.type.startsWith("video/") ||
            file.type.startsWith("image/")
        );

        if (!validFiles.length) {
            alert("اختار صورة أو فيديو صالح.");
            return;
        }

        validFiles.forEach(file => {
            addFileToLibrary(file);

            if (file.type.startsWith("video/")) {
                const clip = {
                    id: createId(),
                    file,
                    url: URL.createObjectURL(file),
                    duration: 0
                };

                clips.push(clip);
                readDuration(clip);

            } else {
                showImage(file);
            }
        });

        if (clips.length && selectedId === null) {
            selectClip(clips[0].id);
        }

        renderTimeline();
    }

    function createId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return window.crypto.randomUUID();
        }

        return String(Date.now()) +
            String(Math.random()).slice(2);
    }

    function addFileToLibrary(file) {
        if (!fileList) return;

        const empty = fileList.querySelector(".empty-message");
        empty?.remove();

        const item = document.createElement("div");
        item.className = "media-file-item";

        const name = document.createElement("span");
        name.textContent = "✓ " + file.name;

        const type = document.createElement("small");
        type.textContent = file.type.startsWith("video/")
            ? "VIDEO"
            : "IMAGE";

        item.append(name, type);
        fileList.appendChild(item);
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

        if (mediaInfo) {
            mediaInfo.textContent = file.name;
        }

        if (playBtn) {
            playBtn.textContent = "▧ صورة";
        }
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

        if (mediaInfo) {
            mediaInfo.textContent = clip.file.name;
        }

        if (playBtn) {
            playBtn.textContent = "▶ تشغيل";
        }

        previewVideo.addEventListener("ended", playNextClip);

        if (autoplay) {
            previewVideo.play().then(() => {
                if (playBtn) {
                    playBtn.textContent = "❚❚ إيقاف";
                }
            }).catch(() => {
                if (playBtn) {
                    playBtn.textContent = "▶ تشغيل";
                }
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
            clipCounter.textContent = clips.length;
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

        if (
            index < 0 ||
            newIndex < 0 ||
            newIndex >= clips.length
        ) {
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
                resetPreview();
            }
        }

        renderTimeline();
    }

    // =====================================
    // RESET PREVIEW
    // =====================================

    function resetPreview() {
        stopPreview();

        if (previewScreen) {
            previewScreen.innerHTML =
                '<div class="preview-placeholder"><span>▶</span><p>اختار ملف باش تشوف المعاينة</p></div>';
        }

        if (mediaInfo) {
            mediaInfo.textContent = "لا يوجد ملف محدد";
        }

        if (playBtn) {
            playBtn.textContent = "▶ تشغيل / إيقاف";
        }
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

            clips.forEach(clip => URL.revokeObjectURL(clip.url));

            clips = [];
            selectedId = null;

            if (fileList) {
                fileList.innerHTML =
                    '<p class="empty-message">مازال ما ضفتي حتى ملف.</p>';
            }

            resetPreview();
            renderTimeline();
        });

    // =====================================
    // FORMAT TIME
    // =====================================

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return "00:00";
        }

        const minutes = Math.floor(seconds / 60);
        const remaining = Math.floor(seconds % 60);

        return String(minutes).padStart(2, "0") +
            ":" +
            String(remaining).padStart(2, "0");
    }

    // =====================================
    // DRAG AND DROP
    // =====================================

    uploadArea?.addEventListener("dragover", event => {
        event.preventDefault();
        uploadArea.classList.add("drag-active");
    });

    uploadArea?.addEventListener("dragleave", () => {
        uploadArea.classList.remove("drag-active");
    });

    uploadArea?.addEventListener("drop", event => {
        event.preventDefault();
        uploadArea.classList.remove("drag-active");

        addFiles(Array.from(event.dataTransfer.files || []));
    });

    // =====================================
    // INITIALIZE
    // =====================================

    renderTimeline();

    console.log("AI VIDEO STUDIO PRO EDITOR READY!");
    console.log("DASHBOARD NAVIGATION READY!");
    console.log("TIMELINE READY!");

});
