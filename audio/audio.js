/* 레일런 오디오 매니저 — Web Audio API
 *
 *   BGM  C major · 129.2 BPM · 16마디 29.826초 루프
 *   SFX  같은 조성(C major)으로 합성됨
 *
 * 사용법
 *   <script src="audio.js"></script>
 *   RRAudio.preload();                     // 로드 시작 (제스처 불필요)
 *   soundBtn.onclick = async () => {       // 반드시 사용자 제스처 안에서
 *     await RRAudio.unlock();
 *     RRAudio.setMuted(!RRAudio.muted);
 *   };
 *   RRAudio.playBgm();                     // 홈 진입
 *   RRAudio.setIntensity(0.6);             // 0~1, 주행 속도에 비례
 *   RRAudio.sfx('switch_L');
 *   RRAudio.tap(comboIndex);               // 부스터 연타 (0부터)
 *   RRAudio.crash();                       // 덕킹 + 정지까지 한 번에
 *
 * iOS: AudioContext 는 suspended 로 시작합니다. unlock() 을 반드시
 *      클릭/터치 핸들러 '안에서' await 하세요. 로드 시점에 호출하면 조용히 실패합니다.
 */
(function (global) {
  "use strict";

  var BASE = "audio/";                 // 파일 기준 경로 — 필요하면 여기만 고치세요
  var LS_KEY = "railrun.muted";

  var SFX_NAMES = [
    "switch_L", "switch_R",
    "boost_start", "boost_end",
    "station", "crash", "record",
    "count", "count_go",
    "ui_tap", "ui_back", "ui_confirm"
  ];
  var TAP_STEPS = 12;                  // sfx_tap_01 ~ 12

  /* 믹스 밸런스 — 여기서 조절하세요 */
  var VOL = {
    master: 0.9,
    music: 0.55,
    sfx: 0.95,
    switch: 0.45,     // 가장 자주 울리므로 낮게
    tap: 0.7,
    ui: 0.5
  };

  var ctx = null, master = null, musicBus = null, musicUser = null, sfxBus = null, comp = null;
  var buffers = {}, loading = null, ready = false;
  var bgmSrc = null, bgmPlaying = false;
  var muted = false;
  var intensity = 0, musicBase = VOL.music;

  /* 사용자 음량 (설정 슬라이더) 0~1. VOL 믹스 위에 곱해진다.
     musicBus 는 페이드·덕킹·부스터 자동화가 걸리는 노드라, 사용자 음량은
     그 뒤의 별도 노드(musicUser)에 걸어 서로 덮어쓰지 않게 한다. */
  var LS_MUSIC = "railrun.vol.music", LS_SFX = "railrun.vol.sfx";
  var userMusic = 1, userSfx = 1;
  function readVol(k) {
    var v = parseFloat(localStorage.getItem(k));
    return isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
  }
  try {
    muted = localStorage.getItem(LS_KEY) === "1";
    userMusic = readVol(LS_MUSIC);
    userSfx = readVol(LS_SFX);
    // 예전 전체 음소거 버튼으로 꺼 둔 사용자 → 슬라이더 0 으로 옮긴다(음소거 UI 가 사라졌으므로)
    if (muted) {
      userMusic = 0; userSfx = 0; muted = false;
      localStorage.setItem(LS_KEY, "0");
      localStorage.setItem(LS_MUSIC, "0");
      localStorage.setItem(LS_SFX, "0");
    }
  } catch (e) {}
  /* 슬라이더 값 → 게인. 귀는 로그 스케일이라 선형 그대로면 윗부분이 거의 차이가 안 난다 */
  function curve(v) { return v * v; }

  /* ── 포맷 선택 ─────────────────────────── */
  function bgmFile() {
    var a = document.createElement("audio");
    if (a.canPlayType('audio/ogg; codecs="vorbis"')) return BASE + "bgm/bgm_drive_loop.ogg";
    return BASE + "bgm/bgm_drive_loop.m4a";        // Safari
  }

  /* ── 로드 ──────────────────────────────── */
  function fetchBuf(url) {
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(url + " " + r.status);
        return r.arrayBuffer();
      })
      .then(function (ab) {
        return new Promise(function (res, rej) {
          // Safari 구버전은 Promise 형태를 지원하지 않아 콜백도 같이 넘깁니다
          var p = ctx.decodeAudioData(ab, res, rej);
          if (p && p.then) p.then(res, rej);
        });
      });
  }

  function ensureCtx() {
    if (ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    ctx = new AC();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL.master;
    master.connect(comp);

    musicUser = ctx.createGain();
    musicUser.gain.value = curve(userMusic);
    musicUser.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = VOL.music;
    musicBus.connect(musicUser);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = VOL.sfx * curve(userSfx);
    sfxBus.connect(master);
  }

  function preload() {
    if (loading) return loading;
    ensureCtx();
    var jobs = [];
    jobs.push(fetchBuf(bgmFile()).then(function (b) { buffers.bgm = b; }));
    SFX_NAMES.forEach(function (n) {
      jobs.push(fetchBuf(BASE + "sfx/sfx_" + n + ".wav").then(function (b) { buffers[n] = b; }));
    });
    for (var i = 1; i <= TAP_STEPS; i++) {
      (function (i) {
        var k = "tap_" + (i < 10 ? "0" + i : i);
        jobs.push(fetchBuf(BASE + "sfx/sfx_" + k + ".wav").then(function (b) { buffers[k] = b; }));
      })(i);
    }
    loading = Promise.all(jobs).then(function () { ready = true; })
      .catch(function (e) { console.warn("[RRAudio] 로드 실패", e); });
    return loading;
  }

  function unlock() {
    ensureCtx();
    var p = preload();
    if (ctx.state === "suspended") {
      return ctx.resume().then(function () { return p; });
    }
    return p;
  }

  /* ── 재생 ──────────────────────────────── */
  function one(buf, gain, rate, pan) {
    if (!ctx || !buf) return null;
    var s = ctx.createBufferSource();
    s.buffer = buf;
    if (rate) s.playbackRate.value = rate;
    var g = ctx.createGain();
    g.gain.value = gain == null ? 1 : gain;
    var node = s;
    if (pan != null && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = pan;
      s.connect(p); p.connect(g);
    } else {
      s.connect(g);
    }
    g.connect(sfxBus);
    s.start(0);
    return s;
  }

  function sfx(name, opts) {
    opts = opts || {};
    var b = buffers[name];
    if (!b) return;
    var v = opts.gain;
    if (v == null) {
      if (name.indexOf("switch") === 0) v = VOL.switch;
      else if (name.indexOf("ui_") === 0) v = VOL.ui;
      else v = 1;
    }
    return one(b, v, opts.rate, opts.pan);
  }

  /* 부스터 연타 — i 번째 탭이면 i 번째 음. 12를 넘으면 마지막 음을 조금씩 올립니다 */
  function tap(i) {
    var n = Math.max(0, i | 0);
    var idx = Math.min(n, TAP_STEPS - 1) + 1;
    var k = "tap_" + (idx < 10 ? "0" + idx : idx);
    var extra = Math.max(0, n - (TAP_STEPS - 1));
    return sfx(k, { gain: VOL.tap, rate: Math.pow(2, extra / 12) });
  }

  /* ── BGM ───────────────────────────────── */
  function playBgm(fadeSec) {
    if (!ctx || !buffers.bgm || bgmPlaying) return;
    bgmSrc = ctx.createBufferSource();
    bgmSrc.buffer = buffers.bgm;
    bgmSrc.loop = true;
    bgmSrc.loopStart = 0;
    bgmSrc.loopEnd = buffers.bgm.duration;   // 파일 전체가 루프입니다
    bgmSrc.connect(musicBus);
    bgmSrc.start(0);
    bgmPlaying = true;
    var f = fadeSec == null ? 1.2 : fadeSec;
    var t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(0.0001, t);
    musicBus.gain.linearRampToValueAtTime(musicBase, t + f);
  }

  function stopBgm(fadeSec) {
    if (!ctx || !bgmPlaying) return;
    var f = fadeSec == null ? 0.5 : fadeSec;
    var t = ctx.currentTime, src = bgmSrc;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0001, t + f);
    setTimeout(function () { try { src.stop(); } catch (e) {} }, f * 1000 + 60);
    bgmPlaying = false;
    bgmSrc = null;
  }

  /* 주행 강도 0~1 — 템포는 그대로 두고 음량과 밝기만 바꿉니다.
     템포를 바꾸면 루프가 깨지고 어지럽습니다. */
  function setIntensity(v) {
    intensity = Math.max(0, Math.min(1, v));
    if (!ctx || !bgmPlaying) return;
    musicBase = VOL.music * (0.78 + 0.22 * intensity);
    musicBus.gain.setTargetAtTime(musicBase, ctx.currentTime, 0.25);
  }

  /* 부스터: 음악을 살짝 밀어올립니다 */
  function boost(on) {
    if (!ctx) return;
    sfx(on ? "boost_start" : "boost_end");
    if (!bgmPlaying) return;
    var target = on ? VOL.music * 1.18 : musicBase;
    musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
  }

  /* 덕킹 — 중요한 소리 동안 음악을 눌렀다 복구 */
  function duck(amount, holdSec, backSec) {
    if (!ctx || !bgmPlaying) return;
    var g = musicBus.gain, t = ctx.currentTime;
    var cur = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(cur, t);
    g.linearRampToValueAtTime(cur * (amount == null ? 0.25 : amount), t + (holdSec || 0.12));
    g.linearRampToValueAtTime(musicBase, t + (holdSec || 0.12) + (backSec || 0.7));
  }

  /* 탈선 — 음악을 끊고 정적을 만든 뒤 충돌음 */
  function crash() {
    if (!ctx) return;
    stopBgm(0.06);
    setTimeout(function () { sfx("crash"); }, 40);
  }

  /* ── 음소거 ────────────────────────────── */
  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(LS_KEY, muted ? "1" : "0"); } catch (e) {}
    if (!ctx) return;
    master.gain.setTargetAtTime(muted ? 0 : VOL.master, ctx.currentTime, 0.05);
  }

  /* ── 사용자 음량 (설정 슬라이더) ───────── */
  function setMusicVolume(v) {
    userMusic = Math.max(0, Math.min(1, +v || 0));
    try { localStorage.setItem(LS_MUSIC, String(userMusic)); } catch (e) {}
    if (ctx) musicUser.gain.setTargetAtTime(curve(userMusic), ctx.currentTime, 0.03);
  }
  function setSfxVolume(v) {
    userSfx = Math.max(0, Math.min(1, +v || 0));
    try { localStorage.setItem(LS_SFX, String(userSfx)); } catch (e) {}
    if (ctx) sfxBus.gain.setTargetAtTime(VOL.sfx * curve(userSfx), ctx.currentTime, 0.03);
  }

  /* 광고 재생 중 완전 정지 */
  function suspendForAd() { if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.08); }
  function resumeFromAd() {
    if (ctx && !muted) master.gain.setTargetAtTime(VOL.master, ctx.currentTime, 0.6);
  }

  global.RRAudio = {
    preload: preload,
    unlock: unlock,
    sfx: sfx,
    tap: tap,
    playBgm: playBgm,
    stopBgm: stopBgm,
    setIntensity: setIntensity,
    boost: boost,
    duck: duck,
    crash: crash,
    setMuted: setMuted,
    setMusicVolume: setMusicVolume,
    setSfxVolume: setSfxVolume,
    get musicVolume() { return userMusic; },
    get sfxVolume() { return userSfx; },
    suspendForAd: suspendForAd,
    resumeFromAd: resumeFromAd,
    get muted() { return muted; },
    get ready() { return ready; },
    get ctx() { return ctx; },
    VOL: VOL
  };
})(window);
