// ── STATE ──
let capturedPhotos = []; 
let selectedOrder = []; 
let stream = null;
let currentLayout = "1_4"; 
let currentTheme = "classic"; 
let bgColor = "#ffffff";
let bgImage = null;
let stickers = [];
let dragging = null;
let dragOffset = { x: 0, y: 0 };
const shutterSound = new Audio("shutter.mp3"); // [참고] 경로가 다를 경우 "assets/sound/shutter.mp3" 등으로 수정하세요.

// ── [PICKMEM TECH] 자동 슬롯 감지 엔진 ──
let currentDetectedSlots = []; 

async function detectSlotsFromImage(img) {
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  tempCtx.drawImage(img, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, img.width, img.height).data;
  const slots = [];
  const visited = new Uint8Array(img.width * img.height);
  
  // 회색 감지 (#D9D9D9)
  const isTargetColor = (r, g, b) => r > 210 && r < 225 && g > 210 && g < 225 && b > 210 && b < 225;

  for (let y = 0; y < img.height; y += 5) {
    for (let x = 0; x < img.width; x += 5) {
      const idx = (y * img.width + x) * 4;
      if (!visited[y * img.width + x] && isTargetColor(imageData[idx], imageData[idx+1], imageData[idx+2])) {
        let tw = 0, th = 0;
        while (x + tw < img.width && isTargetColor(imageData[(y * img.width + (x + tw)) * 4], imageData[(y * img.width + (x + tw)) * 4 + 1], imageData[(y * img.width + (x + tw)) * 4 + 2])) tw++;
        while (y + th < img.height && isTargetColor(imageData[((y + th) * img.width + x) * 4], imageData[((y + th) * img.width + x) * 4 + 1], imageData[((y + th) * img.width + x) * 4 + 2])) th++;

        if (tw > 50 && th > 50) {
          slots.push({ x, y, w: tw, h: th });
          for (let vy = y; vy < y + th; vy++) {
            for (let vx = x; vx < x + tw; vx++) visited[vy * img.width + vx] = 1;
          }
        }
      }
    }
  }
  return slots.sort((a, b) => a.y - b.y || a.x - b.x);
}

// ── ELEMENTS ──
const flash = document.getElementById("flash"), camArea = document.getElementById("camArea"), video = document.getElementById("camVideo");
const countdownEl = document.getElementById("countdown"), shotLabel = document.getElementById("shotLabel");
const startCamBtn = document.getElementById("startCamBtn"), shootBtn = document.getElementById("shootBtn"), stopCamBtn = document.getElementById("stopCamBtn");
const shootHint = document.getElementById("shootHint"), progressDots = document.getElementById("progressDots");
const toSelectBtn = document.getElementById("toSelectBtn"), selectGrid = document.getElementById("selectGrid"), toDecorBtn = document.getElementById("toDecorBtn");
const toSaveBtn = document.getElementById("toSaveBtn"), savePreview = document.getElementById("savePreview"), dlBtn = document.getElementById("dlBtn"), restartBtn = document.getElementById("restartBtn");

function getCanvas() {
  const canvas = document.getElementById("mainCanvas");
  return { canvas, ctx: canvas ? canvas.getContext("2d") : null };
}

function roundRect(ctx, x, y, width, height, radius) {
  if (radius <= 0) { ctx.beginPath(); ctx.rect(x, y, width, height); return; }
  ctx.beginPath();
  ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function goToStep(n) {
  document.querySelectorAll(".page").forEach((p, i) => p.classList.toggle("active", i === n - 1));
  [1, 2, 3, 4].forEach(i => {
    const si = document.getElementById("si" + i);
    if(si) { si.classList.remove("active", "done"); if(i < n) si.classList.add("done"); else if(i === n) si.classList.add("active"); }
  });
}

// ── 1. 촬영 기능 ──
function renderDots() {
  progressDots.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const d = document.createElement("div"); d.className = "prog-dot" + (capturedPhotos[i] ? " filled" : "");
    if (capturedPhotos[i]) { const img = document.createElement("img"); img.src = capturedPhotos[i].src; d.appendChild(img); } else d.textContent = i + 1;
    progressDots.appendChild(d);
  }
  toSelectBtn.classList.toggle("ready", capturedPhotos.length >= 6);
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    video.srcObject = stream; camArea.style.display = "block";
    startCamBtn.classList.add("hidden"); shootBtn.classList.remove("hidden"); stopCamBtn.classList.remove("hidden");
    renderDots();
  } catch (e) { alert("카메라를 켤 수 없습니다."); }
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; camArea.style.display = "none";
  startCamBtn.classList.remove("hidden"); shootBtn.classList.add("hidden"); stopCamBtn.classList.add("hidden");
  renderDots();
}

