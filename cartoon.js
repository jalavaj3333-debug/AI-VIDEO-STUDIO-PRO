const canvas = document.getElementById("cartoonCanvas");
const ctx = canvas.getContext("2d");

const statusBox = document.getElementById("status");

let animationId = null;
let recording = false;
let recorder = null;
let recordedChunks = [];
let startTime = 0;
let animationDuration = 8;

const characterName = document.getElementById("characterName");
const characterColor = document.getElementById("characterColor");
const backgroundSelect = document.getElementById("background");
const dialogue = document.getElementById("dialogue");

function drawBackground() {
  const type = backgroundSelect.value;

  const backgrounds = {
    sky: ["#62b9ed", "#d8f2ff"],
    forest: ["#063c32", "#70a65c"],
    night: ["#080d30", "#333c70"],
    desert: ["#d58c3c", "#f5d18b"]
  };

  const colors = backgrounds[type];
  const gradient = ctx.createLinearGradient(0, 0, 0, 540);

  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 540);

  if (type === "night") {
    ctx.fillStyle = "#fff4c2";

    for (let i = 0; i < 45; i++) {
      const x = (i * 173) % 950;
      const y = (i * 83) % 260;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (type === "forest") {
    for (let i = 0; i < 8; i++) {
      const x = i * 140 + 30;

      ctx.fillStyle = "#563a22";
      ctx.fillRect(x, 300, 25, 180);

      ctx.fillStyle = "#145b36";
      ctx.beginPath();
      ctx.arc(x + 12, 290, 65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (type === "desert") {
    ctx.fillStyle = "#b97735";
    ctx.beginPath();
    ctx.ellipse(250, 480, 380, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(800, 490, 350, 110, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (type === "sky") {
    ctx.fillStyle = "rgba(255,255,255,.75)";

    [150, 700].forEach((x, index) => {
      const y = index === 0 ? 110 : 170;

      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.arc(x + 30, y - 10, 30, 0, Math.PI * 2);
      ctx.arc(x + 60, y, 22, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawCharacter(time = 0) {
  const color = characterColor.value;

  const bounce = Math.sin(time / 250) * 12;
  const x = 480;
  const y = 340 + bounce;

  // الجسم
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 65, y - 5, 130, 125, 35);
  ctx.fill();

  // الرأس
  ctx.fillStyle = "#ffcf9f";
  ctx.beginPath();
  ctx.arc(x, y - 95, 65, 0, Math.PI * 2);
  ctx.fill();

  // الشعر
  ctx.fillStyle = "#252020";
  ctx.beginPath();
  ctx.arc(x, y - 130, 55, Math.PI, 0);
  ctx.fill();

  // العينان
  ctx.fillStyle = "#171717";

  ctx.beginPath();
  ctx.arc(x - 23, y - 100, 6, 0, Math.PI * 2);
  ctx.arc(x + 23, y - 100, 6, 0, Math.PI * 2);
  ctx.fill();

  // الفم
  ctx.strokeStyle = "#8a352c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y - 77, 15, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // الاسم
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText(characterName.value || "Hero", x, y + 155);

  // الحوار
  const message = dialogue.value || "";

  if (message) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(235, 35, 490, 75, 18);
    ctx.fill();

    ctx.fillStyle = "#171717";
    ctx.font = "bold 23px Arial";
    ctx.fillText(message.slice(0, 45), 480, 80);
  }
}

function render(time = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawCharacter(time);
}

function animate() {
  render(performance.now());
  animationId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  render();
}

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    const is2D = button.dataset.mode === "2d";

    document.getElementById("studio2d").classList.toggle("hidden", !is2D);
    document.getElementById("studio3d").classList.toggle("hidden", is2D);

    if (!is2D) {
      init3D();
    }
  });
});

document.getElementById("previewBtn").addEventListener("click", () => {
  stopAnimation();
  animate();
  statusBox.textContent = "المعاينة شغالة...";
});

document.getElementById("stopBtn").addEventListener("click", () => {
  stopAnimation();
  statusBox.textContent = "تم إيقاف الحركة.";
});

[
  characterName,
  characterColor,
  backgroundSelect,
  dialogue
].forEach(input => {
  input.addEventListener("input", () => render());
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  if (!canvas.captureStream || !window.MediaRecorder) {
    statusBox.textContent = "المتصفح لا يدعم تسجيل الفيديو.";
    return;
  }

  if (recording) return;

  animationDuration = Math.min(
    30,
    Math.max(3, Number(document.getElementById("duration").value) || 8)
  );

  recordedChunks = [];
  recording = true;

  const stream = canvas.captureStream(30);

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch (error) {
    recording = false;
    statusBox.textContent = "تعذر تشغيل مسجل الفيديو.";
    return;
  }

  recorder.ondataavailable = event => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "AI-Cartoon-2D.webm";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 3000);

    stream.getTracks().forEach(track => track.stop());

    recording = false;
    statusBox.textContent = "تم تصدير الفيديو بنجاح.";
  };

  render();
  recorder.start();
  startTime = Date.now();

  function recordFrame() {
    if (!recording) return;

    render(Date.now());

    const elapsed = (Date.now() - startTime) / 1000;
    statusBox.textContent =
      `جاري تسجيل الفيديو: ${Math.min(elapsed, animationDuration).toFixed(1)} ثانية`;

    if (elapsed >= animationDuration) {
      recorder.stop();
      return;
    }

    requestAnimationFrame(recordFrame);
  }

  recordFrame();
});

// -------------------------
// 3D CARTOON PREVIEW
// -------------------------

let scene3D;
let camera3D;
let renderer3D;
let character3D;
let animation3D;

function init3D() {
  const container = document.getElementById("threeScene");

  if (renderer3D) {
    renderer3D.setSize(container.clientWidth, container.clientHeight);
    return;
  }

  if (!window.THREE) {
    container.textContent = "تعذر تحميل مكتبة 3D. تحقق من اتصال الإنترنت.";
    return;
  }

  scene3D = new THREE.Scene();
  scene3D.background = new THREE.Color("#151d32");

  camera3D = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );

  camera3D.position.set(0, 1.5, 6);

  renderer3D = new THREE.WebGLRenderer({ antialias: true });
  renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer3D.setSize(container.clientWidth, container.clientHeight);

  container.innerHTML = "";
  container.appendChild(renderer3D.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(3, 5, 5);
  scene3D.add(light);

  scene3D.add(new THREE.AmbientLight(0xffffff, 0.8));

  const material = new THREE.MeshStandardMaterial({
    color: 0xe5a928,
    roughness: 0.65
  });

  character3D = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 32),
    material
  );
  body.scale.set(0.8, 1.1, 0.55);
  body.position.y = -0.5;
  character3D.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xffc99c })
  );
  head.position.y = 0.75;
  character3D.add(head);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

  [-0.22, 0.22].forEach(x => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      eyeMaterial
    );

    eye.position.set(x, 0.85, 0.55);
    character3D.add(eye);
  });

  scene3D.add(character3D);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x243c35 })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.65;
  scene3D.add(floor);

  function loop() {
    animation3D = requestAnimationFrame(loop);

    character3D.rotation.y += 0.008;
    character3D.position.y = Math.sin(Date.now() / 500) * 0.08;

    renderer3D.render(scene3D, camera3D);
  }

  loop();
}

document.getElementById("reset3d").addEventListener("click", () => {
  if (character3D) {
    character3D.rotation.set(0, 0, 0);
    character3D.position.set(0, 0, 0);
  }
});

window.addEventListener("resize", () => {
  const container = document.getElementById("threeScene");

  if (!renderer3D || !camera3D || container.classList.contains("hidden")) {
    return;
  }

  camera3D.aspect = container.clientWidth / container.clientHeight;
  camera3D.updateProjectionMatrix();

  renderer3D.setSize(container.clientWidth, container.clientHeight);
});

render();
