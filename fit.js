/* 모든 기기에서 384x832dp 레이아웃을 동일 비율로 표시 */
(function(){
  var W = 384;                       // 기준 논리 폭 (dp)
  function fit(){
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var s  = vw / W;                 // 폰: 화면 폭에 맞춰 확대/축소
    if (vw > 560) s = Math.min(vw / W, vh / 832);   // 데스크톱: 세로도 넘지 않게
    var r = document.documentElement.style;
    r.setProperty('--s', s);
    r.setProperty('--vw', W + 'px');
    r.setProperty('--vh', (vh / s) + 'px');
  }
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);
})();
