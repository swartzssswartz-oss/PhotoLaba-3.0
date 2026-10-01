
    // ──────────────────────────────────────────────────────────────────────
    // Установка как приложение (PWA).
    //
    // Требования, чтобы это вообще заработало:
    //  1. Сайт должен быть открыт по HTTPS (или на localhost) — Service
    //     Worker и событие beforeinstallprompt на file:// не работают.
    //  2. Chrome/Edge/Android покажут нативный промпт сами — мы просто
    //     перехватываем его и рисуем свою кнопку в фирменном стиле вместо
    //     системной плашки снизу экрана.
    //  3. iOS Safari вообще не поддерживает beforeinstallprompt — там
    //     показываем свою инструкцию «Поделиться → На экран Домой».
    // ──────────────────────────────────────────────────────────────────────
    (function () {
      const DISMISS_KEY = 'svemaLabInstallDismissedAt';
      const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 дней

      function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true;
      }

      function isDismissedRecently() {
        try {
          const raw = localStorage.getItem(DISMISS_KEY);
          if (!raw) return false;
          return (Date.now() - parseInt(raw, 10)) < COOLDOWN_MS;
        } catch (e) { return false; }
      }

      function markDismissed() {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      }

      function isIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
      }

      // ── Service Worker (нужен для beforeinstallprompt в Chrome/Android) ──
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js').catch(() => {
            // Тихо игнорируем — на file:// или http (не localhost) это ожидаемо.
          });
        });
      }

      if (isStandalone() || isDismissedRecently()) return;

      // ── Баннер (общая разметка для обоих сценариев) ──────────────────────
      let deferredPrompt = null;
      let banner = null;

      function buildBanner(mode) {
        const el = document.createElement('div');
        el.className = 'install-banner';
        el.innerHTML = mode === 'ios'
          ? `
            <div class="install-banner-icon">▭</div>
            <div class="install-banner-text">
              <div class="install-banner-title">Установить СВЕМА LAB</div>
              <div class="install-banner-sub">Нажмите «Поделиться» <span class="install-share-glyph">⬆</span> внизу Safari → «На экран «Домой»</div>
            </div>
            <button class="install-banner-close" aria-label="Закрыть">✕</button>
          `
          : `
            <div class="install-banner-icon">▭</div>
            <div class="install-banner-text">
              <div class="install-banner-title">Установить СВЕМА LAB</div>
              <div class="install-banner-sub">Работает офлайн, открывается как отдельное приложение</div>
            </div>
            <button class="install-banner-install">Установить</button>
            <button class="install-banner-close" aria-label="Закрыть">✕</button>
          `;

        el.querySelector('.install-banner-close').addEventListener('click', () => {
          markDismissed();
          hideBanner();
        });

        if (mode !== 'ios') {
          el.querySelector('.install-banner-install').addEventListener('click', async () => {
            if (!deferredPrompt) return;
            hideBanner();
            deferredPrompt.prompt();
            try { await deferredPrompt.userChoice; } catch (e) {}
            deferredPrompt = null;
          });
        }

        return el;
      }

      function showBanner(mode) {
        if (banner) return;
        banner = buildBanner(mode);
        document.body.appendChild(banner);
        requestAnimationFrame(() => banner.classList.add('visible'));
      }

      function hideBanner() {
        if (!banner) return;
        banner.classList.remove('visible');
        setTimeout(() => { if (banner) { banner.remove(); banner = null; } }, 250);
      }

      // ── Сценарий Chrome/Edge/Android: реальный нативный промпт ───────────
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showBanner('android');
      });

      window.addEventListener('appinstalled', () => {
        hideBanner();
        deferredPrompt = null;
      });

      // ── Сценарий iOS Safari: инструкция вручную (без beforeinstallprompt) ─
      if (isIOS() && !isStandalone()) {
        // Небольшая задержка — не бросаемся баннером в первую секунду визита.
        setTimeout(() => { if (!deferredPrompt) showBanner('ios'); }, 2500);
      }
    })();