function shootOne(idx, onDone) {
  let n = 3; countdownEl.style.display = "block"; countdownEl.textContent = n;
  shotLabel.style.display = "block"; shotLabel.textContent = `${idx + 1}/6번째 사진`;
  const iv = setInterval(() => {
    if (--n > 0) countdownEl.textContent = n;
    else {
      clearInterval(iv); countdownEl.style.display = "none";
      flash.style.opacity = "0.85"; setTimeout(() => flash.style.opacity = "0", 130);
      shutterSound.play().catch(()=>{});
      const tmp = document.createElement("canvas");
      tmp.width = video.videoWidth; tmp.height = video.videoHeight;
      tmp.getContext("2d").drawImage(video, 0, 0);
      const img = new Image(); img.onload = () => { capturedPhotos[idx] = img; renderDots(); onDone(); };
      img.src = tmp.toDataURL("image/jpeg");
    }
  }, 1000);
}

function startShooting() {
  shootBtn.disabled = true;
  function next(i) { if (i >= 6) { shootBtn.disabled = false; shotLabel.style.display = "none"; stopCamera(); return; } shootOne(i, () => next(i + 1)); }
  next(capturedPhotos.length);
}

startCamBtn.onclick = startCamera;
stopCamBtn.onclick = stopCamera;
shootBtn.onclick = startShooting;

// [복구] 업로드 및 초기화 버튼 기능
document.getElementById("uploadBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = function () {
  Array.from(this.files).forEach(file => {
    if (capturedPhotos.length >= 6) return;
    const img = new Image();
    img.onload = () => { capturedPhotos.push(img); renderDots(); };
    img.src = URL.createObjectURL(file);
  });
  this.value = "";
};
document.getElementById("resetBtn").onclick = () => { capturedPhotos = []; selectedOrder = []; if (stream) stopCamera(); renderDots(); };

// ── 2. 사진 셀렉 ──
function buildSelectGrid() {
  selectGrid.innerHTML = ""; selectedOrder = [];
  capturedPhotos.forEach((img, i) => {
    const card = document.createElement("div"); card.className = "select-card";
    card.innerHTML = `<img src="${img.src}"><div class="check">✓</div><div class="order-badge"></div>`;
    card.onclick = () => {
      const pos = selectedOrder.indexOf(i);
      if (pos >= 0) { selectedOrder.splice(pos, 1); card.classList.remove("chosen"); }
      else if (selectedOrder.length < 4) { selectedOrder.push(i); card.classList.add("chosen"); }
      selectGrid.querySelectorAll(".select-card").forEach((c, idx) => {
        const b = c.querySelector(".order-badge"); const p = selectedOrder.indexOf(idx);
        b.textContent = p >= 0 ? (p + 1) + "번째" : "";
      });
      toDecorBtn.classList.toggle("ready", selectedOrder.length === 4);
    };
    selectGrid.appendChild(card);
  });
}
toSelectBtn.onclick = () => { if(capturedPhotos.length>=6) { buildSelectGrid(); goToStep(2); } };
toDecorBtn.onclick = () => { if(selectedOrder.length===4) { goToStep(3); requestAnimationFrame(() => { attachCanvasEvents(); drawFrame(); }); } };

// ── 3. 꾸미기 (404 에러 방지를 위해 경로 수정) ──
const LAYOUT_CONFIG = { "1_4": { mask: "assets/frame/1_4.png" }, "2_2": { mask: "assets/frame/2_2.png" }, "4_1": { mask: "assets/frame/4_1.png" } };
const THEMES = { 
  classic: { defaultBg: "#ffffff", overlaySrc: null }, 
  minimal: { defaultBg: "#1a1a2e", overlaySrc: "assets/frame/minimal_overlay.png" }, // 경로를 assets/frame으로 통일
  film: { defaultBg: "#f59e0b", overlaySrc: "assets/frame/film_overlay.png" } 
};

