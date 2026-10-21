
    const canvas = document.getElementById('filmCanvas');
    const ctx = canvas.getContext('2d');
    let sourceImg = null;
    let previewCanvas = document.createElement('canvas');
    let previewCtx = previewCanvas.getContext('2d');

    // Уменьшенный "черновой" буфер для отзывчивого рендера во время драга слайдеров.
    const FAST_PREVIEW_MAX_DIM = 420;
    let fastPreviewCanvas = document.createElement('canvas');
    let fastPreviewCtx = fastPreviewCanvas.getContext('2d');
    let lowResMode = false;

    // ────────────────────────────────────────────────────────────────────
    // Pinch-zoom и пан по превью (двумя пальцами — приблизить/отдалить,
    // одним пальцем при зуме — двигать кадр, двойной тап — сбросить).
    // Масштабируется сам элемент <canvas> через CSS transform — это чисто
    // визуальный зум поверх уже отрендеренного кадра, он не трогает
    // реальные пиксели и не влияет на движок обработки/экспорт.
    // Скролл/зум страницы этими же пальцами отключён через touch-action:
    // none на .canvas-container (components.css).
    // ────────────────────────────────────────────────────────────────────
    (function initCanvasPinchZoom() {
      const container = document.getElementById('canvasContainer');
      const target = document.getElementById('filmCanvas');
      const MIN_SCALE = 1, MAX_SCALE = 4;
      let scale = 1, panX = 0, panY = 0;
      let lastDist = null;
      let panStart = null;
      let lastTapTime = 0;

      function apply() {
        target.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      }

      function reset() {
        scale = 1; panX = 0; panY = 0;
        apply();
      }

      function touchDist(a, b) {
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      }

      container.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
          lastDist = touchDist(e.touches[0], e.touches[1]);
        } else if (e.touches.length === 1 && scale > 1) {
          panStart = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
        }
      }, { passive: true });

      container.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && lastDist) {
          e.preventDefault();
          const d = touchDist(e.touches[0], e.touches[1]);
          scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (d / lastDist)));
          lastDist = d;
          apply();
        } else if (e.touches.length === 1 && panStart) {
          e.preventDefault();
          panX = e.touches[0].clientX - panStart.x;
          panY = e.touches[0].clientY - panStart.y;
          apply();
        }
      }, { passive: false });

      container.addEventListener('touchend', e => {
        if (e.touches.length < 2) lastDist = null;
        if (e.touches.length === 0) {
          panStart = null;
          if (scale <= 1) reset();

          const now = Date.now();
          if (now - lastTapTime < 300) reset();
          lastTapTime = now;
        }
      });
      container.addEventListener('touchcancel', () => { lastDist = null; panStart = null; });

      // Доступно снаружи — сбрасываем зум при загрузке нового фото
      // (см. handleFileSelected), чтобы не открывать новый кадр
      // приближённым/сдвинутым от прошлого.
      window.resetCanvasZoom = reset;
    })();

    // Mobile Tab Navigation Logic
    const headerMoreActions = document.getElementById('headerMoreActions');
    if (headerMoreActions) {
      headerMoreActions.addEventListener('click', event => {
        if (event.target.closest('.header-more-menu button')) headerMoreActions.open = false;
      });
      document.addEventListener('click', event => {
        if (headerMoreActions.open && !headerMoreActions.contains(event.target)) headerMoreActions.open = false;
      });
    }

    const tabs = document.querySelectorAll('.m-tab');
    const tabsArray = Array.from(tabs);
    const mobileNav = document.getElementById('mobileNavTabs');
    const leftSidebar = document.getElementById('section-presets');
    const rightSidebar = document.getElementById('section-right-controls');
    const mobileSections = document.querySelectorAll('.mobile-section');

    // Единственная точка применения состояния навигации. Возвращаясь из
    // свёрнутого состояния, мобильные браузеры иногда восстанавливают старый
    // слой страницы; повторное применение классов после pageshow/visibilitychange
    // синхронизирует видимую панель с выбранной вкладкой.
    function applyMobileTab(tabKey) {
      const selected = tabsArray.find(tab => tab.dataset.tab === tabKey) || tabsArray[0];
      if (!selected) return;
      tabsArray.forEach(tab => {
        const active = tab === selected;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });

      const presetsActive = selected.dataset.tab === 'presets';
      leftSidebar.classList.toggle('mobile-active', presetsActive);
      rightSidebar.classList.toggle('mobile-active', !presetsActive);
      mobileSections.forEach(section => {
        section.classList.toggle('active-mobile-section', !presetsActive && section.dataset.mGroup === selected.dataset.tab);
      });
    }

    mobileNav.setAttribute('role', 'tablist');
    tabsArray.forEach(tab => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', tab.dataset.tab === 'presets' ? 'section-presets' : 'mobile-section-' + tab.dataset.tab);
      tab.addEventListener('click', () => applyMobileTab(tab.dataset.tab));
      tab.addEventListener('keydown', event => {
        const current = tabsArray.indexOf(tab);
        let next = current;
        if (event.key === 'ArrowRight') next = (current + 1) % tabsArray.length;
        else if (event.key === 'ArrowLeft') next = (current - 1 + tabsArray.length) % tabsArray.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabsArray.length - 1;
        else return;
        event.preventDefault();
        tabsArray[next].focus();
        applyMobileTab(tabsArray[next].dataset.tab);
      });
    });
    mobileSections.forEach(section => {
      section.id = 'mobile-section-' + section.dataset.mGroup;
      section.setAttribute('role', 'tabpanel');
    });
    applyMobileTab(document.querySelector('.m-tab.active')?.dataset.tab || 'presets');

    function restoreMobileTab() {
      const active = document.querySelector('.m-tab.active');
      applyMobileTab(active?.dataset.tab || 'presets');
      // Просим движок браузера заново пересчитать разметку после возврата из
      // фона или смены ориентации, когда размеры визуального viewport меняются.
      requestAnimationFrame(() => {
        if (document.visibilityState !== 'hidden') {
          applyMobileTab(active?.dataset.tab || 'presets');
          // Чтение размеров заставляет WebKit пересчитать display/flex после
          // восстановления вкладки из замороженного состояния.
          void rightSidebar.offsetHeight;
        }
      });
    }
    window.addEventListener('pageshow', restoreMobileTab);
    window.addEventListener('orientationchange', restoreMobileTab);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') restoreMobileTab();
    });

    let touchStartX = 0;
    let touchEndX = 0;

    mobileNav.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mobileNav.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) < swipeThreshold) return;

      const activeTab = document.querySelector('.m-tab.active');
      const currentIndex = tabsArray.indexOf(activeTab);

      if (diff > 0 && currentIndex < tabsArray.length - 1) {
        // Swipe left - next tab
        tabsArray[currentIndex + 1].click();
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous tab
        tabsArray[currentIndex - 1].click();
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // Рейка разделов (широкий экран): панели там не переключаются, а идут
    // стопкой, поэтому разделы получают навигацию. Клик ведёт к нужной
    // секции, подпись раздела обновляется по прокрутке.
    // ────────────────────────────────────────────────────────────────────
    (function initSectionRail() {
      const rail = document.getElementById('sectionRail');
      const rightSidebar = document.getElementById('section-right-controls');
      if (!rail || !rightSidebar) return;

      const items = Array.from(rail.querySelectorAll('.rail-item'));
      const railItems = {};
      items.forEach(it => { railItems[it.dataset.tab] = it; });

      function groupY(key) {
        if (key === 'presets') return 0;
        const sec = rightSidebar.querySelector('.mobile-section[data-m-group="' + key + '"]');
        return sec ? sec.offsetTop - 40 : 0;
      }

      items.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          rightSidebar.scrollTo({ top: groupY(item.dataset.tab), behavior: 'smooth' });
          items.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
        });
      });

      // Раздел подсвечивается по факту прокрутки: рейка читается как навигация
      let railTick = false;
      rightSidebar.addEventListener('scroll', () => {
        if (railTick) return;
        railTick = true;
        requestAnimationFrame(() => {
          railTick = false;
          const y = rightSidebar.scrollTop + 60;
          let current = 'response';
          ['response', 'grain', 'defects', 'style'].forEach(key => {
            if (groupY(key) <= y) current = key;
          });
          items.forEach(i => i.classList.toggle('active', i.dataset.tab === current));
        });
      }, { passive: true });
    })();

    // ────────────────────────────────────────────────────────────────────
    // Аккордеон панелей: критично для мобильного формата — иначе пришлось
    // бы листать десятки слайдеров, чтобы найти нужный модуль. На мобильном
    // по умолчанию раскрыта только первая панель в каждой группе вкладок,
    // на десктопе — открыто всё, как раньше.
    // ────────────────────────────────────────────────────────────────────
    (function initAccordion() {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      document.querySelectorAll('.panel-block').forEach((block, index) => {
        const header = block.querySelector('.panel-header');
        const title = header && header.querySelector('.panel-title');
        const body = block.querySelector('.panel-body');
        if (!header || !title || !body) return;

        if (isMobile) {
          const group = block.closest('.mobile-section') || block.closest('#section-presets');
          const isFirstInGroup = group && group.querySelector('.panel-block') === block;
          if (!isFirstInGroup) block.classList.add('collapsed');
        }

        if (!body.id) body.id = `panel-body-${index + 1}`;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'panel-toggle';
        toggle.setAttribute('aria-controls', body.id);

        const chevron = document.createElement('span');
        chevron.className = 'panel-chevron';
        chevron.textContent = '▾';
        toggle.appendChild(chevron);
        header.appendChild(toggle);

        function syncAccordionState() {
          const expanded = !block.classList.contains('collapsed');
          toggle.setAttribute('aria-expanded', String(expanded));
          toggle.setAttribute('aria-label', `${expanded ? 'Свернуть' : 'Раскрыть'}: ${title.textContent.trim()}`);
          body.setAttribute('aria-hidden', String(!expanded));
          body.inert = !expanded;
        }
        function toggleAccordion() {
          block.classList.toggle('collapsed');
          syncAccordionState();
        }
        toggle.addEventListener('click', toggleAccordion);
        header.addEventListener('click', event => {
          if (event.target.closest('button')) return;
          toggleAccordion();
        });
        syncAccordionState();
      });
    })();

    // ────────────────────────────────────────────────────────────────────
    // Защита слайдеров от случайных тапов при скролле (мобильные).
    // Раньше касание ЛЮБОЙ точки трека слайдера пальцем — даже мимоходом,
    // когда человек просто листает страницу — сразу же прыгало значением
    // в точку тапа (стандартное поведение <input type="range">). Теперь
    // тач засчитывается только если он начался рядом с самим бегунком —
    // иначе это, скорее всего, просто скролл, и мы его не трогаем.
    // На мышь/трекпад (десктоп) это не влияет — там клик по треку
    // по-прежнему сразу переставляет значение, как и ожидается.
    // ────────────────────────────────────────────────────────────────────
    (function guardSlidersFromAccidentalTouch() {
      const THUMB_SIZE = window.matchMedia('(max-width: 900px)').matches ? 24 : 18;
      const HIT_PADDING = 18; // запас вокруг бегунка, px

      document.addEventListener('touchstart', (e) => {
        const input = e.target.closest && e.target.closest('input[type="range"]');
        if (!input) return;
        const touch = e.touches[0];
        if (!touch) return;

        const min = parseFloat(input.min || '0');
        const max = parseFloat(input.max || '100');
        const val = parseFloat(input.value || '0');
        const rect = input.getBoundingClientRect();
        const percent = max > min ? (val - min) / (max - min) : 0;
        // Бегунок отрисовывается внутри трека, поэтому его центр считается по
        // «полезной» ширине (ширина минус диаметр бегунка). Дополнительно
        // проверяем вертикаль: касание выше/ниже дорожки — это скролл списка
        // слайдеров, а не попытка взяться за бегунок.
        const usable = Math.max(0, rect.width - THUMB_SIZE);
        const thumbCenterX = rect.left + THUMB_SIZE / 2 + percent * usable;
        const insideThumbBox =
          Math.abs(touch.clientX - thumbCenterX) <= (THUMB_SIZE / 2 + HIT_PADDING) &&
          touch.clientY >= rect.top - HIT_PADDING &&
          touch.clientY <= rect.bottom + HIT_PADDING;

        if (!insideThumbBox) {
          e.preventDefault(); // мимо бегунка — считаем это скроллом, не хватаем слайдер
        }
      }, { passive: false });
    })();

    // Точки мастер-кривой крупнее на мобильном — легче попасть пальцем
    const CURVE_HANDLE = window.matchMedia('(max-width: 900px)').matches ? 20 : 12;

    // SVG Curve Setup & Touch Support (мастер-кривая, творческая часть Film Response)
    const svg = document.getElementById('curveSvg');
    const p1El = document.getElementById('p1');
    const p2El = document.getElementById('p2');
    const p1Hit = document.getElementById('p1Hit');
    const p2Hit = document.getElementById('p2Hit');
    const curvePath = document.getElementById('curvePath');

    // ────────────────────────────────────────────────────────────────────
    // Мастер-кривая: перетаскивание узлов.
    // Раньше здесь были mousedown на самих квадратиках + mousemove/touchmove
    // на window. На телефоне это работало плохо: палец, начавший движение на
    // узле, уезжал из него — и обработчик «терял» точку, потому что события
    // приходили только пока палец оставался над узлом; а сам узел при
    // нажатии ещё и масштабировался (`.curve-handle:active { transform:
    // scale() }`) с origin по центру viewBox — квадратик уезжал из-под пальца
    // ровно в момент захвата.
    // Сейчас: Pointer Events + setPointerCapture (точка остаётся захваченной,
    // куда бы палец ни ушёл), узел ловит касание через closest(), у каждого
    // узла есть невидимая зона захвата, а CSS-трансформации узлов привязаны к
    // их собственному bounding box (см. .curve-handle в modules.css).
    // Невидимая зона захвата вокруг узла. Радиус считается в единицах viewBox,
    // но отталкивается от реального размера на экране: viewBox 200×120 при
    // preserveAspectRatio по умолчанию вписывается в блок с полями, поэтому
    // «30 единиц» — это вовсе не 30 экранных пикселей (на телефоне получалось
    // меньше 25 px, и по узлу нельзя было попасть пальцем). Масштаб берём у
    // самого квадратика: его ширина в единицах viewBox известна (CURVE_HANDLE),
    // а фактическая — из getBoundingClientRect().
    const CURVE_MIN_HIT_PX = 34;
    function curveHitRadiusUnits() {
      let pxPerUnit = 0;
      if (p1El && p1El.getBoundingClientRect) {
        const px = p1El.getBoundingClientRect().width;
        if (px > 0) pxPerUnit = px / CURVE_HANDLE;
      }
      if (!pxPerUnit) pxPerUnit = 0.55; // запасной вариант до первой раскладки
      return Math.max(CURVE_HANDLE / 2, (CURVE_MIN_HIT_PX / 2) / pxPerUnit);
    }

    function updateCurveSvg() {
      curvePath.setAttribute('d', `M 0 120 C ${state.p1.x} ${state.p1.y}, ${state.p2.x} ${state.p2.y}, 200 0`);
      const half = CURVE_HANDLE / 2;
      [p1El, p2El].forEach((el, idx) => {
        const pt = idx === 0 ? state.p1 : state.p2;
        el.setAttribute('width', CURVE_HANDLE);
        el.setAttribute('height', CURVE_HANDLE);
        el.setAttribute('x', pt.x - half);
        el.setAttribute('y', pt.y - half);
      });
      const hitR = curveHitRadiusUnits();
      [p1El, p2El].forEach((el, idx) => {
        const pt = idx === 0 ? state.p1 : state.p2;
        const hit = idx === 0 ? p1Hit : p2Hit;
        if (!hit) return;
        hit.setAttribute('cx', pt.x);
        hit.setAttribute('cy', pt.y);
        hit.setAttribute('r', hitR);
      });
      if (sourceImg) requestRenderLive();
    }

    function getSvgCoords(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(200, (clientX - rect.left) * (200 / rect.width))),
        y: Math.max(0, Math.min(120, (clientY - rect.top) * (120 / rect.height)))
      };
    }

    // Кривая идёт от (0,120) к (200,0): узлы не должны выезжать за края и
    // меняться местами по X — иначе кривая «выворачивается» и перестаёт
    // отвечать на движение пальца.
    const CURVE_MIN_GAP = 12;
    function setCurvePoint(which, raw) {
      if (which === 'p1') {
        state.p1.x = Math.min(raw.x, state.p2.x - CURVE_MIN_GAP);
        state.p1.y = raw.y;
      } else {
        state.p2.x = Math.max(raw.x, state.p1.x + CURVE_MIN_GAP);
        state.p2.y = raw.y;
      }
      updateCurveSvg();
    }

    let curveDrag = null;

    function startCurveDrag(el, which, e) {
      const pt = which === 'p1' ? state.p1 : state.p2;
      curveDrag = { el, which, moved: false };
      // Тянем именно за тот узел, за который взялись: пока палец/курсор
      // двигается, наведение на другой узел ничего не перехватывает.
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      }
      // Пока тянем — без анимации пути, иначе кривая «догоняет» палец.
      curvePath.style.transition = 'none';
      el.classList.add('dragging');
      document.body.classList.add('curve-dragging');
      // Если взялись не за центр узла — не даём кривой прыгнуть под палец.
      const c = getSvgCoords(e.clientX, e.clientY);
      curveDrag.offset = { x: pt.x - c.x, y: pt.y - c.y };
      e.preventDefault();
      return true;
    }

    if (svg) {
      svg.addEventListener('pointerdown', (e) => {
        const target = e.target.closest ? e.target.closest('.curve-handle, .curve-hit') : null;
        if (!target) return;
        // getAttribute, а не dataset: у SVG-элементов dataset есть не везде.
        const which = target.getAttribute('data-point') === 'p2' ? 'p2' : 'p1';
        startCurveDrag(target, which, e);
      });

      svg.addEventListener('pointermove', (e) => {
        if (!curveDrag) return;
        e.preventDefault();
        const c = getSvgCoords(e.clientX, e.clientY);
        const off = curveDrag.offset || { x: 0, y: 0 };
        setCurvePoint(curveDrag.which, { x: c.x + off.x, y: c.y + off.y });
        curveDrag.moved = true;
      });

      function endCurveDrag(e) {
        if (!curveDrag) return;
        const { el } = curveDrag;
        try { if (e && e.pointerId !== undefined) el.releasePointerCapture(e.pointerId); } catch (err) {}
        el.classList.remove('dragging');
        document.body.classList.remove('curve-dragging');
        curvePath.style.transition = '';
        curveDrag = null;
      }
      svg.addEventListener('pointerup', endCurveDrag);
      svg.addEventListener('pointercancel', endCurveDrag);
      svg.addEventListener('lostpointercapture', endCurveDrag);
    }

    // Presets List
    // ────────────────────────────────────────────────────────────────────
    // Свои пресеты — localStorage. Пресет запоминает ВЕСЬ текущий state
    // (включая базовую плёнку, на которой он основан — для bwMix/ИК/т.д.),
    // кроме явно "фотографических" полей (кадр, поворот) и служебных.
    // ────────────────────────────────────────────────────────────────────
    const CUSTOM_PRESETS_KEY = 'svemaLabCustomPresets';
    const CUSTOM_PRESET_EXCLUDE = ['cropRect', 'rotation', 'renderPending', 'activeFilter'];

    function loadCustomPresets() {
      try {
        const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    function saveCustomPresetsToStorage(list) {
      try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list)); } catch (e) {
        alert('Не удалось сохранить пресет — возможно, закончилось место в хранилище браузера.');
      }
    }

    function captureCurrentLook() {
      const snapshot = {};
      Object.keys(state).forEach(key => {
        if (CUSTOM_PRESET_EXCLUDE.includes(key)) return;
        snapshot[key] = JSON.parse(JSON.stringify(state[key]));
      });
      return snapshot;
    }

    function saveCustomPreset(name) {
      const list = loadCustomPresets();
      list.unshift({ id: 'custom_' + Date.now(), name: name.trim() || 'Без названия', createdAt: Date.now(), snapshot: captureCurrentLook() });
      saveCustomPresetsToStorage(list);
      return list;
    }
    function deleteCustomPreset(id) {
      const list = loadCustomPresets().filter(p => p.id !== id);
      saveCustomPresetsToStorage(list);
      return list;
    }

    // Применяет ВСЕ поля сохранённого снимка к текущему state и синхронизирует
    // соответствующие UI-элементы (по общей конвенции id="param"+Key).
    function selectCustomPreset(id) {
      const custom = loadCustomPresets().find(p => p.id === id);
      if (!custom) return;
      activeCustomPresetId = id;

      const snapshot = JSON.parse(JSON.stringify(custom.snapshot));
      withControlWritesSuppressed(() => {
        Object.assign(state, snapshot);

        Object.keys(snapshot).forEach(key => {
          const el = document.getElementById('param' + key.charAt(0).toUpperCase() + key.slice(1));
          if (!el) return;
          if (el.type === 'checkbox') {
            el.checked = !!snapshot[key];
            el.dispatchEvent(new Event('change'));
          } else if (typeof snapshot[key] !== 'object') {
            el.value = snapshot[key];
            el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
          }
        });

        // Служебные обработчики некоторых select-полей могут менять сразу
        // несколько параметров. Снимок пресета остаётся источником истины.
        Object.assign(state, snapshot);
      });

      updateCurveSvg(); // p1/p2 — свои элементы управления (SVG), не param-инпут
      installMaskControls(); // маски — объекты, синхронизируются пересборкой панели
      // Зона захвата узлов считается от реального размера кривой на экране,
      // поэтому при смене размера окна её нужно пересчитать.
      window.addEventListener('resize', () => { if (!svg) return; updateCurveSvg(); });

      const baseFilm = filmDatabase.find(f => f.id === state.preset);
      document.getElementById('presetDesc').innerText = `Свой пресет «${custom.name}»` + (baseFilm ? ` (на основе ${baseFilm.name})` : '');
      if (baseFilm) {
        document.getElementById('hudGost').innerText = baseFilm.gost;
        document.getElementById('hudRes').innerText = baseFilm.res;
        document.getElementById('hudDev').innerText = baseFilm.dev;
      }

      if (sourceImg) requestRender();
    }

    function renderPresetsList() {
      const container = document.getElementById('presetsList');
      container.innerHTML = '';

      if (state.activeFilter === 'custom') {
        const list = loadCustomPresets();
        if (!list.length) {
          container.innerHTML = '<div class="presets-empty">Пока пусто — настройте кадр и нажмите «Сохранить как пресет» внизу.</div>';
          return;
        }
        list.forEach(custom => {
          const row = document.createElement('div');
          row.className = `preset-row preset-row-custom ${custom.id === activeCustomPresetId ? 'active' : ''}`;
          row.innerHTML = `
            <div class="preset-meta" style="flex-direction:column; align-items:flex-start; gap:2px;">
              <span class="preset-title">${custom.name}</span>
              <span class="preset-gost">${new Date(custom.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <button class="preset-del-btn" aria-label="Удалить">✕</button>
          `;
          row.querySelector('.preset-meta').addEventListener('click', () => {
            document.querySelectorAll('.preset-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            selectCustomPreset(custom.id);
          });
          row.querySelector('.preset-del-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            // В подтверждении должно быть название пресета, а не индекс/номер
            // строки — иначе человек не понимает, что именно удаляет.
            if (confirm(`Удалить пресет «${custom.name}»?`)) {
              deleteCustomPreset(custom.id);
              renderPresetsList();
            }
          });
          container.appendChild(row);
        });
        return;
      }

      filmDatabase.forEach(film => {
        if (state.activeFilter !== 'all' && film.type !== state.activeFilter) return;

        const row = document.createElement('div');
        row.className = `preset-row ${film.id === state.preset ? 'active' : ''}`;
        row.dataset.id = film.id;

        const tagLabel = film.type === 'color' ? 'ЦВЕТ' : film.type === 'aero' ? 'СПЕЦ' : 'Ч/Б';

        row.innerHTML = `
          <div class="preset-meta">
            <span class="preset-title">${film.name}</span>
            <span class="preset-tag">${tagLabel}</span>
          </div>
          <span class="preset-gost">${film.gost}</span>
        `;

        row.addEventListener('click', () => {
          document.querySelectorAll('.preset-row').forEach(r => r.classList.remove('active'));
          row.classList.add('active');
          selectPreset(film.id);
        });

        container.appendChild(row);
      });
    }

    // Ключи, которые пресет ВСЕГДА выставляет явно (даже если у плёнки нет
    // своего recipe — тогда берётся нейтральный набор). Так при переключении
    // пресетов не остаётся "хвостов" от предыдущей плёнки (например, зерно
    // СВЕМА 250 не залипает на ADOX 25 просто потому что не было в списке).
    // Каждый конкретный recipe плёнки может указывать не все ключи —
    // недостающие подставляются из NEUTRAL_RECIPE (так старые Ч/Б-рецепты,
    // где нет frGain*/sat/dyeFade, не ломаются при расширении списка).
    const RECIPE_KEYS = ['contrast', 'grain', 'grainSize', 'grainContrast', 'devFog', 'frLiftR', 'frLiftG', 'frLiftB', 'frGainR', 'frGainG', 'frGainB', 'sat', 'dyeFade', 'halation', 'bloom'];
    const NEUTRAL_RECIPE = { contrast: 0, grain: 30, grainSize: 10, grainContrast: 50, devFog: 8, frLiftR: 0, frLiftG: 0, frLiftB: 0, frGainR: 100, frGainG: 100, frGainB: 100, sat: 100, dyeFade: 0, halation: 15, bloom: 0 };

    // Отдельно от state.preset (который после выбора своего пресета указывает
    // на БАЗОВУЮ плёнку — для корректной физики рендера), храним id самого
    // кастомного пресета — иначе подсветка активной строки в списке "Мои"
    // не сможет определить, какой именно пресет сейчас выбран.
    let activeCustomPresetId = null;

    // Внутренняя реализация выбора пресета. Раньше это была одна функция,
    // которую ниже переприсваивали (см. обёртку для undo) — в нестрогом
    // режиме переприсваивание function-declaration молча терялось (или
    // падало с TypeError), из-за чего обёртка не работала. Теперь явно:
    // applyPresetById — «сырое» применение, selectPreset — публичная точка входа.
    function applyPresetById(id) {
      const prevPreset = state.preset;
      activeCustomPresetId = null;
      state.preset = id;
      const film = filmDatabase.find(f => f.id === id);
      if (!film) return;

      document.getElementById('presetDesc').innerText = film.desc;
      document.getElementById('hudGost').innerText = film.gost;
      document.getElementById('hudRes').innerText = film.res;
      document.getElementById('hudDev').innerText = film.dev;

      // Текст на рамке 35mm переписываем только при РЕАЛЬНОЙ смене плёнки.
      // Иначе любое восстановление состояния (undo/autosave/сброс секции)
      // затирало вручную введённый «Текст на рамке 35mm» обратно на
      // автоматический «НАЗВАНИЕ :: ГОСТ :: 24A».
      if (prevPreset !== id || !state.frameText) {
        const defText = `${film.name} :: ${film.gost} :: 24A`;
        state.frameText = defText;
        const frameTextEl = document.getElementById('paramFrameText');
        if (frameTextEl) frameTextEl.value = defText;
      }

      // Применяем "паспорт" плёнки: контраст/зерно/туман/светочувствительность
      // тона — то, чем реально отличаются эмульсии друг от друга, а не только
      // текст описания.
      const recipe = film.recipe || NEUTRAL_RECIPE;
      RECIPE_KEYS.forEach(key => {
        const val = recipe[key] !== undefined ? recipe[key] : NEUTRAL_RECIPE[key];
        state[key] = val;
        const el = document.getElementById('param' + key.charAt(0).toUpperCase() + key.slice(1));
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input')); // подхватит форматирование значения и перерисовку
        }
      });

      if (sourceImg) requestRender();
    }

    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        renderPresetsList();
      });
    });

    // Жёсткий предел буфера рендера. Экспорт раньше вызывал
    // preparePreviewBuffer(Infinity), то есть пытался построить канвас в
    // исходном разрешении фото — на телефоне снимок 12–48 Мп это мгновенное
    // падение (у <canvas> лимит площади, а ещё нужны in/out ImageData
    // на каждый шаг пайплайна). Потолок совпадает с MAX_SOURCE_DIM: рабочая
    // копия фото всё равно не больше, так что качество не теряется.
    const MAX_PREVIEW_DIM = 4096;

    function preparePreviewBuffer(maxDim = 900) {
      if (!sourceImg || !sourceImg.width || !sourceImg.height) return;

      const targetDim = Math.min(maxDim, MAX_PREVIEW_DIM, MAX_SOURCE_DIM);

      // Поворот "запекаем" в промежуточный канвас ДО кропа — так рамка
      // кадрирования (заданная в координатах уже повёрнутого кадра) всегда
      // соответствует тому, что человек видел в окне кадрирования.
      let rotSrc = sourceImg, rotW = sourceImg.width, rotH = sourceImg.height;
      if (state.rotation && window.SvemaCrop) {
        const rotated = SvemaCrop.buildRotatedCanvas(sourceImg, state.rotation);
        rotSrc = rotated; rotW = rotated.width; rotH = rotated.height;
      }

      let sw = rotW, sh = rotH, sx = 0, sy = 0;

      // state.cropRect — нормализованный прямоугольник (0..1) в координатах
      // ПОВЁРНУТОГО изображения, задаётся интерактивным окном кадрирования.
      // null/undefined = используется кадр целиком.
      const r = state.cropRect;
      if (r && r.w > 0.01 && r.h > 0.01) {
        sx = Math.round(r.x * rotW);
        sy = Math.round(r.y * rotH);
        sw = Math.round(r.w * rotW);
        sh = Math.round(r.h * rotH);
      }
      sw = Math.max(1, Math.min(sw, rotW - sx));
      sh = Math.max(1, Math.min(sh, rotH - sy));

      const scale = Math.min(1, targetDim / Math.max(sw, sh));
      previewCanvas.width = Math.max(1, Math.round(sw * scale));
      previewCanvas.height = Math.max(1, Math.round(sh * scale));
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewCtx.drawImage(rotSrc, sx, sy, sw, sh, 0, 0, previewCanvas.width, previewCanvas.height);

      // Черновой уменьшенный буфер — используется, пока пользователь тащит
      // слайдер, чтобы пайплайн не считался на полном разрешении на каждый тик.
      const fastScale = Math.min(1, FAST_PREVIEW_MAX_DIM / Math.max(previewCanvas.width, previewCanvas.height));
      fastPreviewCanvas.width = Math.max(1, Math.round(previewCanvas.width * fastScale));
      fastPreviewCanvas.height = Math.max(1, Math.round(previewCanvas.height * fastScale));
      fastPreviewCtx.clearRect(0, 0, fastPreviewCanvas.width, fastPreviewCanvas.height);
      fastPreviewCtx.drawImage(previewCanvas, 0, 0, fastPreviewCanvas.width, fastPreviewCanvas.height);

      lowResMode = false;
      canvas.width = previewCanvas.width;
      canvas.height = previewCanvas.height;

      const overlay = document.getElementById('uploadOverlay');
      if (overlay) overlay.classList.add('hidden');
      canvas.classList.add('loaded');
      requestRender();
    }

    function requestRender() {
      if (!state.renderPending && sourceImg) {
        state.renderPending = true;
        requestAnimationFrame(renderFilmPipeline);
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // "Живой" рендер для перетаскиваемых контролов (слайдеры): пока идёт
    // непрерывное движение, считаем на маленьком буфере (быстро, без
    // подвисаний на мобильных), а через короткую паузу после последнего
    // тика — один финальный рендер в полном качестве.
    // ────────────────────────────────────────────────────────────────────
    let settleTimer = null;
    function requestRenderLive() {
      if (fastPreviewCanvas.width) lowResMode = true;
      requestRender();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (lowResMode) { lowResMode = false; requestRender(); }
      }, 140);
    }

    // ── хроматическая аберрация (объектив, не часть формального движка плёнки) ──────
    // Раньше это был плоский сдвиг всего кадра на N пикселей без разделения каналов —
    // визуально это вообще не давало эффекта цветокающей каймы (все каналы двигались вместе).
    // Сейчас — настоящая радиальная аберрация: R сдвигается от центра, B — к центру,
    // смещение растёт квадратично с расстоянием до центра — как у настоящего объектива,
    // почти невидима в центре и заметна только у краев кадра.
    function applyChroma(w, h) {
      if (state.chroma <= 0) return;

      const srcData = ctx.getImageData(0, 0, w, h);
      const src = srcData.data;
      const dstData = ctx.createImageData(w, h);
      const dst = dstData.data;

      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy) || 1;
      const k = (state.chroma / 20) * 0.22; // макс. сдвиг канала в углах при chroma=20, px

      for (let y = 0; y < h; y++) {
        const dy = y - cy;
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const norm = dist / maxR; // 0..1
          const amt = k * norm * norm * maxR * 0.05; // растёт квадратично к краям
          const ux = dist > 0.5 ? dx / dist : 0, uy = dist > 0.5 ? dy / dist : 0;

          const rx = Math.min(w - 1, Math.max(0, Math.round(x + ux * amt)));
          const ry = Math.min(h - 1, Math.max(0, Math.round(y + uy * amt)));
          const bx = Math.min(w - 1, Math.max(0, Math.round(x - ux * amt)));
          const by = Math.min(h - 1, Math.max(0, Math.round(y - uy * amt)));

          const dstIdx = (y * w + x) * 4;
          const rIdx = (ry * w + rx) * 4;
          const bIdx = (by * w + bx) * 4;

          dst[dstIdx] = src[rIdx];
          dst[dstIdx + 1] = src[dstIdx + 1];
          dst[dstIdx + 2] = src[bIdx + 2];
          dst[dstIdx + 3] = 255;
        }
      }
      ctx.putImageData(dstData, 0, 0);
    }

    // ── Точка входа рендера: делегирует весь пиксельный пайплайн движку ──
    function renderFilmPipeline() {
      state.renderPending = false;
      if (!previewCanvas.width) return;
      const src = (lowResMode && fastPreviewCanvas.width) ? fastPreviewCanvas : previewCanvas;
      const w = src.width;
      const h = src.height;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

      FilmEngine.Core.render({ ctx, canvas, previewCanvas: src, state, filmDatabase, filmColorScience: FILM_COLOR_SCIENCE, applyChroma });
      // гистограмма считается по кадру до рамки и штампа (assets/histogram.js)
      if (window.SvemaHist) window.SvemaHist.update(canvas);

      if (state.frame !== 'none' || state.frameFormat !== '35') {
        renderFilmFrame(w, h);
      }
      if (state.imprint) {
        renderLabImprint(w, h);
      }
    }

    // ───────────────────────────────────────────────────────────────
    // вспомогательные для «генеративной» рамки плёнки: детерминированный seed от имени
    // пресета/рамки (а не от времени) — рамка не дрожит/мерцает между рендерами одного
    // кадра, но отличается между пресетами.
    // ───────────────────────────────────────────────────────────────
    function seedFromString(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
      return h;
    }
    function frameHash(n) {
      return (window.FilmEngine && FilmEngine.Noise) ? FilmEngine.Noise.hash01(n) : (Math.abs(Math.sin(n * 12.9898)) % 1);
    }
    function roundedRectPath(rctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      rctx.beginPath();
      rctx.moveTo(x + r, y);
      rctx.arcTo(x + w, y, x + w, y + h, r);
      rctx.arcTo(x + w, y + h, x, y + h, r);
      rctx.arcTo(x, y + h, x, y, r);
      rctx.arcTo(x, y, x + w, y, r);
      rctx.closePath();
    }
    // Рисует лёгкую шумовую текстуру подложки внутри прямоугольника (x0,y0,w2,h2) поверх
    // уже залитого цвета — вместо идеально ровной заливки у рамки теперь есть структура подложки.
    function paintFilmBaseTexture(x0, y0, w2, h2, base, seedNum) {
      if (!(window.FilmEngine && FilmEngine.Noise) || w2 <= 0 || h2 <= 0) return;
      const field = FilmEngine.Noise.makeFractalField(w2, h2, Math.max(3, Math.round(Math.min(w2, h2) * 0.3)), seedNum, 2);
      const tex = document.createElement('canvas'); tex.width = w2; tex.height = h2;
      const tctx = tex.getContext('2d');
      const id = tctx.createImageData(w2, h2);
      for (let y = 0; y < h2; y++) {
        for (let x = 0; x < w2; x++) {
          const n = field(x, y);
          const v = Math.max(0, Math.min(255, base + n * 9));
          const idx = (y * w2 + x) * 4;
          id.data[idx] = id.data[idx + 1] = id.data[idx + 2] = v;
          id.data[idx + 3] = 255;
        }
      }
      tctx.putImageData(id, 0, 0);
      ctx.drawImage(tex, x0, y0);
    }

    // Советские/немецкие плёнки печатали разные маркировки на краю кадра — раньше выбор бренда
    // в UI ни на что не влиял (всегда печаталось одинаковое "SAFETY FILM") — теперь реально разные.
    const FRAME_BRAND_MARK = {
      svema: 'СВЕМА • MADE IN USSR',
      orwo: 'ORWO SAFETY FILM',
      tasma: 'ТАСМА • КАЗАНЬ'
    };

    function renderFilmFrame(w, h) {
      if (state.frameFormat === '6x6' || state.frameFormat === '6x7' || state.frameFormat === '4x5') {
        renderRollfilmFrame(w, h);
        return;
      }
      render35mmFrame(w, h);
    }

    function renderRollfilmFrame(w, h) {
      const m = Math.round(Math.min(w, h) * 0.06);
      const seedNum = seedFromString(state.preset + state.frameFormat);

      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, w, m); ctx.fillRect(0, h - m, w, m); ctx.fillRect(0, 0, m, h); ctx.fillRect(w - m, 0, m, h);
      paintFilmBaseTexture(0, 0, w, m, 8, seedNum);
      paintFilmBaseTexture(0, h - m, w, m, 8, seedNum + 111);
      paintFilmBaseTexture(0, 0, m, h, 8, seedNum + 222);
      paintFilmBaseTexture(w - m, 0, m, h, 8, seedNum + 333);

      if (state.frameFormat === '4x5') {
        // Notch-код: вырезы-насечки на краю листовой плёнки — так фотограф в темноте на
        // ощупь определял, какой это тип эмульсии. раньше тут были срезанные уголки —
        // эстетика слайд-рамки, а не настоящей листовой плёнки.
        const notchCount = 2 + (Math.abs(seedNum) % 3);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < notchCount; i++) {
          const t = 0.2 + frameHash(seedNum + i * 41) * 0.6;
          const ny = m * (0.35 + t * 0.4);
          const nx = m * 0.5;
          const r = m * (0.09 + frameHash(seedNum + i * 71) * 0.06);
          ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      ctx.font = `${Math.round(m * 0.42)}px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, monospace`;
      ctx.fillStyle = '#aaa';
      const label = state.frameFormat === '4x5' ? 'SHEET FILM' : 'ROLLFILM';
      ctx.fillText(state.frameFormat.toUpperCase() + ' • ' + label, m * 1.4, m * 0.72);
    }

    function render35mmFrame(w, h) {
      const margin = Math.round(Math.min(w, h) * 0.08);
      const seedNum = seedFromString(state.preset + state.frame);

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, margin);
      ctx.fillRect(0, h - margin, w, margin);
      paintFilmBaseTexture(0, 0, w, margin, 5, seedNum);
      paintFilmBaseTexture(0, h - margin, w, margin, 5, seedNum + 777);

      ctx.fillStyle = '#111111';
      const holeW = Math.round(margin * 0.5);
      const holeH = Math.round(margin * 0.6);
      const holeGap = holeW * 1.8;
      const holeR = Math.max(1, Math.round(holeW * 0.28));

      // Перфорация теперь со скругленными углами и микро-джиттером каждой дырки (детерминировано
      // по индексу и seedNum) — раньше все дырки были буквально идентичны, теперь похожи,
      // но не клоны.
      let holeIdx = 0;
      for (let x = 10; x < w; x += holeGap) {
        const jitterX = (frameHash(seedNum + holeIdx * 97) - 0.5) * holeW * 0.16;
        const jitterY = (frameHash(seedNum + holeIdx * 233) - 0.5) * holeH * 0.12;
        const wear = 0.92 + frameHash(seedNum + holeIdx * 57) * 0.16;
        const hw = holeW * wear, hh = holeH * wear;
        roundedRectPath(ctx, x + jitterX, Math.round(margin * 0.2) + jitterY, hw, hh, holeR);
        ctx.fill();
        roundedRectPath(ctx, x + jitterX, h - margin + Math.round(margin * 0.2) + jitterY, hw, hh, holeR);
        ctx.fill();
        holeIdx++;
      }

      ctx.font = `${Math.round(margin * 0.35)}px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, monospace`;
      ctx.fillStyle = 'rgba(230, 230, 230, 0.7)';
      ctx.fillText(`${state.frameText} :: ${state.frameNumber}`, Math.round(w * 0.15), Math.round(margin * 0.65));
      ctx.fillText(FRAME_BRAND_MARK[state.frame] || 'SAFETY FILM', Math.round(w * 0.7), h - Math.round(margin * 0.35));
    }

    function renderLabImprint(w, h) {
      let imprintText = state.imprintText;
      if (!imprintText || imprintText.trim() === '') {
        const film = filmDatabase.find(f => f.id === state.preset);
        const filmName = film ? film.name : 'UNKNOWN';
        const dateStr = new Date().toISOString().slice(0, 10);
        imprintText = `${filmName} | DEV: ${state.devType.toUpperCase()} | PAPER: ${state.paper.toUpperCase()} | ${dateStr}`;
      }

      const padding = Math.round(w * 0.03);
      const fontSize = Math.max(10, Math.round(w * 0.018));
      const style = state.imprintStyle || 'classic';
      const fontStack = `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, monospace`;

      ctx.save();

      if (style === 'kodak') {
        // Коробка-этилетка: жёлтая рамка с чёрным текстом в верхнем углу, как бумажный оттиск лаборатории.
        ctx.font = `bold ${fontSize}px ${fontStack}`;
        const textW = ctx.measureText(imprintText).width;
        const boxPad = Math.round(fontSize * 0.5);
        const boxW = textW + boxPad * 2, boxH = fontSize + boxPad * 1.4;
        ctx.fillStyle = 'rgba(255, 210, 40, 0.92)';
        ctx.fillRect(padding, padding, boxW, boxH);
        ctx.fillStyle = '#101010';
        ctx.fillText(imprintText, padding + boxPad, padding + boxH - boxPad * 0.9);
      } else if (style === 'stamp') {
        // Красный повёрнутый штамп в рамке — как оттиск приёмки фотолаборатории.
        ctx.font = `bold ${fontSize}px ${fontStack}`;
        const textW = ctx.measureText(imprintText).width;
        const boxPad = Math.round(fontSize * 0.6);
        const boxW = textW + boxPad * 2, boxH = fontSize + boxPad * 1.6;
        ctx.translate(w - padding - boxW / 2, h - padding - boxH / 2);
        ctx.rotate(-0.06);
        ctx.strokeStyle = 'rgba(230, 40, 30, 0.85)';
        ctx.lineWidth = Math.max(1, fontSize * 0.08);
        ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
        ctx.fillStyle = 'rgba(230, 40, 30, 0.85)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(imprintText, 0, boxH * 0.06);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      } else if (style === 'minimal') {
        // Минималистичный: тонкий белый текст в нижнем углу справа, без тени.
        ctx.font = `${Math.round(fontSize * 0.85)}px ${fontStack}`;
        const textW = ctx.measureText(imprintText).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillText(imprintText, w - padding - textW, h - padding);
      } else {
        // classic: оранжевый текст снизу слева, как таймкод проявителя.
        ctx.font = `bold ${fontSize}px ${fontStack}`;
        ctx.fillStyle = 'rgba(255, 180, 60, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(imprintText, padding, h - padding);
      }

      ctx.restore();
    }

    // Upload Triggers
    document.getElementById('btnCenterUpload').addEventListener('click', () => {
      document.getElementById('fileUploader').click();
    });
    document.getElementById('btnHeaderUpload').addEventListener('click', () => {
      document.getElementById('fileUploader').click();
    });
    document.getElementById('btnCenterUploadRaw')?.addEventListener('click', () => {
      document.getElementById('rawFileUploader').click();
    });

    // Считаем файл изображением по MIME ИЛИ по расширению: часть браузеров
    // (и почти все RAW) отдаёт пустой file.type, из-за чего честная картинка
    // раньше молча отбрасывалась проверкой file.type.startsWith('image/').
    const IMAGE_EXT_RE = /\.(jpe?g|jpe|png|gif|webp|bmp|avif|heic|heif|tiff?|jfif|svg)$/i;
    function isImageFile(file) {
      if (!file) return false;
      if (window.SvemaRaw && SvemaRaw.isRawFile(file)) return true;
      if (file.type && file.type.startsWith('image/')) return true;
      return IMAGE_EXT_RE.test(file.name || '');
    }

    // Показываем редактор и прячем лендинг.
    function showEditor() {
      const landingPage = document.getElementById('landingPage');
      const editorPage = document.getElementById('editorPage');
      if (!landingPage || !editorPage) return;
      landingPage.style.display = 'none';
      // .editor-page — flex-контейнер: его дочерним элементам нужны order и
      // корректное распределение высоты (в частности, нижней мобильной навигации).
      editorPage.style.display = 'flex';
      const btnBack = document.getElementById('btnBackToHome');
      if (btnBack) btnBack.style.display = window.innerWidth <= 900 ? 'block' : 'none';
    }

    function showLanding() {
      const landingPage = document.getElementById('landingPage');
      const editorPage = document.getElementById('editorPage');
      if (!landingPage || !editorPage) return;
      // '' (а не 'flex'): раскладку стартового экрана задаёт CSS (#landingPage.lab-index — grid)
      landingPage.style.display = '';
      editorPage.style.display = 'none';
      const btnBack = document.getElementById('btnBackToHome');
      if (btnBack) btnBack.style.display = 'none';
    }

    document.getElementById('btnBackToHome').addEventListener('click', showLanding);

    // Приём файлов drag&drop — и на лендинге (drop-zone), и прямо в редакторе.
    // Раньше обработчик дропа вызывал отдельную функцию handleFile(), которая
    // обращалась к переменной canvas в момент, когда её ещё не существовало
    // (ReferenceError: Cannot access 'canvas' before initialization) — то есть
    // перетаскивание файла не работало вообще, ни на лендинге, ни в редакторе.
    function bindDropTarget(el) {
      if (!el) return;
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
        el.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false));
      ['dragenter', 'dragover'].forEach(ev =>
        el.addEventListener(ev, () => el.classList.add('dragover'), false));
      ['dragleave', 'drop'].forEach(ev =>
        el.addEventListener(ev, () => el.classList.remove('dragover'), false));
      el.addEventListener('drop', (e) => {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFileSelected(file);
      }, false);
    }
    bindDropTarget(document.getElementById('dropZone'));
    bindDropTarget(document.getElementById('landingPage'));
    bindDropTarget(document.getElementById('canvasContainer'));

    // Вставка из буфера (Ctrl+V) — привычный способ отдать скриншот/картинку.
    document.addEventListener('paste', (e) => {
      const items = (e.clipboardData && e.clipboardData.files) || [];
      for (const file of items) {
        if (isImageFile(file)) { handleFileSelected(file); return; }
      }
    });

    async function loadFileAsImage(file) {
      // RAW-файлы (.RAF/.CR2/.NEF/.ARW/...) браузер декодировать не умеет —
      // достаём встроенный JPEG-превью (см. assets/raw.js). Обычные форматы
      // (JPEG/PNG/WebP/HEIC-если-поддерживается) идут стандартным путём.
      if (window.SvemaRaw && SvemaRaw.isRawFile(file)) {
        setUploadStatus('Извлекаю встроенный просмотр из RAW…');
        try {
          const result = await SvemaRaw.extractPreview(file);
          if (result && result.img) {
            clearUploadStatus();
            return result.img;
          }
        } catch (e) {
          console.warn('RAW: не удалось извлечь превью', e);
        }
        clearUploadStatus();
        alert('Не удалось найти встроенный просмотр в этом RAW-файле. Попробуйте экспортировать JPEG из RAW-конвертера камеры и загрузить его.');
        return null;
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(file);
      });
    }

    function setUploadStatus(text) {
      const overlay = document.getElementById('uploadOverlay');
      overlay.classList.remove('hidden');
      let statusEl = document.getElementById('uploadStatusText');
      if (!statusEl) {
        statusEl = document.createElement('span');
        statusEl.id = 'uploadStatusText';
        statusEl.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;';
        overlay.appendChild(statusEl);
      }
      statusEl.textContent = text;
    }
    function clearUploadStatus() {
      const el = document.getElementById('uploadStatusText');
      if (el) el.remove();
    }

    // Рабочая копия фото с ограничением по длинной стороне.
    // Раньше в sourceImg клалось декодированное фото «как есть», и уже первый
    // же шаг — поворот (SvemaCrop.buildRotatedCanvas) или подготовка превью —
    // строил канвас в полном разрешении: для снимка 6000×4000 это 96 МБ на
    // канвас, а пайплайн держит в памяти ещё и превью с копией буфера. На
    // телефоне такой кадр просто ронял вкладку («фото не грузится»).
    // Ограничение ничего не теряет визуально: экспорт всё равно упирается в
    // MAX_PREVIEW_DIM, а превью на экране не бывает больше ~1200 px.
    const MAX_SOURCE_DIM = 4096;

    function fitSourceToWorkingSize(img) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return img;
      const scale = Math.min(1, MAX_SOURCE_DIM / Math.max(w, h));
      if (scale >= 1) return img;

      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * scale));
      c.height = Math.max(1, Math.round(h * scale));
      const cctx = c.getContext('2d');
      cctx.imageSmoothingEnabled = true;
      cctx.imageSmoothingQuality = 'high';
      cctx.drawImage(img, 0, 0, c.width, c.height);
      return c;
    }

    async function loadSelectedFile(file) {
      if (!file) return false;
      const img = await loadFileAsImage(file);
      if (!img) {
        if (!(window.SvemaRaw && SvemaRaw.isRawFile(file))) alert('Не удалось открыть файл как изображение.');
        return false;
      }
      sourceImg = fitSourceToWorkingSize(img);
      state.cropRect = null; // новое фото — старое кадрирование больше не актуально
      if (window.resetCanvasZoom) window.resetCanvasZoom();
      preparePreviewBuffer();
      showEditor(); // фото реально загружено — уводим с лендинга в редактор
      return true;
    }

    // Сбрасываем value инпута после выбора — иначе повторный выбор ТОГО ЖЕ
    // файла не порождает событие change, и кажется, что «фото не загружается».
    document.getElementById('fileUploader').addEventListener('change', (e) => {
      const input = e.target;
      const file = input.files && input.files[0];
      input.value = '';
      handleFileSelected(file);
    });
    document.getElementById('rawFileUploader').addEventListener('change', (e) => {
      const input = e.target;
      const file = input.files && input.files[0];
      input.value = '';
      handleFileSelected(file);
    });

    // ────────────────────────────────────────────────────────────────────
    // Универсальный байндер слайдеров: id="paramKey" ↔ state.key ↔ id="valKey"
    // ────────────────────────────────────────────────────────────────────
    const bindSlider = (id, key, formatFn) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('input', (e) => {
        const valElem = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
        // Во время восстановления состояния (undo/redo/autosave) мы сами
        // выставляем значение контрола и бросаем input — обработчик не должен
        // переписывать state тем же значением «как от пользователя», но
        // подпись значения обновить обязан (иначе слайдер уезжает, а цифра
        // рядом с ним остаётся от прежнего состояния).
        if (suppressControlWrites) {
          if (valElem) valElem.innerText = formatFn(parseFloat(e.target.value));
          return;
        }
        state[key] = parseFloat(e.target.value);
        if (valElem) valElem.innerText = formatFn(state[key]);
        requestRenderLive();
      });
    };

    // ---- Легаси / творческая тональность ----
    bindSlider('paramPush', 'pushPull', v => v === 0 ? 'NORMAL' : v > 0 ? `PUSH +${v}` : `PULL ${v}`);
    bindSlider('paramDyeFade', 'dyeFade', v => `${v}%`);
    bindSlider('paramExp', 'exp', v => (v / 50).toFixed(1));
    bindSlider('paramContrast', 'contrast', v => v > 0 ? `+${v}` : v);
    bindSlider('paramHighlights', 'highlights', v => v > 0 ? `+${v}` : v);
    bindSlider('paramShadows', 'shadows', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterR', 'filterR', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterG', 'filterG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterB', 'filterB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramTemp', 'temp', v => v > 0 ? `+${v}` : v);
    bindSlider('paramSat', 'sat', v => `${v}%`);
    bindSlider('paramSplitShadow', 'splitShadow', v => `${v}%`);
    bindSlider('paramChroma', 'chroma', v => `+${v}`);
    bindSlider('paramVignette', 'vignette', v => `${v}%`);
    bindSlider('paramVignetteX', 'vignetteX', v => `${v}%`);
    bindSlider('paramVignetteY', 'vignetteY', v => `${v}%`);
    document.getElementById('paramVignetteShape').addEventListener('change', (e) => {
      if (suppressControlWrites) return;
      state.vignetteShape = e.target.value; requestRender();
    });
    bindSlider('paramSabattier', 'sabattier', v => `${v}%`);
    bindSlider('paramReciprocity', 'reciprocity', v => `${v}%`);
    bindSlider('paramReticulation', 'reticulation', v => `${v}%`);
    bindSlider('paramBromide', 'bromide', v => `${v}%`);
    bindSlider('paramRotation','rotation',v=>`${v}°`);

    // ---- 1. Film Response ----
    bindSlider('paramFrBlackPoint', 'frBlackPoint', v => `${v}`);
    bindSlider('paramFrWhitePoint', 'frWhitePoint', v => `${v}`);
    bindSlider('paramFrMasterGamma', 'frMasterGamma', v => (v / 100).toFixed(2));
    bindSlider('paramFrLiftR', 'frLiftR', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrLiftG', 'frLiftG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrLiftB', 'frLiftB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrGammaR', 'frGammaR', v => (v / 100).toFixed(2));
    bindSlider('paramFrGammaG', 'frGammaG', v => (v / 100).toFixed(2));
    bindSlider('paramFrGammaB', 'frGammaB', v => (v / 100).toFixed(2));
    bindSlider('paramFrGainR', 'frGainR', v => (v / 100).toFixed(2));
    bindSlider('paramFrGainG', 'frGainG', v => (v / 100).toFixed(2));
    bindSlider('paramFrGainB', 'frGainB', v => (v / 100).toFixed(2));
    bindSlider('paramFrMixRG', 'frMixRG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrMixRB', 'frMixRB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrMixGB', 'frMixGB', v => v > 0 ? `+${v}` : v);

    // ---- 2. Grain Engine ----
    bindSlider('paramGrain', 'grain', v => `${v}%`);
    bindSlider('paramGrainSize', 'grainSize', v => `${(v/10).toFixed(1)}x`);
    bindSlider('paramGrainDensity', 'grainDensity', v => `${v}%`);
    bindSlider('paramGrainContrast', 'grainContrast', v => `${v}%`);
    bindSlider('paramGrainColor', 'grainColor', v => `${v}%`);
    bindSlider('paramGrainExposureDep', 'grainExposureDep', v => `${v}%`);
    document.getElementById('paramGrainLock').addEventListener('change', e => {
      if (suppressControlWrites) return;
      state.grainLock = e.target.checked; state.grainSeed = Math.random() * 99999; requestRender();
    });

    // ---- 3. Developer ----
    bindSlider('paramDevTemp', 'devTemp', v => `${v}°C`);
    bindSlider('paramDevTime', 'devTime', v => `${v}%`);
    bindSlider('paramDevDilution', 'devDilution', v => `${v}%`);
    bindSlider('paramDevAgitation', 'devAgitation', v => `${v}%`);
    bindSlider('paramDevContrast', 'devContrast', v => v > 0 ? `+${v}` : v);
    bindSlider('paramDevFog', 'devFog', v => `${v}%`);
    document.getElementById('paramDevType').addEventListener('change', (e) => {
      if (suppressControlWrites) return;
      FilmEngine.Developer.applyRecipe(state, e.target.value);
      ['DevTemp','DevTime','DevDilution','DevAgitation','DevContrast','DevFog'].forEach(n => {
        const key = n.charAt(0).toLowerCase() + n.slice(1);
        const el = document.getElementById('param' + n);
        if (el) { el.value = state[key]; el.dispatchEvent(new Event('input')); }
      });
      requestRender();
    });

    // ---- 5. Halation ----
    bindSlider('paramHalation', 'halation', v => `${v}%`);
    bindSlider('paramHalationThreshold', 'halationThreshold', v => `${v}`);
    bindSlider('paramHalationRadius', 'halationRadius', v => `${v}px`);
    bindSlider('paramHalationDecay', 'halationDecay', v => `${v}%`);
    bindSlider('paramHalationStreak', 'halationStreak', v => `${v}%`);
    bindSlider('paramHalationR', 'halationR', v => `${v}%`);
    bindSlider('paramHalationG', 'halationG', v => `${v}%`);
    bindSlider('paramHalationB', 'halationB', v => `${v}%`);

    // ---- 6. Bloom ----
    bindSlider('paramBloom', 'bloom', v => `${v}%`);
    bindSlider('paramBloomThreshold', 'bloomThreshold', v => `${v}`);
    bindSlider('paramBloomRadius', 'bloomRadius', v => `${v}px`);

    // ---- 7. Emulsion Defects ----
    bindSlider('paramDust', 'dust', v => `${v}%`);
    bindSlider('paramScratches', 'scratches', v => `${v}%`);
    bindSlider('paramDamage', 'damage', v => `${v}%`);
    bindSlider('paramSpots', 'spots', v => `${v}%`);
    bindSlider('paramUnevenDensity', 'unevenDensity', v => `${v}%`);
    bindSlider('paramLeak', 'leak', v => `${v}%`);
    document.getElementById('paramDefectLock').addEventListener('change', e => {
      if (suppressControlWrites) return;
      state.defectLock = e.target.checked; state.defectSeed = Math.random() * 99999; requestRender();
    });

    // ---- 8. Exposure Uniformity ----
    bindSlider('paramUniformH', 'uniformH', v => v > 0 ? `+${v}` : v);
    bindSlider('paramUniformV', 'uniformV', v => v > 0 ? `+${v}` : v);
    bindSlider('paramUniformRadial', 'uniformRadial', v => v > 0 ? `+${v}` : v);
    bindSlider('paramUniformRandom', 'uniformRandom', v => `${v}%`);
    bindSlider('paramUniformScale', 'uniformScale', v => `${v}%`);

    // ---- FoundYear (эффективный ISO) ----
    bindSlider('paramFoundYear', 'foundYear', v => `${v}`);
    document.getElementById('paramFoundYear').addEventListener('input', () => {
      const film = filmDatabase.find(f => f.id === state.preset);
      const iso = (film && (film.gost.match(/\d+/) || [100]))[0];
      const effective = Math.max(1, Math.round(iso * (1 - (new Date().getFullYear() - state.foundYear) / 70)));
      document.getElementById('hudGost').innerText = `ISO ${effective} (ном. ${iso})`;
    });

    // ---- Селекты, чекбоксы и текстовые поля ------------------------------
    // Восстановление состояния само бросает change/input на эти контролы —
    // без проверки suppressControlWrites они переписывали бы state значениями
    // из DOM и ломали undo/redo (см. комментарий у suppressControlWrites).
    //
    // Для текстовых полей используем 'input' (реакция на каждый символ), для
    // селектов и чекбоксов — 'change'. Обработчик здесь единственный: он же
    // пишет историю ДО изменения state (иначе undo «отменял» бы сам себя —
    // снимок уже содержал бы новое значение).
    // ── Текстовые поля: история по «сессии правки» ───────────────────────
    // Событие 'input' приходит до изменения значения, поэтому первый символ
    // новой правки — единственный момент, когда в state ещё лежит прежний
    // текст (именно он и нужен для «Отменить»). Один снимок на сессию, а не
    // на каждую букву: сессия закрывается по 'change' (Enter/потеря фокуса)
    // или после паузы в наборе.
    let textEditOpen = false;
    let textEditIdleTimer = null;

    function closeTextEditSession() {
      clearTimeout(textEditIdleTimer);
      textEditIdleTimer = null;
      textEditOpen = false;
    }

    function bindTextControl(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', (e) => {
        if (suppressControlWrites) return;
        if (!textEditOpen) {
          pushHistoryEntry(); // снимок ДО первого изменения текста
          textEditOpen = true;
        }
        clearTimeout(textEditIdleTimer);
        textEditIdleTimer = setTimeout(closeTextEditSession, 900);
        state[key] = e.target.value;
        saveToLocalStorage();
        requestRender();
      });
      el.addEventListener('change', (e) => {
        if (suppressControlWrites) return;
        clearTimeout(textEditIdleTimer);
        textEditIdleTimer = null;
        state[key] = e.target.value;
        textEditOpen = false; // следующая правка снова даст снимок «до»
        saveToLocalStorage();
        requestRender();
      });
    }

    // ---- Селекты и чекбоксы ----------------------------------------------
    // Восстановление состояния само бросает change на эти контролы — без
    // проверки suppressControlWrites они переписывали бы state значениями из
    // DOM и ломали undo/redo (см. комментарий у suppressControlWrites).
    // Обработчик единственный: он же пишет историю ДО изменения state — у
    // select/checkbox событие change приходит до присваивания в state, так что
    // снимок успевает захватить прежнее значение.
    function bindControl(id, key, read) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', (e) => {
        if (suppressControlWrites) return;
        pushHistoryEntry(); // снимок «до»
        state[key] = read ? read(e.target) : e.target.value;
        saveToLocalStorage();
        requestRender();
      });
    }

    bindControl('paramPaper', 'paper');
    bindControl('paramPaperSurface', 'paperSurface');
    bindSlider('paramPaperGrade', 'paperGrade', v => `${v}`);
    bindControl('paramToner', 'toner');
    bindControl('paramCrossProcess', 'crossProcess', el => el.checked);
    bindControl('paramFrame', 'frame');
    bindTextControl('paramFrameText', 'frameText');
    bindTextControl('paramImprintText', 'imprintText');
    bindControl('paramImprint', 'imprint', el => el.checked);
    bindControl('paramImprintStyle', 'imprintStyle');
    bindControl('paramFrameFormat', 'frameFormat');
    // Приводит любой угол к диапазону (-180, 180] — вращение периодично по
    // модулю 360°, так что визуально это тот же результат, зато совместимо
    // со старым слайдером поворота (-180..180).
    function normalizeRotation(deg) {
      return ((deg + 180) % 360 + 360) % 360 - 180;
    }

    document.getElementById('btnOpenCrop').addEventListener('click', () => {
      if (!sourceImg) return;
      SvemaCrop.open(sourceImg, state.cropRect, state.rotation, (rect, rotationDeg) => {
        state.cropRect = rect; // null = кадр целиком
        state.rotation = normalizeRotation(rotationDeg);
        const rotEl = document.getElementById('paramRotation');
        if (rotEl) { rotEl.value = state.rotation; rotEl.dispatchEvent(new Event('input')); }
        preparePreviewBuffer();
      });
    });
    document.getElementById('paramRotation').addEventListener('change', () => {
      // Ручная правка поворота в обход окна кадрирования — старая рамка
      // кадрирования могла быть рассчитана под другой угол, поэтому сбрасываем.
      state.cropRect = null;
      preparePreviewBuffer();
    });
    document.getElementById('paramFrameNumber').addEventListener('input',e=>{
      if (suppressControlWrites) return;
      state.frameNumber=e.target.value;requestRender();
    });
    document.getElementById('paramCondition').addEventListener('change',e=>{
      if (suppressControlWrites) return;
      state.condition=e.target.value;
      // «Свежая / холодильник» — это текущий год, а не жёстко зашитый 2026:
      // иначе через год-два состояние «свежая» само начинало «стареть».
      const p={fresh:[new Date().getFullYear(),0,0],drawer:[1997,16,18],attic:[1985,40,50],camera:[1991,25,35]}[e.target.value];
      if (!p) return;
      state.foundYear=p[0];state.dyeFade=p[1];state.dust=p[2];
      ['FoundYear','DyeFade','Dust'].forEach((n,i)=>{
        const el=document.getElementById('param'+n);
        if (!el) return;
        el.value=p[i];el.dispatchEvent(new Event('input'));
      });
    });
    document.getElementById('paramRecipe').addEventListener('change',e=>{
      if (suppressControlWrites) return;
      state.recipe=e.target.value;
      const r={d76:'st2',rodinal:'rodinal',stand:'rodinal'}[e.target.value];
      if(!r)return;
      document.getElementById('paramDevType').value = r;
      document.getElementById('paramDevType').dispatchEvent(new Event('change'));
      if (e.target.value === 'stand') {
        state.pushPull = -1; state.devAgitation = 4; state.devTime = 220;
        document.getElementById('paramPush').value = -1; document.getElementById('paramPush').dispatchEvent(new Event('input'));
        document.getElementById('paramDevAgitation').value = 4; document.getElementById('paramDevAgitation').dispatchEvent(new Event('input'));
        document.getElementById('paramDevTime').value = 220; document.getElementById('paramDevTime').dispatchEvent(new Event('input'));
      }
    });

    // ────────────────────────────────────────────────────────────────────
    // 9. МАСКИ: единый компонент, вставляется во все .mask-slot
    // ────────────────────────────────────────────────────────────────────
    function maskStateKey(dataKey) { return 'mask' + dataKey.charAt(0).toUpperCase() + dataKey.slice(1); }

    function installMaskControls() {
      document.querySelectorAll('.mask-slot').forEach(slot => {
        const dataKey = slot.dataset.key;
        const stateKey = maskStateKey(dataKey);
        const cfg = state[stateKey];
        if (!cfg) return;

        slot.innerHTML = `
          <div class="mask-block">
            <div class="mask-block-title">Маска эффекта</div>
            <select class="select-input mm-target">
              <option value="all">Весь кадр</option>
              <option value="shadows">Тени</option>
              <option value="midtones">Полутона</option>
              <option value="highlights">Света</option>
              <option value="custom">Своя маска</option>
            </select>
            <div class="mask-custom" hidden>
              <select class="select-input mm-shape">
                <option value="linear">Линейный градиент</option>
                <option value="radial">Радиальный градиент</option>
              </select>
              <div class="control-unit mask-row mm-row-angle"><div class="control-head"><span>Угол</span><span class="control-val mm-angle-val">0°</span></div><input type="range" class="mm-angle" min="0" max="360" value="0"></div>
              <div class="control-unit mask-row mm-row-radial"><div class="control-head"><span>Центр X</span><span class="control-val mm-cx-val">50%</span></div><input type="range" class="mm-cx" min="0" max="100" value="50"></div>
              <div class="control-unit mask-row mm-row-radial"><div class="control-head"><span>Центр Y</span><span class="control-val mm-cy-val">50%</span></div><input type="range" class="mm-cy" min="0" max="100" value="50"></div>
              <div class="control-unit mask-row mm-row-radial"><div class="control-head"><span>Радиус</span><span class="control-val mm-radius-val">60%</span></div><input type="range" class="mm-radius" min="5" max="150" value="60"></div>
              <div class="control-unit mask-row"><div class="control-head"><span>Растушёвка</span><span class="control-val mm-feather-val">40%</span></div><input type="range" class="mm-feather" min="1" max="100" value="40"></div>
              <label class="checkbox-label"><input type="checkbox" class="mm-invert"> Инвертировать</label>
            </div>
          </div>
        `;

        const targetSel = slot.querySelector('.mm-target');
        const customBlock = slot.querySelector('.mask-custom');
        const shapeSel = slot.querySelector('.mm-shape');
        const angleRow = slot.querySelector('.mm-row-angle');
        const radialRows = slot.querySelectorAll('.mm-row-radial');
        const angleInput = slot.querySelector('.mm-angle');
        const cxInput = slot.querySelector('.mm-cx');
        const cyInput = slot.querySelector('.mm-cy');
        const radiusInput = slot.querySelector('.mm-radius');
        const featherInput = slot.querySelector('.mm-feather');
        const invertInput = slot.querySelector('.mm-invert');

        // Начальные значения из state
        targetSel.value = cfg.target;
        shapeSel.value = cfg.custom.shape;
        angleInput.value = cfg.custom.angle;
        cxInput.value = cfg.custom.cx;
        cyInput.value = cfg.custom.cy;
        radiusInput.value = cfg.custom.radius;
        featherInput.value = cfg.custom.feather;
        invertInput.checked = cfg.custom.invert;

        function syncVisibility() {
          customBlock.hidden = targetSel.value !== 'custom';
          const isRadial = shapeSel.value === 'radial';
          angleRow.hidden = isRadial;
          radialRows.forEach(r => r.hidden = !isRadial);
        }
        function syncLabels() {
          slot.querySelector('.mm-angle-val').innerText = `${angleInput.value}°`;
          slot.querySelector('.mm-cx-val').innerText = `${cxInput.value}%`;
          slot.querySelector('.mm-cy-val').innerText = `${cyInput.value}%`;
          slot.querySelector('.mm-radius-val').innerText = `${radiusInput.value}%`;
          slot.querySelector('.mm-feather-val').innerText = `${featherInput.value}%`;
        }
        syncVisibility();
        syncLabels();

        targetSel.addEventListener('change', () => { cfg.target = targetSel.value; syncVisibility(); requestRender(); });
        shapeSel.addEventListener('change', () => { cfg.custom.shape = shapeSel.value; syncVisibility(); requestRender(); });
        angleInput.addEventListener('input', () => { cfg.custom.angle = parseFloat(angleInput.value); syncLabels(); requestRenderLive(); });
        cxInput.addEventListener('input', () => { cfg.custom.cx = parseFloat(cxInput.value); syncLabels(); requestRenderLive(); });
        cyInput.addEventListener('input', () => { cfg.custom.cy = parseFloat(cyInput.value); syncLabels(); requestRenderLive(); });
        radiusInput.addEventListener('input', () => { cfg.custom.radius = parseFloat(radiusInput.value); syncLabels(); requestRenderLive(); });
        featherInput.addEventListener('input', () => { cfg.custom.feather = parseFloat(featherInput.value); syncLabels(); requestRenderLive(); });
        invertInput.addEventListener('change', () => { cfg.custom.invert = invertInput.checked; requestRender(); });
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // Slider Value Tooltip (disabled)
    // ────────────────────────────────────────────────────────────────────
    // Functionality disabled - using static control-val display instead

    // ────────────────────────────────────────────────────────────────────
    // Landing Page & Navigation
    // ────────────────────────────────────────────────────────────────────
    // Здесь осталась только лендинг-специфичная логика. Обработчики загрузки
    // файлов, показа редактора и кнопки «Назад» объявлены выше (showEditor /
    // showLanding / bindDropTarget) — раньше они были продублированы внутри
    // этой IIFE вместе с устаревшей веткой «быстрых пресетов», которая звала
    // несуществующую функцию applyPreset() и падала бы при клике.
    (function initLandingPage() {
      const fileUploader = document.getElementById('fileUploader');
      const dropZone = document.getElementById('dropZone');

      // Клик по зоне «Загрузить фото» — открывает системный выбор файла
      // (в т.ч. галерею на мобильных: у инпута accept="image/*").
      if (dropZone && fileUploader) {
        dropZone.addEventListener('click', () => fileUploader.click());
      }

      const landingRawBtn = document.getElementById('btnLandingUploadRaw');
      if (landingRawBtn) {
        landingRawBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.getElementById('rawFileUploader').click();
        });
      }

      // Мобильный bottom-sheet — легаси-режим без вкладок. Если разметка
      // использует мобильные вкладки (.mobile-active), этот переключатель не
      // нужен: он открывал панель при любом тапе по кадру.
      const sidebarRight = document.querySelector('.sidebar-right');
      const viewportStage = document.querySelector('.viewport-stage');
      if (viewportStage && sidebarRight) {
        viewportStage.addEventListener('click', () => {
          if (window.innerWidth > 900) return;
          if (sidebarRight.classList.contains('mobile-active')) return;
          sidebarRight.classList.toggle('visible');
        });
        const closeBtn = document.createElement('button');
        closeBtn.className = 'sheet-close-btn';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          sidebarRight.classList.remove('visible');
        });
        sidebarRight.appendChild(closeBtn);
      }
    })();

    // ────────────────────────────────────────────────────────────────────
    // Toast Notifications
    // ────────────────────────────────────────────────────────────────────
    let toastTimeout = null;
    function showToast(message, duration = 2000) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('visible');

      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
      }, duration);
    }

    // ────────────────────────────────────────────────────────────────────
    // Precise Value Input
    // ────────────────────────────────────────────────────────────────────
    function attachPreciseEdit(valEl) {
      if (valEl.dataset.preciseBound) return;
      valEl.dataset.preciseBound = '1';
      valEl.addEventListener('click', () => {
        const currentValue = valEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'control-val editing';
        input.style.width = '60px';
        input.style.background = 'var(--panel-3)';
        input.style.color = 'var(--text)';
        input.style.border = '1px solid var(--accent)';
        input.style.borderRadius = '4px';
        input.style.padding = '2px 4px';
        input.style.fontSize = 'inherit';
        input.style.fontWeight = 'inherit';

        valEl.parentNode.replaceChild(input, valEl);
        input.focus();
        input.select();

        function finishEdit() {
          const newValue = input.value;
          input.parentNode.replaceChild(valEl, input);
          valEl.classList.remove('editing');

          if (newValue !== currentValue) {
            const controlId = valEl.id.replace('val', 'param');
            const control = document.getElementById(controlId);
            if (control) {
              let numericValue = parseFloat(newValue);
              if (!isNaN(numericValue)) {
                control.value = numericValue;
                control.dispatchEvent(new Event('input'));
                saveState();
              }
            }
          }
        }

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            finishEdit();
          } else if (e.key === 'Escape') {
            input.parentNode.replaceChild(valEl, input);
            valEl.classList.remove('editing');
          }
        });
      });
    }
    document.querySelectorAll('.control-val').forEach(attachPreciseEdit);

    // Double-click by param label (left side) also opens precise edit on the paired value.
    document.querySelectorAll('.control-head').forEach(head => {
      const labelEl = head.querySelector('span:not(.control-val):first-child');
      const valEl = head.querySelector('.control-val');
      if (labelEl && valEl) {
        labelEl.style.cursor = 'pointer';
        labelEl.addEventListener('dblclick', () => valEl.click());
      }
    });

    // ────────────────────────────────────────────────────────────────────
    // Undo/Redo System
    // ────────────────────────────────────────────────────────────────────
    const UNDO_LIMIT = 50;
    let undoStack = [];
    let redoStack = [];
    // Пока UI синхронизируется с восстановленным состоянием, контролы
    // бросают события input/change — и каждое из них снова писало в историю
    // undo. Из-за этого undo/redo «съедали» сами себя: кнопка «Повторить»
    // после отмены возвращала не прежнее значение, а промежуточный снимок
    // восстановления. Флаг отключает запись истории на время restore.
    let suppressHistory = false;
    // Отдельный флаг для восстановления состояния из undo/redo/autosave:
    // обработчики контролов получают собственные же события input/change и
    // переписывают ими state. Именно из-за этого после «Отменить» состояние
    // откатывалось не к снимку, а к промежуточному значению, которое успевал
    // записать очередной слайдер.
    let suppressControlWrites = false;

    function withControlWritesSuppressed(fn) {
      suppressControlWrites = true;
      suppressHistory = true;
      try { return fn(); } finally {
        suppressControlWrites = false;
        suppressHistory = false;
      }
    }

    function saveState() {
      if (suppressHistory) return; // идёт restore — история не пишется
      const snapshot = JSON.parse(JSON.stringify(state));
      undoStack.push(snapshot);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack = [];
      updateUndoRedoButtons();
    }

    function undo() {
      if (undoStack.length === 0) return;
      redoStack.push(JSON.parse(JSON.stringify(state)));
      state = undoStack.pop();
      withControlWritesSuppressed(restoreStateToUI);
      updateUndoRedoButtons();
      requestRender();
      showToast('Отменено');
    }

    function redo() {
      if (redoStack.length === 0) return;
      undoStack.push(JSON.parse(JSON.stringify(state)));
      state = redoStack.pop();
      withControlWritesSuppressed(restoreStateToUI);
      updateUndoRedoButtons();
      requestRender();
      showToast('Повторено');
    }

    function updateUndoRedoButtons() {
      document.getElementById('btnUndo').disabled = undoStack.length === 0;
      document.getElementById('btnRedo').disabled = redoStack.length === 0;
    }

    // Восстанавливает UI и state по текущему state. Снимок (из undo/redo или
    // автосейва) должен победить любой побочный эффект обработчиков: они
    // бросают события, а часть из них ещё и сама меняет state (например,
    // applyPresetById раскладывает «паспорт» плёнки по слайдерам и затирает
    // пользовательское зерно цифрой из рецепта). Поэтому в конце — финальная
    // раскладка значений снимка поверх всего, что натворили обработчики.
    function syncControlsFromState() {
      document.querySelectorAll('input[type="range"]').forEach(input => {
        const key = input.id.replace('param', '');
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (state[lowerKey] !== undefined) {
          input.value = state[lowerKey];
          input.dispatchEvent(new Event('input'));
        }
      });
      document.querySelectorAll('input[type="checkbox"]').forEach(input => {
        const key = input.id.replace('param', '');
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (state[lowerKey] !== undefined) {
          input.checked = !!state[lowerKey];
          input.dispatchEvent(new Event('change'));
        }
      });
      document.querySelectorAll('select').forEach(input => {
        const key = input.id.replace('param', '');
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (state[lowerKey] !== undefined) {
          input.value = state[lowerKey];
          input.dispatchEvent(new Event('change'));
        }
      });
      // Текстовые поля (текст рамки, текст штампа) раньше вообще не попадали
      // в восстановление: слайдеры и селекты возвращались к снимку, а текст
      // оставался от текущего кадра — undo выглядел как «отменилось всё,
      // кроме текста».
      document.querySelectorAll('input[type="text"]').forEach(input => {
        const key = input.id.replace('param', '');
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (state[lowerKey] !== undefined) {
          input.value = state[lowerKey];
        }
      });
    }

    // Ключи состояния, которые НЕЛЬЗЯ возвращать из снимка: это свойства
    // конкретного фото, а не «образа плёнки» (см. CUSTOM_PRESET_EXCLUDE).
    const RESTORE_EXCLUDE = ['cropRect', 'rotation', 'renderPending'];

    function restoreStateToUI() {
      // Незавершённая правка текстового поля («сессия» набора) не должна
      // доживать до восстановления: её обработчик допишет в state значение из
      // DOM сразу после того, как мы разложили снимок, и undo вернёт не то,
      // что отменяли.
      closeTextEditSession();

      // Снимок снимаем ДО синхронизации: обработчики контролов меняют state,
      // пока мы раскладываем по ним значения.
      const snapshot = {};
      Object.keys(state).forEach(key => {
        snapshot[key] = state[key];
      });

      const film = filmDatabase.find(f => f.id === state.preset);
      if (film) applyPresetById(state.preset); // «паспорт» плёнки — первым
      syncControlsFromState();                  // затем значения из снимка

      // Финал: возвращаем в state ровно то, что было в снимке, — поверх всех
      // побочных эффектов обработчиков событий (см. комментарий выше).
      Object.keys(snapshot).forEach(key => {
        if (RESTORE_EXCLUDE.includes(key)) return;
        state[key] = snapshot[key];
      });

      updateCurveSvg();
      // Маски хранятся объектами и не восстанавливаются через id="param…" —
      // пересобираем их панели, иначе undo/autosave оставляли старые настройки маски.
      installMaskControls();
      renderPresetsList();
    }

    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnRedo').addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }

      // Keyboard shortcuts
      if (e.ctrlKey || e.metaKey) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch(e.key.toLowerCase()) {
        case 'r':
          document.getElementById('btnReset').click();
          break;
        case 'e':
          document.getElementById('btnExport').click();
          break;
        case '1':
          document.querySelector('.m-tab[data-tab="presets"]').click();
          break;
        case '2':
          document.querySelector('.m-tab[data-tab="response"]').click();
          break;
        case '3':
          document.querySelector('.m-tab[data-tab="grain"]').click();
          break;
        case '4':
          document.querySelector('.m-tab[data-tab="defects"]').click();
          break;
        case '5':
          document.querySelector('.m-tab[data-tab="style"]').click();
          break;
        case 'b':
          if (e.altKey) {
            e.preventDefault();
            document.getElementById('btnAB').click();
          }
          break;
      }
    });

    // Публичная точка входа выбора пресета: пишет состояние в историю
    // (undo) и делегирует «сырое» применение в applyPresetById.
    function selectPreset(id) {
      if (state.preset !== id) pushHistoryEntry();
      applyPresetById(id);
    }

    // ── История + автосейв для контролов ────────────────────────────────
    // Раньше это были ОТДЕЛЬНЫЕ слушатели change: сначала свой у каждого
    // контрола (он менял state), а потом общий (он писал историю). К моменту
    // записи state уже содержал новое значение, поэтому undo возвращал не
    // прежний кадр, а тот же самый. Теперь порядок строгий: снимок «до» —
    // потом изменение state — потом запись истории и автосейв, всё в одном
    // обработчике. Плюс отсекаем пустые записи (снимок == текущее состояние),
    // из-за которых кнопка «Отменить» щёлкала без видимого эффекта.
    function snapshotsEqual(a, b) {
      try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
    }

    function pushHistoryEntry() {
      if (suppressHistory) return;
      const snapshot = JSON.parse(JSON.stringify(state));
      const last = undoStack[undoStack.length - 1];
      if (last && snapshotsEqual(last, snapshot)) return;
      undoStack.push(snapshot);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack = [];
      updateUndoRedoButtons();
    }

    // Слайдеры: снимок «до» берётся здесь — bindSlider (зарегистрированный
    // раньше) на этом же событии change ещё только собирается записать новое
    // значение в state.
    document.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener('change', () => {
        if (suppressControlWrites) return;
        pushHistoryEntry();
        saveToLocalStorage();
      });
    });
    // Селекты, чекбоксы и текстовые поля НЕ подписываем здесь: они уже делают
    // это внутри bindControl. Вторая подписка давала две записи истории на одно
    // изменение — undo/redo после неё возвращали тот же кадр.

    // ────────────────────────────────────────────────────────────────────
    // Autosave to localStorage
    // ────────────────────────────────────────────────────────────────────
    const AUTOSAVE_KEY = 'svemalab_autosave';

    function saveToLocalStorage() {
      try {
        const snapshot = {
          state: JSON.parse(JSON.stringify(state)),
          activeCustomPresetId: activeCustomPresetId,
          timestamp: Date.now()
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
      } catch (e) {
        console.warn('Failed to autosave:', e);
      }
    }

    function loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (!saved) return false;

        const snapshot = JSON.parse(saved);
        if (!snapshot || typeof snapshot !== 'object' || !snapshot.state) return false;

        const age = Date.now() - (snapshot.timestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (age > maxAge) {
          localStorage.removeItem(AUTOSAVE_KEY);
          return false;
        }

        // Автосейв может быть сделан более старой версией приложения и не
        // содержать новых ключей (маски, acutance, форматы и т.д.) — раньше
        // он подставлялся как есть, и отсутствующий, например, maskGrain
        // приводил к падению рендера (cfg.target у undefined). Теперь
        // сохранённые поля накладываются ПОВЕРХ свежей схемы defaultState.
        state = Object.assign(JSON.parse(JSON.stringify(defaultState)), snapshot.state);
        // Кадрирование и поворот — свойства конкретного фото, а не «образа»,
        // поэтому из автосейва они не восстанавливаются.
        state.cropRect = null;
        state.rotation = 0;
        state.p1 = { ...(state.p1 || defaultState.p1) };
        state.p2 = { ...(state.p2 || defaultState.p2) };
        activeCustomPresetId = snapshot.activeCustomPresetId || null;
        withControlWritesSuppressed(restoreStateToUI);
        return true;
      } catch (e) {
        console.warn('Failed to load autosave:', e);
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e2) {}
        return false;
      }
    }

    // Полный цикл «пользователь выбрал файл»: загрузка фото + восстановление
    // последних настроек. Раньше это пытались сделать переприсваиванием
    // handleFileSelected, но обработчики change уже держали ссылку на старую
    // функцию — автосейв не подхватывался никогда.
    async function handleFileSelected(file) {
      const ok = await loadSelectedFile(file);
      if (!ok) return;
      const loaded = loadFromLocalStorage();
      if (!loaded) selectPreset(state.preset);
      // После восстановления настроек перерисовываем кадр и подгоняем буфер.
      if (sourceImg) {
        preparePreviewBuffer();
        updateCurveSvg();
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // Легаси-инструмент: A/B (удержание показывает оригинал без эффектов)
    // ───────────────────────────────────────────────────────────────
    let showOriginal=false;
    const btnAB = document.getElementById('btnAB');
    btnAB.addEventListener('pointerdown',()=>{
      if(!sourceImg)return;
      showOriginal=true;
      btnAB.classList.add('active');
      ctx.drawImage(previewCanvas,0,0);
    });
    btnAB.addEventListener('pointerup',()=>{
      showOriginal=false;
      btnAB.classList.remove('active');
      requestRender();
    });
    btnAB.addEventListener('pointerleave',()=>{
      if(showOriginal){
        showOriginal=false;
        btnAB.classList.remove('active');
        requestRender();
      }
    });

    // ────────────────────────────────────────────────────────────────────
    // Reset Individual Sections
    // ────────────────────────────────────────────────────────────────────
    const SECTION_RESETS = {
      'Мастер-кривая (творческая)': () => {
        state.p1 = { ...defaultState.p1 };
        state.p2 = { ...defaultState.p2 };
        updateCurveSvg();
      },
      'Film Response — RGB отклик': () => {
        state.frBlackPoint = defaultState.frBlackPoint;
        state.frWhitePoint = defaultState.frWhitePoint;
        state.frMasterGamma = defaultState.frMasterGamma;
        state.frLiftR = defaultState.frLiftR;
        state.frLiftG = defaultState.frLiftG;
        state.frLiftB = defaultState.frLiftB;
        state.frGammaR = defaultState.frGammaR;
        state.frGammaG = defaultState.frGammaG;
        state.frGammaB = defaultState.frGammaB;
        state.frGainR = defaultState.frGainR;
        state.frGainG = defaultState.frGainG;
        state.frGainB = defaultState.frGainB;
        state.frMixRG = defaultState.frMixRG;
        state.frMixRB = defaultState.frMixRB;
        state.frMixGB = defaultState.frMixGB;
      },
      'Проявитель (Developer)': () => {
        state.devType = defaultState.devType;
        state.devTemp = defaultState.devTemp;
        state.devTime = defaultState.devTime;
        state.devDilution = defaultState.devDilution;
        state.devAgitation = defaultState.devAgitation;
        state.devContrast = defaultState.devContrast;
        state.devFog = defaultState.devFog;
        state.crossProcess = defaultState.crossProcess;
      },
      'Push / Pull': () => {
        state.pushPull = defaultState.pushPull;
      },
      'Творческая тональность': () => {
        state.exp = defaultState.exp;
        state.contrast = defaultState.contrast;
        state.highlights = defaultState.highlights;
        state.shadows = defaultState.shadows;
      },
      'Grain Engine': () => {
        state.grain = defaultState.grain;
        state.grainSize = defaultState.grainSize;
        state.grainDensity = defaultState.grainDensity;
        state.grainContrast = defaultState.grainContrast;
        state.grainColor = defaultState.grainColor;
        state.grainExposureDep = defaultState.grainExposureDep;
        state.grainLock = defaultState.grainLock;
      },
      'Halation': () => {
        state.halation = defaultState.halation;
        state.halationThreshold = defaultState.halationThreshold;
        state.halationRadius = defaultState.halationRadius;
        state.halationDecay = defaultState.halationDecay;
        state.halationStreak = defaultState.halationStreak;
        state.halationR = defaultState.halationR;
        state.halationG = defaultState.halationG;
        state.halationB = defaultState.halationB;
      },
      'Bloom': () => {
        state.bloom = defaultState.bloom;
        state.bloomThreshold = defaultState.bloomThreshold;
        state.bloomRadius = defaultState.bloomRadius;
      },
      'Emulsion Defects': () => {
        state.dust = defaultState.dust;
        state.scratches = defaultState.scratches;
        state.damage = defaultState.damage;
        state.spots = defaultState.spots;
        state.unevenDensity = defaultState.unevenDensity;
        state.bromide = defaultState.bromide;
        state.reticulation = defaultState.reticulation;
        state.defectSeed = defaultState.defectSeed;
        state.defectLock = defaultState.defectLock;
      },
      'Exposure Uniformity': () => {
        state.uniformH = defaultState.uniformH;
        state.uniformV = defaultState.uniformV;
        state.uniformRadial = defaultState.uniformRadial;
        state.uniformRandom = defaultState.uniformRandom;
        state.uniformScale = defaultState.uniformScale;
      },
      'Светофильтры и тонирование': () => {
        state.filterR = defaultState.filterR;
        state.filterG = defaultState.filterG;
        state.filterB = defaultState.filterB;
        state.temp = defaultState.temp;
        state.sat = defaultState.sat;
        state.splitShadow = defaultState.splitShadow;
        state.toner = defaultState.toner;
      },
      'Старение и хранение': () => {
        state.foundYear = defaultState.foundYear;
        state.condition = defaultState.condition;
        state.dyeFade = defaultState.dyeFade;
        state.sabattier = defaultState.sabattier;
        state.reciprocity = defaultState.reciprocity;
      },
      'Бумага и печать': () => {
        state.paper = defaultState.paper;
        state.paperSurface = defaultState.paperSurface;
        state.paperGrade = defaultState.paperGrade;
      },
      'Объектив и виньетирование': () => {
        state.chroma = defaultState.chroma;
        state.vignette = defaultState.vignette;
        state.vignetteShape = defaultState.vignetteShape;
        state.vignetteX = defaultState.vignetteX;
        state.vignetteY = defaultState.vignetteY;
        state.leak = defaultState.leak;
      },
      'Рамка, текст и паспорт кадра': () => {
        state.cropRect = defaultState.cropRect;
        state.rotation = defaultState.rotation;
        state.frame = defaultState.frame;
        state.frameText = defaultState.frameText;
        state.frameFormat = defaultState.frameFormat;
        state.frameNumber = defaultState.frameNumber;
        state.imprint = defaultState.imprint;
        state.imprintText = defaultState.imprintText;
        state.imprintStyle = defaultState.imprintStyle;
      }
    };

    document.querySelectorAll('.panel-header').forEach(header => {
      const title = header.querySelector('.panel-title')?.textContent;
      if (title && SECTION_RESETS[title]) {
        const resetBtn = document.createElement('button');
        resetBtn.className = 'panel-reset-btn';
        resetBtn.textContent = 'Сброс';
        resetBtn.addEventListener('click', () => {
          saveState();
          SECTION_RESETS[title]();
          restoreStateToUI();
          requestRender();
        });
        header.appendChild(resetBtn);
      }
    });

    // ────────────────────────────────────────────────────────────────────
    // Reset All
    // ────────────────────────────────────────────────────────────────────
    // Видимая кнопка «Сброс» в шапке — тот же сброс, что и в меню «⋯»; отменяется через «Отмена»
    document.getElementById('btnResetQuick').addEventListener('click', () => document.getElementById('btnReset').click());

    document.getElementById('btnReset').addEventListener('click', () => {
      saveState();
      activeCustomPresetId = null;
      state = JSON.parse(JSON.stringify(defaultState));
      state.p1 = { ...defaultState.p1 };
      state.p2 = { ...defaultState.p2 };
      showToast('Сброшено');

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
      document.getElementById('paramPaperSurface').value = 'glossy';
      document.getElementById('paramToner').value = 'none';
      document.getElementById('paramCrossProcess').checked = false;
      document.getElementById('paramFrame').value = 'none';
      document.getElementById('paramFrameFormat').value = '35';
      document.getElementById('paramVignetteShape').value = 'round';
      document.getElementById('paramImprintStyle').value = 'classic';
      document.getElementById('paramCondition').value = 'fresh';
      state.cropRect = null;
      document.getElementById('paramRotation').value = 0;
      document.getElementById('paramRecipe').value = 'manual';
      document.getElementById('paramGrainLock').checked = false;
      document.getElementById('paramDefectLock').checked = false;
      document.getElementById('paramFrameNumber').value = state.frameNumber;
      document.getElementById('paramFrameText').value = state.frameText;
      document.getElementById('paramImprint').checked = false;
      document.getElementById('paramImprintText').value = '';
      installMaskControls();
      updateCurveSvg();
      renderPresetsList();
    });

    // ────────────────────────────────────────────────────────────────────
    // Оверлей анимации экспорта — рендер в полном разрешении не мгновенный,
    // особенно на телефоне (halation/bloom считаются заново, целиком).
    // Показываем процесс явно, а не подвешиваем интерфейс молча.
    // ────────────────────────────────────────────────────────────────────
    let exportOverlay = null;
    function ensureExportOverlay() {
      if (exportOverlay) return exportOverlay;
      exportOverlay = document.createElement('div');
      exportOverlay.className = 'export-overlay';
      exportOverlay.innerHTML = `
        <div class="export-card">
          <div class="export-icon spin">◆</div>
          <div class="export-title">Рендер полного разрешения…</div>
          <div class="export-track"><div class="export-fill"></div></div>
        </div>
      `;
      document.body.appendChild(exportOverlay);
      return exportOverlay;
    }
    function setExportStatus(text, mode) {
      const el = ensureExportOverlay();
      el.classList.add('visible');
      const card = el.querySelector('.export-card');
      const icon = el.querySelector('.export-icon');
      card.className = 'export-card' + (mode ? ' ' + mode : '');
      el.querySelector('.export-title').textContent = text;
      icon.classList.toggle('spin', !mode);
      icon.textContent = mode === 'success' ? '✓' : mode === 'error' ? '✕' : '◆';
    }
    function hideExportOverlay(delay = 0) {
      setTimeout(() => { if (exportOverlay) exportOverlay.classList.remove('visible'); }, delay);
    }
    // Двойной rAF гарантирует, что оверлей реально отрисован на экране
    // ДО того, как мы заблокируем поток тяжёлым синхронным рендером.
    function nextPaint() {
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function triggerDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // ───────────────────────────────────────────────────────────────
    // Мобильный экспорт: раньше тут предоткрывали пустую вкладку и позже
    // навигировали её на blob-URL — на части мобильных браузеров фоновая
    // вкладка не прогружает навигацию до тех пор, пока не получит фокус —
    // снаружи это выглядит как «пустое окно, которое оживает только после
    // возврата на вкладку». Сейчас картинка вместо этого показывается прямо
    // на текущей странице в полноэкранной модалке — долгий тап по ней работает
    // во всех браузерах так же надёжно («Сохранить изображение»/«Добавить
    // в Фото»), но без зависимости от тайминга рендера или фокуса вкладки.
    // ────────────────────────────────────────────────────────────────────
    let exportPreviewOverlay = null;
    let exportPreviewUrl = null;
    function ensureExportPreviewOverlay() {
      if (exportPreviewOverlay) return exportPreviewOverlay;
      exportPreviewOverlay = document.createElement('div');
      exportPreviewOverlay.className = 'export-preview-overlay';
      exportPreviewOverlay.innerHTML = `
        <div class="export-preview-topbar">
          <span class="export-preview-title">СВЕМА LAB :: Экспорт</span>
          <button class="export-preview-close" aria-label="Закрыть">✕</button>
        </div>
        <div class="export-preview-img-wrap"><img alt="Готовый кадр"></div>
        <div class="export-preview-hint">Зажмите картинку → «Сохранить изображение» / «Добавить в Фото»</div>
        <div class="export-preview-actions"></div>
      `;
      exportPreviewOverlay.querySelector('.export-preview-close').addEventListener('click', closeExportPreview);
      document.body.appendChild(exportPreviewOverlay);
      return exportPreviewOverlay;
    }
    function showExportPreview(url) {
      const el = ensureExportPreviewOverlay();
      el.querySelector('img').src = url;
      el.querySelector('.export-preview-actions').innerHTML = '';
      el.classList.add('visible');
    }
    function closeExportPreview() {
      if (!exportPreviewOverlay) return;
      exportPreviewOverlay.classList.remove('visible');
      if (exportPreviewUrl) { URL.revokeObjectURL(exportPreviewUrl); exportPreviewUrl = null; }
    }

    // Export PNG
    document.getElementById('btnExport').addEventListener('click', async () => {
      if (!sourceImg) return;
      const isMobile = window.matchMedia('(max-width: 900px)').matches;

      setExportStatus('Рендер полного разрешения…');
      await nextPaint();

      lowResMode = false;
      clearTimeout(settleTimer);
      // Infinity означает «в исходном разрешении фото», но фактический потолок
      // задаёт MAX_PREVIEW_DIM внутри preparePreviewBuffer — иначе экспорт
      // многомегапиксельного снимка валил вкладку (см. комментарий там).
      preparePreviewBuffer(Infinity);
      renderFilmPipeline();

      setExportStatus('Кодирование PNG…');
      await nextPaint();

      canvas.toBlob(async (blob) => {
        // Возвращаем буфер превью и РАЗМЕР канваса к рабочему: экспорт шёл на
        // канвасе большого разрешения, и без этого шага превью после экспорта
        // оставалось растянутым (CSS width/height: 100%) и заметно мылилось.
        preparePreviewBuffer();
        canvas.width = previewCanvas.width;
        canvas.height = previewCanvas.height;
        renderFilmPipeline();

        if (!blob) {
          setExportStatus('Не удалось сохранить кадр', 'error');
          hideExportOverlay(2200);
          return;
        }

        const filename = `SvemaLab_${state.preset}_${Date.now()}.png`;

        if (isMobile) {
          if (exportPreviewUrl) URL.revokeObjectURL(exportPreviewUrl);
          exportPreviewUrl = URL.createObjectURL(blob);
          hideExportOverlay(0);
          showExportPreview(exportPreviewUrl);
          maybeShowShareButton(blob, filename);
        } else {
          triggerDownload(blob, filename);
          setExportStatus('Файл сохранён в Загрузки', 'success');
          hideExportOverlay(1800);
        }
      }, 'image/png');
    });

    // Если Web Share API вообще доступен — даём его как ДОПОЛНИТЕЛЬНУЮ кнопку
    // в модалке предпросмотра (кому-то удобнее сразу переслать в мессенджер),
    // но не как единственный путь — см. комментарий выше про ограниченный
    // список приложений на некоторых устройствах.
    function maybeShowShareButton(blob, filename) {
      const file = new File([blob], filename, { type: 'image/png' });
      if (!(navigator.canShare && navigator.canShare({ files: [file] }))) return;
      const actions = exportPreviewOverlay && exportPreviewOverlay.querySelector('.export-preview-actions');
      if (!actions || actions.querySelector('.export-share-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'btn export-share-btn';
      btn.textContent = 'Или поделиться…';
      btn.addEventListener('click', () => {
        navigator.share({ files: [file], title: 'СВЕМА LAB' }).catch(() => {});
      });
      actions.appendChild(btn);
    }

    // ────────────────────────────────────────────────────────────────────
    // Диалог "Сохранить как пресет"
    // ────────────────────────────────────────────────────────────────────
    function openSavePresetDialog() {
      if (!sourceImg) { alert('Сначала загрузите фото и настройте кадр.'); return; }
      const overlay = document.getElementById('savePresetOverlay');
      const input = document.getElementById('savePresetName');
      overlay.classList.add('visible');
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    function closeSavePresetDialog() {
      document.getElementById('savePresetOverlay').classList.remove('visible');
    }
    document.getElementById('btnSavePreset').addEventListener('click', openSavePresetDialog);
    document.getElementById('savePresetCancel').addEventListener('click', closeSavePresetDialog);
    document.getElementById('savePresetOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'savePresetOverlay') closeSavePresetDialog();
    });
    document.getElementById('savePresetConfirm').addEventListener('click', () => {
      const name = document.getElementById('savePresetName').value;
      saveCustomPreset(name);
      closeSavePresetDialog();
      if (state.activeFilter === 'custom') renderPresetsList();
    });
    document.getElementById('savePresetName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('savePresetConfirm').click();
      if (e.key === 'Escape') closeSavePresetDialog();
    });

    // Initialization
    const currentYear = new Date().getFullYear();
    const foundYearInput = document.getElementById('paramFoundYear');
    if (foundYearInput) {
      foundYearInput.max = currentYear;
      if (!foundYearInput.value || parseFloat(foundYearInput.value) > currentYear) {
        foundYearInput.value = currentYear;
      }
      state.foundYear = parseFloat(foundYearInput.value);
    }
    renderPresetsList();
    // Первичная плёнка уже стоит в defaultState — просто применяем её паспорт.
    // Через selectPreset() нельзя: он бы записал в историю undo пустой снимок
    // ещё до того, как пользователь что-то изменил (кнопка «Отменить» сразу
    // активна, а первое нажатие откатывает к состоянию до инициализации).
    applyPresetById(defaultState.preset);
    updateCurveSvg();
    installMaskControls();
