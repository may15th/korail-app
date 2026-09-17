/* ══════════════════════════════════════════════════════════════
   페이지 전환 애니메이션 (MPA — 여러 html 파일 구조는 그대로 유지)
   모든 html 의 <body> 여는 태그 바로 뒤에 <script src="transition.js">
   로 포함한다. 최대한 이르게 실행돼야 "arm" 단계가 첫 페인트 전에
   끝나 깜빡임(FOUC) 없이 진입 애니메이션이 보인다.

   전환 종류는 fade 하나로 통일돼 있다(과거엔 slide-in/slide-out 도
   있었으나 제거됨). data-transition="none" 인 링크는 건드리지 않는다
   (예: 홈 화면 미니게임 셀 — 자체 오버레이 로직을 그대로 씀).

   사용법: <a href="foo.html" data-transition="fade">  (속성 생략 시 기본값도 fade)

   ── 검은 화면 버그 히스토리 ──
   다른 페이지로 넘어가려고 body 에 fade-leave(opacity:0)를 건 채로
   location.href 를 바꾸면, 브라우저가 이 페이지를 bfcache 에 얼릴 때
   "다 사라진" 상태 그대로 스냅샷을 뜬다. 이후 뒤로가기로 그 페이지가
   bfcache 에서 복원되면 스크립트가 재실행되지 않으므로 opacity:0 가
   영원히 풀리지 않고 화면이 검게 남는다. 그래서:
     1) pagehide 시점에 fade-leave 를 지워 애초에 "사라진" 상태가
        스냅샷에 찍히지 않게 하고,
     2) pageshow 는 event.persisted 여부와 무관하게 항상 fade-leave
        를 한 번 더 지우고(2중 안전장치),
     3) 그래도 뭔가 안 풀리는 경우를 대비해 0.3초 뒤 강제로 모든
        전환 클래스를 제거하는 fallback 을 둔다.
   ══════════════════════════════════════════════════════════════ */
(() => {
  const KEY = 'pageTransitionType';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURATION = 150;       // fade 전환 지속시간(ms), CSS 값과 맞춤
  const FALLBACK_MS = 300;    // 무슨 일이 있어도 이 시간 안에는 반드시 보이게
  const body = document.body;

  function clearLeave() { body.classList.remove('fade-leave'); }
  function clearEnter() { body.classList.remove('fade-enter', 'fade-enter-active'); }

  /* ── 진입(enter): 직전 클릭에서 저장해둔 종류를 pageshow 시점에 재생 ──
     주소창 직접 입력/새로고침이면 sessionStorage 에 값이 없으므로 생략된다. */
  let pendingType = null;
  try { pendingType = sessionStorage.getItem(KEY); } catch (e) {}
  if (pendingType && !reduceMotion) {
    // 첫 페인트 전에 시작 상태(투명)부터 걸어 깜빡임을 막는다.
    body.classList.add('fade-enter');
  }

  function playEnter() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.classList.remove('fade-enter');
        body.classList.add('fade-enter-active');
        const done = (e) => {
          if (e && e.target !== body) return;
          body.classList.remove('fade-enter-active');
          body.removeEventListener('transitionend', done);
        };
        body.addEventListener('transitionend', done);
        setTimeout(done, DURATION + 80);
      });
    });
  }

  window.addEventListener('pageshow', (e) => {
    // bfcache 복원(event.persisted===true) 포함, 이 페이지가 보일 때마다
    // 무조건 leave 상태부터 지운다 — 검은 화면 버그의 핵심 방지책.
    clearLeave();

    if (pendingType) {
      pendingType = null;
      try { sessionStorage.removeItem(KEY); } catch (err) {}
      if (e.persisted) {
        // bfcache 로 되돌아온 경우 진입 애니메이션을 새로 재생하지 않고
        // 즉시 보이는 상태로 정리한다.
        clearEnter();
      } else {
        playEnter();
      }
    }

    // 안전장치: 스크립트가 어떤 이유로든 제때 정리하지 못해도
    // 0.3초 뒤에는 무조건 화면이 보이는 상태로 고정한다.
    setTimeout(() => { clearLeave(); clearEnter(); }, FALLBACK_MS);
  });

  /* ── 이탈(leave): 같은 사이트 내부 링크 클릭을 가로채 애니메이션 후 이동 ── */
  function isInternalNavLink(a) {
    if (!a || !a.hasAttribute('href')) return false;
    const href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    if (a.dataset.transition === 'none') return false;
    let url;
    try { url = new URL(href, location.href); } catch (e) { return false; }
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.hash) return false; // 같은 페이지 내 앵커
    return true;
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 새 탭 등 기본 동작 존중
    const a = e.target.closest('a[href]');
    if (!isInternalNavLink(a)) return;
    if (reduceMotion) return; // 기본 이동 그대로 진행(즉시 이동)

    e.preventDefault();
    const href = a.getAttribute('href');
    try { sessionStorage.setItem(KEY, 'fade'); } catch (err) {}
    body.classList.add('fade-leave');
    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      location.href = href;
    };
    body.addEventListener('transitionend', go, { once: true });
    setTimeout(go, DURATION + 80);
  });

  // 이 페이지를 실제로 떠나는 순간(다른 페이지로 이동/bfcache 로 얼려짐)
  // fade-leave 를 지워, bfcache 스냅샷 자체가 "사라진" 상태로 찍히지 않게 한다.
  window.addEventListener('pagehide', clearLeave);
})();
