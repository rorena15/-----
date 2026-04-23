document.addEventListener("DOMContentLoaded", function() {

  // ── STATE ──
  let capturedPhotos = []; 
  let selectedOrder = []; 
  let stream = null;
  let currentFrame = "classic";
  let bgColor = "#ffffff";
  let bgImage = null;
  let stickers = [];
  let dragging = null;
  let dragOffset = { x: 0, y: 0 };

  const W = 300, H = 680;

  // ── ELEMENTS ──
  const flash = document.getElementById("flash");
  const camArea = document.getElementById("camArea");
  const video = document.getElementById("camVideo");
  const countdownEl = document.getElementById("countdown");
  const shotLabel = document.getElementById("shotLabel");
  const startCamBtn = document.getElementById("startCamBtn");
  const shootBtn = document.getElementById("shootBtn");
  const stopCamBtn = document.getElementById("stopCamBtn");
  const shootHint = document.getElementById("shootHint");
  const progressDots = document.getElementById("progressDots");
  const toSelectBtn = document.getElementById("toSelectBtn");
  const selectGrid = document.getElementById("selectGrid");
  const toDecorBtn = document.getElementById("toDecorBtn");
  
  // HTML 로딩이 완료된 후 요소를 찾으므로 여기서 절대 에러가 나지 않습니다.
  const canvas = document.getElementById("mainCanvas");
  const ctx = canvas.getContext("2d"); 
  
  const toSaveBtn = document.getElementById("toSaveBtn");
  const savePreview = document.getElementById("savePreview");
  const dlBtn = document.getElementById("dlBtn");
  const restartBtn = document.getElementById("restartBtn");

  // ── STEP NAVIGATION ──
  function goToStep(n) {
    document.querySelectorAll(".page").forEach((p, i) => p.classList.toggle("active", i === n - 1));
    [1, 2, 3, 4].forEach((i) => {
      const si = document.getElementById("si" + i);
      si.classList.remove("active", "done");
      if (i < n) si.classList.add("done");
      else if (i === n) si.classList.add("active");
    });
    [1, 2, 3].forEach((i) => {
      document.getElementById("sl" + i).classList.toggle("done", i < n);
    });
    window.scrollTo(0, 0);
  }

  // ── PROGRESS DOTS ──
  function renderDots() {
    progressDots.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const d = document.createElement("div");
      d.className = "prog-dot";
      if (capturedPhotos[i]) {
        d.classList.add("filled");
        const img = document.createElement("img");
        img.src = capturedPhotos[i].src;
        d.appendChild(img);
      } else {
        d.textContent = i + 1;
      }
      progressDots.appendChild(d);
    }
    toSelectBtn.classList.toggle("ready", capturedPhotos.length >= 6);
    const done = capturedPhotos.length;
    if (done >= 6) shootHint.textContent = "6장 완성! 다음으로 넘어가세요 ✅";
    else if (stream) shootHint.textContent = `${done}/6장 촬영됨`;
    else shootHint.textContent = `${done}/6장 완료 — 카메라를 켜거나 파일을 업로드하세요`;
  }

  // ── FLASH ──
  function doFlash() {
    flash.style.opacity = "0.85";
    setTimeout(() => { flash.style.opacity = "0"; }, 130);
  }

  // ── SHOOT LOGIC ──
  function shootOne(slotIdx, onDone) {
    let n = 3;
    countdownEl.style.display = "block";
    countdownEl.textContent = n;
    shotLabel.style.display = "block";
    shotLabel.textContent = `${slotIdx + 1}/6번째 사진`;
    const iv = setInterval(() => {
      n--;
      if (n > 0) {
        countdownEl.textContent = n;
      } else {
        clearInterval(iv);
        countdownEl.style.display = "none";
        doFlash();
        const tmp = document.createElement("canvas");
        tmp.width = video.videoWidth;
        tmp.height = video.videoHeight;
        tmp.getContext("2d").drawImage(video, 0, 0);
        const img = new Image();
        img.onload = () => {
          capturedPhotos[slotIdx] = img;
          renderDots();
          onDone();
        };
        img.src = tmp.toDataURL("image/jpeg", 0.92);
      }
    }, 1000);
  }

  function startShooting() {
    shootBtn.disabled = true;
    const startIdx = capturedPhotos.length;
    const slotsLeft = 6 - startIdx;
    if (slotsLeft <= 0) {
      shootBtn.disabled = false;
      return;
    }
    function next(i) {
      if (i >= 6) {
        shootBtn.disabled = false;
        shotLabel.style.display = "none";
        if (stream) stopCamera();
        return;
      }
      shootOne(i, () => next(i + 1));
    }
    next(startIdx);
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      video.srcObject = stream;
      camArea.style.display = "block";
      startCamBtn.classList.add("hidden");
      shootBtn.classList.remove("hidden");
      stopCamBtn.classList.remove("hidden");
      renderDots();
    } catch (e) {
      shootHint.textContent = "카메라 접근이 거부되었어요. 파일 업로드를 이용하세요.";
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    camArea.style.display = "none";
    startCamBtn.classList.remove("hidden");
    shootBtn.classList.add("hidden");
    stopCamBtn.classList.add("hidden");
    renderDots();
  }

  startCamBtn.addEventListener("click", startCamera);
  stopCamBtn.addEventListener("click", stopCamera);
  shootBtn.addEventListener("click", startShooting);

  document.getElementById("uploadBtn").addEventListener("click", () => document.getElementById("fileInput").click());
  document.getElementById("fileInput").addEventListener("change", function () {
    const files = Array.from(this.files);
    files.forEach((file) => {
      if (capturedPhotos.length >= 6) return;
      const img = new Image();
      img.onload = () => {
        capturedPhotos.push(img);
        renderDots();
      };
      img.src = URL.createObjectURL(file);
    });
    this.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    capturedPhotos = [];
    selectedOrder = [];
    renderDots();
  });

  toSelectBtn.addEventListener("click", () => {
    if (capturedPhotos.length < 6) return;
    buildSelectGrid();
    goToStep(2);
  });

  // ── PAGE 2: SELECT ──
  function buildSelectGrid() {
    selectGrid.innerHTML = "";
    selectedOrder = [];
    capturedPhotos.forEach((img, i) => {
      const card = document.createElement("div");
      card.className = "select-card";
      const im = document.createElement("img");
      im.src = img.src;
      card.appendChild(im);
      const check = document.createElement("div");
      check.className = "check";
      check.textContent = "✓";
      card.appendChild(check);
      const badge = document.createElement("div");
      badge.className = "order-badge";
      card.appendChild(badge);
      card.addEventListener("click", () => toggleSelect(i, card, badge));
      selectGrid.appendChild(card);
    });
    updateSelectBtn();
  }

  function toggleSelect(idx, card, badge) {
    const pos = selectedOrder.indexOf(idx);
    if (pos >= 0) {
      selectedOrder.splice(pos, 1);
      card.classList.remove("chosen");
      renumberBadges();
    } else {
      if (selectedOrder.length >= 4) return;
      selectedOrder.push(idx);
      card.classList.add("chosen");
      renumberBadges();
    }
    updateSelectBtn();
  }

  function renumberBadges() {
    selectGrid.querySelectorAll(".select-card").forEach((card, i) => {
      const badge = card.querySelector(".order-badge");
      const pos = selectedOrder.indexOf(i);
      if (pos >= 0) badge.textContent = `${pos + 1}번째`;
    });
  }

  function updateSelectBtn() {
    const info = document.querySelector(".select-info");
    info.innerHTML = `찍은 6장 중 <span>${selectedOrder.length}/4장</span> 선택됨`;
    toDecorBtn.classList.toggle("ready", selectedOrder.length === 4);
  }

  toDecorBtn.addEventListener("click", () => {
    if (selectedOrder.length !== 4) return;
    drawFrame();
    goToStep(3);
  });

  // ── PAGE 3: DECORATE ──
  const FRAMES = {
    classic: { padding: 20, gap: 10, borderRadius: 6, border: { color: "#222", width: 2 }, label: "CLASSIC" },
    minimal: { padding: 24, gap: 8, borderRadius: 0, border: { color: "transparent", width: 0 }, label: "" },
    film: { padding: 14, gap: 6, borderRadius: 0, border: { color: "#f59e0b", width: 3 }, label: "35mm FILM" },
    polaroid: { padding: 18, gap: 14, borderRadius: 4, border: { color: "#e5e7eb", width: 8 }, label: "" },
    scrap: { padding: 16, gap: 12, borderRadius: 8, border: { color: "#6366f1", width: 2, dashed: true }, label: "✂ SCRAP" },
  };

  function getSlots() {
    const f = FRAMES[currentFrame];
    const p = f.padding, g = f.gap;
    const bottomPad = bgImage ? p + 60 : p;
    const slotW = (W - p * 2 - g) / 2;
    const slotH = (H - p - bottomPad - g * 3) / 4;
    return Array.from({ length: 4 }, (_, i) => ({
      x: p, y: p + i * (slotH + g), w: slotW * 2 + g, h: slotH, idx: i,
    }));
  }

  function roundRect(c, x, y, w, h, r) {
    if (r <= 0) { c.beginPath(); c.rect(x, y, w, h); return; }
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    const f = FRAMES[currentFrame];

    if (bgImage) {
      ctx.save();
      roundRect(ctx, 0, 0, W, H, currentFrame === "scrap" ? 16 : currentFrame === "classic" ? 12 : 4);
      ctx.clip();
      const scale = Math.max(W / bgImage.width, H / bgImage.height);
      const dw = bgImage.width * scale, dh = bgImage.height * scale;
      ctx.drawImage(bgImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = bgColor;
      roundRect(ctx, 0, 0, W, H, currentFrame === "scrap" ? 16 : currentFrame === "classic" ? 12 : 4);
      ctx.fill();
    }

    if (currentFrame === "film") {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, W, 12);
      ctx.fillRect(0, H - 12, W, 12);
      for (let x = 8; x < W; x += 18) {
        ctx.fillStyle = "#fff";
        roundRect(ctx, x, 2, 10, 8, 2);
        ctx.fill();
        roundRect(ctx, x, H - 10, 10, 8, 2);
        ctx.fill();
      }
    }
    if (currentFrame === "scrap") {
      ctx.strokeStyle = "#c7d2fe";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.setLineDash([]);
    }

    const slots = getSlots();
    slots.forEach((s, i) => {
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, s.x, s.y, s.w, s.h, f.borderRadius);
      ctx.clip();
      const photoIdx = selectedOrder[i];
      const img = capturedPhotos[photoIdx];
      if (img) {
        const scale = Math.max(s.w / img.width, s.h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, s.x + (s.w - dw) / 2, s.y + (s.h - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.04)";
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.font = "bold 12px Nunito,sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${i + 1}번`, s.x + s.w / 2, s.y + s.h / 2);
      }
      ctx.restore();
      if (f.border.width > 0 && f.border.color !== "transparent") {
        ctx.save();
        if (f.border.dashed) ctx.setLineDash([6, 3]);
        ctx.strokeStyle = f.border.color;
        ctx.lineWidth = f.border.width;
        ctx.beginPath();
        roundRect(ctx, s.x, s.y, s.w, s.h, f.borderRadius);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    if (f.label) {
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = bgColor === "#1e293b" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.22)";
      ctx.textAlign = "center";
      ctx.fillText(f.label, W / 2, H - 6);
    }

    stickers.forEach((st) => {
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";
      if (st.emoji) {
        ctx.font = `${st.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(st.emoji, st.x, st.y);
      }
      if (st.text) {
        ctx.font = "bold 14px Nunito,sans-serif";
        ctx.fillStyle = bgColor === "#1e293b" ? "#fff" : "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(st.text, st.x, st.y);
      }
      ctx.restore();
    });
  }

  document.querySelectorAll(".frame-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".frame-btn").forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentFrame = this.dataset.frame;
      drawFrame();
    });
  });
  document.querySelectorAll(".color-dot").forEach((dot) => {
    dot.addEventListener("click", function () {
      document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
      this.classList.add("active");
      bgColor = this.dataset.color;
      drawFrame();
    });
  });
  document.querySelectorAll(".sticker-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      stickers.push({
        emoji: this.dataset.sticker,
        x: W / 2 + Math.random() * 60 - 30,
        y: H / 2 + Math.random() * 60 - 30,
        size: 32,
        text: null,
      });
      drawFrame();
    });
  });
  document.getElementById("addTextBtn").addEventListener("click", function () {
    const val = document.getElementById("textInput").value.trim();
    if (!val) return;
    stickers.push({ emoji: null, x: W / 2, y: H - 40, size: 0, text: val });
    document.getElementById("textInput").value = "";
    drawFrame();
  });

  document.getElementById("bgImgBtn").addEventListener("click", () => document.getElementById("bgImgInput").click());
  document.getElementById("bgImgInput").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      bgImage = img;
      drawFrame();
    };
    img.src = URL.createObjectURL(file);
    this.value = "";
  });
  document.getElementById("bgImgClearBtn").addEventListener("click", () => {
    bgImage = null;
    drawFrame();
  });

  // sticker drag (mouse)
  canvas.addEventListener("mousedown", function (e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
    const idx = stickers.findIndex((s) => Math.abs(px - s.x) < 28 && Math.abs(py - s.y) < 28);
    if (idx >= 0) {
      dragging = idx;
      dragOffset = { x: px - stickers[idx].x, y: py - stickers[idx].y };
    }
  });
  canvas.addEventListener("mousemove", function (e) {
    if (dragging === null) return;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    stickers[dragging].x = (e.clientX - r.left) * sx - dragOffset.x;
    stickers[dragging].y = (e.clientY - r.top) * sy - dragOffset.y;
    drawFrame();
  });
  canvas.addEventListener("mouseup", () => { dragging = null; });

  // sticker drag (touch)
  canvas.addEventListener("touchstart", function (e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const px = (e.touches[0].clientX - r.left) * sx, py = (e.touches[0].clientY - r.top) * sy;
    const idx = stickers.findIndex((s) => Math.abs(px - s.x) < 28 && Math.abs(py - s.y) < 28);
    if (idx >= 0) {
      dragging = idx;
      dragOffset = { x: px - stickers[idx].x, y: py - stickers[idx].y };
      e.preventDefault();
    }
  }, { passive: false });
  canvas.addEventListener("touchmove", function (e) {
    if (dragging === null) return;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    stickers[dragging].x = (e.touches[0].clientX - r.left) * sx - dragOffset.x;
    stickers[dragging].y = (e.touches[0].clientY - r.top) * sy - dragOffset.y;
    drawFrame();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchend", () => { dragging = null; });

  toSaveBtn.addEventListener("click", () => {
    const dataUrl = canvas.toDataURL("image/png");
    savePreview.src = dataUrl;
    goToStep(4);
    generateQR(dataUrl);
  });

  // ── PAGE 4: SAVE ──
  dlBtn.addEventListener("click", function () {
    const link = document.createElement("a");
    link.download = "my_life4cuts.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  // ── QR CODE GENERATION (PHP SERVER) ──
  let currentDataUrl = "";

  async function generateQR(dataUrl) {
    currentDataUrl = dataUrl;
    const qrBox = document.getElementById("qrBox");
    const qrLoading = document.getElementById("qrLoading");
    const qrCanvas = document.getElementById("qrCanvas");

    qrLoading.style.display = "block";
    qrCanvas.style.display = "none";

    try {
      const response = await fetch("upload.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await response.json();

      if (data.status === "success") {
        window._qrUrl = data.url;
        makeQRCanvas(data.url);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error("QR Generate Error: ", err);
      fallbackQR();
    }
  }

  function makeQRCanvas(url) {
    const qrLoading = document.getElementById("qrLoading");
    const qrCanvas = document.getElementById("qrCanvas");

    const tmpDiv = document.createElement("div");
    tmpDiv.style.display = "none";
    document.body.appendChild(tmpDiv);

    new QRCode(tmpDiv, {
      text: url,
      width: 150,
      height: 150,
      colorDark: "#1a1a2e",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });

    setTimeout(() => {
      const qrImg = tmpDiv.querySelector("img") || tmpDiv.querySelector("canvas");
      qrCanvas.width = 150;
      qrCanvas.height = 150;
      const ctx2 = qrCanvas.getContext("2d");

      if (qrImg && qrImg.tagName === "IMG") {
        const i = new Image();
        i.onload = () => {
          ctx2.drawImage(i, 0, 0, 150, 150);
          qrLoading.style.display = "none";
          qrCanvas.style.display = "block";
        };
        i.src = qrImg.src;
      } else if (qrImg && qrImg.tagName === "CANVAS") {
        ctx2.drawImage(qrImg, 0, 0, 150, 150);
        qrLoading.style.display = "none";
        qrCanvas.style.display = "block";
      }
      document.body.removeChild(tmpDiv);
    }, 300);
  }

  function fallbackQR() {
    const qrLoading = document.getElementById("qrLoading");
    const qrCanvas = document.getElementById("qrCanvas");
    const tmpDiv = document.createElement("div");
    tmpDiv.style.display = "none";
    document.body.appendChild(tmpDiv);

    const msg = "이미지를 직접 저장 버튼을 이용해 주세요 😊";
    new QRCode(tmpDiv, {
      text: msg,
      width: 150,
      height: 150,
      colorDark: "#a29bfe",
      colorLight: "#fff",
      correctLevel: QRCode.CorrectLevel.L,
    });
    setTimeout(() => {
      const qrImg = tmpDiv.querySelector("img") || tmpDiv.querySelector("canvas");
      qrCanvas.width = 150;
      qrCanvas.height = 150;
      const ctx2 = qrCanvas.getContext("2d");
      if (qrImg && qrImg.tagName === "IMG") {
        const i = new Image();
        i.onload = () => {
          ctx2.drawImage(i, 0, 0, 150, 150);
          qrLoading.style.display = "none";
          qrCanvas.style.display = "block";
        };
        i.src = qrImg.src;
      } else if (qrImg && qrImg.tagName === "CANVAS") {
        ctx2.drawImage(qrImg, 0, 0, 150, 150);
        qrLoading.style.display = "none";
        qrCanvas.style.display = "block";
      }
      document.body.removeChild(tmpDiv);
      qrLoading.textContent = "⚠️ 업로드 실패 — 직접 저장 이용";
    }, 300);
  }

  document.getElementById("qrDlBtn").addEventListener("click", function () {
    const qrCanvas = document.getElementById("qrCanvas");
    if (qrCanvas.style.display === "none") return;
    const link = document.createElement("a");
    link.download = "life4cuts_qr.png";
    link.href = qrCanvas.toDataURL("image/png");
    link.click();
  });

  document.getElementById("copyLinkBtn").addEventListener("click", function () {
    const url = window._qrUrl;
    if (!url) {
      alert("링크 생성 중이에요. 잠시 후 다시 눌러주세요!");
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      this.textContent = "✅ 복사됨!";
      setTimeout(() => { this.textContent = "🔗 링크 복사"; }, 2000);
    }).catch(() => {
      prompt("아래 링크를 복사하세요:", url);
    });
  });

  restartBtn.addEventListener("click", () => {
    capturedPhotos = [];
    selectedOrder = [];
    stickers = [];
    bgImage = null;
    bgColor = "#ffffff";
    currentFrame = "classic";
    if (stream) stopCamera();
    document.querySelectorAll(".frame-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('[data-frame="classic"]').classList.add("active");
    document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
    document.querySelector('[data-color="#ffffff"]').classList.add("active");
    renderDots();
    goToStep(1);
  });

  // ── INIT ──
  renderDots();
  goToStep(1);

}); // DOMContentLoaded 괄호 닫기