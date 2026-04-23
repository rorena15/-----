// ── STATE ──
let capturedPhotos = []; 
let selectedOrder = []; 
let stream = null;
let currentLayout = "1_4";    // 프레임 구조 (기본: 세로 4컷)
let currentTheme = "classic"; // 프레임 디자인 (기본: 클래식)
let bgColor = "#ffffff";
let bgImage = null;
let stickers = [];
let dragging = null;
let dragOffset = { x: 0, y: 0 };

const W = 300, H = 680;
const shutterSound = new Audio("shutter.mp3");
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

// canvas/ctx: 사용 시점마다 직접 참조 (전역 선언 없음)
function getCanvas() {
  const canvas = document.getElementById("mainCanvas");
  if (!canvas) return { canvas: null, ctx: null };
  return { canvas, ctx: canvas.getContext("2d") };
}

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
      shutterSound.currentTime = 0;
      shutterSound.play().catch(e => console.warn("터치 전 사운드 방어됨"));
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
  if (stream) stopCamera();
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
  goToStep(3);
  // requestAnimationFrame으로 DOM이 display:block 된 후 canvas 접근 보장
  requestAnimationFrame(() => {
    attachCanvasEvents();
    drawFrame();
  });
});

// ── PAGE 3: DECORATE ──
// 1. 레이아웃 (구조) 정의 (pickmem 에셋 기준)
const LAYOUTS = {
  "1_4": { cols: 1, rows: 4, mask: "assets/frame/1_4.png", max: 4 },
  "2_2": { cols: 2, rows: 2, mask: "assets/frame/2_2.png", max: 4 },
  "1_2": { cols: 1, rows: 2, mask: "assets/frame/1_2.png", max: 2 }
};

// 2. 테마 (디자인) 정의
const THEMES = {
  classic: { defaultBg: "#ffffff", overlaySrc: null },
  minimal: { defaultBg: "#1a1a2e", overlaySrc: "frames/minimal_overlay.png" },
  film: { defaultBg: "#f59e0b", overlaySrc: "frames/film_overlay.png" },
  polaroid: { defaultBg: "#e5e7eb", overlaySrc: "frames/polaroid_overlay.png" },
  scrap: { defaultBg: "#e0e7ff", overlaySrc: "frames/scrap_overlay.png" }
};

const preloadedImages = {};

// 3. 자산 동시 로드 엔진
function preloadAssets() {
  Object.values(LAYOUTS).forEach(l => {
    if (l.mask) {
      const img = new Image();
      img.onload = () => { preloadedImages[l.mask] = img; };
      img.src = l.mask;
    }
  });
  Object.values(THEMES).forEach(t => {
    if (t.overlaySrc) {
      const img = new Image();
      img.onload = () => { preloadedImages[t.overlaySrc] = img; };
      img.onerror = () => { preloadedImages[t.overlaySrc] = null; };
      img.src = t.overlaySrc;
    }
  });
}
preloadAssets();

// 4. 동적 슬롯 계산 엔진
function getSlots() {
  const layout = LAYOUTS[currentLayout];
  const p = 20, g = 10, bottomPad = 80;
  const usableW = W - (p * 2);
  const usableH = H - p - bottomPad;
  const slotW = (usableW - (g * (layout.cols - 1))) / layout.cols;
  const slotH = (usableH - (g * (layout.rows - 1))) / layout.rows;

  let slots = [];
  let idx = 0;
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      if (idx >= layout.max) break;
      slots.push({ x: p + c * (slotW + g), y: p + r * (slotH + g), w: slotW, h: slotH, idx: idx });
      idx++;
    }
  }
  return slots;
}

