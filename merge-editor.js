import { FFmpeg } from "./ffmpeg/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

(() => {
  "use strict";

  const input = document.getElementById("mergeInput");
  const list = document.getElementById("mergeFileList");
  const loadButton = document.getElementById("loadMergeFFmpeg");
  const exportButton = document.getElementById("exportMerge");
  const progress = document.getElementById("mergeProgress");
  const status = document.getElementById("mergeStatus");
  const download = document.getElementById("mergeDownload");

  if (!input || !list || !loadButton || !exportButton || !progress || !status || !download) {
    console.error("[Video Merge] Required HTML elements are missing.");
    return;
  }

  let ffmpeg = null;
  let loaded = false;
  let busy = false;
  let files = [];
  let outputURL = null;

  const setStatus = message => { status.textContent = message; };
  const setProgress = value => { progress.value = Math.max(0, Math.min(100, Number(value) || 0)); };

  function renderFiles() {
    list.replaceChildren();
    if (!files.length) {
      list.textContent = "مازال ما اخترتي حتى فيديو.";
      return;
    }
    files.forEach((file, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "8px 0";
      const name = document.createElement("span");
      name.textContent = (index + 1) + ". " + file.name + " (" + (file.size / 1024 / 1024).toFixed(1) + " MB)";
      const actions = document.createElement("span");
      const up = document.createElement("button");
      up.type = "button"; up.className = "secondary"; up.textContent = "↑";
      up.disabled = index === 0 || busy;
      up.addEventListener("click", () => {
        [files[index - 1], files[index]] = [files[index], files[index - 1]];
        renderFiles();
      });
      const down = document.createElement("button");
      down.type = "button"; down.className = "secondary"; down.textContent = "↓";
      down.disabled = index === files.length - 1 || busy;
      down.addEventListener("click", () => {
        [files[index + 1], files[index]] = [files[index], files[index + 1]];
        renderFiles();
      });
      actions.append(up, down);
      row.append(name, actions);
      list.append(row);
    });
  }

  input.addEventListener("change", () => {
    files = Array.from(input.files || []).filter(file => file.type.startsWith("video/"));
    if (files.length !== input.files.length) setStatus("تم تجاهل الملفات اللي ماشي فيديو.");
    else setStatus(files.length >= 2 ? "مزيان، رتب الفيديوهات وحمّل المحرك للدمج." : "خاصك تختار جوج فيديوهات على الأقل.");
    if (outputURL) URL.revokeObjectURL(outputURL);
    outputURL = null;
    download.hidden = true;
    download.removeAttribute("href");
    exportButton.disabled = !loaded || files.length < 2;
    renderFiles();
  });

  loadButton.addEventListener("click", async () => {
    if (loaded || busy) return;
    try {
      busy = true;
      loadButton.disabled = true;
      setStatus("جاري تحميل محرك الدمج...");
      setProgress(5);
      ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => console.log("[Merge FFmpeg]", message));
      ffmpeg.on("progress", ({ progress: value }) => setProgress(Math.round(value * 100)));
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      const coreURL = await toBlobURL(baseURL + "/ffmpeg-core.js", "text/javascript");
      setProgress(35);
      const wasmURL = await toBlobURL(baseURL + "/ffmpeg-core.wasm", "application/wasm");
      const classWorkerURL = new URL("./ffmpeg/worker.js", import.meta.url).href;
      setProgress(70);
      await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
      loaded = true;
      setProgress(100);
      setStatus("✓ محرك الدمج واجد.");
      loadButton.textContent = "✓ المحرك جاهز";
      exportButton.disabled = files.length < 2;
    } catch (error) {
      console.error("[Video Merge] Load error:", error);
      setStatus("فشل تحميل المحرك: " + (error?.message || error));
      setProgress(0);
      loadButton.disabled = false;
      loadButton.textContent = "إعادة تحميل المحرك";
    } finally {
      busy = false;
    }
  });

  exportButton.addEventListener("click", async () => {
    if (!loaded || files.length < 2 || busy) {
      setStatus("اختار جوج فيديوهات على الأقل وحمّل المحرك أولا.");
      return;
    }
    busy = true;
    exportButton.disabled = true;
    loadButton.disabled = true;
    download.hidden = true;
    setProgress(0);
    const inputNames = [];
    try {
      setStatus("جاري تجهيز الفيديوهات...");
      const concatLines = [];
      for (let i = 0; i < files.length; i++) {
        const ext = (files[i].name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
        const name = "merge_input_" + String(i).padStart(3, "0") + "." + ext;
        inputNames.push(name);
        await ffmpeg.writeFile(name, await fetchFile(files[i]));
        concatLines.push("file '" + name + "'");
        setProgress(5 + Math.round(((i + 1) / files.length) * 35));
      }
      await ffmpeg.writeFile("merge_list.txt", new TextEncoder().encode(concatLines.join("\n")));
      setStatus("جاري دمج وترميز الفيديوهات، قد يستغرق الأمر بعض الوقت...");
      const result = await ffmpeg.exec([
        "-f", "concat", "-safe", "0", "-i", "merge_list.txt",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "merged_output.mp4"
      ]);
      if (result !== 0) throw new Error("FFmpeg لم يستطع دمج هذه الملفات. جرب فيديوهات بصيغ متقاربة مثل MP4.");
      const data = await ffmpeg.readFile("merged_output.mp4");
      const blob = new Blob([data], { type: "video/mp4" });
      if (outputURL) URL.revokeObjectURL(outputURL);
      outputURL = URL.createObjectURL(blob);
      download.href = outputURL;
      download.download = "AI-VIDEO-MERGED.mp4";
      download.hidden = false;
      setProgress(100);
      setStatus("✓ تم الدمج بنجاح. تقدر تحمل الفيديو النهائي.");
    } catch (error) {
      console.error("[Video Merge] Export error:", error);
      setStatus("وقع مشكل أثناء الدمج: " + (error?.message || error));
      setProgress(0);
    } finally {
      for (const name of inputNames) await ffmpeg.deleteFile(name).catch(() => {});
      await ffmpeg.deleteFile("merge_list.txt").catch(() => {});
      await ffmpeg.deleteFile("merged_output.mp4").catch(() => {});
      busy = false;
      loadButton.disabled = loaded;
      exportButton.disabled = !loaded || files.length < 2;
    }
  });

  renderFiles();
  console.log("[Video Merge] Ready.");
})();