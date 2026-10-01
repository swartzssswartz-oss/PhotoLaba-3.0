
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

      function findJpegSegments(bytes) {
        const segments = [];
        let i = 0;
        const len = bytes.length;
        while (i < len - 1) {
          if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8) {
            let j = i + 2;
            let end = -1;
            // Ищем EOI, но не дальше разумного предела за один проход —
            // файлы бывают по 40-80MB, поэтому сразу двигаем i вперёд по ходу поиска.
            while (j < len - 1) {
              if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) { end = j + 2; break; }
              j++;
            }
            if (end > 0) {
              segments.push([i, end]);
              i = end;
              continue;
            }
          }
          i++;
        }
        return segments;
      }

      // Пытаемся декодировать блоб как изображение — так отсеиваем "случайные"
      // FFD8...FFD9 совпадения внутри сжатых сырых данных, которые не являются
      // валидным JPEG.
      function tryDecode(blob) {
        return new Promise((resolve) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => { resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
          img.src = url;
        });
      }

      async function extractPreview(file) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
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

      root.SvemaRaw = { isRawFile, extractPreview, RAW_EXTENSIONS };
    })(typeof window !== 'undefined' ? window : globalThis);
