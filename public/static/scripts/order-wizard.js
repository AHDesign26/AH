// Order page — three-step project inquiry wizard.
// Posts to /api/order, whose field allowlist is just name/email/phone/
// company/title/message (see src/lib/spam.ts ALLOWED_FIELDS) — everything
// richer the wizard collects is folded into a formatted `message` string
// before submit, or it would be silently dropped server-side.
(function () {
  var ENDPOINT = '/api/order';

  var state = {
    step: 0, needs: new Set(), customRequest: '', businessNature: '',
    hasWebsite: null, websiteUrl: '', hasBranding: null, industry: '',
    goal: null, launchDate: '', stage: null,
    name: '', email: '', company: '', callTime: '', message: '',
    referredPlan: '',
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  var els = {
    card: $('.ow-card'),
    form: $('#ordersubmit'),
    progressFill: $('#owProgressFill'),
    stepsRow: $('#owSteps'),
    steps: $$('#owSteps .ow-steps__item'),
    panels: $$('.ow-panel'),
    success: $('.ow-success'),
    needCards: $$('.ow-optioncard[data-need]'),
    goalCards: $$('.ow-optioncard[data-goal]'),
    customRequest: $('#owCustomRequest'),
    otherSub: $('#owOtherSub'),
    business: $('#owBusiness'),
    websiteUrlWrap: $('#owWebsiteUrlWrap'),
    websiteUrl: $('#owWebsiteUrl'),
    brandingWrap: $('#owBrandingWrap'),
    industryWrap: $('#owIndustryWrap'),
    industry: $('#owIndustry'),
    launch: $('#owLaunch'),
    name: $('#owName'),
    email: $('#owEmail'),
    company: $('#owCompany'),
    callTime: $('#owCallTime'),
    message: $('#owMessage'),
    successText: $('#owSuccessText'),
    summaryNeeds: $('#owSummaryNeeds'),
    summaryGoal: $('#owSummaryGoal'),
    summaryStage: $('#owSummaryStage'),
    summaryEmail: $('#owSummaryEmail'),
    reset: $('#owReset'),
    back: $('#owBack'),
    next: $('#owNext'),
    nav: $('#owNav'),
    output: $('#output'),
  };

  if (!els.card || !els.form) return;

  var NEED_LABELS = { new: 'New Website', redesign: 'Website Redesign', seo: 'SEO / Marketing', scaling: 'Business Scaling', other: 'Custom request' };
  var GOAL_LABELS = { sales: 'Increase Sales', brand: 'Brand Identity', traffic: 'More Traffic', automate: 'Automate my Business' };
  var STAGE_LABELS = { idea: 'I have an idea', assets: 'Brand & assets ready', launch: 'Ready to launch' };

  // /order/?plan=xxx arrives from the pricing cards and /migration; the
  // wizard's "needs" cards are a coarser bucket than the old plan list, so
  // this is a best-effort mapping, not a 1:1 match. The exact plan id is
  // kept in the summary sent to the team either way.
  var PLAN_TO_NEED = {
    'the-one': 'new', 'the-core': 'new', 'the-growth': 'new', 'the-infinite': 'new',
    'digital-authority': 'redesign', 'the-move': 'redesign',
    'starter-visibility': 'seo', 'the-reach': 'seo', 'the-growth-engine': 'seo',
    'scale-and-automate': 'scaling', 'the-dispatch': 'scaling', 'outreach-campaign-platform': 'scaling',
  };

  function disabled() {
    if (state.step === 0) return state.needs.size === 0;
    if (state.step === 1) return !state.goal || !state.stage;
    if (state.step === 2) return !state.name.trim() || !/^\S+@\S+\.\S+$/.test(state.email);
    return true;
  }

  function render() {
    var pct = state.step >= 3 ? 100 : ((state.step + 1) / 3) * 100;
    if (els.progressFill) els.progressFill.style.width = pct + '%';

    els.steps.forEach(function (el) {
      var i = Number(el.dataset.stepIndicator);
      el.classList.toggle('is-active', i === state.step);
      el.classList.toggle('is-done', i < state.step);
    });
    if (els.stepsRow) els.stepsRow.hidden = state.step >= 3;

    els.panels.forEach(function (p) { p.hidden = Number(p.dataset.panel) !== state.step; });
    if (els.success) els.success.hidden = state.step !== 3;

    if (els.nav) els.nav.hidden = state.step >= 3;
    if (els.back) els.back.hidden = state.step === 0;
    if (els.next) {
      els.next.disabled = disabled();
      els.next.textContent = state.step === 2 ? 'Submit request' : 'Continue';
    }

    els.needCards.forEach(function (card) {
      var on = state.needs.has(card.dataset.need);
      card.classList.toggle('is-selected', on);
      var badge = card.querySelector('.ow-optioncard__badge');
      if (badge) badge.hidden = !on;
    });
    if (els.customRequest) els.customRequest.hidden = !state.needs.has('other');
    if (els.otherSub) els.otherSub.classList.toggle('is-on-dark', state.needs.has('other'));

    if (els.websiteUrlWrap) els.websiteUrlWrap.hidden = state.hasWebsite !== 'yes';
    $$('.ow-pill[data-set="hasWebsite"]').forEach(function (b) { b.classList.toggle('is-selected', b.dataset.value === state.hasWebsite); });

    if (els.brandingWrap) els.brandingWrap.hidden = !(state.needs.has('new') || state.needs.has('redesign'));
    if (els.industryWrap) els.industryWrap.hidden = !state.needs.has('seo');
    $$('.ow-pill[data-set="hasBranding"]').forEach(function (b) { b.classList.toggle('is-selected', b.dataset.value === state.hasBranding); });

    els.goalCards.forEach(function (card) {
      var on = state.goal === card.dataset.goal;
      card.classList.toggle('is-selected', on);
      var badge = card.querySelector('.ow-optioncard__badge');
      if (badge) badge.hidden = !on;
    });

    $$('.ow-pill[data-stage]').forEach(function (b) { b.classList.toggle('is-selected', b.dataset.stage === state.stage); });
  }

  function toggleNeed(id) {
    if (state.needs.has(id)) state.needs.delete(id); else state.needs.add(id);
    render();
  }

  els.needCards.forEach(function (card) {
    card.addEventListener('click', function () { toggleNeed(card.dataset.need); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNeed(card.dataset.need); }
    });
  });
  if (els.customRequest) {
    els.customRequest.addEventListener('click', function (e) { e.stopPropagation(); });
    els.customRequest.addEventListener('input', function (e) { state.customRequest = e.target.value; });
  }

  els.goalCards.forEach(function (card) {
    function select() { state.goal = card.dataset.goal; render(); }
    card.addEventListener('click', select);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  });

  $$('.ow-pill[data-set]').forEach(function (btn) {
    btn.addEventListener('click', function () { state[btn.dataset.set] = btn.dataset.value; render(); });
  });
  $$('.ow-pill[data-stage]').forEach(function (btn) {
    btn.addEventListener('click', function () { state.stage = btn.dataset.stage; render(); });
  });

  function bind(el, key, evt, revalidate) {
    if (!el) return;
    el.addEventListener(evt || 'input', function (e) {
      state[key] = e.target.value;
      if (revalidate) render();
    });
  }
  bind(els.business, 'businessNature');
  bind(els.websiteUrl, 'websiteUrl');
  bind(els.industry, 'industry');
  bind(els.launch, 'launchDate', 'change');
  bind(els.name, 'name', 'input', true);
  bind(els.email, 'email', 'input', true);
  bind(els.company, 'company');
  bind(els.callTime, 'callTime');
  bind(els.message, 'message');

  (function () {
    var wanted = new URLSearchParams(location.search).get('plan');
    if (!wanted) return;
    state.referredPlan = wanted;
    var need = PLAN_TO_NEED[wanted];
    if (need) state.needs.add(need);
  })();

  function goNext() {
    if (disabled()) return;
    if (state.step === 2) { submit(); return; }
    state.step += 1;
    render();
    els.card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function goBack() {
    state.step = Math.max(0, state.step - 1);
    render();
  }
  function resetAll() {
    state.step = 0; state.needs = new Set(); state.customRequest = ''; state.businessNature = '';
    state.hasWebsite = null; state.websiteUrl = ''; state.hasBranding = null; state.industry = '';
    state.goal = null; state.launchDate = ''; state.stage = null; state.name = ''; state.email = '';
    state.company = ''; state.callTime = ''; state.message = '';
    els.form.reset();
    if (els.customRequest) els.customRequest.value = '';
    render();
  }

  if (els.next) els.next.addEventListener('click', goNext);
  if (els.back) els.back.addEventListener('click', goBack);
  if (els.reset) els.reset.addEventListener('click', resetAll);

  // Enter in a text field advances the wizard instead of submitting the
  // <form> natively mid-flow; buttons and the textarea keep their own
  // native Enter behaviour (activate / insert newline).
  els.form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); goNext(); }
  });
  els.form.addEventListener('submit', function (e) { e.preventDefault(); });

  function buildSummary() {
    var lines = [];
    var needsList = Array.from(state.needs).map(function (id) { return NEED_LABELS[id]; }).join(', ') || '—';
    lines.push('Needs: ' + needsList);
    if (state.needs.has('other') && state.customRequest.trim()) lines.push('Custom request: ' + state.customRequest.trim());
    if (state.businessNature.trim()) lines.push('Business: ' + state.businessNature.trim());
    if (state.hasWebsite) lines.push('Has website: ' + state.hasWebsite);
    if ((state.needs.has('new') || state.needs.has('redesign')) && state.hasBranding) {
      lines.push('Branding ready: ' + state.hasBranding);
    }
    if (state.needs.has('seo') && state.industry.trim()) lines.push('Industry: ' + state.industry.trim());
    lines.push('Goal: ' + (GOAL_LABELS[state.goal] || '—'));
    if (state.launchDate) lines.push('Target launch: ' + state.launchDate);
    lines.push('Stage: ' + (STAGE_LABELS[state.stage] || '—'));
    if (state.callTime.trim()) lines.push('Best time to call: ' + state.callTime.trim());
    if (state.referredPlan) lines.push('Referred plan: ' + state.referredPlan);
    if (state.message.trim()) lines.push('', state.message.trim());
    return lines.join('\n');
  }

  function showError(text) {
    if (!els.output) return;
    els.output.textContent = text;
    els.output.classList.add('is-visible');
  }
  function hideError() {
    if (!els.output) return;
    els.output.classList.remove('is-visible');
  }

  function submit() {
    if (disabled()) return;
    els.next.disabled = true;
    els.next.textContent = 'Sending…';
    hideError();

    var data = new FormData(els.form);
    data.set('name', state.name.trim());
    data.set('email', state.email.trim());
    data.set('company', state.company.trim());
    data.set('title', Array.from(state.needs).map(function (id) { return NEED_LABELS[id]; }).join(', '));
    data.set('website_url', state.hasWebsite === 'yes' ? state.websiteUrl.trim() : '');
    data.set('message', buildSummary());

    fetch(ENDPOINT, { method: 'POST', body: data })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok || !json.success) throw new Error('submit-failed');

          state.step = 3;
          var firstName = state.name.trim().split(' ')[0];
          if (els.successText) {
            els.successText.textContent = 'Thanks' + (firstName ? ', ' + firstName : '') +
              '. We’ll review your project and get back within one business day to confirm scope, timeline and a fixed quote.';
          }
          if (els.summaryNeeds) els.summaryNeeds.textContent = Array.from(state.needs).map(function (id) { return NEED_LABELS[id]; }).join(', ') || '—';
          if (els.summaryGoal) els.summaryGoal.textContent = GOAL_LABELS[state.goal] || '—';
          if (els.summaryStage) els.summaryStage.textContent = STAGE_LABELS[state.stage] || '—';
          if (els.summaryEmail) els.summaryEmail.textContent = state.email;
          render();
          if (window.turnstile) window.turnstile.reset();
        });
      })
      .catch(function () {
        showError('Something went wrong, please try again.');
        els.next.disabled = false;
        els.next.textContent = 'Submit request';
      });
  }

  render();
})();
