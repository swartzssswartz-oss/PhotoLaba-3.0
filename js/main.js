// main.js
// Точка входа. Склеивает state + filmDatabase + pipeline + ui,
// плюс всё, что специфично для этой страницы: загрузка фото, экспорт PNG, сброс.




const canvas = document.getElementById('filmCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let sourceImg = null;
const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });

function hasSourceImg() {
  return !!sourceImg;
}

function requestRender() {
  if (!state.renderPending && sourceImg) {
    state.renderPending = true;
    requestAnimationFrame(() => renderFilmPipeline(ctx, canvas, previewCanvas));
  }
}

function preparePreviewBuffer() {
  const maxDim = 1200;
  const scale = Math.min(1, maxDim / Math.max(sourceImg.width, sourceImg.height));
  previewCanvas.width = Math.round(sourceImg.width * scale);
  previewCanvas.height = Math.round(sourceImg.height * scale);
  previewCtx.drawImage(sourceImg, 0, 0, previewCanvas.width, previewCanvas.height);

  canvas.width = previewCanvas.width;
  canvas.height = previewCanvas.height;

  document.getElementById('uploadOverlay').classList.add('hidden');
  requestRender();
}

// --- Wire up UI modules ---
initMobileTabs();
const { updateCurveSvg } = initCurveEditor(requestRender);

function handlePresetSelect(id) {
  selectPreset(id, requestRender, hasSourceImg);
}

renderPresetsList(handlePresetSelect);
initPresetFilterTabs(() => renderPresetsList(handlePresetSelect));
bindAllSliders(requestRender);
bindSelectsAndText(requestRender);

// --- Upload ---
document.getElementById('btnCenterUpload').addEventListener('click', () => {
  document.getElementById('fileUploader').click();
});
document.getElementById('btnHeaderUpload').addEventListener('click', () => {
  document.getElementById('fileUploader').click();
});

document.getElementById('fileUploader').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    sourceImg = img;
    preparePreviewBuffer();
  };
  img.src = URL.createObjectURL(file);
});

// --- Reset ---
document.getElementById('btnReset').addEventListener('click', () => {
  resetState();
  document.querySelectorAll('input[type="range"]').forEach(input => {
    const key = input.id.replace('param', '');
    const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
    if (state[lowerKey] !== undefined) {
      input.value = state[lowerKey];
      input.dispatchEvent(new Event('input'));
    }
  });
  document.getElementById('paramDevType').value = 'st2';
  document.getElementById('paramPaper').value = 'rc';
  document.getElementById('paramToner').value = 'none';
  document.getElementById('paramFrame').value = 'none';
  document.getElementById('paramFrameText').value = state.frameText;
  document.getElementById('paramImprint').checked = false;
  document.getElementById('paramImprintText').value = '';
  updateCurveSvg();
});

// --- Export ---
document.getElementById('btnExport').addEventListener('click', () => {
  if (!sourceImg) return;
  renderFilmPipeline(ctx, canvas, previewCanvas);
  const link = document.createElement('a');
  link.download = `SvemaLab_Mobile_${state.preset}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// --- Init ---
handlePresetSelect('svema64');
updateCurveSvg();
