/* ============================
   BOSSAIGC V14 — FULL SPECTRUM
   粒子星空 · 自定义光标(性能优化) · 终端打字
   解码动画 · 滚动揭示 · 数字递增
   ✅ V14: cursor visibilitychange + 静止跳帧; starfield V13 优化保留
   ============================ */

const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const IS_HOMEPAGE = !!document.querySelector('.cover');
const IS_ABOUT = !!document.querySelector('.about-universe');
const CURSOR_COLORS = IS_HOMEPAGE ? '#00FFFF' : IS_ABOUT ? '#00B4FF' : '#FF00FF';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileNav();
  initStaggerCards();
  initScrollReveal();
  initStarfield();
  if (!IS_TOUCH && !REDUCED_MOTION) initCustomCursor();
  if (IS_HOMEPAGE) { initDecodeHero(); }
  initDecodeTitles();
  // Partner carousel now uses CSS animation (continuous scroll, no pause on hover)
});

/* ==========================================
   NAVBAR
   ========================================== */
function initNavbar() {
  const nb = document.getElementById('navbar');
  if (!nb) return;
  window.addEventListener('scroll', () => nb.classList.toggle('scrolled', window.scrollY > 40), { passive: true });
}
function initMobileNav() {
  const t = document.getElementById('navToggle'), m = document.getElementById('navMenu');
  if (!t || !m) return;
  t.addEventListener('click', () => { m.classList.toggle('open'); t.classList.toggle('active'); });
  m.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => { m.classList.remove('open'); t.classList.remove('active'); }));
}

/* ==========================================
   CUSTOM CURSOR — lerp 平滑跟随发光球 (V14 性能优化)
   ========================================== */
function initCustomCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'cursor-glow';
  cursor.style.cssText = `--cursor-color:${CURSOR_COLORS};position:fixed;width:28px;height:28px;border-radius:50%;pointer-events:none;z-index:9999;mix-blend-mode:screen;background:radial-gradient(circle,${CURSOR_COLORS}40,transparent 70%);transform:translate(-50%,-50%);transition:width .3s,height .3s,background .3s;will-change:transform;`;
  document.body.appendChild(cursor);

  const trail = document.createElement('div');
  trail.className = 'cursor-trail';
  trail.style.cssText = `position:fixed;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:9998;background:${CURSOR_COLORS};box-shadow:0 0 12px ${CURSOR_COLORS},0 0 24px ${CURSOR_COLORS}80;transform:translate(-50%,-50%);transition:width .2s,height .2s;will-change:transform;`;
  document.body.appendChild(trail);

  let mx = 0, my = 0, cx = 0, cy = 0, tx = 0, ty = 0;
  let animationId = null;
  let isPaused = false;
  let hasPointer = false;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    hasPointer = true;
    if (!animationId && !isPaused) animationId = requestAnimationFrame(animate);
  }, { passive: true });

  // ✅ 关键优化：页面隐藏时暂停光标动画（降CPU~20%+）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isPaused = true;
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    } else {
      if (isPaused) {
        isPaused = false;
        if (hasPointer && !animationId) animationId = requestAnimationFrame(animate);
      }
    }
  });

  // hover 放大
  document.querySelectorAll('a, button, .biz-card, .feature-card, .about-entity-card, .contact-qr-card, .team-card-new').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.style.width = '52px'; cursor.style.height = '52px'; trail.style.width = '10px'; trail.style.height = '10px'; });
    el.addEventListener('mouseleave', () => { cursor.style.width = '28px'; cursor.style.height = '28px'; trail.style.width = '6px'; trail.style.height = '6px'; });
  });

  function animate() {
    animationId = null;
    if (isPaused || !hasPointer) return;
    cx += (mx - cx) * 0.12;
    cy += (my - cy) * 0.12;
    tx += (mx - tx) * 0.22;
    ty += (my - ty) * 0.22;
    cursor.style.transform = `translate(-50%,-50%) translate3d(${cx}px,${cy}px,0)`;
    trail.style.transform = `translate(-50%,-50%) translate3d(${tx}px,${ty}px,0)`;
    const moving = Math.abs(mx - cx) > 0.1 || Math.abs(my - cy) > 0.1 ||
      Math.abs(mx - tx) > 0.1 || Math.abs(my - ty) > 0.1;
    if (moving) animationId = requestAnimationFrame(animate);
  }
}

