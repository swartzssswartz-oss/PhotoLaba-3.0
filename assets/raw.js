
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Raw (SvemaRaw)
    // Браузер физически не умеет декодировать сырые данные сенсора (демозаик,
    // баланс белого и т.д. — это работа RAW-конвертера, а не веб-платформы).
    // Честный практичный путь: почти все RAW-форматы (CR2/CR3, NEF, ARW, RAF,
    // ORF, RW2, DNG, PEF, SRW...) внутри несут ВСТРОЕННЫЙ JPEG-превью —
    // камера сама его генерирует для быстрого просмотра на экране/в Lightroom,
    // обычно почти полного разрешения. Мы вытаскиваем именно его.
    //
    // Технически: сканируем файл на маркеры JPEG SOI (0xFFD8) / EOI (0xFFD9).
    // RAW-контейнеры (в основе своей TIFF-подобные) обычно содержат НЕСКОЛЬКО
    // JPEG-сегментов (мелкая EXIF-миниатюра + крупный preview) — берём самый
    // большой по размеру и проверяем, что он реально декодируется.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const RAW_EXTENSIONS = [
        'raw', 'arw', 'srf', 'sr2',        // Sony
        'cr2', 'cr3', 'crw',                 // Canon
        'nef', 'nrw',                         // Nikon
        'raf',                                 // Fujifilm
        'orf',                                  // Olympus
        'rw2',                                   // Panasonic
        'pef', 'ptx',                             // Pentax
        'srw',                                     // Samsung
        'dng',                                       // Adobe / общий
        '3fr',                                        // Hasselblad
        'erf',                                          // Epson
        'kdc', 'dcr',                                     // Kodak
        'mrw',                                              // Minolta
        'x3f',                                               // Sigma
        'mef', 'mos', 'iiq'                                   // Mamiya/Leaf/Phase One
      ];

      function isRawFile(file) {
        if (!file) return false;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (RAW_EXTENSIONS.includes(ext)) return true;
        // Некоторые RAW отдаются с MIME 'image/x-...' или вовсе пустым —
        // а обычные image/jpeg|png|webp браузер и так откроет нативно.
        if (file.type && file.type.startsWith('image/') && !file.type.includes('x-')) return false;
        return RAW_EXTENSIONS.includes(ext);
      }

      // Конец JPEG по структуре сегментов, а не по первому FFD9: внутри APP1 лежит EXIF-миниатюра со своим
      // SOI/EOI, и поиск «до первой FFD9» обрезал настоящее превью (так ломался RAF Fuji).
      function jpegEnd(b, s) {
        const n = b.length;
        let i = s + 2;
        while (i + 3 < n) {
          if (b[i] !== 0xFF) return -1;
          const m = b[i + 1];
          if (m === 0xFF) { i++; continue; }
          if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
          if (m === 0xD9) return i + 2;
          const L = (b[i + 2] << 8) | b[i + 3];
          if (L < 2) return -1;
          i += 2 + L;                       // APPn / DQT / DHT / SOF / SOS — перепрыгиваем целиком
          if (m === 0xDA) {                 // после заголовка скана идут сжатые данные до следующего маркера
            while (i + 1 < n) {
              if (b[i] === 0xFF) {
                const c = b[i + 1];
                if (c === 0x00 || (c >= 0xD0 && c <= 0xD7)) { i += 2; continue; }
                if (c === 0xFF) { i++; continue; }
                break;
              }
              i++;
            }
          }
        }
        return -1;
      }

      function findJpegSegments(bytes) {
        const segments = [];
        const len = bytes.length;
        let i = 0;
        while (i < len - 3) {
          if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
            const end = jpegEnd(bytes, i);
            if (end > 0) { segments.push([i, end]); i = end; continue; }
          }
          i++;
        }
        return segments;
      }

      // Fuji RAF: в заголовке по смещению 84 лежат смещение и длина полноразмерного JPEG-превью (big-endian).
      function rafPreviewRange(bytes) {
        if (bytes.length < 100) return null;
        const magic = String.fromCharCode.apply(null, bytes.subarray(0, 15));
        if (magic !== 'FUJIFILMCCD-RAW') return null;
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const off = dv.getUint32(84, false), ln = dv.getUint32(88, false);
        if (!off || !ln || off + ln > bytes.length || bytes[off] !== 0xFF || bytes[off + 1] !== 0xD8) return null;
        return [off, off + ln];
      }

      // Пытаемся декодировать блоб как изображение — так отсеиваем "случайные"
      // FFD8...FFD9 совпадения внутри сжатых сырых данных, которые не являются
      // валидным JPEG.
      function tryDecode(blob) {
        return new Promise((resolve) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            // После загрузки браузер уже декодировал изображение; освобождаем
            // временный Blob URL, сохраняя пригодность Image для drawImage().
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
          img.src = url;
        });
      }

      async function extractPreview(file) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const raf = rafPreviewRange(bytes);
        if (raf) {
          const img = await tryDecode(new Blob([bytes.slice(raf[0], raf[1])], { type: 'image/jpeg' }));
          if (img && img.width > 32 && img.height > 32) return { img, blob: null };
        }
        const segments = findJpegSegments(bytes);
        if (!segments.length) return null;

        // Сортируем по размеру по убыванию — самый большой это, как правило,
        // full-size preview, а не мелкая EXIF-миниатюра.
        segments.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));

        for (const [start, end] of segments.slice(0, 4)) { // пробуем до 4 крупнейших кандидатов
          const blob = new Blob([bytes.slice(start, end)], { type: 'image/jpeg' });
          const img = await tryDecode(blob);
          if (img && img.width > 32 && img.height > 32) {
            return { img, blob };
          }
        }
        return null;
      }

      // ──────────────────────────────────────────────────────────────────────
      // Настоящее проявление RAW (LibRaw → WebAssembly, assets/vendor/libraw).
      // Демозаик + баланс белого + матрица камеры → 16-бит sRGB, затем в 8-бит холст
      // рабочей копии. Параметры проявки (экспозиция, WB, света, качество) можно менять —
      // файл просто проявляется заново. Если декодер недоступен (старый браузер,
      // file://, неподдерживаемая камера) вызывающий код откатывается к extractPreview().
      // ──────────────────────────────────────────────────────────────────────
      let libPromise = null;
      function loadLib() {
        if (!libPromise) {
          libPromise = import('./vendor/libraw/index.js').then(m => m.default).catch(e => { libPromise = null; throw e; });
        }
        return libPromise;
      }

      const DEV_DEFAULTS = { ev: 0, wb: 'camera', highlight: 0, quality: 'auto', res: 'auto', denoise: 0 };

      async function develop(file, opts) {
        const o = Object.assign({}, DEV_DEFAULTS, opts || {});
        const LibRaw = await loadLib();
        const raw = new LibRaw();
        try {
          const buf = new Uint8Array(await file.arrayBuffer());
          // «Авто»: очень большие файлы (>~30 Мп) проявляем в половинном разрешении — иначе
          // 16-бит буфер (~270 МБ) роняет вкладку, особенно на телефоне.
          const half = o.res === 'half' || (o.res === 'auto' && file.size > 40e6);
          const ev = Number(o.ev) || 0;
          await raw.open(buf, {
            useCameraWb: o.wb === 'camera',
            useAutoWb: o.wb === 'auto',
            outputColor: 1,            // sRGB
            outputBps: 16,
            // 'auto': у Fuji X-Trans (RAF) качество ≥3 включает 3-проходный Markesteijn — вдвое медленнее и
            // заметно тяжелее по памяти; быстрый 1-проходный разумнее по умолчанию. Остальным — AHD.
            userQual: o.quality === 'auto' ? (/\.raf$/i.test(file.name || '') ? 2 : 3) : Number(o.quality),
            noAutoBright: true,        // яркость решает пользователь, а не авто-подтяжка
            halfSize: half,
            highlight: Number(o.highlight),
            expCorrec: ev !== 0,
            expShift: Math.pow(2, ev),
            expPreser: ev > 0 ? 0.8 : 0,
            fbddNoiserd: Number(o.denoise) || 0
          });
          const meta = await raw.metadata();
          const d = await raw.imageData();
          const w = d.width, h = d.height, src = d.data;
          if (!w || !h || !src || !src.length) throw new Error('LibRaw вернул пустое изображение');
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const cx = c.getContext('2d');
          const id = cx.createImageData(w, h), out = id.data;
          const n = w * h, ch = d.colors || 3, sixteen = (d.bits || 16) === 16;
          for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += ch) {
            if (sixteen) { out[j] = (src[k] + 128) >> 8; out[j + 1] = (src[k + 1] + 128) >> 8; out[j + 2] = (src[k + 2] + 128) >> 8; }
            else { out[j] = src[k]; out[j + 1] = src[k + 1]; out[j + 2] = src[k + 2]; }
            out[j + 3] = 255;
          }
          cx.putImageData(id, 0, 0);
          return {
            canvas: c,
            meta: {
              make: meta.camera_make || meta.normalized_make || '', model: meta.camera_model || meta.normalized_model || '',
              iso: meta.iso_speed || 0, shutter: meta.shutter || 0, aperture: meta.aperture || 0, focal: meta.focal_len || 0,
              sensorW: meta.width || w, sensorH: meta.height || h, outW: w, outH: h, half
            }
          };
        } finally {
          try { raw.dispose(); } catch (e) { /* уже освобождён */ }
        }
      }

      root.SvemaRaw = { isRawFile, extractPreview, develop, DEV_DEFAULTS, RAW_EXTENSIONS };
    })(typeof window !== 'undefined' ? window : globalThis);
