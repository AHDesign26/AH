// Web Development page — "website designing process:" scroll-pinned phase
// wheel. Loaded only on /web-development/.
(function () {
  'use strict';

  var PHASES = [
    {
      num: '01',
      title: 'Strategy',
      desc: 'We align on goals, audience and scope, then turn it into a concrete plan.',
      steps: ['Gather requirements', 'Prepare & present proposal', 'Request materials'],
    },
    {
      num: '02',
      title: 'Design',
      desc: 'We shape the look and feel, from first wireframe to polished page templates.',
      steps: ['Homepage wireframe', 'Homepage mockup', 'Internal templates'],
    },
    {
      num: '03',
      title: 'Development',
      desc: 'We turn the design into a fast, working website with real content and modules.',
      steps: ['Program the design', 'Add copy & formatting', 'Build & install modules'],
    },
    {
      num: '04',
      title: 'Testing',
      desc: "We test everything end to end and refine until it's ready for the world.",
      steps: ['Test the product', 'Implement changes', 'Final refinements'],
    },
    {
      num: '05',
      title: 'Launch',
      desc: 'We present the finished site and take it live; then hand you the keys.',
      steps: ['Present the website', 'Go live'],
    },
  ];

  function init() {
    var wrap = document.getElementById('ahProcessWheel');
    if (!wrap) return;

    var sticky = document.getElementById('ahProcessSticky');
    var arcCircle = document.getElementById('ahProcessArcCircle');
    var numbersEl = document.getElementById('ahProcessNumbers');
    var eyebrowEl = document.getElementById('ahProcessEyebrow');
    var titleEl = document.getElementById('ahProcessTitle');
    var descEl = document.getElementById('ahProcessDesc');
    var tagsEl = document.getElementById('ahProcessTags');
    var scrollFillEl = document.getElementById('ahProcessScrollFill');

    // One DOM node per phase, built once; only transform/opacity/class
    // change per frame (positions depend on scroll progress, so they're
    // necessarily runtime-computed rather than static CSS — same pattern
    // as index2.js's scroll-pin helpers elsewhere on this site).
    var numberEls = PHASES.map(function (phase) {
      var el = document.createElement('div');
      el.className = 'ah-process-wheel__number';

      var dot = document.createElement('span');
      dot.className = 'ah-process-wheel__number-dot';
      el.appendChild(dot);

      var label = document.createElement('span');
      label.textContent = phase.num;
      el.appendChild(label);

      numbersEl.appendChild(el);
      return el;
    });

    var geometry = { cx: 0, cy: 0, r: 0, stepDeg: 24, numSize: 56 };
    var lastActive = -1;

    function recomputeGeometry() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var markerX = Math.max(84, w * 0.12);
      var cy = h * 0.5;
      // Radius chosen so the circle passes exactly through the sticky
      // panel's top-left corner (0, 0).
      var r = (markerX * markerX + cy * cy) / (2 * markerX);
      var cx = markerX - r;

      geometry.cx = cx;
      geometry.cy = cy;
      geometry.r = r;
      geometry.stepDeg = w < 760 ? 18 : 24;
      geometry.numSize = Math.max(38, Math.min(72, w * 0.05));

      arcCircle.setAttribute('cx', String(cx));
      arcCircle.setAttribute('cy', String(cy));
      arcCircle.setAttribute('r', String(r));
    }

    function renderTags(steps) {
      tagsEl.innerHTML = '';
      steps.forEach(function (step) {
        var tag = document.createElement('span');
        tag.className = 'ah-process-wheel__tag';
        tag.textContent = step;
        tagsEl.appendChild(tag);
      });
    }

    // `.vlt-main` (theme-wide) sets `overflow: hidden`, which becomes the
    // containing block for CSS `position: sticky` and breaks pinning here.
    // Pin the panel manually instead — same approach as index2.js's
    // pinInTrack.
    function pinSticky(rect) {
      var vh = window.innerHeight;
      sticky.style.left = '0';
      sticky.style.right = '0';
      if (rect.top > 0) {
        sticky.style.position = 'absolute';
        sticky.style.top = '0';
        sticky.style.bottom = 'auto';
      } else if (rect.bottom <= vh) {
        sticky.style.position = 'absolute';
        sticky.style.top = 'auto';
        sticky.style.bottom = '0';
      } else {
        sticky.style.position = 'fixed';
        sticky.style.top = '0';
        sticky.style.bottom = 'auto';
      }
    }

    function update() {
      var rect = wrap.getBoundingClientRect();
      pinSticky(rect);
      var total = wrap.offsetHeight - window.innerHeight;
      var progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      var n = PHASES.length;
      var af = progress * (n - 1);
      var active = Math.min(n - 1, Math.max(0, Math.round(af)));

      PHASES.forEach(function (phase, i) {
        var angle = ((i - af) * geometry.stepDeg * Math.PI) / 180;
        var x = geometry.cx + geometry.r * Math.cos(angle);
        var y = geometry.cy + geometry.r * Math.sin(angle);
        var dist = Math.abs(i - af);
        var isActive = i === active;
        var opacity = Math.max(0.1, 1 - dist * 0.42);
        var scale = isActive ? 1 : Math.max(0.55, 1 - dist * 0.16);

        var el = numberEls[i];
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
        el.style.opacity = String(opacity);
        el.style.fontSize = geometry.numSize + 'px';
        el.classList.toggle('is-active', isActive);
      });

      if (active !== lastActive) {
        lastActive = active;
        var phase = PHASES[active];
        eyebrowEl.textContent = 'PHASE ' + phase.num + ' / ' + String(n).padStart(2, '0');
        titleEl.textContent = phase.title;
        descEl.textContent = phase.desc;
        renderTags(phase.steps);
      }

      scrollFillEl.style.width = Math.round(progress * 100) + '%';
    }

    function onResize() {
      recomputeGeometry();
      update();
    }

    recomputeGeometry();
    renderTags(PHASES[0].steps);
    update();

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