/* ==========================================
   STARFIELD — canvas 粒子星空 + 星座连线
   ========================================== */
  /* ==========================================
    STARFIELD — canvas 粒子星空 + 星座连线 (性能优化版 V13)
    ========================================== */
  function initStarfield() {
    if (REDUCED_MOTION) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'starfield-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.8;';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let W, H, stars = [], curves = [], glowSpots = [], time = 0;
    let animationId = null;
    let isPaused = false;
    let lastFrame = 0;
    const FRAME_INTERVAL = 1000 / 30;

    // 动态粒子数量：根据设备性能自适应
    function getStarCount() {
      const isMobile = window.innerWidth < 768;
      const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
      if (isMobile || isLowEnd) return 50;
      return 90;
    }
    const STAR_COUNT = getStarCount();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        o: Math.random(), s: Math.random() * 0.02 + 0.005
      }));
      curves = Array.from({ length: 6 }, () => ({
        p0: { x: Math.random() * W, y: Math.random() * H },
        cp1: { x: Math.random() * W * 0.6, y: Math.random() * H * 0.4 },
        cp2: { x: Math.random() * W * 0.7 + W * 0.3, y: Math.random() * H * 0.7 + H * 0.3 },
        p3: { x: Math.random() * W, y: Math.random() * H },
        speed: Math.random() * 0.0004 + 0.0002
      }));
      glowSpots = Array.from({ length: 5 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 200 + 100,
        phase: Math.random() * Math.PI * 2
      }));
    }
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 180);
    }, { passive: true });
    resize();

    // ✅ 关键优化1：页面隐藏时暂停动画（降CPU 90%+）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isPaused = true;
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
      } else {
        if (isPaused) {
          isPaused = false;
          animationId = requestAnimationFrame(draw);
        }
      }
    });

    function draw(now = 0) {
      if (isPaused) return;
      if (now - lastFrame < FRAME_INTERVAL) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastFrame = now;
      ctx.clearRect(0, 0, W, H);
      time++;

      // ── 光晕斑点 ──
      glowSpots.forEach(g => {
        const o = 0.02 + Math.sin(time * 0.01 + g.phase) * 0.015;
        const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        grad.addColorStop(0, `rgba(0,180,255,${o})`);
        grad.addColorStop(0.5, `rgba(0,255,255,${o * 0.3})`);
        grad.addColorStop(1, 'rgba(0,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      });

      // ── 不规则贝塞尔曲线底纹 ──
      curves.forEach((c, i) => {
        const t = (time * c.speed) % 1;
        ctx.beginPath();
        ctx.moveTo(c.p0.x, c.p0.y);
        ctx.bezierCurveTo(
          c.cp1.x + Math.sin(time * 0.003 + i) * 60, c.cp1.y + Math.cos(time * 0.004 + i) * 40,
          c.cp2.x + Math.cos(time * 0.005 + i) * 50, c.cp2.y + Math.sin(time * 0.003 + i) * 50,
          c.p3.x, c.p3.y
        );
        ctx.strokeStyle = 'rgba(0,255,255,0.04)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const mx = c.p0.x + (c.p3.x - c.p0.x) * t;
        const my = c.p0.y + (c.p3.y - c.p0.y) * t;
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,255,0.15)';
        ctx.fill();
      });

      // ✅ 关键优化2：星座连线 O(n²) 加距离粗筛
      const maxDist = 120;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          if (Math.abs(dx) > maxDist || Math.abs(dy) > maxDist) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
            ctx.lineWidth = 0.3;
            ctx.stroke();
          }
        }
      }

      // ── 星星粒子 ──
      stars.forEach(s => {
        s.o += s.s; if (s.o > 1 || s.o < 0.15) s.s *= -1;
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = H; if (s.y > H) s.y = 0;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,255,${s.o * 0.6})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,255,${s.o * 0.07})`;
        ctx.fill();
      });
      animationId = requestAnimationFrame(draw);
    }
    animationId = requestAnimationFrame(draw);
  }

/* ==========================================
   SCROLL REVEAL — IntersectionObserver 交错入场
   ========================================== */
function initScrollReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      const idx = Array.from(entry.target.parentNode?.children || []).indexOf(entry.target);
      const stagger = (idx >= 0 ? idx : 0) * 80;
      const delay = parseInt(entry.target.dataset.revealDelay || stagger, 10);
      setTimeout(() => entry.target.classList.add('revealed'), delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => observer.observe(el));
}

/* ==========================================
   CARD STAGGER — 卡片交错揭示
   ========================================== */
function initStaggerCards() {
  document.querySelectorAll('.feature-card, .biz-card, .about-entity-card, .team-card-new, .news-item, .location-card').forEach((el, i) => {
    el.style.setProperty('--stagger-index', i);
    if (!el.hasAttribute('data-reveal')) { el.dataset.reveal = ''; el.dataset.revealDelay = (i % 3) * 100 + 50; }
  });
}

/* ==========================================
   DECODE ANIMATION — 标题字符乱码 → 解码浮现
   首页立即触发，其他页面滚动触发
   ========================================== */
function scrambleText(el, final, duration = 1800) {
  if (REDUCED_MOTION) {
    el.textContent = final;
    return;
  }
  const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const start = performance.now();
  const len = final.length;
  let done = false;

  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    let out = '';
    for (let i = 0; i < len; i++) {
      if (p > i / len * 0.7) { out += final[i]; continue; }
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = final;
  }
  requestAnimationFrame(tick);
}

function initDecodeHero() {
  const titles = document.querySelectorAll('.cover-title-line');
  titles.forEach((t, i) => {
    const text = t.textContent.trim();
    t.dataset.final = text;
    t.textContent = '';
    setTimeout(() => scrambleText(t, text, 2000 + i * 400), 500 + i * 300);
  });
}

function initDecodeTitles() {
  const titles = document.querySelectorAll('.about-title, .sub-hero h1');
  if (!titles.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const t = entry.target;
      const text = t.textContent.trim();
      t.dataset.final = text;
      t.textContent = '';
      scrambleText(t, text, 1500);
      observer.unobserve(t);
    });
  }, { threshold: 0.5 });
  titles.forEach(t => observer.observe(t));
}

/* ==========================================
   PARTNER CAROUSEL — 走马灯轮播
   同屏5个，3s自动步进，无缝循环
   ========================================== */
function initPartnerCarousel() {
  const viewport = document.getElementById('partnerViewport');
  const track = document.getElementById('partnerTrack');
  if (!viewport || !track) return;

  const TOTAL = 18;        // 原始合作伙伴数量
  const DUP = 5;           // 尾部副本数
  let visible = 5;         // 同屏显示数量
  let index = 0;
  let paused = false;
  let timer = null;
  let chipWidth = 0;
  let gap = 14;

  function getVisible() {
    const w = window.innerWidth;
    if (w <= 768) return 3;
    if (w <= 1024) return 4;
    return 5;
  }

  function calcChipWidth() {
    const chips = track.querySelectorAll('.partner-chip');
    if (chips.length === 0) return;
    chipWidth = chips[0].offsetWidth;
    gap = 14;
    // 响应式gap
    if (window.innerWidth <= 768) gap = 10;
  }

  function slideTo(pos) {
    calcChipWidth();
    const offset = pos * (chipWidth + gap);
    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)';
    track.style.transform = `translateX(-${offset}px)`;
  }

  function slideInstant(pos) {
    const offset = pos * (chipWidth + gap);
    track.style.transition = 'none';
    track.style.transform = `translateX(-${offset}px)`;
  }

  function next() {
    if (paused) return;
    visible = getVisible();
    calcChipWidth();
    index++;
    slideTo(index);
    // 到达副本区起点 → 瞬间跳回
    if (index >= TOTAL) {
      setTimeout(() => {
        index = 0;
        slideInstant(0);
      }, 650); // 等过渡动画完成
    }
  }

  function start() {
    stop();
    timer = setInterval(next, 3000);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // 初始化
  calcChipWidth();
  slideInstant(0);

  // Hover 暂停
  viewport.addEventListener('mouseenter', () => { paused = true; });
  viewport.addEventListener('mouseleave', () => { paused = false; });

  // 触摸暂停
  viewport.addEventListener('touchstart', () => { paused = true; }, { passive: true });
  viewport.addEventListener('touchend', () => {
    paused = false;
    // 触摸结束后立即推进一帧避免长时间停留
    clearTimeout(timer);
    timer = setTimeout(() => { start(); }, 800);
  });

  // 窗口大小变化重算
  let resizeDebounce;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      visible = getVisible();
      calcChipWidth();
      // 保持当前位置
      slideInstant(index);
    }, 300);
  });

  start();
}

/* ==========================================
   CSS Animation classes injection
   ========================================== */
const animCSS = document.createElement('style');
animCSS.textContent = `
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulseGlow { 0%,100%{box-shadow:0 0 8px var(--cursor-color,#0ff)40}50%{box-shadow:0 0 24px var(--cursor-color,#0ff)80} }
  .revealed { animation: slideUp 0.7s cubic-bezier(.16,1,.3,1) forwards; }
`;
document.head.appendChild(animCSS);
