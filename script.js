document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = 'vipCardData';

  // ---------- 저장/불러오기 헬퍼 ----------
  function saveData(partial) {
    let data = {};
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) { data = {}; }
    data = { ...data, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('저장 용량 초과 (사진이 너무 클 수 있음):', e);
    }
  }

  function loadData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  const saved = loadData();

  // ---------- 텍스트 입력 연동 (대소문자 그대로 표시) ----------
  const coordiInput = $('coordiCode');
  const memberInput = $('memberId');
  const outCoordi = $('outCoordi');
  const outMemberId = $('outMemberId');

  if (saved.coordiCode !== undefined) {
    coordiInput.value = saved.coordiCode;
    outCoordi.textContent = saved.coordiCode || '-';
  }
  if (saved.memberId !== undefined) {
    memberInput.value = saved.memberId;
    outMemberId.textContent = saved.memberId || '-';
  }

  coordiInput.addEventListener('input', () => {
    outCoordi.textContent = coordiInput.value || '-';
    saveData({ coordiCode: coordiInput.value });
  });
  memberInput.addEventListener('input', () => {
    outMemberId.textContent = memberInput.value || '-';
    saveData({ memberId: memberInput.value });
  });

  // ---------- 화면 확대/축소 (Zoom) 상태 제어 ----------
  const stage = $('stage');
  const stageScaler = $('stageScaler');
  const CARD_W = 856;
  let currentZoom = 1;
  let globalScale = 1;

  function fitStage() {
    const w = stage.clientWidth;
    const scale = Math.min(1, w / CARD_W) * currentZoom;
    globalScale = scale;
    stageScaler.style.transform = `scale(${scale})`;
  }

  const zoomLabel = $('zoomLabel');
  $('zoomIn').addEventListener('click', () => {
    currentZoom = Math.min(1.5, currentZoom + 0.1);
    zoomLabel.textContent = Math.round(currentZoom * 100) + '%';
    fitStage();
  });
  $('zoomOut').addEventListener('click', () => {
    currentZoom = Math.max(0.5, currentZoom - 0.1);
    zoomLabel.textContent = Math.round(currentZoom * 100) + '%';
    fitStage();
  });

  window.addEventListener('resize', fitStage);
  window.addEventListener('load', fitStage);
  fitStage();

  // ---------- 사진 드래그 & 스케일 로직 (위치/크기 자동저장) ----------
  function makeDraggableAndScalable(imgElement, scaleInputEl, scaleValEl, posValEl, initial) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let translateX = initial && initial.x !== undefined ? initial.x : 0;
    let translateY = initial && initial.y !== undefined ? initial.y : 0;
    let scale = initial && initial.scale !== undefined ? initial.scale : (parseFloat(scaleInputEl.value) || 1);

    scaleInputEl.value = scale;

    function updateTransform(persist) {
      imgElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      if (scaleValEl) scaleValEl.textContent = Math.round(scale * 100) + '%';
      if (posValEl) posValEl.textContent = `X: ${Math.round(translateX)}, Y: ${Math.round(translateY)}`;
      if (persist) {
        saveData({ photoTransform: { x: translateX, y: translateY, scale } });
      }
    }

    scaleInputEl.addEventListener('input', (e) => {
      scale = parseFloat(e.target.value);
      updateTransform(true);
    });

    imgElement.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      imgElement.style.cursor = 'grabbing';
      startX = e.clientX - (translateX * globalScale);
      startY = e.clientY - (translateY * globalScale);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      translateX = (e.clientX - startX) / globalScale;
      translateY = (e.clientY - startY) / globalScale;
      updateTransform(false);
    });

    const stopDragging = () => {
      if (isDragging) {
        isDragging = false;
        imgElement.style.cursor = 'grab';
        updateTransform(true);
      }
    };

    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('mouseleave', stopDragging);

    updateTransform(false);
  }

  // ---------- 프로필 사진 업로더 ----------
  const photoInput = $('photoInput');
  const photoThumb = $('photoThumb');
  const photoFileName = $('photoFileName');
  const photoClear = $('photoClear');
  const cardPhoto = $('cardPhoto');
  const photoScaleControl = $('photoScaleControl');
  const photoScale = $('photoScale');
  const photoScaleVal = $('photoScaleVal');
  const photoPosVal = $('photoPosVal');

  const thumbDefaultHTML = photoThumb.innerHTML;
  const cardPhotoDefaultHTML = cardPhoto.innerHTML;

  function applyPhoto(dataUrl, fileName, transform) {
    photoThumb.innerHTML = `<img src="${dataUrl}" alt="thumbnail">`;
    photoFileName.textContent = fileName || '저장된 사진';

    cardPhoto.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'draggable-image';
    cardPhoto.appendChild(img);

    photoScaleControl.classList.remove('hidden');
    makeDraggableAndScalable(img, photoScale, photoScaleVal, photoPosVal, transform);
  }

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      applyPhoto(dataUrl, file.name, { x: 0, y: 0, scale: 1 });
      saveData({ photoDataUrl: dataUrl, photoFileName: file.name, photoTransform: { x: 0, y: 0, scale: 1 } });
    };
    reader.readAsDataURL(file);
  });

  photoClear.addEventListener('click', () => {
    photoInput.value = '';
    photoThumb.innerHTML = thumbDefaultHTML;
    photoFileName.textContent = '선택된 파일 없음';
    cardPhoto.innerHTML = cardPhotoDefaultHTML;
    photoScaleControl.classList.add('hidden');
    saveData({ photoDataUrl: null, photoFileName: null, photoTransform: null });
  });

  if (saved.photoDataUrl) {
    applyPhoto(saved.photoDataUrl, saved.photoFileName, saved.photoTransform);
  }

  // ---------- 컬러 테마 변경 (자동저장) ----------
  const swatches = document.querySelectorAll('.swatch');
  swatches.forEach(sw => {
    sw.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const c1 = sw.getAttribute('data-c1');
      const c2 = sw.getAttribute('data-c2');
      document.documentElement.style.setProperty('--bg-color-1', c1);
      document.documentElement.style.setProperty('--bg-color-2', c2);
      saveData({ themeC1: c1, themeC2: c2 });
    });
  });

  if (saved.themeC1 && saved.themeC2) {
    document.documentElement.style.setProperty('--bg-color-1', saved.themeC1);
    document.documentElement.style.setProperty('--bg-color-2', saved.themeC2);
    swatches.forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-c1') === saved.themeC1);
    });
  }

  // ---------- 고화질 PNG 저장 ----------
  const downloadBtn = $('downloadBtn');
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.classList.add('loading');
    downloadBtn.textContent = '고화질 이미지 렌더링 중...';
    try {
      const card = $('card');
      const canvas = await html2canvas(card, {
        scale: 4,
        useCORS: true,
        backgroundColor: null
      });
      const link = document.createElement('a');
      const memberVal = (memberInput.value || 'VIP').trim();
      link.download = `Black-Edition-${memberVal}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('이미지 저장 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      downloadBtn.classList.remove('loading');
      downloadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16"/></svg> 고해상도 실물 렌더링 저장';
    }
  });
});