const preloadedImages = {};
function preloadAssets() {
  Object.values(LAYOUT_CONFIG).forEach(l => { const img = new Image(); img.onload = () => preloadedImages[l.mask] = img; img.src = l.mask; });
  Object.values(THEMES).forEach(t => { if(t.overlaySrc) { const img = new Image(); img.onload = () => preloadedImages[t.overlaySrc] = img; img.src = t.overlaySrc; } });
}
preloadAssets();

async function drawFrame() {
  const { canvas, ctx } = getCanvas();
  const config = LAYOUT_CONFIG[currentLayout];
  const frameImg = preloadedImages[config.mask];
  if (!canvas || !frameImg) return;
  const theme = THEMES[currentTheme] || THEMES["classic"];

  if (canvas.width !== frameImg.width || canvas.height !== frameImg.height) {
    canvas.width = frameImg.width; canvas.height = frameImg.height;
    currentDetectedSlots = [];
  }
  if (currentDetectedSlots.length === 0) currentDetectedSlots = await detectSlotsFromImage(frameImg);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bgColor !== "#ffffff" ? bgColor : (theme.defaultBg || "#ffffff");
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 10); ctx.fill();

  if (bgImage) {
    ctx.save(); roundRect(ctx, 0, 0, canvas.width, canvas.height, 10); ctx.clip();
    const s = Math.max(canvas.width/bgImage.width, canvas.height/bgImage.height);
    ctx.drawImage(bgImage, (canvas.width-bgImage.width*s)/2, (canvas.height-bgImage.height*s)/2, bgImage.width*s, bgImage.height*s);
    ctx.restore();
  }

  ctx.drawImage(frameImg, 0, 0);

  currentDetectedSlots.forEach((s, i) => {
    const photoIdx = selectedOrder[i]; const img = capturedPhotos[photoIdx];
    if (img) {
      ctx.save(); roundRect(ctx, s.x, s.y, s.w, s.h, 2); ctx.clip();
      const sc = Math.max(s.w / img.width, s.h / img.height);
      ctx.drawImage(img, s.x + (s.w - img.width * sc) / 2, s.y + (s.h - img.height * sc) / 2, img.width * sc, img.height * sc);
      ctx.restore();
    }
  });

  if (theme.overlaySrc && preloadedImages[theme.overlaySrc]) ctx.drawImage(preloadedImages[theme.overlaySrc], 0, 0, canvas.width, canvas.height);
  
  stickers.forEach(st => {
    ctx.save();
    if (st.type === "image" && loadedStickerImgs[st.src]) ctx.drawImage(loadedStickerImgs[st.src], st.x - st.size/2, st.y - st.size/2, st.size, st.size);
    else if (st.text) {
      ctx.font = "bold 20px Nunito, sans-serif"; ctx.fillStyle = (theme.defaultBg==="#1a1a2e")?"#fff":"#222";
      ctx.textAlign = "center"; ctx.fillText(st.text, st.x, st.y);
    }
    ctx.restore();
  });
}

// ── 4. 인터랙션 (TypeError 완벽 수정) ──
let canvasEventsAttached = false;
function attachCanvasEvents() {
  if (canvasEventsAttached) return;
  const { canvas } = getCanvas();
  const handleMove = (ex, ey) => {
    if (dragging === null || dragging === -1 || !stickers[dragging]) return;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    stickers[dragging].x = (ex - r.left) * sx - dragOffset.x;
    stickers[dragging].y = (ey - r.top) * sy - dragOffset.y;
    drawFrame();
  };
  canvas.onmousedown = (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
    const idx = stickers.findIndex(s => Math.abs(px - s.x) < 40 && Math.abs(py - s.y) < 40);
    if (idx >= 0) { dragging = idx; dragOffset = { x: px - stickers[idx].x, y: py - stickers[idx].y }; }
    else dragging = null;
  };
  window.onmousemove = (e) => handleMove(e.clientX, e.clientY);
  window.onmouseup = () => dragging = null;
  canvas.ondblclick = (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width/r.width, sy = canvas.height/r.height;
    const px = (e.clientX-r.left)*sx, py = (e.clientY-r.top)*sy;
    const idx = stickers.findIndex(s => Math.abs(px-s.x)<40 && Math.abs(py-s.y)<40);
    if(idx>=0) { stickers.splice(idx, 1); drawFrame(); }
  };
  canvasEventsAttached = true;
}

