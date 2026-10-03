/* ══════════════════════════════════════════════════════════════
   라이트/다크 모드 — 홈 · 전체메뉴 · 마이페이지 · 탄소리포트 공용
   각 페이지 <head> 에서 fit.js 바로 뒤에 <script src="theme.js"> 로 포함한다.
   (게임 화면은 밤하늘 컨셉 전용이라 포함하지 않는다)

   · 테마는 <html data-theme="dark|light"> 하나로 결정. 기본값 다크(실측 원본).
     <head> 에서 즉시 실행돼 첫 페인트 전에 붙으므로 깜빡임이 없다.
   · 선택은 localStorage 에 저장 → 페이지를 이동해도 유지.
   · 색은 각 CSS 의 [data-theme="light"] 블록이 담당(app.css / carbon.html).
     라이트 색은 asset/light_mode/ 실제 앱 스크린샷 실측값.
   · 다크 배경에 맞춰 추출된 이미지 중 라이트에서 안 보이거나 얼룩지는 것만
     img/light/ 에 같은 파일명으로 따로 두고, 여기서 src 를 바꿔 끼운다.
   · 최상단 우측에 전환 버튼 하나를 띄운다.
   ══════════════════════════════════════════════════════════════ */
(() => {
  const KEY = 'korail_theme';
  const root = document.documentElement;
  let theme = 'dark';
  try { theme = localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
  root.dataset.theme = theme;

  // 브라우저 강제 다크 차단 — 폰이 다크모드면 안드로이드 크롬·삼성 인터넷이 밝은 페이지를
  // 자동으로 어둡게 칠해서(흰 카드 → 검정, 파랑 → 탁한 파랑, 배경 이미지는 그대로) 라이트 화면이 깨진다.
  // 페이지가 직접 색 체계를 선언하면 손대지 않는다: 라이트 = "only light", 다크 = "dark".
  const scheme = document.createElement('meta');
  scheme.name = 'color-scheme';
  document.head.appendChild(scheme);
  function setScheme(t) {
    const v = t === 'light' ? 'only light' : 'dark';
    scheme.content = v;
    root.style.colorScheme = v;
  }
  setScheme(theme);

  // img/light/ 에 라이트 버전이 있는 파일
  const LIGHT_IMGS = new Set([
    'am_lang.png', 'am_bell.png', 'am_cart.png',        // 전체메뉴 헤더 아이콘(흰색 → 검정)
    'arrow.png',                                        // 출발/도착역 옆 삼각형(흰색 → 검정)
    'ic_swap.png',                                      // 교환 버튼(71% 반투명 원 → 불투명 #1E68F3)
    'ic_phone.png', 'ic_chat.png',                      // 상담 버튼 아이콘(흰색 → 검정, 바탕 얼룩 제거)
    'sv_ticket.png', 'sv_pass.png', 'sv_map.png',       // 전체 서비스 아이콘(바탕에 깔린 다크 카드색 제거)
    'sv_railplus.png', 'sv_nav.png', 'sv_region.png',
    'tile_trainmap.png', 'tile_railplus.png',           // 홈 하단 타일(다크 바탕이 박혀 있어 라이트 스크린샷에서 재추출)
  ]);

  function swapImages(t) {
    document.querySelectorAll('img[src]').forEach(im => {
      const m = im.getAttribute('src').match(/^img\/(?:light\/)?([^/]+)$/);
      if (!m || !LIGHT_IMGS.has(m[1])) return;
      im.setAttribute('src', (t === 'light' ? 'img/light/' : 'img/') + m[1]);
    });
  }
  // 테마에 따라 문구가 바뀌는 곳 — 예: 전체메뉴 "화면 모드 설정  어두운 모드/밝은 모드"
  function swapTexts(t) {
    document.querySelectorAll('[data-light-text]').forEach(el => {
      if (el.dataset.darkText == null) el.dataset.darkText = el.textContent;
      el.textContent = t === 'light' ? el.dataset.lightText : el.dataset.darkText;
    });
  }

  let btn = null;
  const ICON = {
    // 다크일 때 해(→ 라이트로), 라이트일 때 달(→ 다크로)
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" fill="currentColor"/></svg>',
  };
  function renderButton(t) {
    if (!btn) return;
    btn.innerHTML = t === 'light' ? ICON.moon : ICON.sun;
    btn.setAttribute('aria-label', t === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
  }

  function apply(t, save) {
    theme = t;
    root.dataset.theme = t;
    setScheme(t);
    if (save) { try { localStorage.setItem(KEY, t); } catch (e) {} }
    swapImages(t); swapTexts(t); renderButton(t);
  }

  function mountButton() {
    const css = document.createElement('style');
    css.textContent =
      // 24px · 모서리 3px — 헤더 우측 아이콘(장바구니·공유)의 그림 부분과 겹치지 않는 크기
      '.theme-toggle{position:fixed;top:3px;right:3px;z-index:9999;width:24px;height:24px;padding:0;' +
      'display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;' +
      'background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#FFD970;' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent}' +
      '.theme-toggle svg{width:14px;height:14px}' +
      '.theme-toggle:active{transform:scale(.92)}' +
      '.theme-toggle:focus-visible{outline:2px solid #3567EA;outline-offset:2px}' +
      // 라이트: 흰 바탕 — 홈의 파란 헤더 위에서도 달 아이콘이 보이게
      '[data-theme="light"] .theme-toggle{background:rgba(255,255,255,.92);border-color:rgba(16,19,24,.12);color:#3567EA}';
    document.head.appendChild(css);
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      apply(theme === 'light' ? 'dark' : 'light', true);
    });
    document.body.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', () => {
    mountButton();
    apply(theme, false);
  });
  // 다른 페이지에서 테마를 바꾸고 뒤로가기(bfcache 복원)로 돌아온 경우 다시 맞춘다
  addEventListener('pageshow', () => {
    let saved = theme;
    try { saved = localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
    if (saved !== theme) apply(saved, false);
  });
})();
