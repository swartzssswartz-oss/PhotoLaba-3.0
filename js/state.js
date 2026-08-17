// state.js
// Единый источник правды по параметрам редактора.
// Экспортируем функцию-фабрику вместо голого объекта, чтобы reset()
// гарантированно давал чистую копию (без утечек ссылок на p1/p2).

function createDefaultState() {
  return {
    preset: 'svema64',
    devType: 'st2',
    pushPull: 0,
    dyeFade: 0,
    exp: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    fade: 8,
    grain: 30,
    grainSize: 10,
    clarity: 0,
    filterR: 0,
    filterG: 0,
    filterB: 0,
    temp: 0,
    sat: 100,
    splitShadow: 0,
    paper: 'rc',
    toner: 'none',
    halation: 15,
    bloom: 0,
    chroma: 0,
    vignette: 20,
    frame: 'none',
    frameText: 'СВЕМА 64 :: ГОСТ 64-85 :: 24A',
    imprint: false,
    imprintText: '',
    leak: 0,
    spots: 0,
    dust: 0,
    p1: { x: 40, y: 100 },
    p2: { x: 160, y: 20 },
    activeFilter: 'all',
    renderPending: false
  };
}

// Мутируемый на всё время жизни приложения объект состояния.
// pipeline.js и ui.js импортируют его напрямую и читают/пишут поля.
let state = createDefaultState();

function resetState() {
  state = createDefaultState();
  return state;
}