// ── 5. 저장 및 광고 제거 QR (수정됨) ──
toSaveBtn.onclick = () => {
  const { canvas } = getCanvas();
  if (!canvas) return;
  
  savePreview.src = canvas.toDataURL("image/png");
  
  // 가로/세로 비율에 따른 미리보기 스타일 설정
  if (canvas.width > canvas.height) {
    savePreview.style.width = "100%";
    savePreview.style.height = "auto";
  } else {
    savePreview.style.width = "auto";
    savePreview.style.height = "70vh";
  }
  savePreview.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  
  goToStep(4); 
  generateQR(savePreview.src); 
};

dlBtn.onclick = () => { const a = document.createElement("a"); a.download = "my_life4cuts.png"; a.href = savePreview.src; a.click(); };

async function generateQR(dataUrl) {
  const qrL = document.getElementById("qrLoading"), qrC = document.getElementById("qrCanvas");
  if (!qrL || !qrC) return;

  qrL.style.display = "block"; 
  qrC.style.display = "none";
  qrC.innerHTML = ""; // 이전 QR 초기화

  try {
    const res = await fetch("upload.php", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ image: dataUrl }) 
    });
    const data = await res.json();
    
    // 라이브러리 존재 여부 및 데이터 상태 확인
    if (data.status === "success" && data.url) {
      if (typeof QRCode === "undefined") {
        qrL.textContent = "QRCode 라이브러리 없음";
        return;
      }
      
      // 광고 없는 순수 직접 주소로 QR 생성
      new QRCode(qrC, { 
        text: data.url, 
        width: 150, 
        height: 150,
        correctLevel : QRCode.CorrectLevel.H 
      });
      
      qrL.style.display = "none"; 
      qrC.style.display = "block";
    } else {
      qrL.textContent = "데이터 처리 오류";
    }
  } catch (e) { 
    qrL.textContent = "네트워크 연결 실패";
    console.error("QR Error:", e);
  }
}
restartBtn.onclick = () => location.reload();

// ── 6. UI 리스너 ──
document.getElementById("layoutGallery")?.addEventListener("click", (e) => {
  const item = e.target.closest(".frame-thumb"); if (!item) return;
  document.querySelectorAll("#layoutGallery .frame-thumb").forEach(t => t.classList.remove("active"));
  item.classList.add("active"); currentLayout = item.dataset.layout; currentDetectedSlots = []; drawFrame();
});
document.getElementById("themeGallery")?.addEventListener("click", (e) => {
  const item = e.target.closest(".frame-thumb"); if (!item) return;
  document.querySelectorAll("#themeGallery .frame-thumb").forEach(t => t.classList.remove("active"));
  item.classList.add("active"); currentTheme = item.dataset.frame; drawFrame();
});
document.querySelectorAll(".color-dot").forEach(dot => {
  dot.onclick = function() { document.querySelectorAll(".color-dot").forEach(d => d.classList.remove("active")); this.classList.add("active"); bgColor = this.dataset.color; drawFrame(); };
});
document.getElementById("addTextBtn").onclick = () => {
  const val = document.getElementById("textInput").value.trim(); if (!val) return;
  const { canvas } = getCanvas(); stickers.push({ text: val, x: canvas.width/2, y: canvas.height-40 });
  document.getElementById("textInput").value = ""; drawFrame();
};
document.getElementById("bgImgBtn").onclick = () => document.getElementById("bgImgInput").click();
document.getElementById("bgImgInput").onchange = function() {
  const file = this.files[0]; if(!file) return;
  const img = new Image(); img.onload = () => { bgImage = img; drawFrame(); }; img.src = URL.createObjectURL(file);
};
document.getElementById("bgImgClearBtn").onclick = () => { bgImage = null; drawFrame(); };

let loadedStickerImgs = {}; 
async function initStickerUI() {
  const row = document.querySelector(".sticker-row"); if (!row) return;
  try {
    const res = await fetch("get_assets.php"); const json = await res.json();
    if (json.status === "success") {
      row.innerHTML = "";
      json.data.forEach(src => {
        const img = new Image(); img.onload = () => loadedStickerImgs[src] = img; img.src = src;
        const btn = document.createElement("div"); btn.className = "sticker-btn";
        btn.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">`;
        btn.onclick = () => { const { canvas } = getCanvas(); stickers.push({ type: "image", src: src, x: canvas.width/2, y: canvas.height/2, size: 80 }); drawFrame(); };
        row.appendChild(btn);
      });
    }
  } catch (e) { row.innerHTML = "로드 실패"; }
}

initStickerUI(); renderDots(); goToStep(1);