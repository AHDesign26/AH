// Homepage concept page (src/pages/index2.astro) — the pinned scroll-morph
// hero, the testimonials carousel and the "tell us what you need" chip
// picker. Navigation is BaseLayout's own header/menu (vlt-plugins.min.js),
// so there's no nav-toggle logic here.
(function () {
  'use strict';

  // Manual sticky, hero variant: pins `target` to the viewport for as long
  // as `track` (an ancestor sized to reserve the pinned scroll distance)
  // spans the viewport, holding it at the track's own top/bottom edge
  // before/after that — the fixed/absolute swap that stands in for CSS
  // `position: sticky`, which <main class="vlt-main">'s site-wide
  // `overflow: hidden` (vlt-main.min.css) silently breaks on any
  // descendant (it degrades to acting like `position: relative` instead of
  // pinning). The hero needs this 3-state (before/pinned/released) version
  // because the morph itself has to finish and settle before the pin
  // releases; the About section below uses a plainer 2-state version of
  // the same idea, since it only ever needs to turn pinning on.
  function pinInTrack(track, target, vh) {
    var rect = track.getBoundingClientRect();
    target.style.left = '0';
    target.style.right = '0';
    if (rect.top > 0) {
      target.style.position = 'absolute';
      target.style.top = '0';
      target.style.bottom = '';
    } else if (rect.bottom <= vh) {
      target.style.position = 'absolute';
      target.style.top = '';
      target.style.bottom = '0';
    } else {
      target.style.position = 'fixed';
      target.style.top = '0';
      target.style.bottom = '';
    }
  }

  // ---- Pinned scroll-morph hero -------------------------------------------
  // The hero video card lives fixed at full-viewport size while its section
  // is pinned, then eases into the middle cell of the services grid as the
  // user scrolls through it (first 60% of the pinned scroll), and holds
  // there for the remainder so "Services / One partner for..." can be read.
  // Below 760px the section is a normal static block — no scroll-jacking.
  // The pin itself goes through pinInTrack (see above) rather than CSS
  // `position: sticky`.
  (function heroMorph() {
    var track = document.getElementById('ahMorphTrack');
    var card = document.getElementById('ahMorphCard');
    var cell = document.getElementById('ahMorphCell');
    var sticky = document.getElementById('ahMorphSticky');
    if (!track || !card || !cell || !sticky) return;

    var text = document.getElementById('ahMorphText');
    var grid = document.getElementById('ahMorphGrid');
    var services = document.getElementById('ahMorphServices');
    var partner = document.getElementById('ahMorphPartner');
    var video = card.querySelector('video');
    var overlay = card.querySelector('.ah-hero-overlay');
    var solid = card.querySelector('.ah-hero-solid');

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function resetMobile() {
      sticky.style.position = '';
      sticky.style.top = '';
      sticky.style.bottom = '';
      sticky.style.left = '';
      sticky.style.right = '';
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.width = '';
      card.style.height = '';
      card.style.borderRadius = '';
      if (text) text.style.transform = '';
      if (video) video.style.opacity = '';
      if (overlay) overlay.style.opacity = '';
      if (solid) solid.style.opacity = '';
      if (services) services.style.opacity = '';
      if (partner) partner.style.opacity = '';
      if (grid) {
        Array.prototype.forEach.call(grid.querySelectorAll('[data-side]'), function (el) {
          el.style.opacity = '';
          el.style.transform = '';
        });
      }
    }

    function frame() {
      var vh = window.innerHeight;
      var vw = window.innerWidth;

      if (vw <= 760) {
        resetMobile();
        requestAnimationFrame(frame);
        return;
      }

      pinInTrack(track, sticky, vh);
      var rect = track.getBoundingClientRect();
      var total = track.offsetHeight - vh;
      var p = total > 0 ? -rect.top / total : 0;
      p = Math.max(0, Math.min(1, p));
      p = Math.min(1, p / 0.6);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      var cr = cell.getBoundingClientRect();

      if (p >= 0.999) {
        card.style.position = 'absolute';
        card.style.left = '0';
        card.style.top = '0';
        card.style.width = '100%';
        card.style.height = '100%';
        card.style.borderRadius = '15px';
      } else {
        card.style.position = 'fixed';
        card.style.left = lerp(0, cr.left, e) + 'px';
        card.style.top = lerp(0, cr.top, e) + 'px';
        card.style.width = lerp(vw, cr.width, e) + 'px';
        card.style.height = lerp(vh, cr.height, e) + 'px';
        card.style.borderRadius = lerp(0, 15, e) + 'px';
      }

      if (text) {
        text.style.transform = 'scale(' + lerp(1.7, 1, e) + ')';
        text.style.opacity = String(Math.max(0, 1 - p * 2.2));
      }
      if (services) services.style.opacity = String(Math.max(0, Math.min(1, (p - 0.55) / 0.2)));
      if (partner) partner.style.opacity = String(Math.max(0, Math.min(1, (p - 0.8) / 0.2)));
      if (video) video.style.opacity = String(Math.max(0, 1 - p * 1.5));
      if (overlay) overlay.style.opacity = String(Math.max(0, 1 - p * 1.5));
      if (solid) solid.style.opacity = String(Math.max(0, Math.min(1, p * 1.5)));

      if (grid) {
        var sides = grid.querySelectorAll('[data-side]');
        var sp = Math.max(0, Math.min(1, (p - 0.4) / 0.45));
        Array.prototype.forEach.call(sides, function (el, i) {
          var d = Math.max(0, Math.min(1, sp - i * 0.05));
          el.style.opacity = String(d);
          el.style.transform = 'translateY(' + (1 - d) * 26 + 'px)';
        });
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  })();

  // ---- About section: pinned reveal ---------------------------------------
  // #ahAboutSticky stays pinned full-width while #ahFlow (the white "FLOW"
  // panel right after it, margin-top: -60px, higher z-index) scrolls up and
  // covers it — a stacked-cards reveal. #ahAboutTrack reserves its natural
  // height in flow so pinning it doesn't collapse the layout below it (see
  // .ah-about-track in index2.css).
  (function aboutReveal() {
    var track = document.getElementById('ahAboutTrack');
    var about = document.getElementById('ahAboutSticky');
    var page = document.querySelector('.ah-page');
    if (!track || !about || !page) return;

    function lockHeight() {
      var prevPosition = about.style.position;
      about.style.position = 'relative';
      track.style.height = about.offsetHeight + 'px';
      about.style.position = prevPosition;
    }
    lockHeight();
    window.addEventListener('resize', lockHeight);

    // Below 760px .ah-about__grid stacks to one column (index2.css), making
    // the panel's natural content height far taller than the viewport.
    // Pinned at `position: fixed`, that overflow is simply unreachable —
    // nothing below the fold scrolls into view before .ah-flow slides over
    // and covers the panel. So skip the pin on mobile and let it scroll in
    // normal flow instead, same bypass heroMorph uses for its own pin.
    function resetMobile() {
      track.style.height = '';
      about.style.position = '';
      about.style.top = '';
      about.style.bottom = '';
      about.style.left = '';
      about.style.right = '';
    }

    // Pins once #ahAboutSticky is reached and holds it through #ahFlow and
    // everything after (contact, testimonials, more, pricing, need) — they
    // all sit in normal flow with a higher z-index than .ah-about's 2, so
    // they naturally paint over the pinned panel as they scroll into view.
    // But it can't stay pinned forever: <main class="vlt-main"> (this
    // page's own root) is `position: relative; z-index: 20`
    // (vlt-main.min.css, site-wide), which promotes its ENTIRE subtree —
    // fixed descendants included — above the real site footer just outside
    // it, which has no such promotion. Left pinned, About would keep
    // painting over the footer for the rest of the scroll. So it releases
    // once .ah-page's own bottom is about to pass the viewport — right
    // before the footer would appear — the same track-bottom release the
    // hero uses (pinInTrack above), just measured against the whole page's
    // content instead of the hero's own short track.
    function frame() {
      if (window.innerWidth <= 760) {
        resetMobile();
        requestAnimationFrame(frame);
        return;
      }
      var vh = window.innerHeight;
      var trackTop = track.getBoundingClientRect().top;
      var pageBottom = page.getBoundingClientRect().bottom;
      about.style.left = '0';
      about.style.right = '0';
      if (trackTop > 0) {
        about.style.position = 'relative';
        about.style.top = '';
        about.style.bottom = '';
      } else if (pageBottom <= vh) {
        about.style.position = 'absolute';
        about.style.top = '';
        about.style.bottom = '0';
      } else {
        about.style.position = 'fixed';
        about.style.top = '0';
        about.style.bottom = '';
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ---- Testimonials carousel ------------------------------------------------
  // Three cards stay in the DOM; prev/next just rotate which testimonial
  // (from the JSON island) each position shows, so no markup is duplicated.
  (function testimonials() {
    var gridEl = document.getElementById('ahTestiGrid');
    var dataEl = document.getElementById('ahTestimonialsData');
    var prevBtn = document.getElementById('ahTestiPrev');
    var nextBtn = document.getElementById('ahTestiNext');
    if (!gridEl || !dataEl || !prevBtn || !nextBtn) return;

    var items;
    try {
      items = JSON.parse(dataEl.textContent || '[]');
    } catch (e) {
      return;
    }
    if (!Array.isArray(items) || !items.length) return;

    var cards = Array.prototype.slice.call(gridEl.querySelectorAll('[data-testi-pos]'));
    var index = 0;
    var MAX_LINES = 6;

    // Truncates `fullText` (at word boundaries) so that, once rendered as
    // "<text>… See more" inside the quote <p>, it fits within MAX_LINES —
    // this is what puts "See more" right after the text on its last line,
    // instead of a separate line below (CSS line-clamp can't combine with
    // an inline trailing control reliably across browsers).
    function fitQuote(quoteEl, textEl, moreEl, fullText) {
      // quoteEl has `flex: 1` in its column layout, so it normally stretches
      // to fill the card's height — scrollHeight would then reflect that
      // stretched box, not the text. Neutralize the stretch while measuring.
      quoteEl.style.flex = 'none';

      textEl.textContent = fullText;
      moreEl.classList.remove('is-visible');
      var lineHeight = parseFloat(getComputedStyle(quoteEl).lineHeight) || 24;
      var maxHeight = lineHeight * MAX_LINES + 1;

      if (quoteEl.scrollHeight <= maxHeight) {
        quoteEl.style.flex = '';
        return false;
      }

      var words = fullText.split(' ');
      moreEl.classList.add('is-visible');
      var lo = 0;
      var hi = words.length;
      var best = 0;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        textEl.textContent = words.slice(0, mid).join(' ') + '…';
        if (quoteEl.scrollHeight <= maxHeight) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      textEl.textContent = words.slice(0, best).join(' ') + '…';
      quoteEl.style.flex = '';
      return true;
    }

    function render() {
      cards.forEach(function (card) {
        var pos = parseInt(card.getAttribute('data-testi-pos'), 10) || 0;
        var t = items[(index + pos) % items.length];
        var quote = card.querySelector('[data-testi-quote]');
        var text = card.querySelector('[data-testi-text]');
        var more = card.querySelector('[data-testi-more]');
        var name = card.querySelector('[data-testi-name]');
        var role = card.querySelector('[data-testi-role]');
        var avatar = card.querySelector('[data-testi-avatar]');
        if (name) name.textContent = t.name;
        if (role) role.textContent = t.role;
        if (avatar) {
          avatar.src = t.avatar;
          avatar.alt = t.name + ' logo';
        }
        if (quote && text && more) {
          quote.dataset.fullText = t.quote;
          more.textContent = 'See more';
          fitQuote(quote, text, more, t.quote);
        }
      });
    }

    prevBtn.addEventListener('click', function () {
      index = (index - 1 + items.length) % items.length;
      render();
    });
    nextBtn.addEventListener('click', function () {
      index = (index + 1) % items.length;
      render();
    });

    cards.forEach(function (card) {
      var quote = card.querySelector('[data-testi-quote]');
      var text = card.querySelector('[data-testi-text]');
      var more = card.querySelector('[data-testi-more]');
      if (!quote || !text || !more) return;
      more.addEventListener('click', function () {
        var expanded = more.textContent === 'See less';
        if (expanded) {
          more.textContent = 'See more';
          fitQuote(quote, text, more, quote.dataset.fullText || '');
        } else {
          text.textContent = quote.dataset.fullText || '';
          more.textContent = 'See less';
          more.classList.add('is-visible');
        }
      });
    });

    // Server-rendered markup already shows items[0..2]; this just truncates
    // each quote (if needed) so "See more" appears correctly on load.
    render();
  })();

  // ---- "Tell us what you need" chip picker ----------------------------------
  (function needPicker() {
    var grid = document.getElementById('ahNeedGrid');
    var chips = document.getElementById('ahNeedChips');
    if (!grid || !chips) return;
    var hint = chips.querySelector('.ah-need__chips-hint');
    var selectedCount = 0;

    function updateHint() {
      if (hint) hint.style.display = selectedCount > 0 ? 'none' : '';
    }

    function createChip(name, onRemove) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ah-need__chip';
      var label = document.createElement('span');
      label.textContent = name;
      chip.appendChild(label);
      chip.insertAdjacentHTML(
        'beforeend',
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/>' +
          '<line x1="19" y1="5" x2="5" y2="19"/></svg>',
      );
      chip.addEventListener('click', onRemove);
      return chip;
    }

    Array.prototype.forEach.call(grid.querySelectorAll('[data-need]'), function (btn) {
      var name = btn.getAttribute('data-need');
      var chip = null;

      function deselect() {
        btn.classList.remove('ah-need__service--selected');
        if (chip) {
          chip.remove();
          chip = null;
          selectedCount--;
          updateHint();
        }
      }

      function select() {
        btn.classList.add('ah-need__service--selected');
        chip = createChip(name, deselect);
        if (hint) chips.insertBefore(chip, hint);
        else chips.appendChild(chip);
        selectedCount++;
        updateHint();
      }

      btn.addEventListener('click', function () {
        if (btn.classList.contains('ah-need__service--selected')) deselect();
        else select();
      });
    });
  })();

  // Button ripple (every .ah-ripple element on this page): positions its
  // .ah-ripple__fx child at the pointer's entry point on mouseenter, same
  // as the theme's own VLTJS.button ripple for .vlt-btn
  // (vlt-controllers.min.js), so the CSS grow-from-0 transition expands
  // from wherever the cursor entered.
  (function buttonRipple() {
    var buttons = document.querySelectorAll('.ah-ripple');

    buttons.forEach(function (btn) {
      var ripple = btn.querySelector('.ah-ripple__fx');
      if (!ripple) return;

      function place(e) {
        var rect = btn.getBoundingClientRect();
        ripple.style.left = e.clientX - rect.left + 'px';
        ripple.style.top = e.clientY - rect.top + 'px';
      }

      btn.addEventListener('mouseenter', place);
      btn.addEventListener('mouseout', place);
    });
  })();
})();
