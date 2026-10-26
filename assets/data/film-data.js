
    // Физическая «цветовая наука» по брендам/технологиям — как именно выцветает конкретный сток
    // (старение: agingRDecay/agingRMix и т.д. — тот же смысл, что r*(1-age*Decay)+lum*age*Mix
    // в core.js) и какой цветовой каст даёт на длинных выдержках (reciprocityTint, единицы —
    // уровни яркости канала на 0..255 при reciprocity=100%). Сами коэффициенты — стилизованная
    // апроксимация, как и остальная часть рецептов в этом файле, а не прибор из даташита.
    const FILM_COLOR_SCIENCE = {
      sovietBW:      { agingRDecay: .30, agingRMix: .20, agingGDecay: .20, agingGMix: .16, agingBDecay: .44, agingBMix: .28, reciprocityTint: { r: 6,  g: 2,  b: -4 } },
      westernBW:     { agingRDecay: .22, agingRMix: .16, agingGDecay: .20, agingGMix: .16, agingBDecay: .30, agingBMix: .20, reciprocityTint: { r: 2,  g: 2,  b: 0 } },
      sovietNegative:{ agingRDecay: .24, agingRMix: .14, agingGDecay: .20, agingGMix: .18, agingBDecay: .46, agingBMix: .30, reciprocityTint: { r: 10, g: -2, b: -10 } },
      sovietSlide:   { agingRDecay: .20, agingRMix: .10, agingGDecay: .34, agingGMix: .22, agingBDecay: .26, agingBMix: .14, reciprocityTint: { r: 4,  g: -10, b: 6 } },
      westernColor:  { agingRDecay: .26, agingRMix: .18, agingGDecay: .22, agingGMix: .18, agingBDecay: .34, agingBMix: .22, reciprocityTint: { r: 6,  g: 0,  b: -6 } },
      archival:      { agingRDecay: .14, agingRMix: .10, agingGDecay: .12, agingGMix: .10, agingBDecay: .18, agingBMix: .12, reciprocityTint: { r: 2,  g: 0,  b: -2 } },
      irSpecial:     { agingRDecay: .20, agingRMix: .14, agingGDecay: .20, agingGMix: .14, agingBDecay: .20, agingBMix: .14, reciprocityTint: { r: 8,  g: 6,  b: -4 } },
      orthoSpecial:  { agingRDecay: .22, agingRMix: .18, agingGDecay: .18, agingGMix: .14, agingBDecay: .28, agingBMix: .18, reciprocityTint: { r: 12, g: 2,  b: -8 } }
    };

    // kind: 'negative' | 'slide' — системная категория (не просто описание): слайды в core.js
    // всегда жёстче и узкоширотнее по широте (аккуратнее клипят света), негативы — гибкое,
    // независимо от того, как подобран recipe конкретной плёнки.
    const filmDatabase = [
      { id: 'svema64', name: 'СВЕМА 64', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 64', res: '110 лин/мм', dev: 'Ст-2', desc: 'Классический С/Ж негатив Шосткинского завода. Высокий контраст и глубокие тени.',
        bwMix: [0.28, 0.50, 0.22],
        recipe: { contrast: 24, grain: 28, grainSize: 14, grainContrast: 58, devFog: 5, frLiftR: -6, frLiftG: -6, frLiftB: -6, halation: 12, bloom: 0 } },
      { id: 'svema32', name: 'СВЕМА 32', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 32', res: '120 лин/мм', dev: 'Д-76', desc: 'Мелкозернистая универсальная пленка Шосткинского завода.',
        bwMix: [0.29, 0.56, 0.15],
        recipe: { contrast: 8, grain: 14, grainSize: 10, grainContrast: 28, devFog: 6, frLiftR: -2, frLiftG: -2, frLiftB: -2, halation: 10, bloom: 0 } },
      { id: 'svema16', name: 'СВЕМА 16', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 16', res: '130 лин/мм', dev: 'Д-76', desc: 'Сверхмелкозернистая пленка для портретной съемки.',
        bwMix: [0.28, 0.57, 0.15],
        recipe: { contrast: 12, grain: 10, grainSize: 9, grainContrast: 22, devFog: 4, frLiftR: -4, frLiftG: -4, frLiftB: -4, halation: 8, bloom: 0 } },
      { id: 'svema125', name: 'СВЕМА 125', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 125', res: '95 лин/мм', dev: 'Фенидон', desc: 'Универсальная репортажная С/Ж пленка с пластичным тональным переходом.',
        bwMix: [0.30, 0.56, 0.14],
        recipe: { contrast: -4, grain: 20, grainSize: 11, grainContrast: 32, devFog: 8, frLiftR: 4, frLiftG: 4, frLiftB: 4, halation: 14, bloom: 0 } },
      { id: 'svema130', name: 'СВЕМА 130', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 130', res: '92 лин/мм', dev: 'Ст-2', desc: 'Высокочувствительная репортажная пленка.',
        bwMix: [0.32, 0.54, 0.14],
        recipe: { contrast: 2, grain: 28, grainSize: 13, grainContrast: 40, devFog: 9, frLiftR: 2, frLiftG: 2, frLiftB: 2, halation: 14, bloom: 0 } },
      { id: 'svema200', name: 'СВЕМА 200', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 200', res: '85 лин/мм', dev: 'Ст-2', desc: 'Высокочувствительная эмульсия с умеренным зерном.',
        bwMix: [0.33, 0.52, 0.15],
        recipe: { contrast: 6, grain: 38, grainSize: 16, grainContrast: 48, devFog: 10, frLiftR: 0, frLiftG: 0, frLiftB: 0, halation: 16, bloom: 0 } },
      { id: 'svema250', name: 'СВЕМА 250', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 250', res: '75 лин/мм', dev: 'Агфа-108', desc: 'Высокочувствительная эмульсия с выразительным крупным зерном.',
        bwMix: [0.34, 0.52, 0.14],
        recipe: { contrast: 10, grain: 58, grainSize: 22, grainContrast: 65, devFog: 10, frLiftR: 0, frLiftG: 0, frLiftB: 0, halation: 16, bloom: 0 } },
      { id: 'svema400', name: 'СВЕМА 400', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 400', res: '65 лин/мм', dev: 'Ст-2', desc: 'Экстремально высокочувствительная пленка с очень крупным зерном.',
        bwMix: [0.36, 0.50, 0.14],
        recipe: { contrast: 14, grain: 72, grainSize: 24, grainContrast: 70, devFog: 12, frLiftR: 2, frLiftG: 2, frLiftB: 2, halation: 20, bloom: 0 } },
      { id: 'din250', name: 'ДИН-250', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 250', res: '70 лин/мм', dev: 'Ст-2', desc: 'Ранний советский высокочувствительный негатив. Очень грубое зерно и характерный зеленоватый оттенок.',
        bwMix: [0.36, 0.48, 0.16],
        recipe: { contrast: 15, grain: 68, grainSize: 24, grainContrast: 70, devFog: 12, frLiftR: 2, frLiftG: 4, frLiftB: -2, halation: 20, bloom: 0 } },
      { id: 'tip6', name: 'ТИП-6', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 16', res: '140 лин/мм', dev: 'Д-76', desc: 'Панхроматическая репортажная пленка 1950-х. Тонкое зерно и мягкий контраст.',
        bwMix: [0.29, 0.57, 0.14],
        recipe: { contrast: -15, grain: 16, grainSize: 10, grainContrast: 28, devFog: 6, frLiftR: 6, frLiftG: 6, frLiftB: 6, halation: 10, bloom: 0 } },
      { id: 'tip10', name: 'ТИП-10', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 32', res: '125 лин/мм', dev: 'Д-76', desc: 'Панхроматическая пленка для научной и технической съемки.',
        bwMix: [0.30, 0.56, 0.14],
        recipe: { contrast: 6, grain: 18, grainSize: 11, grainContrast: 32, devFog: 7, frLiftR: 0, frLiftG: 0, frLiftB: 0, halation: 11, bloom: 0 } },
      { id: 'mz2', name: 'МЗ-2', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 90', res: '95 лин/мм', dev: 'Ст-2', desc: 'Ранняя советская репортажная эмульсия.',
        bwMix: [0.31, 0.55, 0.14],
        recipe: { contrast: -6, grain: 28, grainSize: 13, grainContrast: 38, devFog: 10, frLiftR: 4, frLiftG: 4, frLiftB: 4, halation: 12, bloom: 0 } },
      { id: 'mz3', name: 'МЗ-3', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 130', res: '90 лин/мм', dev: 'Ст-2', desc: 'Советская репортажная эмульсия с характерным винтажным серым тоном.',
        bwMix: [0.32, 0.54, 0.14],
        recipe: { contrast: -8, grain: 30, grainSize: 13, grainContrast: 40, devFog: 10, frLiftR: 2, frLiftG: 2, frLiftB: 2, halation: 12, bloom: 0 } },
      { id: 'a2', name: 'А-2', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 180', res: '70 лин/мм', dev: 'Д-19', desc: 'Аэрофотопленка с повышенной чувствительностью.',
        bwMix: [0.40, 0.42, 0.18],
        recipe: { contrast: 18, grain: 38, grainSize: 16, grainContrast: 45, devFog: 8, frLiftR: -4, frLiftG: -4, frLiftB: -4, halation: 14, bloom: 0 } },
      { id: 'a2sh', name: 'А-2Ш', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 250', res: '65 лин/мм', dev: 'Д-19', desc: 'Аэрофотопленка с экстремально высокой чувствительностью и грубым зерном.',
        bwMix: [0.38, 0.50, 0.12],
        recipe: { contrast: 20, grain: 72, grainSize: 26, grainContrast: 75, devFog: 14, frLiftR: -2, frLiftG: 0, frLiftB: -4, halation: 22, bloom: 0 } },
      { id: 'tasma25', name: 'таСМА 25', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 25', res: '160 лин/мм', dev: 'Мелкозернистый', desc: 'Сверхрезкая микроформатная С/Ж пленка Казанского завода.',
        bwMix: [0.30, 0.59, 0.11],
        recipe: { contrast: 14, grain: 6, grainSize: 9, grainContrast: 20, devFog: 2, frLiftR: -4, frLiftG: -4, frLiftB: -4, halation: 8, bloom: 0 } },
      { id: 'tasma32', name: 'таСМА 32', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 32', res: '145 лин/мм', dev: 'Д-76', desc: 'Мелкозернистая панхроматическая пленка Казанского завода.',
        bwMix: [0.29, 0.57, 0.14],
        recipe: { contrast: 8, grain: 12, grainSize: 10, grainContrast: 26, devFog: 5, frLiftR: -2, frLiftG: -2, frLiftB: -2, halation: 9, bloom: 0 } },
      { id: 'tasma64', name: 'таСМА 64', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 64', res: '130 лин/мм', dev: 'Ст-2', desc: 'Универсальная панхроматическая пленка Казанского завода.',
        bwMix: [0.30, 0.56, 0.14],
        recipe: { contrast: 4, grain: 20, grainSize: 12, grainContrast: 36, devFog: 8, frLiftR: 0, frLiftG: 0, frLiftB: 0, halation: 12, bloom: 0 } },
      { id: 'tasma100', name: 'таСМА 100', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 100', res: '105 лин/мм', dev: 'Универсальный', desc: 'Панхроматическая С/Ж эмульсия с академической передачей серого.',
        bwMix: [0.30, 0.59, 0.11],
        recipe: { contrast: 2, grain: 18, grainSize: 11, grainContrast: 36, devFog: 7, frLiftR: -2, frLiftG: -2, frLiftB: -2, halation: 12, bloom: 0 } },
      { id: 'tasma130', name: 'таСМА 130', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 130', res: '98 лин/мм', dev: 'Ст-2', desc: 'Высокочувствительная панхроматическая эмульсия Казанского завода.',
        bwMix: [0.33, 0.53, 0.14],
        recipe: { contrast: 6, grain: 26, grainSize: 13, grainContrast: 42, devFog: 9, frLiftR: 0, frLiftG: 0, frLiftB: 0, halation: 13, bloom: 0 } },
      { id: 'tasma_fn64', name: 'таСМА ФН-64 / А-2', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 64', res: '140 лин/мм', dev: 'Д-19', desc: 'Жесткая аэрофотопленка с повышенной панхроматической чувствительностью.',
        bwMix: [0.46, 0.36, 0.18],
        recipe: { contrast: 35, grain: 18, grainSize: 12, grainContrast: 38, devFog: 4, frLiftR: -8, frLiftG: -8, frLiftB: -8, halation: 10, bloom: 0 } },
      { id: 'tasma_fn32', name: 'таСМА ФН-32', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 32', res: '150 лин/мм', dev: 'Д-19', desc: 'Аэрофотопленка с высокой разрешающей способностью.',
        bwMix: [0.44, 0.38, 0.18],
        recipe: { contrast: 28, grain: 14, grainSize: 11, grainContrast: 34, devFog: 3, frLiftR: -6, frLiftG: -6, frLiftB: -6, halation: 8, bloom: 0 } },
      { id: 'foto32', name: 'фОтО-32', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 32', res: '125 лин/мм', dev: 'Д-76', desc: 'Ранняя любительская пленка с мелким зерном и мягким тоном.',
        bwMix: [0.30, 0.57, 0.13],
        recipe: { contrast: -10, grain: 14, grainSize: 10, grainContrast: 26, devFog: 6, frLiftR: 4, frLiftG: 4, frLiftB: 4, halation: 9, bloom: 0 } },
      { id: 'foto65', name: 'фОтО-65', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 65', res: '100 лин/мм', dev: 'Ст-2', desc: 'Массовая любительская С/Ж фотопленка СССР 1970-80х годов.',
        bwMix: [0.31, 0.55, 0.14],
        recipe: { contrast: -6, grain: 32, grainSize: 14, grainContrast: 43, devFog: 15, frLiftR: 4, frLiftG: 4, frLiftB: 4, halation: 14, bloom: 0 } },
      { id: 'foto130', name: 'фОтО-130', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 130', res: '90 лин/мм', dev: 'Ст-2', desc: 'Высокочувствительная любительская пленка.',
        bwMix: [0.33, 0.53, 0.14],
        recipe: { contrast: 0, grain: 34, grainSize: 15, grainContrast: 44, devFog: 12, frLiftR: 4, frLiftG: 4, frLiftB: 4, halation: 14, bloom: 0 } },
      { id: 'mikrat200', name: 'МИКРАт-200', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 5', res: '250 лин/мм', dev: 'Мелкозернистый', desc: 'Графическая бескомпромиссная пленка с близким к нулю зерном.',
        bwMix: [0.30, 0.59, 0.11],
        recipe: { contrast: 38, grain: 2, grainSize: 9, grainContrast: 18, devFog: 1, frLiftR: -10, frLiftG: -10, frLiftB: -10, halation: 6, bloom: 0 } },
      { id: 'mikrat100', name: 'МИКРАт-100', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 8', res: '200 лин/мм', dev: 'Мелкозернистый', desc: 'Графическая пленка с очень мелким зерном и высоким контрастом.',
        bwMix: [0.30, 0.58, 0.12],
        recipe: { contrast: 32, grain: 4, grainSize: 9, grainContrast: 22, devFog: 2, frLiftR: -8, frLiftG: -8, frLiftB: -8, halation: 7, bloom: 0 } },
      { id: 'sn2', name: 'СН-2М', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 32', res: '120 лин/мм', dev: 'Д-76', desc: 'Спектральная плёнка для астрономической съемки.',
        bwMix: [0.35, 0.45, 0.20],
        recipe: { contrast: 20, grain: 10, grainSize: 9, grainContrast: 30, devFog: 4, frLiftR: -6, frLiftG: -6, frLiftB: -6, halation: 8, bloom: 0 } },
      { id: 'sn6', name: 'СН-6М', type: 'bw', kind: 'negative', agingProfile: 'sovietBW', gost: 'ГОСТ 6', res: '130 лин/мм', dev: 'Д-76', desc: 'Астрономическая пленка с чувствительностью к красному спектру.',
        bwMix: [0.40, 0.40, 0.20],
        recipe: { contrast: 22, grain: 8, grainSize: 8, grainContrast: 28, devFog: 3, frLiftR: -8, frLiftG: -4, frLiftB: 4, halation: 6, bloom: 0 } },
      { id: 'sovcolor', name: 'СОВЦВЕт ДС4', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 45', res: '85 лин/мм', dev: 'цВК-2', desc: 'советский слайд: теплый золотистый свес, бирюзовые теневые тона.',
        recipe: { contrast: 10, sat: 118, grain: 22, grainSize: 11, grainContrast: 42, devFog: 8, halation: 18, bloom: 8, frLiftR: -8, frLiftG: 0, frLiftB: 12, frGainR: 114, frGainG: 102, frGainB: 86 } },
      { id: 'sovcolor2', name: 'СОВЦВЕт ДС-2', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 32', res: '75 лин/мм', dev: 'цВК-1', desc: 'Ранняя советская цветная пленка 60-х годов.',
        recipe: { contrast: -12, sat: 70, grain: 30, grainSize: 15, grainContrast: 20, devFog: 18, halation: 20, bloom: 0, dyeFade: 15, frLiftR: 0, frLiftG: 10, frLiftB: 0, frGainR: 108, frGainG: 100, frGainB: 82 } },
      { id: 'ds5m', name: 'ДС-5М', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 32', res: '80 лин/мм', dev: 'цП-16', desc: 'цветной негатив с пастельным оливково-оранжевым сдвигом.',
        recipe: { contrast: -4, sat: 75, grain: 18, grainSize: 10, grainContrast: 33, devFog: 10, halation: 14, bloom: 0, frLiftR: 2, frLiftG: 4, frLiftB: -6, frGainR: 104, frGainG: 98, frGainB: 90 } },
      { id: 'ds6', name: 'ДС-6', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 90', res: '75 лин/мм', dev: 'цП-16', desc: 'советский цветной негатив с умеренной насыщенностью.',
        recipe: { contrast: 0, sat: 85, grain: 22, grainSize: 12, grainContrast: 35, devFog: 10, halation: 14, bloom: 0, frLiftR: 2, frLiftG: 2, frLiftB: -4, frGainR: 102, frGainG: 98, frGainB: 92 } },
      { id: 'co32d', name: 'цО-32Д', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 32', res: '90 лин/мм', dev: 'цВК-1', desc: 'слайд дневного света с насыщенным глубоким синим спектром.',
        recipe: { contrast: 16, sat: 125, grain: 16, grainSize: 10, grainContrast: 48, devFog: 4, halation: 10, bloom: 0, frLiftR: -2, frLiftG: -2, frLiftB: 10, frGainR: 94, frGainG: 98, frGainB: 120 } },
      { id: 'co64', name: 'цО-64', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 64', res: '88 лин/мм', dev: 'цВК-2', desc: 'советский слайд с акцентом на красный спектр.',
        recipe: { contrast: 14, sat: 122, grain: 18, grainSize: 11, grainContrast: 42, devFog: 6, halation: 12, bloom: 0, frLiftR: -2, frLiftG: -4, frLiftB: 6, frGainR: 120, frGainG: 102, frGainB: 86 } },
      { id: 'co90', name: 'цО-90', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 90', res: '82 лин/мм', dev: 'цВК-2', desc: 'советский слайд с умеренной насыщенностью.',
        recipe: { contrast: 10, sat: 110, grain: 22, grainSize: 12, grainContrast: 36, devFog: 8, halation: 16, bloom: 0, frLiftR: -4, frLiftG: -2, frLiftB: 6, frGainR: 106, frGainG: 104, frGainB: 90 } },
      { id: 'cp22', name: 'цП-22', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 22', res: '75 лин/мм', dev: 'цП-16', desc: 'ранний советский цветной негатив с холодным оттенком.',
        recipe: { contrast: -10, sat: 68, grain: 30, grainSize: 15, grainContrast: 28, devFog: 16, halation: 18, bloom: 0, frLiftR: 4, frLiftG: 6, frLiftB: -8, frGainR: 102, frGainG: 100, frGainB: 86 } },
      { id: 'cp22a', name: 'цП-22А', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 22', res: '80 лин/мм', dev: 'цП-16', desc: 'улучшенный советский цветной негатив с более насыщенными тонами.',
        recipe: { contrast: -6, sat: 80, grain: 22, grainSize: 12, grainContrast: 30, devFog: 12, halation: 14, bloom: 0, frLiftR: 2, frLiftG: 4, frLiftB: -6, frGainR: 104, frGainG: 98, frGainB: 90 } },
      { id: 'cp32', name: 'цП-32', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 32', res: '85 лин/мм', dev: 'цП-16', desc: 'советский цветной негатив средней чувствительности.',
        recipe: { contrast: -8, sat: 78, grain: 24, grainSize: 13, grainContrast: 32, devFog: 14, halation: 16, bloom: 0, frLiftR: 6, frLiftG: 4, frLiftB: -4, frGainR: 106, frGainG: 100, frGainB: 92 } },
      { id: 'cp45', name: 'цП-45', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 45', res: '90 лин/мм', dev: 'цП-16', desc: 'советский цветной негатив с теплым оттенком.',
        recipe: { contrast: -4, sat: 85, grain: 26, grainSize: 13, grainContrast: 30, devFog: 12, halation: 14, bloom: 0, frLiftR: 8, frLiftG: 2, frLiftB: -2, frGainR: 110, frGainG: 100, frGainB: 94 } },
      { id: 'svemacv32', name: 'СВЕМА цВ2', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 32', res: '85 лин/мм', dev: 'цП-2', desc: 'Первый массовый цветной негатив СССР. Мягкий розоватый скинтон.',
        recipe: { contrast: -10, sat: 85, grain: 26, grainSize: 13, grainContrast: 23, devFog: 14, halation: 16, bloom: 6, frLiftR: 10, frLiftG: -2, frLiftB: -2, frGainR: 110, frGainG: 96, frGainB: 94 } },
      { id: 'svemacv45', name: 'СВЕМА цВ-45', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 45', res: '90 лин/мм', dev: 'цП-16', desc: 'Советский цветной негатив с теплым оранжевым оттенком.',
        recipe: { contrast: -6, sat: 90, grain: 24, grainSize: 12, grainContrast: 26, devFog: 12, halation: 14, bloom: 0, frLiftR: 8, frLiftG: 0, frLiftB: -4, frGainR: 112, frGainG: 98, frGainB: 92 } },
      { id: 'svemacv65', name: 'СВЕМА цВ-65', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 65', res: '88 лин/мм', dev: 'цП-16', desc: 'Советский цветной негатив с улучшенной чувствительностью.',
        recipe: { contrast: -2, sat: 92, grain: 22, grainSize: 12, grainContrast: 28, devFog: 10, halation: 12, bloom: 0, frLiftR: 4, frLiftG: 0, frLiftB: -2, frGainR: 108, frGainG: 98, frGainB: 92 } },
      { id: 'svemaco50', name: 'СВЕМА цО-50Д', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 50', res: '95 лин/мм', dev: 'цВК-2', desc: 'Поздний советский слайд. Акцентированный красный и желтый спектры.',
        recipe: { contrast: 14, sat: 132, grain: 18, grainSize: 11, grainContrast: 48, devFog: 5, halation: 20, bloom: 0, frLiftR: -2, frLiftG: -2, frLiftB: 2, frGainR: 118, frGainG: 106, frGainB: 88 } },
      { id: 'svemaco64', name: 'СВЕМА цО-64', type: 'color', kind: 'slide', agingProfile: 'sovietSlide', gost: 'ГОСТ 64', res: '92 лин/мм', dev: 'цВК-2', desc: 'Советский слайд с насыщенными цветами.',
        recipe: { contrast: 12, sat: 128, grain: 20, grainSize: 12, grainContrast: 44, devFog: 6, halation: 18, bloom: 0, frLiftR: 0, frLiftG: -2, frLiftB: 4, frGainR: 116, frGainG: 104, frGainB: 88 } },
      { id: 'tasmacnb', name: 'таСМА цНБ-90', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 90', res: '90 лин/мм', dev: 'цП-16M', desc: 'Казанский цветной негатив с крупным структурным цветом.',
        recipe: { contrast: 6, sat: 90, grain: 42, grainSize: 17, grainContrast: 52, devFog: 10, halation: 12, bloom: 0, frLiftR: 0, frLiftG: -2, frLiftB: -2, frGainR: 98, frGainG: 94, frGainB: 98 } },
      { id: 'tasmacn130', name: 'таСМА цН-130', type: 'color', kind: 'negative', agingProfile: 'sovietNegative', gost: 'ГОСТ 130', res: '85 лин/мм', dev: 'цП-16M', desc: 'Казанский цветной негатив с улучшенной чувствительностью.',
        recipe: { contrast: 8, sat: 93, grain: 36, grainSize: 15, grainContrast: 45, devFog: 8, halation: 12, bloom: 0, frLiftR: 0, frLiftG: -2, frLiftB: -2, frGainR: 100, frGainG: 96, frGainB: 96 } },
      { id: 'kinapln1', name: 'КиНАП ЛН-1', type: 'color', kind: 'negative', agingProfile: 'archival', gost: 'ГОСТ 32', res: '100 лин/мм', dev: 'ECN-2', desc: 'Ранняя кинопленка с теплым тоном и умеренным зерном.',
        recipe: { contrast: 6, sat: 92, grain: 26, grainSize: 12, grainContrast: 30, devFog: 8, halation: 18, bloom: 6, frLiftR: 0, frLiftG: -2, frLiftB: 0, frGainR: 102, frGainG: 98, frGainB: 98 } },
      { id: 'kinapln3', name: 'КиНАП ЛН-3', type: 'color', kind: 'negative', agingProfile: 'archival', gost: 'ГОСТ 64', res: '110 лин/мм', dev: 'ECN-2', desc: 'Профессиональная кинопленка для съемки художественных фильмов.',
        recipe: { contrast: 8, sat: 98, grain: 22, grainSize: 11, grainContrast: 28, devFog: 6, halation: 22, bloom: 10, frLiftR: -2, frLiftG: -2, frLiftB: 2, frGainR: 98, frGainG: 98, frGainB: 104 } },
      { id: 'kinapln5', name: 'КиНАП ЛН-5', type: 'color', kind: 'negative', agingProfile: 'archival', gost: 'ГОСТ 80', res: '105 лин/мм', dev: 'ECN-2', desc: 'Кинопленка с высокой чувствительностью и насыщенными цветами.',
        recipe: { contrast: 4, sat: 105, grain: 28, grainSize: 13, grainContrast: 32, devFog: 10, halation: 20, bloom: 8, frLiftR: 2, frLiftG: 0, frLiftB: 0, frGainR: 104, frGainG: 100, frGainB: 100 } },
      { id: 'tasmai810', name: 'таСМА И-810 (ИК)', type: 'aero', kind: 'negative', agingProfile: 'irSpecial', gost: 'ГОСТ 800', res: '60 лин/мм', dev: 'Спец-проявитель', desc: 'инфракрасная С/Ж эмульсия Казанского завода. Листва и зелень становятся белоснежными.',
        recipe: { contrast: 28, sat: 95, grain: 14, grainSize: 10, grainContrast: 48, devFog: 5, halation: 8, bloom: 0, frLiftR: -15, frLiftG: 10, frLiftB: 5, frGainR: 85, frGainG: 110, frGainB: 95 } },
      { id: 'tasmai740', name: 'таСМА И-740 (ИК)', type: 'aero', kind: 'negative', agingProfile: 'irSpecial', gost: 'ГОСТ 640', res: '65 лин/мм', dev: 'Спец-проявитель', desc: 'инфракрасная эмульсия с умеренной чувствительностью.',
        recipe: { contrast: 24, sat: 98, grain: 12, grainSize: 9, grainContrast: 44, devFog: 4, halation: 6, bloom: 0, frLiftR: -12, frLiftG: 8, frLiftB: 4, frGainR: 88, frGainG: 108, frGainB: 96 } },
      { id: 'ortho', name: 'ОРТОХРОМ', type: 'aero', kind: 'negative', agingProfile: 'orthoSpecial', gost: 'ГОСТ 8', res: '90 лин/мм', dev: 'Спец-проявитель', desc: 'ортоскопическая эмульсия. Красный и оранжевый почти не фиксируются.',
        recipe: { contrast: 20, sat: 55, grain: 12, grainSize: 10, grainContrast: 35, devFog: 3, halation: 4, bloom: 0, frLiftR: -25, frLiftG: -2, frLiftB: 10, frGainR: 75, frGainG: 98, frGainB: 125 } },
      { id: 'ortho32', name: 'ОРТОХРОМ-32', type: 'aero', kind: 'negative', agingProfile: 'orthoSpecial', gost: 'ГОСТ 32', res: '85 лин/мм', dev: 'Спец-проявитель', desc: 'ортоскопическая эмульсия средней чувствительности.',
        recipe: { contrast: 18, sat: 60, grain: 14, grainSize: 11, grainContrast: 32, devFog: 4, halation: 5, bloom: 0, frLiftR: -22, frLiftG: 0, frLiftB: 12, frGainR: 78, frGainG: 100, frGainB: 128 } },
      { id: 'panir', name: 'ПАН-ИК', type: 'aero', kind: 'negative', agingProfile: 'irSpecial', gost: 'ГОСТ 250', res: '70 лин/мм', dev: 'Спец-проявитель', desc: 'спектрозональная эмульсия с чувствительностью в ближнем ИК.',
        recipe: { contrast: 18, sat: 102, grain: 16, grainSize: 11, grainContrast: 38, devFog: 5, halation: 8, bloom: 0, frLiftR: -8, frLiftG: 4, frLiftB: 4, frGainR: 92, frGainG: 104, frGainB: 104 } },
      { id: 'panir64', name: 'ПАН-ИК-64', type: 'aero', kind: 'negative', agingProfile: 'irSpecial', gost: 'ГОСТ 64', res: '75 лин/мм', dev: 'Спец-проявитель', desc: 'спектрозональная эмульсия с расширенным ИК-диапазоном.',
        recipe: { contrast: 20, sat: 108, grain: 18, grainSize: 12, grainContrast: 40, devFog: 6, halation: 10, bloom: 0, frLiftR: -10, frLiftG: 6, frLiftB: 6, frGainR: 88, frGainG: 106, frGainB: 108 } },
      { id: 'uvfilm', name: 'УФ-ПЛЕНКА', type: 'aero', kind: 'negative', agingProfile: 'irSpecial', gost: 'ГОСТ 50', res: '80 лин/мм', dev: 'Спец-проявитель', desc: 'ультрафиолетовая эмульсия для научной съемки.',
        recipe: { contrast: 14, sat: 145, grain: 20, grainSize: 12, grainContrast: 33, devFog: 6, halation: 10, bloom: 0, frLiftR: -5, frLiftG: 8, frLiftB: 25, frGainR: 85, frGainG: 108, frGainB: 135 } },
      { id: 'sovis', name: 'СО-ВИС', type: 'aero', kind: 'negative', agingProfile: 'irSpecial', gost: 'ГОСТ 500', res: '68 лин/мм', dev: 'Спец-проявитель', desc: 'спектрозональная эмульсия для съемки в искусственном свете.',
        recipe: { contrast: 16, sat: 115, grain: 16, grainSize: 11, grainContrast: 42, devFog: 5, halation: 9, bloom: 0, frLiftR: -8, frLiftG: 6, frLiftB: 4, frGainR: 92, frGainG: 110, frGainB: 112 } }
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
      cropRect: null, rotation: 0,
      frame: 'none', frameText: 'СВЕМА 64 :: ГОСТ 64-85 :: 24A', frameFormat: '35', frameNumber: '24A',
      imprint: false, imprintText: '', imprintStyle: 'classic',
      foundYear: new Date().getFullYear(), condition: 'fresh',
      recipe: 'manual',
      activeFilter: 'all',
      renderPending: false,

      // ---- Творческая тональная правка (поверх физической модели) ----
      exp: 0, contrast: 0, highlights: 0, shadows: 0,
      filterR: 0, filterG: 0, filterB: 0,
      temp: 0, sat: 100, splitShadow: 0,
      paper: 'rc', paperSurface: 'glossy', paperGrade: 2, toner: 'none',
      dyeFade: 0, sabattier: 0, reciprocity: 0,

      // ---- Оптика (хроматическая аберрация — нарастает к краям кадра) ----
      chroma: 0, vignette: 20, vignetteShape: 'round', vignetteX: 0, vignetteY: 0, leak: 0,

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
      crossProcess: false,    // проявить слайд в химии для негатива (или наоборот)
      maskDeveloper: freshMaskConfig(),

      // ==== 4. PUSH / PULL =======================================
      pushPull: 0,            // -2..+3, стопы

      // ==== 5. HALATION ==========================================
      halation: 15,            // intensity, %
      halationThreshold: 180,  // 0-255
      halationRadius: 14,      // px (на превью-разрешении)
      halationDecay: 50,       // 0-100 резкость спада ореола
      halationStreak: 0,       // 0-100 направленный потёк вдоль перфорации (0 = равномерный ореол)
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
      uniformScale: 100, // масштаб случайного паттерна, %

      // ==== LUT-обработка ======================================
      lutMode: 'engine',   // engine | external | both
      lutStrength: 100,    // сила внешнего .cube, 0..100
      lutEngine: true      // false = прямой расчёт без запекания в LUT
    };

    let state = { ...defaultState };
