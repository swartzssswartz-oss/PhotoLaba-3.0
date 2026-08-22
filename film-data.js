
    const filmDatabase = [
      { id: 'svema64', name: 'СВЕМА 64', type: 'bw', gost: 'ГОСТ 64', res: '110 лин/мм', dev: 'СТ-2', desc: 'Классический Ч/Б негатив Шосткинского завода. Высокий контраст и глубокие тени.' },
      { id: 'svema125', name: 'СВЕМА 125', type: 'bw', gost: 'ГОСТ 125', res: '95 лин/мм', dev: 'Фенидон', desc: 'Универсальная репортажная Ч/Б пленка с пластичным тональным переходом.' },
      { id: 'svema250', name: 'СВЕМА 250', type: 'bw', gost: 'ГОСТ 250', res: '75 лин/мм', dev: 'Агфа-108', desc: 'Высокочувствительная эмульсия с выразительным крупным зерном.' },
      { id: 'tasma25', name: 'ТАСМА 25', type: 'bw', gost: 'ГОСТ 25', res: '160 лин/мм', dev: 'Мелкозернистый', desc: 'Сверхрезкая микроформатная Ч/Б пленка Казанского завода.' },
      { id: 'tasma_fn64', name: 'ТАСМА ФН-64 / А-2', type: 'bw', gost: 'ГОСТ 64', res: '140 лин/мм', dev: 'Д-19', desc: 'Жесткая аэрофотопленка с повышенной панхроматической чувствительностью.' },
      { id: 'tasma100', name: 'ТАСМА 100', type: 'bw', gost: 'ГОСТ 100', res: '105 лин/мм', dev: 'Универсальный', desc: 'Панхроматическая Ч/Б эмульсия с академической передачей серого.' },
      { id: 'foto65', name: 'ФОТО-65', type: 'bw', gost: 'ГОСТ 65', res: '100 лин/мм', dev: 'СТ-2', desc: 'Массовая любительская Ч/Б фотопленка СССР 1970-80х годов.' },
      { id: 'mikrat200', name: 'МИКРАТ-200', type: 'bw', gost: 'ГОСТ 5', res: '250 лин/мм', dev: 'Мелкозернистый', desc: 'Графическая бескомпромиссная пленка с близким к нулю зерном.' },
      { id: 'fomapan400', name: 'FOMAPAN 400', type: 'bw', gost: 'ISO 400', res: '90 лин/мм', dev: 'R-09', desc: 'Чешская классика с бархатным контрастом и объемом в полутонах.' },
      { id: 'retropan320', name: 'RETROPAN 320 Soft', type: 'bw', gost: 'ISO 320', res: '85 лин/мм', dev: 'Retro-Dev', desc: 'Специальная эмульсия с винтажным мягким рисунком и свечением.' },
      { id: 'adox25', name: 'ADOX KB 25', type: 'bw', gost: 'ISO 25', res: '180 лин/мм', dev: 'Rodinal', desc: 'Немецкая микроструктурная пленка с глубоким серебряным слоем.' },
      { id: 'sovcolor', name: 'СОВЦВЕТ ДС4', type: 'color', gost: 'ГОСТ 45', res: '85 лин/мм', dev: 'ЦВК-2', desc: 'Советский слайд: теплый золотистый свес, бирюзовые теневые тона.' },
      { id: 'ds5m', name: 'ДС-5М', type: 'color', gost: 'ГОСТ 32', res: '80 лин/мм', dev: 'ЦП-16', desc: 'Цветной негатив с пастельным оливково-оранжевым сдвигом.' },
      { id: 'co32d', name: 'ЦО-32Д', type: 'color', gost: 'ГОСТ 32', res: '90 лин/мм', dev: 'ЦВК-1', desc: 'Слайд дневного света с насыщенным глубоким синим спектром.' },
      { id: 'orwo18', name: 'ORWO UT18', type: 'color', gost: 'DIN 18', res: '120 лин/мм', dev: 'ORWO C-9165', desc: 'Легендарный немецкий цветной обратимый материал высочайшей чистоты.' },
      { id: 'orwout15', name: 'ORWO CHROM UT15', type: 'color', gost: 'DIN 15', res: '130 лин/мм', dev: 'C-9165', desc: 'Ранний слайд ГДР с пастельным бирюзово-зеленоватым налетом.' },
      { id: 'orwo19', name: 'ORWO NC19', type: 'color', gost: 'DIN 19', res: '110 лин/мм', dev: 'ORWO C-5168', desc: 'Цветной негатив ГДР с холодным киношным оттенком в тенях.' },
      { id: 'svemacv32', name: 'СВЕМА ЦВ-32', type: 'color', gost: 'ГОСТ 32', res: '85 лин/мм', dev: 'ЦП-2', desc: 'Первый массовый цветной негатив СССР. Мягкий розоватый скинтон.' },
      { id: 'svemaco50', name: 'СВЕМА ЦО-50Д', type: 'color', gost: 'ГОСТ 50', res: '95 лин/мм', dev: 'ЦВК-2', desc: 'Поздний советский слайд. Акцентированный красный и желтый спектры.' },
      { id: 'tasmacnb', name: 'ТАСМА ЦНБ-90', type: 'color', gost: 'ГОСТ 90', res: '90 лин/мм', dev: 'ЦП-16M', desc: 'Казанский цветной негатив с крупным структурным цветом.' },
      { id: 'sovds2', name: 'СОВЦВЕТ ДС-2', type: 'color', gost: 'ГОСТ 32', res: '75 лин/мм', dev: 'ЦП-1', desc: 'Ранняя цветная пленка 60-х годов. Сепийно-изумрудный колорит.' },
      { id: 'kinapln3', name: 'КИНАП ЛН-3', type: 'color', gost: 'ГОСТ 64', res: '110 лин/мм', dev: 'ECN-2', desc: 'Профессиональная кинопленка для съемки художественных фильмов.' },
      { id: 'tasmai810', name: 'ТАСМА И-810 (ИК)', type: 'aero', gost: 'ГОСТ 800', res: '60 лин/мм', dev: 'Спец-проявитель', desc: 'Инфракрасная Ч/Б эмульсия. Листва и зелень становятся белоснежными.' },
      { id: 'aerochrome', name: 'AEROCHROME COLOR IR', type: 'aero', gost: 'ISO 400', res: '80 лин/мм', dev: 'E-6 / AERO', desc: 'Цветная спектрозональная ИК-пленка. Зелень окрашивается в ярко-пурпурный цвет.' }
    ];

    // ──────────────────────────────────────────────────────────────────────
    // Схема состояния движка. Разбита по модулям, как в engine/*.js.
    // Старые ключи (exp, contrast, grain, halation, bloom, dust, ...) сохранены
    // для обратной совместимости интерфейса и истории пресетов.
    // ──────────────────────────────────────────────────────────────────────
    function freshMaskConfig() {
      return { target: 'all', custom: { shape: 'linear', angle: 0, cx: 50, cy: 50, radius: 60, feather: 40, invert: false } };
    }

    const defaultState = {
      preset: 'svema64',

      // ---- Легаси / общая стилизация (кадрирование, рамки, паспорт) ----
      crop: 'free', rotation: 0,
      frame: 'none', frameText: 'СВЕМА 64 :: ГОСТ 64-85 :: 24A', frameFormat: '35', frameNumber: '24A',
      imprint: false, imprintText: '',
      foundYear: 2026, condition: 'fresh',
      recipe: 'manual',
      history: [],
      activeFilter: 'all',
      renderPending: false,

      // ---- Творческая тональная правка (поверх физической модели) ----
      exp: 0, contrast: 0, highlights: 0, shadows: 0,
      filterR: 0, filterG: 0, filterB: 0,
      temp: 0, sat: 100, splitShadow: 0,
      paper: 'rc', toner: 'none',
      dyeFade: 0, sabattier: 0,

      // ---- Оптика (объектив, не плёнка) ----
      distortion: 0, chroma: 0, vignette: 20, leak: 0,

      // ==== 1. FILM RESPONSE ====================================
      p1: { x: 40, y: 100 }, p2: { x: 160, y: 20 }, // master creative curve (bezier)
      frBlackPoint: 0, frWhitePoint: 255, frMasterGamma: 100,
      frLiftR: 0, frLiftG: 0, frLiftB: 0,
      frGammaR: 100, frGammaG: 100, frGammaB: 100,
      frGainR: 100, frGainG: 100, frGainB: 100,
      frMixRG: 0, frMixRB: 0, frMixGB: 0,
      maskFilmResponse: freshMaskConfig(),

      // ==== 2. GRAIN ENGINE ======================================
      grain: 30,            // интенсивность (амплитуда шума)
      grainSize: 10,         // размер зерна
      grainDensity: 50,      // плотность/кучность (микс мелкой и крупной структуры)
      grainContrast: 50,     // контраст самого зерна
      grainColor: 8,         // цветность зерна (0 = моно, 100 = независимый шум по каналам)
      grainExposureDep: 35,  // зависимость видимости зерна от экспозиции (больше в тенях)
      grainLock: false, grainSeed: 12345,
      maskGrain: freshMaskConfig(),

      // ==== 3. DEVELOPER ========================================
      devType: 'st2',        // быстрый рецепт-пресет, выставляет слайдеры ниже
      devTemp: 20,            // °C
      devTime: 100,           // % от номинального времени
      devDilution: 0,         // 0 = сток, 100 = сильно разбавлен
      devAgitation: 50,       // 0 = без ажитации (потёки/неровность), 100 = непрерывная (ровно)
      devContrast: 0,         // ручная добавка контраста проявки
      devFog: 8,              // база + вуаль (поднимает чёрную точку)
      maskDeveloper: freshMaskConfig(),

      // ==== 4. PUSH / PULL =======================================
      pushPull: 0,            // -2..+3, стопы

      // ==== 5. HALATION ==========================================
      halation: 15,            // intensity, %
      halationThreshold: 180,  // 0-255
      halationRadius: 14,      // px (на превью-разрешении)
      halationDecay: 50,       // 0-100 резкость спада ореола
      halationR: 100, halationG: 20, halationB: 0, // вклад каналов, %
      maskHalation: freshMaskConfig(),

      // ==== 6. BLOOM =============================================
      bloom: 0,
      bloomThreshold: 190,
      bloomRadius: 40,
      maskBloom: freshMaskConfig(),

      // ==== 7. EMULSION DEFECTS =================================
      dust: 0,               // пыль (точки)
      scratches: 0,           // царапины (линии)
      damage: 0,               // повреждения эмульсии (пятна-проплешины)
      spots: 0,                // пятна/разводы (грибок, вода)
      unevenDensity: 0,        // неравномерность общей плотности (мутные разводы)
      bromide: 0, reticulation: 0, // сохранены из легаси-версии как частные случаи дефектов
      defectSeed: 54321, defectLock: false,
      maskDefects: freshMaskConfig(),

      // ==== 8. EXPOSURE UNIFORMITY ==============================
      uniformH: 0,     // горизонтальная, -100..100
      uniformV: 0,      // вертикальная, -100..100
      uniformRadial: 0, // радиальная, -100..100 (отрицательное = темнее к краям)
      uniformRandom: 0, // случайная неравномерность, 0..100
      uniformScale: 100 // масштаб случайного паттерна, %
    };

    let state = { ...defaultState };
