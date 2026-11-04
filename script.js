
/* =====================================
   AI VIDEO STUDIO PRO
   JAVASCRIPT ENGINE
===================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ELEMENTS
    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menuToggle");

    const mediaInput = document.getElementById("mediaInput");
    const uploadArea = document.getElementById("uploadArea");

    const previewScreen = document.getElementById("previewScreen");
    const fileList = document.getElementById("fileList");

    const mediaInfo = document.getElementById("mediaInfo");
    const playBtn = document.getElementById("playBtn");

    let selectedFile = null;
    let mediaElement = null;
    let objectURL = null;

    // MOBILE MENU
    if (menuToggle && sidebar) {

        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });

    }

    // CLOSE MENU AFTER CLICKING A LINK
    document.querySelectorAll(".menu-item").forEach(link => {

        link.addEventListener("click", () => {

            document.querySelectorAll(".menu-item").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");

            if (window.innerWidth <= 768) {
                sidebar.classList.remove("open");
            }

        });

    });

    // FILE UPLOAD
    if (mediaInput) {

        mediaInput.addEventListener("change", event => {

            const files = Array.from(event.target.files || []);

            if (files.length === 0) return;

            displayFiles(files);

        });

    }

    // DISPLAY FILES
    function displayFiles(files) {

        fileList.innerHTML = "";

        const validFiles = files.filter(file => {

            return file.type.startsWith("image/") ||
                   file.type.startsWith("video/");

        });

        if (validFiles.length === 0) {

            fileList.textContent = "المرجو اختيار صور أو فيديوهات صالحة.";

            return;
        }

        validFiles.forEach(file => {

            const fileItem = document.createElement("div");

            fileItem.textContent =
                "✓ " + file.name + " (" + formatSize(file.size) + ")";

            fileList.appendChild(fileItem);

        });

        // SELECT FIRST FILE FOR PREVIEW
        selectMedia(validFiles[0]);

    }

    // SELECT MEDIA
    function selectMedia(file) {

        selectedFile = file;

        // RELEASE OLD OBJECT URL
        if (objectURL) {
            URL.revokeObjectURL(objectURL);
        }

        objectURL = URL.createObjectURL(file);

        previewScreen.innerHTML = "";

        if (file.type.startsWith("video/")) {

            mediaElement = document.createElement("video");

            mediaElement.src = objectURL;
            mediaElement.controls = true;
            mediaElement.preload = "metadata";
            mediaElement.playsInline = true;

            previewScreen.appendChild(mediaElement);

            playBtn.textContent = "▶ تشغيل";

        } else if (file.type.startsWith("image/")) {

            mediaElement = document.createElement("img");

            mediaElement.src = objectURL;
            mediaElement.alt = "معاينة الصورة";

            previewScreen.appendChild(mediaElement);

            playBtn.textContent = "▧ صورة";

        }

        mediaInfo.textContent = file.name;

    }

    // PLAY / PAUSE
    if (playBtn) {

        playBtn.addEventListener("click", () => {

            if (!selectedFile || !mediaElement) {

                alert("اختار صورة أو فيديو أولاً.");

                return;
            }

            if (selectedFile.type.startsWith("image/")) {

                alert("هاد الملف صورة، ماشي فيديو.");

                return;
            }

            if (mediaElement.paused) {

                mediaElement.play().then(() => {

                    playBtn.textContent = "❚❚ إيقاف";

                }).catch(() => {

                    alert("تعذر تشغيل الفيديو.");

                });

            } else {

                mediaElement.pause();

                playBtn.textContent = "▶ تشغيل";

            }

        });

    }

    // UPDATE PLAY BUTTON WHEN VIDEO ENDS
    previewScreen.addEventListener("ended", () => {

        playBtn.textContent = "▶ تشغيل";

    }, true);

    // FILE SIZE FORMAT
    function formatSize(bytes) {

        if (bytes < 1024) {
            return bytes + " B";
        }

        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + " KB";
        }

        return (bytes / (1024 * 1024)).toFixed(2) + " MB";

    }

    // DRAG AND DROP
    if (uploadArea) {

        uploadArea.addEventListener("dragover", event => {

            event.preventDefault();

            uploadArea.style.borderColor = "#f4d58a";

        });

        uploadArea.addEventListener("dragleave", () => {

            uploadArea.style.borderColor = "";

        });

        uploadArea.addEventListener("drop", event => {

            event.preventDefault();

            uploadArea.style.borderColor = "";

            const files = Array.from(event.dataTransfer.files || []);

            if (files.length > 0) {
                displayFiles(files);
            }

        });

    }

    // TOOL BUTTONS
    document.querySelectorAll(".tool-btn").forEach(button => {

        button.addEventListener("click", () => {

            const tool = button.dataset.tool;

            openTool(tool);

        });

    });

    // TOOL SYSTEM
    function openTool(tool) {

        const messages = {

            text: "أداة تحويل النص إلى فيديو: سيتم تجهيز محرر السكريبت وربطه بخدمة توليد الفيديو.",

            image: "أداة تحويل الصور إلى فيديو: سيتم تجهيز مساحة رفع الصور وتحريكها.",

            editor: "استوديو المونتاج: سيتم تطوير أدوات القص والترتيب والانتقالات.",

            audio: "استوديو الصوت: سيتم تجهيز أدوات الصوت والموسيقى.",

            voice: "التعليق الصوتي: سيتم تجهيز أداة تحويل النص إلى صوت.",

            music: "الموسيقى: سيتم تجهيز مساحة إضافة وإدارة الملفات الصوتية."

        };

        alert(messages[tool] || "الأداة قيد التطوير.");

    }

    // SMOOTH SCROLL
    document.querySelectorAll('a[href^="#"]').forEach(link => {

        link.addEventListener("click", event => {

            const target = document.querySelector(link.getAttribute("href"));

            if (target) {

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

        });

    });

    console.log("AI VIDEO STUDIO PRO READY!");

});