function drawFrame() {
  const { canvas, ctx } = getCanvas();
  if (!canvas || !ctx) return;
  
  const layout = LAYOUTS[currentLayout];
  const theme = THEMES[currentTheme];

  ctx.clearRect(0, 0, W, H);

  // [Layer 1] 배경색 및 이미지
  ctx.fillStyle = bgColor !== "#ffffff" ? bgColor : theme.defaultBg;
  roundRect(ctx, 0, 0, W, H, 4);
  ctx.fill();

  if (bgImage) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 4);
    ctx.clip();
    const scale = Math.max(W / bgImage.width, H / bgImage.height);
    const dw = bgImage.width * scale, dh = bgImage.height * scale;
    ctx.drawImage(bgImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  // [Layer 2] 동적 사진 격자
  const slots = getSlots();
  slots.forEach((s, i) => {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, s.x, s.y, s.w, s.h, 4);
    ctx.clip();
    
    const photoIdx = selectedOrder[i];
    const img = capturedPhotos[photoIdx];
    if (img) {
      const scale = Math.max(s.w / img.width, s.h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, s.x + (s.w - dw) / 2, s.y + (s.h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fill();
    }
    ctx.restore();
  });

  // [Layer 3] pickmem 구조 마스크 덮기
  if (layout.mask && preloadedImages[layout.mask]) {
    try { ctx.drawImage(preloadedImages[layout.mask], 0, 0, W, H); } catch (e) {}
  }

  // [Layer 4] 디자인 오버레이 덮기
  if (theme.overlaySrc && preloadedImages[theme.overlaySrc]) {
    try { ctx.drawImage(preloadedImages[theme.overlaySrc], 0, 0, W, H); } catch (e) {}
  }

  // [Layer 5] 스티커 및 텍스트 렌더링
  stickers.forEach((st) => {
    ctx.save();
    if (st.type === "image" && loadedStickerImgs[st.src]) {
      const img = loadedStickerImgs[st.src];
      ctx.drawImage(img, st.x - st.size / 2, st.y - st.size / 2, st.size, st.size);
    } else if (st.emoji) {
      ctx.font = `${st.size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.emoji, st.x, st.y);
    }
    if (st.text) {
      ctx.font = "bold 16px Nunito,sans-serif";
      ctx.fillStyle = (theme.defaultBg === "#1a1a2e" || theme.defaultBg === "#f59e0b") ? "#fff" : "#222";
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
    currentTheme = this.dataset.frame; // 테마 변수로 수정
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

// canvas 이벤트는 최초 1회만 등록 (page3 진입 시)
let canvasEventsAttached = false;
function attachCanvasEvents() {
  if (canvasEventsAttached) return;
  canvasEventsAttached = true;
  const { canvas } = getCanvas();

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
  // 더블클릭으로 스티커/텍스트 삭제
  canvas.addEventListener("dblclick", function (e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
    const idx = stickers.findIndex((s) => Math.abs(px - s.x) < 28 && Math.abs(py - s.y) < 28);
    if (idx >= 0) {
      stickers.splice(idx, 1);
      drawFrame();
    }
  });

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
}

toSaveBtn.addEventListener("click", () => {
  const { canvas } = getCanvas();
  const dataUrl = canvas.toDataURL("image/png");
  savePreview.src = dataUrl;
  goToStep(4);
  generateQR(dataUrl);
});

// ── PAGE 4: SAVE ──
dlBtn.addEventListener("click", function () {
  const { canvas } = getCanvas();
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
  if (typeof QRCode === 'undefined') {
    fallbackQR();
    return;
  }
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

  qrLoading.textContent = "⚠️ 업로드 실패 — 직접 저장 이용";

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
  currentLayout = "1_4";
  currentTheme = "classic";
  if (stream) stopCamera();
  document.querySelectorAll(".frame-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-frame="classic"]').classList.add("active");
  document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
  document.querySelector('[data-color="#ffffff"]').classList.add("active");
  renderDots();
  goToStep(1);
});
// ── PICKMEM 스티커 에셋 연동 (자동화 버전) ──
let loadedStickerImgs = {}; 

async function initStickerUI() {
  const stickerRow = document.querySelector(".sticker-row");
  if (!stickerRow) return;
  stickerRow.innerHTML = "로딩중..."; 

  try {
    // PHP를 호출해서 폴더 안에 있는 모든 스티커 파일 목록을 가져옴
    const response = await fetch("get_assets.php");
    const result = await response.json();
    
    if (result.status === "success") {
      stickerRow.innerHTML = ""; // 로딩 텍스트 제거
      
      result.data.forEach(src => {
        const img = new Image();
        img.src = src;
        loadedStickerImgs[src] = img;

        const btn = document.createElement("div");
        btn.className = "sticker-btn";
        btn.style.padding = "4px";
        btn.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:contain; pointer-events:none;">`;
        
        btn.addEventListener("click", () => {
          stickers.push({
            type: "image",
            src: src,
            x: W / 2 + Math.random() * 40 - 20,
            y: H / 2 + Math.random() * 40 - 20,
            size: 80,
            text: null, emoji: null
          });
          drawFrame();
        });
        stickerRow.appendChild(btn);
      });
    }
  } catch (e) {
    console.error("[SNAP] 스티커 목록을 불러오지 못했습니다.", e);
    stickerRow.innerHTML = "스티커 로드 실패";
  }
}

// 스크립트 실행 시 스티커 UI 로드
initStickerUI();

// ── INIT ──
renderDots();
goToStep(1);