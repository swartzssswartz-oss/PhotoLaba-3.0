// filmDatabase.js
// Чистые данные о плёнках: характеристики, кривые, цветовые матрицы.
// Ничего не рендерит и не трогает DOM — можно юнит-тестировать отдельно
// или подгружать из JSON/CMS в будущем без переписывания движка рендера.

const filmDatabase = [
  {
    id: 'svema64', name: 'СВЕМА 64', type: 'bw', gost: 'ГОСТ 64', res: '110 лин/мм', dev: 'СТ-2',
    desc: 'Классический Ч/Б негатив Шосткинского завода. Высокий контраст и глубокие тени.',
    baseFog: 0.04, gamma: 1.15, toeLength: 0.15, shoulderLength: 0.25,
    grain: { size: 0.6, roughness: 0.5, shadowWeight: 0.6 },
    halation: { intensity: 0.1, radius: 3 }, edgeEffect: 1.0
  },
  {
    id: 'svema125', name: 'СВЕМА 125', type: 'bw', gost: 'ГОСТ 125', res: '95 лин/мм', dev: 'Фенидон',
    desc: 'Универсальная репортажная Ч/Б пленка с пластичным тональным переходом.',
    baseFog: 0.05, gamma: 1.22, toeLength: 0.12, shoulderLength: 0.22,
    grain: { size: 1.0, roughness: 0.7, shadowWeight: 0.7 },
    halation: { intensity: 0.15, radius: 4 }, edgeEffect: 1.1
  },
  {
    id: 'svema250', name: 'СВЕМА 250', type: 'bw', gost: 'ГОСТ 250', res: '75 лин/мм', dev: 'Агфа-108',
    desc: 'Высокочувствительная эмульсия с выразительным крупным зерном.',
    baseFog: 0.08, gamma: 1.30, toeLength: 0.10, shoulderLength: 0.18,
    grain: { size: 1.7, roughness: 0.9, shadowWeight: 0.85 },
    halation: { intensity: 0.25, radius: 6 }, edgeEffect: 1.5
  },
  {
    id: 'tasma25', name: 'ТАСМА 25', type: 'bw', gost: 'ГОСТ 25', res: '160 лин/мм', dev: 'Мелкозернистый',
    desc: 'Сверхрезкая микроформатная Ч/Б пленка Казанского завода.',
    baseFog: 0.02, gamma: 1.20, toeLength: 0.20, shoulderLength: 0.30,
    grain: { size: 0.3, roughness: 0.3, shadowWeight: 0.4 },
    halation: { intensity: 0.05, radius: 2 }, edgeEffect: 0.8
  },
  {
    id: 'tasma_fn64', name: 'ТАСМА ФН-64 / А-2', type: 'bw', gost: 'ГОСТ 64', res: '140 лин/мм', dev: 'Д-19',
    desc: 'Жесткая аэрофотопленка с повышенной панхроматической чувствительностью.',
    baseFog: 0.07, gamma: 1.35, toeLength: 0.12, shoulderLength: 0.22,
    grain: { size: 1.1, roughness: 0.85, shadowWeight: 0.75 },
    halation: { intensity: 0.22, radius: 5 }, edgeEffect: 2.0
  },
  {
    id: 'tasma100', name: 'ТАСМА 100', type: 'bw', gost: 'ГОСТ 100', res: '105 лин/мм', dev: 'Универсальный',
    desc: 'Панхроматическая Ч/Б эмульсия с академической передачей серого.',
    baseFog: 0.06, gamma: 1.18, toeLength: 0.14, shoulderLength: 0.24,
    grain: { size: 0.9, roughness: 0.6, shadowWeight: 0.65 },
    halation: { intensity: 0.12, radius: 3 }, edgeEffect: 1.0
  },
  {
    id: 'foto65', name: 'ФОТО-65', type: 'bw', gost: 'ГОСТ 65', res: '100 лин/мм', dev: 'СТ-2',
    desc: 'Массовая любительская Ч/Б фотопленка СССР 1970-80х годов.',
    baseFog: 0.06, gamma: 1.10, toeLength: 0.18, shoulderLength: 0.28,
    grain: { size: 1.3, roughness: 0.75, shadowWeight: 0.7 },
    halation: { intensity: 0.18, radius: 4 }, edgeEffect: 1.0
  },
  {
    id: 'mikrat200', name: 'МИКРАТ-200', type: 'bw', gost: 'ГОСТ 5', res: '250 лин/мм', dev: 'Мелкозернистый',
    desc: 'Графическая бескомпромиссная пленка с близким к нулю зерном.',
    baseFog: 0.02, gamma: 1.75, toeLength: 0.05, shoulderLength: 0.08,
    grain: { size: 0.2, roughness: 0.1, shadowWeight: 0.2 },
    halation: { intensity: 0.03, radius: 1 }, edgeEffect: 1.8
  },
  {
    id: 'fomapan400', name: 'FOMAPAN 400', type: 'bw', gost: 'ISO 400', res: '90 лин/мм', dev: 'R-09',
    desc: 'Чешская классика с бархатным контрастом и объемом в полутонах.',
    baseFog: 0.08, gamma: 1.25, toeLength: 0.14, shoulderLength: 0.20,
    grain: { size: 1.9, roughness: 0.8, shadowWeight: 0.8 },
    halation: { intensity: 0.30, radius: 7 }, edgeEffect: 1.2
  },
  {
    id: 'retropan320', name: 'RETROPAN 320 Soft', type: 'bw', gost: 'ISO 320', res: '85 лин/мм', dev: 'Retro-Dev',
    desc: 'Специальная эмульсия с винтажным мягким рисунком и свечением.',
    baseFog: 0.09, gamma: 0.95, toeLength: 0.25, shoulderLength: 0.35,
    grain: { size: 1.5, roughness: 0.6, shadowWeight: 0.5 },
    halation: { intensity: 0.40, radius: 10 }, edgeEffect: 0.9
  },
  {
    id: 'adox25', name: 'ADOX KB 25', type: 'bw', gost: 'ISO 25', res: '180 лин/мм', dev: 'Rodinal',
    desc: 'Немецкая микроструктурная пленка с глубоким серебряным слоем.',
    baseFog: 0.03, gamma: 1.40, toeLength: 0.16, shoulderLength: 0.25,
    grain: { size: 0.4, roughness: 0.4, shadowWeight: 0.5 },
    halation: { intensity: 0.08, radius: 2 }, edgeEffect: 1.3
  },
  {
    id: 'sovcolor', name: 'СОВЦВЕТ ДС4', type: 'color', gost: 'ГОСТ 45', res: '85 лин/мм', dev: 'ЦВК-2',
    desc: 'Советский слайд: теплый золотистый свес, бирюзовые теневые тона.',
    baseFog: 0.10, gamma: 1.08,
    colorShiftMatrix: [1.02, 0.05, -0.08, -0.08, 1.00, 0.04, 0.10, -0.05, 1.12],
    grain: { size: 2.0, roughness: 0.85, shadowWeight: 0.8 },
    halation: { intensity: 0.50, radius: 11 }
  },
  {
    id: 'ds5m', name: 'ДС-5М', type: 'color', gost: 'ГОСТ 32', res: '80 лин/мм', dev: 'ЦП-16',
    desc: 'Цветной негатив с пастельным оливково-оранжевым сдвигом.',
    baseFog: 0.12, gamma: 1.12,
    colorShiftMatrix: [1.05, 0.08, -0.12, -0.05, 0.98, 0.07, 0.15, -0.10, 1.10],
    grain: { size: 2.2, roughness: 0.9, shadowWeight: 0.85 },
    halation: { intensity: 0.65, radius: 14 }
  },
  {
    id: 'co32d', name: 'ЦО-32Д', type: 'color', gost: 'ГОСТ 32', res: '90 лин/мм', dev: 'ЦВК-1',
    desc: 'Слайд дневного света с насыщенным глубоким синим спектром.',
    baseFog: 0.03, gamma: 1.50,
    colorShiftMatrix: [1.10, -0.02, 0.02, 0.02, 1.05, -0.04, -0.05, 0.02, 1.25],
    grain: { size: 0.7, roughness: 0.45, shadowWeight: 0.3 },
    halation: { intensity: 0.12, radius: 3 }
  },
  {
    id: 'orwo18', name: 'ORWO UT18', type: 'color', gost: 'DIN 18', res: '120 лин/мм', dev: 'ORWO C-9165',
    desc: 'Легендарный немецкий цветной обратимый материал высочайшей чистоты.',
    baseFog: 0.03, gamma: 1.45,
    colorShiftMatrix: [1.15, -0.05, 0.00, 0.02, 1.02, -0.02, -0.08, 0.05, 1.20],
    grain: { size: 0.9, roughness: 0.5, shadowWeight: 0.3 },
    halation: { intensity: 0.15, radius: 4 }
  },
  {
    id: 'orwout15', name: 'ORWO CHROM UT15', type: 'color', gost: 'DIN 15', res: '130 лин/мм', dev: 'C-9165',
    desc: 'Ранний слайд ГДР с пастельным бирюзово-зеленоватым налетом.',
    baseFog: 0.04, gamma: 1.40,
    colorShiftMatrix: [1.12, 0.02, -0.05, -0.03, 1.05, 0.03, 0.05, -0.08, 1.15],
    grain: { size: 0.8, roughness: 0.48, shadowWeight: 0.32 },
    halation: { intensity: 0.14, radius: 4 }
  },
  {
    id: 'orwo19', name: 'ORWO NC19', type: 'color', gost: 'DIN 19', res: '110 лин/мм', dev: 'ORWO C-5168',
    desc: 'Цветной негатив ГДР с холодным киношным оттенком в тенях.',
    baseFog: 0.09, gamma: 1.14,
    colorShiftMatrix: [1.03, 0.04, -0.06, -0.03, 1.04, 0.02, 0.06, -0.04, 1.08],
    grain: { size: 1.5, roughness: 0.7, shadowWeight: 0.65 },
    halation: { intensity: 0.35, radius: 8 }
  },
  {
    id: 'svemacv32', name: 'СВЕМА ЦВ-32', type: 'color', gost: 'ГОСТ 32', res: '85 лин/мм', dev: 'ЦП-2',
    desc: 'Первый массовый цветной негатив СССР. Мягкий розоватый скинтон.',
    baseFog: 0.09, gamma: 1.10,
    colorShiftMatrix: [1.00, 0.12, -0.05, -0.03, 1.02, 0.02, 0.05, -0.02, 1.05],
    grain: { size: 1.6, roughness: 0.7, shadowWeight: 0.65 },
    halation: { intensity: 0.40, radius: 9 }
  },
  {
    id: 'svemaco50', name: 'СВЕМА ЦО-50Д', type: 'color', gost: 'ГОСТ 50', res: '95 лин/мм', dev: 'ЦВК-2',
    desc: 'Поздний советский слайд. Акцентированный красный и желтый спектры.',
    baseFog: 0.04, gamma: 1.40,
    colorShiftMatrix: [1.12, -0.05, 0.00, 0.00, 1.08, -0.02, -0.02, 0.05, 1.18],
    grain: { size: 0.8, roughness: 0.5, shadowWeight: 0.35 },
    halation: { intensity: 0.15, radius: 4 }
  },
  {
    id: 'tasmacnb', name: 'ТАСМА ЦНБ-90', type: 'color', gost: 'ГОСТ 90', res: '90 лин/мм', dev: 'ЦП-16M',
    desc: 'Казанский цветной негатив с крупным структурным цветом.',
    baseFog: 0.14, gamma: 1.18,
    colorShiftMatrix: [1.08, -0.02, -0.15, 0.05, 0.95, 0.05, 0.20, -0.15, 1.00],
    grain: { size: 2.5, roughness: 0.95, shadowWeight: 0.9 },
    halation: { intensity: 0.80, radius: 16 }
  },
  {
    id: 'sovds2', name: 'СОВЦВЕТ ДС-2', type: 'color', gost: 'ГОСТ 32', res: '75 лин/мм', dev: 'ЦП-1',
    desc: 'Ранняя цветная пленка 60-х годов. Сепийно-изумрудный колорит.',
    baseFog: 0.11, gamma: 1.02,
    colorShiftMatrix: [0.95, 0.10, -0.05, -0.02, 0.92, 0.08, 0.08, -0.05, 1.02],
    grain: { size: 2.1, roughness: 0.8, shadowWeight: 0.75 },
    halation: { intensity: 0.55, radius: 12 }
  },
  {
    id: 'kinapln3', name: 'КИНАП ЛН-3', type: 'color', gost: 'ГОСТ 64', res: '110 лин/мм', dev: 'ECN-2',
    desc: 'Профессиональная кинопленка для съемки художественных фильмов.',
    baseFog: 0.08, gamma: 1.15,
    colorShiftMatrix: [1.04, -0.04, 0.05, -0.02, 1.02, 0.00, -0.05, 0.08, 1.15],
    grain: { size: 1.4, roughness: 0.65, shadowWeight: 0.6 },
    halation: { intensity: 0.90, radius: 18 }
  },
  {
    id: 'tasmai810', name: 'ТАСМА И-810 (ИК)', type: 'aero', gost: 'ГОСТ 800', res: '60 лин/мм', dev: 'Спец-проявитель',
    desc: 'Инфракрасная Ч/Б эмульсия. Листва и зелень становятся белоснежными.',
    baseFog: 0.05, gamma: 1.30, toeLength: 0.15, shoulderLength: 0.25,
    grain: { size: 2.2, roughness: 0.85, shadowWeight: 0.8 },
    halation: { intensity: 0.45, radius: 10 }, edgeEffect: 1.5
  },
  {
    id: 'aerochrome', name: 'AEROCHROME COLOR IR', type: 'aero', gost: 'ISO 400', res: '80 лин/мм', dev: 'E-6 / AERO',
    desc: 'Цветная спектрозональная ИК-пленка. Зелень окрашивается в ярко-пурпурный цвет.',
    baseFog: 0.06, gamma: 1.25,
    colorShiftMatrix: [0.4, 1.8, -0.2, 0.7, 0.0, 0.3, 0.1, 0.2, 0.8],
    grain: { size: 1.8, roughness: 0.75, shadowWeight: 0.7 },
    halation: { intensity: 0.60, radius: 12 }
  }
];

function findFilm(id) {
  return filmDatabase.find(f => f.id === id) || filmDatabase[0];
}
