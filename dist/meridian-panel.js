/*
 * Meridian — a complete, software-like UI for Home Assistant (custom panel).
 *
 * configuration.yaml:
 *   panel_custom:
 *     - name: meridian-panel
 *       url_path: meridian
 *       sidebar_title: Meridian
 *       sidebar_icon: mdi:home-variant-outline
 *       module_url: /local/meridian/meridian-panel.js?v=0.2.0
 */

const VERSION = '0.2.0';
const STORE_KEY = 'meridian';

// ─── helpers ──────────────────────────────────────────────────────────────────

const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v, d = 1) => { const n = Number(v); return isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–'; };
const isAvail = (s) => s && !['unavailable', 'unknown'].includes(s.state);
const icon = (name, cls = '') => `<ha-icon class="${cls}" icon="${x(name)}"></ha-icon>`;
const uid = () => Math.random().toString(36).slice(2, 10);
const domainOf = (id) => id.split('.')[0];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function relTime(iso) {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  const diff = (Date.now() - t) / 1000;
  const fut = diff < 0, a = Math.abs(diff);
  const v = a < 60 ? null : a < 3600 ? `${Math.round(a / 60)} Min.` : a < 86400 ? `${Math.round(a / 3600)} Std.` : `${Math.round(a / 86400)} ${Math.round(a / 86400) === 1 ? 'Tag' : 'Tagen'}`;
  if (!v) return fut ? 'gleich' : 'gerade eben';
  return fut ? `in ${v}` : `vor ${v}`;
}

function dayLabel(date, long = true) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 864e5);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'long' });
}

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
}

const WASTE = [[/bio/i, '#8B5E3C', 'Bio'], [/rest/i, '#667085', 'Rest'], [/gelb|wertstoff|verpack/i, '#EAB308', 'Gelb'], [/papier|blau/i, '#2E90FA', 'Papier'], [/glas/i, '#12B76A', 'Glas']];
const WEATHER_LABEL = { 'clear-night': 'Klar', cloudy: 'Bewölkt', exceptional: 'Unwetter', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', partlycloudy: 'Teils bewölkt', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'Sonnig', windy: 'Windig', 'windy-variant': 'Windig' };
const CAL_COLORS = ['#4F46E5', '#12B76A', '#F79009', '#EE46BC', '#2E90FA', '#7A5AF8', '#F04438'];
const AREA_ICON = { wohnzimmer: 'mdi:sofa-outline', kuche: 'mdi:countertop-outline', kueche: 'mdi:countertop-outline', schlafzimmer: 'mdi:bed-outline', eingang: 'mdi:door', bad: 'mdi:shower', badezimmer: 'mdi:shower', buero: 'mdi:desk', arbeitszimmer: 'mdi:desk', kinderzimmer: 'mdi:teddy-bear', flur: 'mdi:door-sliding', garten: 'mdi:flower-outline', balkon: 'mdi:balcony' };
const DOMAIN_ICON = { light: 'mdi:lightbulb-outline', switch: 'mdi:toggle-switch-outline', fan: 'mdi:fan', climate: 'mdi:thermostat', media_player: 'mdi:speaker', camera: 'mdi:cctv', sensor: 'mdi:gauge', binary_sensor: 'mdi:checkbox-blank-circle-outline', vacuum: 'mdi:robot-vacuum', cover: 'mdi:window-shutter', lock: 'mdi:lock-outline', button: 'mdi:gesture-tap-button', event: 'mdi:bell-outline', automation: 'mdi:robot-outline', script: 'mdi:script-text-outline', scene: 'mdi:palette-outline', todo: 'mdi:format-list-checks', calendar: 'mdi:calendar', weather: 'mdi:weather-partly-cloudy', update: 'mdi:package-up', image: 'mdi:image-outline' };
const SENSOR_ICON = { temperature: 'mdi:thermometer', humidity: 'mdi:water-percent', battery: 'mdi:battery-outline', motion: 'mdi:motion-sensor', door: 'mdi:door', window: 'mdi:window-closed-variant', power: 'mdi:flash-outline', energy: 'mdi:lightning-bolt-outline', timestamp: 'mdi:clock-outline', data_size: 'mdi:harddisk', data_rate: 'mdi:swap-vertical', safety: 'mdi:shield-check-outline', precipitation_intensity: 'mdi:weather-rainy', pressure: 'mdi:gauge' };

function weatherSvg(cond, size = 44) {
  const sun = `<g class="wx-sun"><circle cx="24" cy="24" r="8" fill="#F5B841"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="24" y1="9" x2="24" y2="5" stroke="#F5B841" stroke-width="2.5" stroke-linecap="round" transform="rotate(${a} 24 24)"/>`).join('')}</g>`;
  const cloud = (dx = 0, dy = 0, fill = 'var(--m-cloud)') => `<path class="wx-cloud" transform="translate(${dx} ${dy})" d="M15 34h19a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 2 13z" fill="${fill}"/>`;
  const drops = `<g class="wx-rain">${[16, 24, 32].map((cx, i) => `<line x1="${cx}" y1="38" x2="${cx - 2}" y2="44" stroke="#53B1FD" stroke-width="2.2" stroke-linecap="round" style="animation-delay:${i * 0.25}s"/>`).join('')}</g>`;
  let body;
  switch (cond) {
    case 'sunny': body = sun; break;
    case 'clear-night': body = `<path class="wx-moon" d="M30 10a14 14 0 1 0 8 25 11 11 0 0 1-8-25z" fill="#C7C9FF"/>`; break;
    case 'partlycloudy': body = `<g transform="translate(-6 -6) scale(.85)">${sun}</g>${cloud(2, 4)}`; break;
    case 'rainy': case 'pouring': case 'lightning-rainy': body = `${cloud(0, -4)}${drops}`; break;
    case 'snowy': case 'snowy-rainy': body = `${cloud(0, -4)}<g class="wx-snow">${[16, 24, 32].map((cx, i) => `<circle cx="${cx}" cy="41" r="1.8" fill="#C4C7CE" style="animation-delay:${i * 0.3}s"/>`).join('')}</g>`; break;
    case 'fog': body = `${cloud(0, -4)}<g stroke="var(--m-muted)" stroke-width="2" stroke-linecap="round"><line x1="10" y1="40" x2="38" y2="40"/><line x1="14" y1="44" x2="34" y2="44"/></g>`; break;
    default: body = `${cloud(-4, -3, 'var(--m-cloud-2)')}${cloud(3, 2)}`;
  }
  return `<svg class="wx" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
}

const NAV = [
  { path: '/', label: 'Home', icon: 'mdi:home-variant-outline' },
  { path: '/raeume', label: 'Räume', icon: 'mdi:floor-plan' },
  { path: '/kalender', label: 'Kalender', icon: 'mdi:calendar-blank-outline' },
  { path: '/listen', label: 'Listen', icon: 'mdi:format-list-checks' },
  { path: '/geraete', label: 'Geräte', icon: 'mdi:devices' },
  { path: '/haushalt', label: 'Haushalt', icon: 'mdi:robot-vacuum' },
  { path: '/automationen', label: 'Automationen', icon: 'mdi:robot-outline' },
  { path: '/system', label: 'System', icon: 'mdi:server-outline' },
];
const MOBILE_TABS = ['/', '/raeume', '/kalender', '/listen'];

// ─── panel ────────────────────────────────────────────────────────────────────

class MeridianPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._layout = null;
    this._sigs = {};
    this._events = null;
    this._forecast = null;
    this._todos = {};
    this._todoSig = '';
    this._nums = new Map();
    this._widgets = new Map();  // widget id → card element
    this._edit = false;
    this._sheet = null;          // { type, ... }
    this._palette = null;        // { q, i }
    this._timers = [];
    this._pageKey = null;
  }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (first) this._boot();
    this._update();
    this._widgets.forEach(el => { el.hass = h; });
  }
  get hass() { return this._hass; }
  set narrow(n) { this._narrow = n; }
  set route(r) {
    const prev = this._route?.path;
    this._route = r;
    if (prev !== undefined && prev !== r?.path) { this._sheet = null; this._update(); this.shadowRoot.querySelector('.m-content')?.scrollTo({ top: 0 }); }
  }
  set panel(p) { this._panel = p; }

  connectedCallback() { if (this._hass && !this._timers.length) this._startTimers(); }
  disconnectedCallback() { this._timers.forEach(clearInterval); this._timers = []; }

  // ─── boot / storage ────────────────────────────────────────────────────────

  async _boot() {
    this._mount();
    try {
      const res = await this._hass.callWS({ type: 'frontend/get_user_data', key: STORE_KEY });
      this._layout = res?.value || {};
    } catch (e) { this._layout = {}; }
    this._layout = { fullscreen: true, home: { widgets: [] }, rooms: {}, hiddenAreas: [], areaOrder: [], hiddenCalendars: [], ...this._layout };
    if (this._layout.fullscreen) this._dock('always_hidden');
    this._startTimers();
    this._fetchEvents();
    this._fetchForecast();
    this._update();
  }

  _startTimers() {
    this._timers.push(setInterval(() => this._fetchEvents(), 15 * 60e3));
    this._timers.push(setInterval(() => this._fetchForecast(), 30 * 60e3));
    this._timers.push(setInterval(() => { this._sigs = {}; this._update(); }, 60e3));
  }

  _saveLayout() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      this._hass.callWS({ type: 'frontend/set_user_data', key: STORE_KEY, value: this._layout })
        .catch(e => console.error('[meridian] save', e));
    }, 300);
  }

  _dock(mode) {
    this.dispatchEvent(new CustomEvent('hass-dock-sidebar', { detail: { dock: mode }, bubbles: true, composed: true }));
  }

  // ─── model (auto discovery) ────────────────────────────────────────────────

  _st(id) { return id ? this._hass?.states?.[id] : undefined; }
  _name(id) {
    const s = this._st(id);
    return s?.attributes?.friendly_name || id;
  }

  _model() {
    const h = this._hass;
    if (this._modelCache && this._modelCache.ents === h.entities && this._modelCache.areas === h.areas && this._modelCache.layout === this._layoutVer) return this._modelCache.m;
    const areaOf = (id) => { const e = h.entities?.[id]; return e ? (e.area_id || h.devices?.[e.device_id]?.area_id || null) : null; };
    const visible = (id) => { const e = h.entities?.[id]; return h.states[id] && !(e?.hidden) && !(e?.entity_category); };
    const all = Object.keys(h.states).filter(visible);
    const byArea = {};
    for (const id of all) { const a = areaOf(id); if (a) (byArea[a] ||= []).push(id); }
    let areas = Object.values(h.areas || {}).map(a => ({
      id: a.area_id, name: a.name, icon: a.icon || AREA_ICON[a.area_id] || 'mdi:home-outline',
      tempId: a.temperature_entity_id, humId: a.humidity_entity_id, ents: (byArea[a.area_id] || []).sort(),
    }));
    const order = this._layout?.areaOrder || [];
    areas.sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.name.localeCompare(b.name, 'de'); });
    const ofDomain = (d) => all.filter(id => domainOf(id) === d);
    const m = {
      all, areas, areaOf,
      visibleAreas: areas.filter(a => !(this._layout?.hiddenAreas || []).includes(a.id)),
      lights: ofDomain('light'),
      climates: ofDomain('climate').filter(id => isAvail(h.states[id])),
      media: ofDomain('media_player'),
      cameras: ofDomain('camera'),
      vacuums: ofDomain('vacuum'),
      calendars: ofDomain('calendar'),
      todos: ofDomain('todo'),
      automations: Object.keys(h.states).filter(id => id.startsWith('automation.')),
      scripts: Object.keys(h.states).filter(id => id.startsWith('script.')),
      scenes: Object.keys(h.states).filter(id => id.startsWith('scene.')),
      updates: Object.keys(h.states).filter(id => id.startsWith('update.')),
      weather: ofDomain('weather').sort((a, b) => (h.states[a].attributes.friendly_name || '').length - (h.states[b].attributes.friendly_name || '').length)[0],
      doorButton: ofDomain('button').find(id => /t(ü|ue)r|door|öffnen/i.test(id + this._name(id))),
      bell: ofDomain('event').find(id => /klingel|bell|ring/i.test(id + this._name(id))),
    };
    m.wasteCal = this._layout?.wasteCalendar || m.calendars.find(id => /m(ü|ue)ll|abfall|waste/i.test(id + this._name(id)));
    m.tasks = this._layout?.tasks || m.todos.find(id => /aufgabe|task/i.test(id + this._name(id))) || m.todos[0];
    m.shopping = this._layout?.shopping || m.todos.find(id => /einkauf|shopping/i.test(id + this._name(id)));
    m.doorArea = m.doorButton ? areaOf(m.doorButton) : null;
    this._modelCache = { ents: h.entities, areas: h.areas, layout: this._layoutVer, m };
    return m;
  }

  _roomEntities(area) {
    const hidden = this._layout.rooms?.[area.id]?.hidden || [];
    return area.ents.filter(id => !hidden.includes(id));
  }

  _roomTemp(area) {
    const pick = (dc) => area.ents.find(id => domainOf(id) === 'sensor' && this._st(id).attributes.device_class === dc && isAvail(this._st(id)));
    const t = this._st(area.tempId) || this._st(pick('temperature'));
    const hum = this._st(area.humId) || this._st(pick('humidity'));
    let temp = isAvail(t) ? Number(t.state) : null;
    if (temp === null) { const c = area.ents.map(id => this._st(id)).find(s => domainOf(s.entity_id) === 'climate' && s.attributes.current_temperature != null); if (c) temp = Number(c.attributes.current_temperature); }
    return { temp, hum: isAvail(hum) ? Number(hum.state) : null };
  }

  // ─── data fetching ─────────────────────────────────────────────────────────

  async _fetchEvents() {
    if (!this._hass) return;
    const m = this._model();
    const ids = m.calendars;
    if (!ids.length) { this._events = []; return; }
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 35 * 864e5);
    try {
      const res = await this._hass.callService('calendar', 'get_events', { start_date_time: start.toISOString(), end_date_time: end.toISOString() }, { entity_id: ids }, false, true);
      const out = [];
      for (const [cal, v] of Object.entries(res.response || {})) {
        for (const e of v.events || []) {
          const allDay = !String(e.start).includes('T');
          out.push({ cal, summary: String(e.summary || '').trim(), start: new Date(allDay ? e.start + 'T00:00:00' : e.start), end: new Date(allDay ? e.end + 'T00:00:00' : e.end), allDay, location: e.location || '', waste: cal === m.wasteCal });
        }
      }
      out.sort((a, b) => a.start - b.start);
      this._events = out;
    } catch (e) { console.warn('[meridian] calendar', e); this._events = []; }
    this._sigs = {}; this._update();
  }

  async _fetchForecast() {
    const w = this._hass && this._model().weather;
    if (!w) return;
    try {
      const res = await this._hass.callService('weather', 'get_forecasts', { type: 'daily' }, { entity_id: w }, false, true);
      this._forecast = res.response?.[w]?.forecast || [];
    } catch (e) { this._forecast = []; }
    this._sigs = {}; this._update();
  }

  async _fetchTodos(ids) {
    ids = ids.filter(Boolean);
    if (!ids.length) return;
    try {
      const res = await this._hass.callService('todo', 'get_items', {}, { entity_id: ids }, false, true);
      for (const id of ids) this._todos[id] = res.response?.[id]?.items || [];
    } catch (e) { console.warn('[meridian] todo', e); }
    this._sigs = {}; this._update();
  }

  _ensureTodos(ids) {
    const need = ids.filter(id => id && !(id in this._todos));
    const sig = ids.map(id => `${id}:${this._st(id)?.state}`).join('|');
    if (need.length || sig !== this._todoSigs?.[ids.join()]) {
      (this._todoSigs ||= {})[ids.join()] = sig;
      if (!this._todoFetching) { this._todoFetching = true; this._fetchTodos(ids).finally(() => { this._todoFetching = false; }); }
    }
  }

  _svc(domain, service, data = {}, target) {
    return this._hass.callService(domain, service, data, target).catch(e => {
      console.error('[meridian]', domain, service, e);
      this._toast(`Fehler: ${e?.message || e}`, true);
    });
  }

  // ─── routing ───────────────────────────────────────────────────────────────

  _path() { return (this._route?.path || '/').replace(/\/+$/, '') || '/'; }
  _go(path) {
    const prefix = this._route?.prefix || '/meridian';
    const external = ['/config', '/lovelace', '/todo', '/history', '/logbook', '/profile', '/developer-tools', '/media-browser', '/calendar', '/map', '/dashboard-'].some(p => path.startsWith(p));
    const url = external ? path : prefix + (path === '/' ? '' : path);
    history.pushState(null, '', url);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  // ─── render engine ─────────────────────────────────────────────────────────

  _mount() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="m-app">
        <nav class="m-nav" data-slot="nav"></nav>
        <div class="m-content">
          <div class="m-topbar" data-slot="topbar"></div>
          <div class="m-page" data-slot="page"></div>
        </div>
        <nav class="m-tabbar" data-slot="tabbar"></nav>
        <div data-slot="overlay"></div>
        <div class="m-toast" data-slot="toast"></div>
      </div>`;
    const root = this.shadowRoot;
    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('submit', (e) => this._onSubmit(e));
    root.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    root.addEventListener('input', (e) => this._onInput(e));
    root.addEventListener('keydown', (e) => this._onKey(e));
    root.addEventListener('change', (e) => this._onChange(e));
    window.addEventListener('keydown', this._globalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this._openPalette(); }
      if (e.key === 'Escape' && (this._sheet || this._palette)) { this._sheet = null; this._palette = null; this._update(); }
    });
  }

  _update() {
    if (!this._hass || !this._layout || !this.shadowRoot.querySelector('.m-app')) return;
    const path = this._path();
    const page = this._page(path);
    const root = this.shadowRoot;
    root.querySelector('.m-app').classList.toggle('is-edit', this._edit);

    this._slot('nav', this._sigNav(path), () => this._renderNav(path));
    this._slot('tabbar', this._sigNav(path), () => this._renderTabbar(path));
    this._slot('topbar', path + page.title + this._edit, () => this._renderTopbar(page));

    // page: rebuild containers on route change, then diff blocks
    const pageEl = root.querySelector('[data-slot="page"]');
    const key = path + '|' + page.blocks.map(b => b.key).join(',') + '|' + this._edit;
    if (this._pageKey !== key) {
      const routeChanged = this._pageKey?.split('|')[0] !== path;
      this._pageKey = key;
      pageEl.className = `m-page${routeChanged || !this._entered ? ' is-entering' : ''} ${page.cls || ''}`;
      pageEl.innerHTML = page.blocks.map(b => `<div class="m-block ${b.cls || ''}" data-block="${b.key}"></div>`).join('');
      this._sigs = Object.fromEntries(Object.entries(this._sigs).filter(([k]) => !k.startsWith('b:')));
      clearTimeout(this._enterT);
      this._enterT = setTimeout(() => { pageEl.classList.remove('is-entering'); this._entered = true; }, 1100);
    }
    for (const b of page.blocks) {
      const el = pageEl.querySelector(`[data-block="${b.key}"]`);
      if (!el) continue;
      const sig = b.sig();
      if (this._sigs['b:' + b.key] === sig) continue;
      if (this._dragging && b.live) { continue; }
      this._sigs['b:' + b.key] = sig;
      el.innerHTML = b.render();
      this._attachWidgets(el);
      this._countUp(el);
    }

    this._renderOverlay();
  }

  _slot(name, sig, render) {
    if (this._sigs[name] === sig) return;
    this._sigs[name] = sig;
    const el = this.shadowRoot.querySelector(`[data-slot="${name}"]`);
    if (el) { el.innerHTML = render(); this._countUp(el); }
  }

  _countUp(root) {
    if (reduceMotion()) return;
    root.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.countKey;
      const to = Number(el.dataset.count);
      if (!key || !isFinite(to)) return;
      const from = this._nums.has(key) ? this._nums.get(key) : 0;
      this._nums.set(key, to);
      if (from === to) return;
      const d = Number(el.dataset.digits || 0), t0 = performance.now();
      const step = (t) => { const p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3); el.textContent = num(from + (to - from) * e, d); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  _sigOf(ids) {
    return ids.filter(Boolean).map(id => { const s = this._st(id); return s ? `${s.state}~${s.attributes.brightness ?? ''}~${s.attributes.temperature ?? ''}~${s.attributes.current_temperature ?? ''}~${s.attributes.media_title ?? ''}~${s.last_changed}` : '-'; }).join('|');
  }

  // ─── navigation ────────────────────────────────────────────────────────────

  _sigNav(path) {
    const m = this._model();
    return [path, this._edit, m.visibleAreas.map(a => a.id).join(), this._updatesCount(), this._hass.user?.name].join('#');
  }
  _updatesCount() { return this._model().updates.filter(id => this._st(id).state === 'on').length; }
  _isActive(navPath, path) { return navPath === '/' ? path === '/' : path === navPath || path.startsWith(navPath + '/') || (navPath === '/raeume' && path.startsWith('/raum/')); }

  _renderNav(path) {
    const m = this._model();
    const user = this._hass.user?.name || '';
    const upd = this._updatesCount();
    return `
      <div class="m-brand">
        <span class="m-brand__mark">${icon('mdi:home-variant')}</span>
        <span class="m-brand__name">Meridian</span>
      </div>
      <button class="m-search m-press" data-action="palette">${icon('mdi:magnify')}<span>Suchen</span><kbd>⌘K</kbd></button>
      <div class="m-nav__group">
        ${NAV.map(n => `
          <a class="m-nav__item${this._isActive(n.path, path) ? ' is-active' : ''}" data-nav="${n.path}" href="#">
            ${icon(n.icon)}<span>${n.label}</span>${n.path === '/system' && upd ? `<em class="m-badge">${upd}</em>` : ''}
          </a>
          ${n.path === '/raeume' ? `<div class="m-nav__sub">${m.visibleAreas.map(a => `
            <a class="m-nav__subitem${path === '/raum/' + a.id ? ' is-active' : ''}" data-nav="/raum/${a.id}" href="#"><i class="m-nav__dot${this._roomLit(a) ? ' is-lit' : ''}"></i>${x(a.name)}</a>`).join('')}</div>` : ''}
        `).join('')}
      </div>
      <div class="m-nav__bottom">
        <button class="m-nav__item${this._edit ? ' is-active' : ''}" data-action="edit">${icon(this._edit ? 'mdi:check' : 'mdi:pencil-outline')}<span>${this._edit ? 'Fertig' : 'Anpassen'}</span></button>
        <a class="m-nav__item${path === '/einstellungen' ? ' is-active' : ''}" data-nav="/einstellungen" href="#">${icon('mdi:cog-outline')}<span>Einstellungen</span></a>
        <a class="m-nav__item" data-nav="/config/dashboard" href="#">${icon('mdi:home-assistant')}<span>Home Assistant</span>${icon('mdi:arrow-top-right', 'm-ext')}</a>
        <div class="m-user"><span class="m-avatar">${x(user.slice(0, 1))}</span><span>${x(user)}</span></div>
      </div>`;
  }

  _roomLit(a) { return a.ents.some(id => domainOf(id) === 'light' && this._st(id)?.state === 'on'); }

  _renderTabbar(path) {
    const more = !MOBILE_TABS.some(p => this._isActive(p, path));
    return `
      ${MOBILE_TABS.map(p => { const n = NAV.find(n => n.path === p); return `
        <a class="m-tab${this._isActive(p, path) ? ' is-active' : ''}" data-nav="${p}" href="#">${icon(n.icon)}<span>${n.label}</span></a>`; }).join('')}
      <button class="m-tab${more ? ' is-active' : ''}" data-action="more">${icon('mdi:dots-horizontal')}<span>Mehr</span></button>`;
  }

  _renderTopbar(page) {
    return `
      <div class="m-topbar__title">${x(page.title)}</div>
      <button class="m-icon-btn m-press" data-action="palette" aria-label="Suchen">${icon('mdi:magnify')}</button>
      ${page.editable ? `<button class="m-icon-btn m-press${this._edit ? ' is-on' : ''}" data-action="edit" aria-label="Anpassen">${icon(this._edit ? 'mdi:check' : 'mdi:pencil-outline')}</button>` : ''}`;
  }

  // ─── page router ───────────────────────────────────────────────────────────

  _page(path) {
    const m = this._model();
    if (path === '/') return this._pageHome();
    if (path === '/raeume') return this._pageRooms();
    if (path.startsWith('/raum/')) { const a = m.areas.find(a => a.id === path.slice(6)); if (a) return this._pageRoom(a); }
    if (path === '/kalender') return this._pageCalendar();
    if (path.startsWith('/listen')) return this._pageLists(path.slice(8));
    if (path.startsWith('/geraete')) return this._pageDevices(path.slice(9) || 'licht');
    if (path === '/haushalt') return this._pageHousehold();
    if (path === '/automationen') return this._pageAutomations();
    if (path === '/system') return this._pageSystem();
    if (path === '/einstellungen') return this._pageSettings();
    return { title: 'Nicht gefunden', blocks: [{ key: 'nf', sig: () => 'nf', render: () => `<div class="m-empty-page">${icon('mdi:map-marker-question-outline')}<h2>Seite nicht gefunden</h2><button class="m-pill m-press is-primary" data-nav="/">Zur Übersicht</button></div>` }] };
  }

  _head(title, sub = '', right = '') {
    return `<header class="m-pagehead m-anim" style="--i:0"><div><h1>${x(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</header>`;
  }

  // ─── HOME ──────────────────────────────────────────────────────────────────

  _pageHome() {
    const m = this._model();
    if (m.tasks) this._ensureTodos([m.tasks, m.shopping]);
    const roomIds = m.visibleAreas.flatMap(a => this._roomEntities(a));
    return {
      title: 'Home', editable: true, cls: 'is-home',
      blocks: [
        { key: 'hero', sig: () => [new Date().getHours(), new Date().getMinutes() >> 4, this._sigOf([m.weather, ...m.lights]), this._forecast?.length, this._events?.length].join('#'), render: () => this._renderHero() },
        { key: 'actions', sig: () => this._sigOf([...m.lights, ...m.vacuums, m.doorButton, m.shopping]), render: () => this._renderQuick() },
        { key: 'rooms', cls: 'is-main', live: true, sig: () => this._sigOf(roomIds) + this._edit + m.visibleAreas.map(a => a.id).join(), render: () => this._renderRoomGrid() },
        { key: 'side', cls: 'is-side', sig: () => JSON.stringify([this._events?.length, this._events?.[0]?.summary, this._todos[m.tasks], new Date().getDate()]), render: () => this._renderAgendaCard(6) + (m.tasks ? this._renderTodoCard(m.tasks, { compact: true }) : '') },
        { key: 'status', cls: 'is-main', sig: () => this._sigOf([...m.vacuums, ...m.media]), render: () => this._renderStatusRow() },
        { key: 'widgets', sig: () => JSON.stringify(this._layout.home.widgets) + this._edit, render: () => this._renderWidgetArea('home') },
      ],
    };
  }

  _renderHero() {
    const m = this._model();
    const now = new Date();
    const name = (this._hass.user?.name || '').split(' ')[0];
    const w = this._st(m.weather);
    const lightsOn = m.lights.filter(id => this._st(id)?.state === 'on').length;
    const next = (this._events || []).find(e => !e.waste && (e.allDay ? e.start >= new Date(now.toDateString()) : e.start >= now));
    const fc = (this._forecast || []).slice(0, 5);
    const summary = [lightsOn ? `${lightsOn} ${lightsOn === 1 ? 'Licht' : 'Lichter'} an` : 'Alle Lichter aus', next ? `${dayLabel(next.start)}: ${next.summary}` : null].filter(Boolean);
    return `
      <div class="m-hero">
        <div class="m-anim" style="--i:0">
          <div class="m-eyebrow">${x(now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
          <h1 class="m-title">${x(greeting(now))}${name ? `, ${x(name)}` : ''}</h1>
          <div class="m-summary">${summary.map(s => `<span>${x(s)}</span>`).join('<i class="m-dot"></i>')}</div>
        </div>
        ${w ? `
          <button class="m-weather m-anim m-press" style="--i:1" data-more="${x(m.weather)}">
            <div class="m-weather__now">${weatherSvg(w.state, 52)}<div>
              <div class="m-weather__temp"><span data-count="${w.attributes.temperature}" data-count-key="wx">${num(w.attributes.temperature, 0)}</span>°</div>
              <div class="m-weather__label">${x(WEATHER_LABEL[w.state] || w.state)}</div></div></div>
            ${fc.length ? `<div class="m-weather__days">${fc.map((d, i) => `<div class="m-weather__day"><span>${i === 0 ? 'Heute' : x(new Date(d.datetime).toLocaleDateString('de-DE', { weekday: 'short' }))}</span>${weatherSvg(d.condition, 26)}<b>${num(d.temperature, 0)}°</b><em>${num(d.templow, 0)}°</em></div>`).join('')}</div>` : ''}
          </button>` : ''}
      </div>`;
  }

  _renderQuick() {
    const m = this._model();
    const on = m.lights.filter(id => this._st(id)?.state === 'on');
    const v = this._st(m.vacuums[0]);
    const cleaning = v && ['cleaning', 'returning'].includes(v.state);
    const items = [
      `<button class="m-action m-press${on.length ? ' is-active' : ''}" data-action="all-off" ${on.length ? '' : 'disabled'}><span class="m-action__icon">${icon('mdi:power')}</span><span><b>Alles aus</b><small>${on.length ? `${on.length} ${on.length === 1 ? 'Licht' : 'Lichter'} an` : 'Alles ist aus'}</small></span></button>`,
    ];
    if (m.doorButton) items.push(`<button class="m-action m-press m-hold" data-hold="${x(m.doorButton)}"><span class="m-action__icon m-hold__ring">${icon('mdi:door-open')}</span><span><b>Tür öffnen</b><small class="m-hold__hint">Gedrückt halten</small></span></button>`);
    if (v) items.push(`<button class="m-action m-press${cleaning ? ' is-active' : ''}" data-vac="${cleaning ? 'return_to_base' : 'start'}" data-entity="${x(v.entity_id)}"><span class="m-action__icon${cleaning ? ' is-spin' : ''}">${icon('mdi:robot-vacuum')}</span><span><b>${cleaning ? 'Zur Station' : 'Saugen'}</b><small>${x(this._vacLabel(v))}</small></span></button>`);
    if (m.shopping) { const n = Number(this._st(m.shopping)?.state) || 0; items.push(`<button class="m-action m-press" data-nav="/listen/${x(m.shopping)}"><span class="m-action__icon">${icon('mdi:cart-outline')}</span><span><b>Einkauf</b><small>${n ? `${n} offen` : 'Liste leer'}</small></span></button>`); }
    return `<div class="m-actions">${items.map((h, i) => h.replace('class="m-action', `style="--i:${i + 2}" class="m-anim m-action`)).join('')}</div>`;
  }

  _vacLabel(v) { return ({ docked: 'In der Station', cleaning: 'Saugt gerade', returning: 'Fährt zurück', paused: 'Pausiert', idle: 'Bereit', error: 'Fehler' })[v.state] || v.state; }

  _renderRoomGrid() {
    const m = this._model();
    const areas = m.visibleAreas;
    return `
      <div class="m-sectionhead m-anim" style="--i:4"><h2>Räume</h2><span>${areas.length}</span><a class="m-link" data-nav="/raeume" href="#">Alle ${icon('mdi:chevron-right')}</a></div>
      <div class="m-rooms">${areas.map((a, i) => this._renderRoomCard(a, i)).join('')}</div>`;
  }

  _renderRoomCard(a, i) {
    const m = this._model();
    const ents = this._roomEntities(a);
    const lights = ents.filter(id => domainOf(id) === 'light');
    const on = lights.filter(id => this._st(id).state === 'on');
    const { temp, hum } = this._roomTemp(a);
    const clim = ents.map(id => this._st(id)).find(s => domainOf(s.entity_id) === 'climate' && s.state === 'heat');
    const fanOn = ents.some(id => domainOf(id) === 'fan' && this._st(id).state === 'on');
    const media = ents.map(id => this._st(id)).find(s => domainOf(s.entity_id) === 'media_player' && s.state === 'playing');
    const bell = m.bell && (m.areaOf(m.bell) === a.id || m.doorArea === a.id) ? this._st(m.bell) : null;
    const rang = bell && Date.now() - new Date(bell.state).getTime() < 3 * 60e3;
    const bri = on.length ? Math.round(on.reduce((s, id) => s + (this._st(id).attributes.brightness || 255), 0) / on.length / 2.55) : 0;
    const chips = [];
    if (temp !== null) chips.push(`<span class="m-chip">${icon('mdi:thermometer')}<b data-count="${temp}" data-digits="1" data-count-key="t-${x(a.id)}">${num(temp)}</b>°</span>`);
    if (hum !== null) chips.push(`<span class="m-chip">${icon('mdi:water-percent')}${num(hum, 0)}%</span>`);
    if (clim) chips.push(`<span class="m-chip is-heat">${icon('mdi:fire')}${num(clim.attributes.temperature)}°</span>`);
    if (fanOn) chips.push(`<span class="m-chip is-on">${icon('mdi:fan', 'is-spin')}An</span>`);
    if (media) chips.push(`<span class="m-chip is-on">${icon('mdi:music-note')}Spielt</span>`);
    if (bell) chips.push(`<span class="m-chip${rang ? ' is-ring' : ''}">${icon('mdi:bell-outline', rang ? 'm-shake' : '')}${x(relTime(bell.state))}</span>`);
    const state = lights.length ? (on.length ? `${on.length} von ${lights.length} Lichtern · ${bri}%` : `${lights.length} ${lights.length === 1 ? 'Licht' : 'Lichter'} aus`) : `${ents.length} ${ents.length === 1 ? 'Gerät' : 'Geräte'}`;
    return `
      <article class="m-room m-anim m-press${on.length ? ' is-lit' : ''}${rang ? ' is-ringing' : ''}" style="--i:${5 + i};--glow:${bri / 100}" data-nav="/raum/${x(a.id)}" tabindex="0" role="link">
        <div class="m-room__glow"></div>
        <div class="m-room__top">
          <span class="m-room__icon">${icon(a.icon)}</span>
          ${this._edit ? `<span class="m-edit-tools"><button class="m-mini" data-move-area="${x(a.id)}" data-dir="-1" aria-label="Nach vorne">${icon('mdi:arrow-left')}</button><button class="m-mini" data-move-area="${x(a.id)}" data-dir="1" aria-label="Nach hinten">${icon('mdi:arrow-right')}</button><button class="m-mini" data-hide-area="${x(a.id)}" aria-label="Ausblenden">${icon('mdi:eye-off-outline')}</button></span>`
            : lights.length ? `<button class="m-switch is-warm${on.length ? ' is-on' : ''}" data-room-toggle="${x(a.id)}" role="switch" aria-checked="${!!on.length}" aria-label="Licht ${x(a.name)}"><span class="m-switch__thumb"></span></button>` : ''}
        </div>
        <div class="m-room__name">${x(a.name)}</div>
        <div class="m-room__state">${state}</div>
        <div class="m-room__chips">${chips.join('')}</div>
      </article>`;
  }

  _renderStatusRow() {
    const m = this._model();
    const parts = [];
    const v = m.vacuums[0];
    if (v) parts.push(this._renderVacuumCard(v, false));
    const playing = m.media.find(id => this._st(id).state === 'playing');
    if (playing) parts.push(this._renderMediaCard(playing));
    else parts.push(this._renderSystemMini());
    return `<div class="m-duo">${parts.join('')}</div>`;
  }

  // ─── ROOMS ─────────────────────────────────────────────────────────────────

  _pageRooms() {
    const m = this._model();
    const ids = m.areas.flatMap(a => a.ents);
    return {
      title: 'Räume', editable: true,
      blocks: [
        { key: 'head', sig: () => 'h' + m.areas.length, render: () => this._head('Räume', `${m.visibleAreas.length} Räume · alles nach Bereich sortiert`) },
        { key: 'grid', live: true, sig: () => this._sigOf(ids) + this._edit + m.visibleAreas.map(a => a.id).join(), render: () => `<div class="m-rooms is-large">${m.visibleAreas.map((a, i) => this._renderRoomCard(a, i)).join('')}</div>${this._edit && m.areas.length !== m.visibleAreas.length ? `<div class="m-hidden-list m-anim" style="--i:9"><span>Ausgeblendet:</span>${m.areas.filter(a => !m.visibleAreas.includes(a)).map(a => `<button class="m-pill m-press" data-show-area="${x(a.id)}">${icon('mdi:eye-outline')}${x(a.name)}</button>`).join('')}</div>` : ''}` },
        { key: 'noroom', live: true, sig: () => this._sigOf(this._unassigned()), render: () => { const ids = this._unassigned(); return ids.length ? `
            <section class="m-group m-anim" style="--i:9"><h3 class="m-label">Ohne Raum · ${ids.length}</h3>
              <p class="m-hint">${icon('mdi:information-outline')}Diese Geräte haben in Home Assistant noch keinen Bereich. Tippe auf das Symbol, um sie in den Einstellungen einem Raum zuzuordnen.</p>
              <div class="m-list is-grid">${ids.map(id => this._renderEntity(id)).join('')}</div></section>` : ''; } },
        { key: 'unassigned', sig: () => 'u', render: () => `<p class="m-hint m-anim" style="--i:10">${icon('mdi:information-outline')}Neue Räume legst du in Home Assistant unter Einstellungen → Bereiche an. Sie erscheinen hier automatisch. <a class="m-link" data-nav="/config/areas/dashboard" href="#">Bereiche öffnen</a></p>` },
      ],
    };
  }

  _unassigned() {
    const m = this._model();
    return m.all.filter(id => ['light', 'switch', 'fan', 'climate', 'media_player', 'cover', 'lock'].includes(domainOf(id)) && !m.areaOf(id) && isAvail(this._st(id)) && !/^switch\.(zigbee2mqtt|.*permit_join|.*_dock_)/.test(id));
  }

  _pageRoom(a) {
    const ents = () => this._roomEntities(a);
    const all = a.ents;
    const { temp, hum } = this._roomTemp(a);
    const groups = () => {
      const e = this._edit ? all : ents();
      const by = (pred) => e.filter(pred);
      return [
        ['Licht', by(id => domainOf(id) === 'light')],
        ['Klima', by(id => domainOf(id) === 'climate')],
        ['Geräte', by(id => ['fan', 'switch', 'cover', 'lock', 'vacuum', 'input_boolean'].includes(domainOf(id)))],
        ['Medien', by(id => domainOf(id) === 'media_player')],
        ['Aktionen', by(id => ['button', 'scene', 'script'].includes(domainOf(id)))],
        ['Kameras', by(id => domainOf(id) === 'camera')],
        ['Sensoren', by(id => ['sensor', 'binary_sensor', 'event'].includes(domainOf(id)))],
      ].filter(([, ids]) => ids.length);
    };
    return {
      title: a.name, editable: true,
      blocks: [
        { key: 'head', sig: () => [temp, hum, this._sigOf(all.filter(id => domainOf(id) === 'light'))].join(), render: () => this._head(a.name,
            [temp !== null ? `${icon('mdi:thermometer')}${num(temp)} °C` : '', hum !== null ? `${icon('mdi:water-percent')}${num(hum, 0)} %` : '', `${all.length} Geräte`].filter(Boolean).map(s => `<span class="m-meta">${s}</span>`).join(''),
            all.some(id => domainOf(id) === 'light') ? `<button class="m-pill m-press${this._roomLit(a) ? ' is-warm' : ''}" data-room-toggle="${x(a.id)}">${icon('mdi:lightbulb-group-outline')}${this._roomLit(a) ? 'Alle aus' : 'Alle an'}</button>` : '') },
        { key: 'groups', live: true, sig: () => this._sigOf(all) + this._edit + JSON.stringify(this._layout.rooms?.[a.id]?.hidden || []), render: () => {
            const gs = groups();
            if (!gs.length) return `<div class="m-empty m-anim">${icon('mdi:package-variant')}In diesem Raum sind keine Geräte. Ordne Geräte in Home Assistant diesem Bereich zu.</div>`;
            return `<div class="m-groups">${gs.map(([title, ids], gi) => `
              <section class="m-group m-anim${title === 'Klima' ? ' is-wide' : ''}" style="--i:${gi + 1}">
                <h3 class="m-label">${title}</h3>
                <div class="m-list">${ids.map(id => this._renderEntity(id, a.id)).join('')}</div>
              </section>`).join('')}</div>`;
          } },
        { key: 'widgets', sig: () => JSON.stringify(this._layout.rooms?.[a.id]?.widgets || []) + this._edit, render: () => this._renderWidgetArea('room:' + a.id) },
      ],
    };
  }

  // ─── entity renderers ──────────────────────────────────────────────────────

  _renderEntity(id, areaId = null) {
    const s = this._st(id);
    if (!s) return '';
    const hidden = areaId && (this._layout.rooms?.[areaId]?.hidden || []).includes(id);
    const editTool = this._edit && areaId ? `<button class="m-mini" data-hide-ent="${x(id)}" data-area="${x(areaId)}" aria-label="${hidden ? 'Einblenden' : 'Ausblenden'}">${icon(hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline')}</button>` : '';
    const wrap = (html) => hidden ? html.replace('class="m-row', 'class="m-row is-hiddenent') : html;
    switch (domainOf(id)) {
      case 'light': return wrap(this._lightRow(s, editTool));
      case 'climate': return wrap(this._climateBlock(s, editTool));
      case 'media_player': return wrap(this._mediaRow(s, editTool));
      case 'camera': return wrap(this._cameraRow(s, editTool));
      case 'vacuum': return wrap(this._simpleRow(s, editTool, `<button class="m-pill m-press" data-nav="/haushalt">Öffnen</button>`));
      case 'cover': return wrap(this._simpleRow(s, editTool, `<span class="m-seg"><button data-cover="open_cover" data-entity="${x(id)}">${icon('mdi:arrow-up')}</button><button data-cover="stop_cover" data-entity="${x(id)}">${icon('mdi:stop')}</button><button data-cover="close_cover" data-entity="${x(id)}">${icon('mdi:arrow-down')}</button></span>`));
      case 'button': {
        const sensitive = /t(ü|ue)r|door|öffnen|unlock/i.test(id + this._name(id));
        return wrap(this._simpleRow(s, editTool, sensitive
          ? `<button class="m-pill m-press m-hold is-inline" data-hold="${x(id)}"><span class="m-hold__ring m-hold__ring--pill"></span><span class="m-hold__hint">Halten</span></button>`
          : `<button class="m-pill m-press" data-press="${x(id)}">Ausführen</button>`, relTime(s.state)));
      }
      case 'scene': case 'script': return wrap(this._simpleRow(s, editTool, `<button class="m-pill m-press" data-run="${x(id)}">${icon('mdi:play')}Start</button>`));
      case 'event': return wrap(this._simpleRow(s, editTool, '', isAvail(s) ? relTime(s.state) : 'Nie'));
      case 'sensor': case 'binary_sensor': return wrap(this._sensorRow(s, editTool));
      default: {
        const toggleable = ['switch', 'fan', 'input_boolean', 'lock', 'automation'].includes(domainOf(id));
        return wrap(this._simpleRow(s, editTool, toggleable && isAvail(s) ? this._switch(id, s.state === 'on' || s.state === 'locked') : ''));
      }
    }
  }

  _switch(id, on, warm = false) { return `<button class="m-switch${warm ? ' is-warm' : ''}${on ? ' is-on' : ''}" data-toggle="${x(id)}" role="switch" aria-checked="${on}" aria-label="${x(this._name(id))}"><span class="m-switch__thumb"></span></button>`; }

  _entityIcon(s) {
    const d = domainOf(s.entity_id);
    const reg = this._hass.entities?.[s.entity_id];
    if (s.attributes.icon || reg?.icon) return s.attributes.icon || reg.icon;
    if (d === 'sensor' || d === 'binary_sensor') return SENSOR_ICON[s.attributes.device_class] || DOMAIN_ICON[d];
    if (d === 'fan') return 'mdi:fan';
    return DOMAIN_ICON[d] || 'mdi:circle-outline';
  }

  _stateLabel(s) {
    if (!isAvail(s)) return 'Nicht erreichbar';
    const d = domainOf(s.entity_id);
    const map = { on: 'An', off: 'Aus', open: 'Offen', closed: 'Geschlossen', locked: 'Verriegelt', unlocked: 'Entriegelt', playing: 'Spielt', paused: 'Pausiert', idle: 'Bereit', home: 'Zuhause', not_home: 'Unterwegs', docked: 'In der Station', cleaning: 'Saugt', heat: 'Heizt' };
    if (d === 'binary_sensor') { const dc = s.attributes.device_class; if (dc === 'motion' || dc === 'occupancy') return s.state === 'on' ? 'Bewegung' : 'Ruhig'; if (dc === 'door' || dc === 'window' || dc === 'opening') return s.state === 'on' ? 'Offen' : 'Zu'; }
    if (s.attributes.device_class === 'timestamp') return relTime(s.state);
    const n = Number(s.state);
    if (s.state !== '' && isFinite(n) && d === 'sensor') return `${num(n, Number.isInteger(n) ? 0 : 1)}${s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : ''}`;
    return map[s.state] || s.state;
  }

  _simpleRow(s, editTool, control, sub) {
    const on = ['on', 'playing', 'open', 'cleaning', 'heat', 'unlocked'].includes(s.state);
    return `
      <div class="m-row${on ? ' is-on' : ''}${isAvail(s) ? '' : ' is-off'}">
        <button class="m-row__icon" data-more="${x(s.entity_id)}" aria-label="Details">${icon(this._entityIcon(s), domainOf(s.entity_id) === 'fan' && on ? 'is-spin' : '')}</button>
        <button class="m-row__name" data-more="${x(s.entity_id)}">${x(s.attributes.friendly_name || s.entity_id)}<small>${x(sub ?? this._stateLabel(s))}</small></button>
        ${control || ''}${editTool}
      </div>`;
  }

  _sensorRow(s, editTool, label) {
    return `
      <div class="m-row is-sensor${isAvail(s) ? '' : ' is-off'}">
        <button class="m-row__icon" data-more="${x(s.entity_id)}">${icon(this._entityIcon(s))}</button>
        <button class="m-row__name" data-more="${x(s.entity_id)}">${x(label || s.attributes.friendly_name || s.entity_id)}</button>
        <span class="m-row__value">${x(this._stateLabel(s))}</span>${editTool}
      </div>`;
  }

  _lightRow(s, editTool = '') {
    const on = s.state === 'on', avail = isAvail(s);
    const pct = on ? Math.max(1, Math.round((s.attributes.brightness ?? 255) / 2.55)) : 0;
    const dim = (s.attributes.supported_color_modes || []).some(m => m !== 'onoff');
    return `
      <div class="m-row m-light${on ? ' is-on' : ''}${avail ? '' : ' is-off'}" style="--pct:${pct}%" ${dim && avail ? `data-slider="${x(s.entity_id)}"` : ''}>
        ${dim && avail ? '<div class="m-light__fill"></div>' : ''}
        <button class="m-row__icon" data-more="${x(s.entity_id)}">${icon(on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline')}</button>
        <span class="m-row__name">${x(s.attributes.friendly_name)}<small>${avail ? (on ? `${pct} %` : 'Aus') : 'Nicht erreichbar'}</small></span>
        ${avail ? this._switch(s.entity_id, on, true) : ''}${editTool}
      </div>`;
  }

  _climateBlock(c, editTool = '') {
    if (!isAvail(c)) return this._simpleRow(c, editTool, '');
    const heat = c.state !== 'off';
    const target = Number(c.attributes.temperature), cur = Number(c.attributes.current_temperature);
    const min = c.attributes.min_temp ?? 5, max = c.attributes.max_temp ?? 30;
    const p = Math.max(0, Math.min(1, (target - min) / (max - min)));
    const R = 54, C = 2 * Math.PI * R, arc = 0.75;
    return `
      <div class="m-row m-climate${heat ? ' is-heat' : ''}">
        <div class="m-dial">
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle class="m-dial__track" cx="64" cy="64" r="${R}" stroke-dasharray="${C * arc} ${C}" transform="rotate(135 64 64)"/>
            <circle class="m-dial__value" cx="64" cy="64" r="${R}" stroke-dasharray="${C * arc * p} ${C}" transform="rotate(135 64 64)"/>
          </svg>
          <div class="m-dial__center"><div class="m-dial__target"><span data-count="${target}" data-digits="1" data-count-key="ct-${x(c.entity_id)}">${num(target)}</span><sup>°</sup></div><div class="m-dial__cur">Ist ${num(cur)}°</div></div>
        </div>
        <div class="m-climate__side">
          <button class="m-row__name" data-more="${x(c.entity_id)}">${x(c.attributes.friendly_name)}<small>${heat ? 'Heizt auf ' + num(target) + ' °C' : 'Aus'}</small></button>
          <div class="m-climate__ctrl">
            <button class="m-icon-btn m-press" data-temp="${x(c.entity_id)}" data-step="-0.5" aria-label="Kälter">${icon('mdi:minus')}</button>
            <button class="m-pill m-press${heat ? ' is-heat' : ''}" data-hvac="${x(c.entity_id)}">${icon(heat ? 'mdi:fire' : 'mdi:power')}${heat ? 'Heizt' : 'Aus'}</button>
            <button class="m-icon-btn m-press" data-temp="${x(c.entity_id)}" data-step="0.5" aria-label="Wärmer">${icon('mdi:plus')}</button>
          </div>
        </div>${editTool}
      </div>`;
  }

  _mediaRow(s, editTool = '') {
    const a = s.attributes, playing = s.state === 'playing';
    const art = a.entity_picture ? `<img class="m-art" src="${x(a.entity_picture)}" alt="">` : `<span class="m-art">${icon('mdi:music-note')}</span>`;
    return `
      <div class="m-row m-media${playing ? ' is-on' : ''}${isAvail(s) ? '' : ' is-off'}">
        <button class="m-media__art" data-more="${x(s.entity_id)}">${art}${playing ? '<span class="m-eq"><i></i><i></i><i></i></span>' : ''}</button>
        <span class="m-row__name">${x(a.media_title || a.friendly_name)}<small>${x(a.media_artist || (a.media_title ? a.friendly_name : this._stateLabel(s)))}</small></span>
        ${isAvail(s) ? `<span class="m-seg"><button data-media="media_previous_track" data-entity="${x(s.entity_id)}" aria-label="Zurück">${icon('mdi:skip-previous')}</button><button data-media="media_play_pause" data-entity="${x(s.entity_id)}" aria-label="Play/Pause">${icon(playing ? 'mdi:pause' : 'mdi:play')}</button><button data-media="media_next_track" data-entity="${x(s.entity_id)}" aria-label="Weiter">${icon('mdi:skip-next')}</button></span>` : ''}${editTool}
      </div>`;
  }

  _cameraRow(s, editTool = '') {
    return `
      <div class="m-row${isAvail(s) ? '' : ' is-off'}">
        <span class="m-row__icon">${icon('mdi:cctv')}</span>
        <span class="m-row__name">${x(s.attributes.friendly_name)}<small>${isAvail(s) ? 'Livebild auf Tipp' : 'Nicht erreichbar'}</small></span>
        ${isAvail(s) ? `<button class="m-pill m-press" data-more="${x(s.entity_id)}">${icon('mdi:play-circle-outline')}Ansehen</button>` : ''}${editTool}
      </div>`;
  }

  // ─── CALENDAR ──────────────────────────────────────────────────────────────

  _pageCalendar() {
    const m = this._model();
    return {
      title: 'Kalender',
      blocks: [
        { key: 'head', sig: () => JSON.stringify(this._layout.hiddenCalendars), render: () => this._head('Kalender', 'Die nächsten fünf Wochen aus allen Kalendern',
            `<div class="m-chips">${m.calendars.filter(c => c !== m.wasteCal).map((c, i) => { const off = this._layout.hiddenCalendars.includes(c); return `<button class="m-filter${off ? '' : ' is-on'}" data-cal="${x(c)}" style="--c:${CAL_COLORS[i % CAL_COLORS.length]}"><i></i>${x(this._name(c))}</button>`; }).join('')}</div>`) },
        { key: 'list', sig: () => JSON.stringify([this._events?.length, this._layout.hiddenCalendars, new Date().getDate()]), render: () => `<div class="m-cal">${this._renderAgendaCard(80, true)}${this._renderWasteCard()}</div>` },
      ],
    };
  }

  _calColor(cal) { const m = this._model(); const i = m.calendars.filter(c => c !== m.wasteCal).indexOf(cal); return CAL_COLORS[(i < 0 ? 0 : i) % CAL_COLORS.length]; }

  _renderAgendaCard(limit = 6, full = false) {
    const ev = this._events;
    const now = new Date();
    const list = (ev || []).filter(e => !e.waste && !this._layout.hiddenCalendars.includes(e.cal) && (e.allDay ? e.end > new Date(now.toDateString()) : e.end >= now)).slice(0, limit);
    const groups = [];
    for (const e of list) { const label = dayLabel(e.start < now ? now : e.start); let g = groups.find(g => g.label === label); if (!g) groups.push(g = { label, items: [] }); g.items.push(e); }
    const m = this._model();
    const waste = full ? [] : (ev || []).filter(e => e.waste).slice(0, 3);
    return `
      <div class="m-card m-anim" style="--i:3">
        <div class="m-card__head"><h3>${icon('mdi:calendar-blank-outline')}${full ? 'Agenda' : 'Als Nächstes'}</h3>${full ? '' : `<a class="m-link" data-nav="/kalender" href="#">Kalender ${icon('mdi:chevron-right')}</a>`}</div>
        ${ev === null ? '<div class="m-skel"></div><div class="m-skel"></div><div class="m-skel is-short"></div>' : groups.length ? groups.map(g => `
          <div class="m-agenda__day">${x(g.label)}</div>
          ${g.items.map(e => `<div class="m-agenda__item"><span class="m-agenda__time">${e.allDay ? 'Ganztägig' : x(e.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))}</span><span class="m-agenda__bar" style="--c:${this._calColor(e.cal)}"></span><span class="m-agenda__title">${x(e.summary)}<small>${x(this._name(e.cal))}${e.location ? ' · ' + x(e.location) : ''}</small></span></div>`).join('')}`).join('')
          : `<div class="m-empty">${icon('mdi:calendar-check-outline')}Keine Termine</div>`}
        ${waste.length ? `<div class="m-waste">${waste.map(e => this._wasteChip(e)).join('')}</div>` : ''}
      </div>`;
  }

  _wasteChip(e) { const w = WASTE.find(([re]) => re.test(e.summary)); return `<span class="m-waste__chip" style="--c:${w ? w[1] : 'var(--m-muted)'}"><i></i>${x(w ? w[2] : e.summary)} · ${x(dayLabel(e.start, false))}</span>`; }

  _renderWasteCard() {
    const m = this._model();
    const list = (this._events || []).filter(e => e.waste).slice(0, 8);
    if (!m.wasteCal) return '';
    return `
      <div class="m-card m-anim" style="--i:4">
        <div class="m-card__head"><h3>${icon('mdi:delete-outline')}Müllabfuhr</h3></div>
        ${list.length ? list.map(e => { const w = WASTE.find(([re]) => re.test(e.summary)); return `<div class="m-waste__row"><i style="--c:${w ? w[1] : 'var(--m-muted)'}"></i><span>${x(e.summary)}</span><em>${x(dayLabel(e.start))}</em></div>`; }).join('') : `<div class="m-empty">${icon('mdi:check')}Keine Abholung geplant</div>`}
      </div>`;
  }

  // ─── LISTS ─────────────────────────────────────────────────────────────────

  _pageLists(sub) {
    const m = this._model();
    const tabs = [...m.todos.map(id => ({ id, label: this._name(id), icon: /einkauf/i.test(this._name(id)) ? 'mdi:cart-outline' : 'mdi:format-list-checks' })), ...(customElements.get('alh-meal-card') ? [{ id: 'mahlzeiten', label: 'Mahlzeiten', icon: 'mdi:food-outline' }] : [])]
      .filter(t => !/rezept|mahlzeitenplan|essensplan|alh_/i.test(t.id));
    const cur = tabs.find(t => t.id === sub) || tabs.find(t => t.id === m.tasks) || tabs[0];
    if (cur && cur.id !== 'mahlzeiten') this._ensureTodos([cur.id]);
    return {
      title: 'Listen',
      blocks: [
        { key: 'head', sig: () => cur?.id + m.todos.map(id => this._st(id)?.state).join(), render: () => this._head('Listen', '', '') + `
          <div class="m-tabs m-anim" style="--i:1">${tabs.map(t => `<a class="m-tabbtn${t.id === cur?.id ? ' is-active' : ''}" data-nav="/listen/${x(t.id)}" href="#">${icon(t.icon)}${x(t.label)}${t.id !== 'mahlzeiten' && Number(this._st(t.id)?.state) ? `<em>${this._st(t.id).state}</em>` : ''}</a>`).join('')}</div>` },
        cur?.id === 'mahlzeiten'
          ? { key: 'meal', sig: () => 'meal', render: () => `<div class="m-card m-anim is-flush" style="--i:2"><div class="m-widget" data-wid="__meal"></div></div>` }
          : { key: 'list', sig: () => JSON.stringify(this._todos[cur?.id] || null), render: () => cur ? this._renderTodoCard(cur.id, { full: true }) : `<div class="m-empty">${icon('mdi:format-list-checks')}Keine Listen gefunden</div>` },
      ],
    };
  }

  _renderTodoCard(id, { compact = false, full = false } = {}) {
    const items = this._todos[id];
    const open = (items || []).filter(i => i.status !== 'completed');
    const done = (items || []).filter(i => i.status === 'completed');
    const shown = compact ? open.slice(0, 6) : open;
    const row = (t, isDone = false) => `
      <div class="m-task${isDone ? ' is-done is-static' : ''}" data-task="${x(t.uid)}">
        <button class="m-check" data-done="${x(t.uid)}" data-list="${x(id)}" data-status="${isDone ? 'needs_action' : 'completed'}" aria-label="${x(t.summary)} ${isDone ? 'wieder öffnen' : 'erledigen'}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
        <span class="m-task__text">${x(t.summary)}${t.description ? `<small>${x(t.description)}</small>` : ''}${t.due ? `<small class="m-due">${icon('mdi:calendar-outline')}${x(dayLabel(t.due))}</small>` : ''}</span>
        ${full ? `<button class="m-mini m-task__del" data-del-item="${x(t.uid)}" data-list="${x(id)}" aria-label="Löschen">${icon('mdi:close')}</button>` : ''}
      </div>`;
    return `
      <div class="m-card m-anim" style="--i:${compact ? 4 : 2}">
        <div class="m-card__head"><h3>${icon('mdi:checkbox-marked-circle-outline')}${x(this._name(id))}</h3><span class="m-count">${open.length}</span>${compact ? `<a class="m-link" data-nav="/listen/${x(id)}" href="#">Alle ${icon('mdi:chevron-right')}</a>` : ''}</div>
        <form class="m-add" data-add-item="${x(id)}">${icon('mdi:plus')}<input class="m-add__input" placeholder="Neuer Eintrag" aria-label="Neuer Eintrag" /></form>
        <div class="m-tasks">
          ${items === undefined ? '<div class="m-skel"></div><div class="m-skel"></div>' : shown.length ? shown.map(t => row(t)).join('') : `<div class="m-empty">${icon('mdi:party-popper')}Alles erledigt</div>`}
          ${compact && open.length > shown.length ? `<a class="m-link m-more" data-nav="/listen/${x(id)}" href="#">+${open.length - shown.length} weitere</a>` : ''}
        </div>
        ${full && done.length ? `<details class="m-done"><summary>Erledigt (${done.length})</summary>${done.slice(0, 30).map(t => row(t, true)).join('')}</details>` : ''}
      </div>`;
  }

  // ─── DEVICES ───────────────────────────────────────────────────────────────

  _pageDevices(sub) {
    const m = this._model();
    const tabs = [['licht', 'Licht', 'mdi:lightbulb-outline', m.lights], ['klima', 'Klima', 'mdi:thermostat', m.climates], ['medien', 'Medien', 'mdi:speaker', m.media], ['kameras', 'Kameras', 'mdi:cctv', m.cameras]].filter(t => t[3].length);
    const cur = tabs.find(t => t[0] === sub) || tabs[0];
    const byRoom = (ids) => {
      const groups = new Map();
      for (const id of ids) { const a = m.areas.find(a => a.id === m.areaOf(id)); const k = a ? a.name : 'Ohne Raum'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(id); }
      return [...groups.entries()].sort((a, b) => (a[0] === 'Ohne Raum') - (b[0] === 'Ohne Raum') || a[0].localeCompare(b[0], 'de'));
    };
    return {
      title: 'Geräte',
      blocks: [
        { key: 'head', sig: () => cur?.[0] + this._sigOf(m.lights), render: () => this._head('Geräte', cur?.[0] === 'licht' ? `${m.lights.filter(id => this._st(id).state === 'on').length} von ${m.lights.length} Lichtern an` : '',
            cur?.[0] === 'licht' && m.lights.some(id => this._st(id).state === 'on') ? `<button class="m-pill m-press is-warm" data-action="all-off">${icon('mdi:power')}Alle aus</button>` : '') +
            `<div class="m-tabs m-anim" style="--i:1">${tabs.map(t => `<a class="m-tabbtn${t === cur ? ' is-active' : ''}" data-nav="/geraete/${t[0]}" href="#">${icon(t[2])}${t[1]}<em>${t[3].length}</em></a>`).join('')}</div>` },
        { key: 'list', live: true, sig: () => this._sigOf(cur ? cur[3] : []) + cur?.[0], render: () => cur ? `<div class="m-groups">${byRoom(cur[3]).map(([room, ids], i) => `
            <section class="m-group m-anim${cur[0] === 'klima' ? ' is-wide' : ''}" style="--i:${i + 2}"><h3 class="m-label">${x(room)}</h3><div class="m-list">${ids.map(id => this._renderEntity(id)).join('')}</div></section>`).join('')}</div>` : '' },
      ],
    };
  }

  // ─── HOUSEHOLD ─────────────────────────────────────────────────────────────

  _pageHousehold() {
    const m = this._model();
    const batteries = () => Object.values(this._hass.states).filter(s => s.attributes.device_class === 'battery' && domainOf(s.entity_id) === 'sensor' && isAvail(s)).sort((a, b) => Number(a.state) - Number(b.state));
    return {
      title: 'Haushalt',
      blocks: [
        { key: 'head', sig: () => 'h', render: () => this._head('Haushalt', 'Saugroboter, Verbrauchsteile und Akkus') },
        { key: 'vac', sig: () => this._sigOf([...m.vacuums, ...this._vacSensors(m.vacuums[0]).map(s => s.entity_id)]), render: () => m.vacuums.length ? `<div class="m-duo">${m.vacuums.map(v => this._renderVacuumCard(v, true)).join('')}${this._renderConsumables(m.vacuums[0])}</div>` : `<div class="m-empty">${icon('mdi:robot-vacuum')}Kein Saugroboter gefunden</div>` },
        { key: 'bat', sig: () => batteries().map(s => s.state).join(), render: () => { const b = batteries(); return b.length ? `<div class="m-card m-anim" style="--i:4"><div class="m-card__head"><h3>${icon('mdi:battery-outline')}Akkus</h3><span class="m-count">${b.length}</span></div><div class="m-sys">${b.map(s => this._meter(s.attributes.friendly_name, Number(s.state), '%', this._entityIcon(s), Number(s.state) < 20, 'bat-' + s.entity_id, s.entity_id)).join('')}</div></div>` : ''; } },
      ],
    };
  }

  _vacSensors(v) {
    if (!v) return [];
    const base = v.split('.')[1].replace(/_\d+$/, '');
    return Object.values(this._hass.states).filter(s => /^(sensor|binary_sensor)\./.test(s.entity_id) && s.entity_id.includes(base));
  }

  _renderVacuumCard(id, full) {
    const v = this._st(id);
    const sens = this._vacSensors(id);
    const find = (re) => sens.find(s => re.test(s.entity_id));
    const bat = Number(find(/batter/)?.state), prog = Number(find(/fortschritt|progress/)?.state);
    const room = find(/aktueller_raum|current_room/);
    const cleaning = ['cleaning', 'returning'].includes(v.state);
    return `
      <div class="m-card m-anim" style="--i:9">
        <div class="m-card__head"><h3>${icon('mdi:robot-vacuum')}${x(v.attributes.friendly_name)}</h3><span class="m-status${cleaning ? ' is-live' : ''}"><i></i>${x(this._vacLabel(v))}</span></div>
        <div class="m-vac">
          ${isFinite(bat) ? this._meter('Akku', bat, '%', 'mdi:battery-outline', bat < 20, 'vac-bat-' + id) : ''}
          ${cleaning && isFinite(prog) ? this._meter(`Fortschritt${room && isAvail(room) ? ' · ' + room.state : ''}`, prog, '%', 'mdi:progress-clock', false, 'vac-prog-' + id, null, true) : ''}
        </div>
        <div class="m-card__actions">
          ${cleaning ? `<button class="m-pill m-press" data-vac="pause" data-entity="${x(id)}">${icon('mdi:pause')}Pause</button><button class="m-pill m-press" data-vac="return_to_base" data-entity="${x(id)}">${icon('mdi:home-import-outline')}Zur Station</button>`
            : `<button class="m-pill m-press is-primary" data-vac="start" data-entity="${x(id)}">${icon('mdi:play')}Saugen starten</button>${full ? `<button class="m-pill m-press" data-vac="locate" data-entity="${x(id)}">${icon('mdi:map-marker-outline')}Finden</button>` : ''}`}
          ${full ? '' : `<a class="m-link" data-nav="/haushalt" href="#">Details ${icon('mdi:chevron-right')}</a>`}
        </div>
      </div>`;
  }

  _renderConsumables(id) {
    const rows = this._vacSensors(id).filter(s => /verbleibend|remaining|filter|burste|bürste|sensor_time/i.test(s.entity_id) && isAvail(s));
    if (!rows.length) return '';
    return `
      <div class="m-card m-anim" style="--i:10">
        <div class="m-card__head"><h3>${icon('mdi:wrench-outline')}Verbrauchsteile</h3></div>
        <div class="m-sys">${rows.map(s => `<div class="m-sys__row is-plain"><span class="m-row__icon">${icon('mdi:timer-sand')}</span><span class="m-sys__name">${x((s.attributes.friendly_name || '').replace(/^.*?(Verbleibende|Remaining)/i, '$1'))}</span><span class="m-sys__val">${x(this._stateLabel(s))}</span></div>`).join('')}</div>
      </div>`;
  }

  _meter(name, val, unit, ic, warn, key, entity = null, accent = false) {
    return `
      <div class="m-sys__row${warn ? ' is-warn' : ''}">
        <span class="m-row__icon">${icon(ic)}</span>
        ${entity ? `<button class="m-sys__name" data-more="${x(entity)}">${x(name)}</button>` : `<span class="m-sys__name">${x(name)}</span>`}
        <span class="m-sys__val"><b data-count="${val}" data-count-key="${x(key)}">${num(val, 0)}</b>${x(unit)}</span>
        <span class="m-bar${warn ? ' is-warn' : accent ? ' is-accent' : ''}"><i style="--w:${Math.max(0, Math.min(100, val))}%"></i></span>
      </div>`;
  }

  // ─── MEDIA ─────────────────────────────────────────────────────────────────

  _renderMediaCard(id) {
    return `<div class="m-card m-anim" style="--i:10"><div class="m-card__head"><h3>${icon('mdi:music-note')}Jetzt läuft</h3></div><div class="m-list">${this._mediaRow(this._st(id))}</div></div>`;
  }

  // ─── AUTOMATIONS ───────────────────────────────────────────────────────────

  _pageAutomations() {
    const m = this._model();
    const ids = [...m.automations, ...m.scripts, ...m.scenes];
    return {
      title: 'Automationen',
      blocks: [
        { key: 'head', sig: () => 'h', render: () => this._head('Automationen', `${m.automations.length} Automationen · ${m.scripts.length} Skripte · ${m.scenes.length} Szenen`, `<button class="m-pill m-press" data-nav="/config/automation/dashboard">${icon('mdi:plus')}In HA erstellen</button>`) },
        { key: 'list', sig: () => this._sigOf(ids) + ids.map(id => this._st(id).attributes.last_triggered).join(), render: () => `<div class="m-groups">
          ${m.automations.length ? `<section class="m-group m-anim is-wide" style="--i:1"><h3 class="m-label">Automationen</h3><div class="m-list">${m.automations.map(id => { const s = this._st(id); return `
            <div class="m-row${s.state === 'on' ? ' is-on' : ''}">
              <span class="m-row__icon">${icon('mdi:robot-outline')}</span>
              <button class="m-row__name" data-more="${x(id)}">${x(s.attributes.friendly_name)}<small>${s.attributes.last_triggered ? 'Zuletzt ' + x(relTime(s.attributes.last_triggered)) : 'Noch nie ausgelöst'}</small></button>
              <button class="m-icon-btn m-press" data-run="${x(id)}" aria-label="Jetzt ausführen" title="Jetzt ausführen">${icon('mdi:play')}</button>
              ${this._switch(id, s.state === 'on')}
            </div>`; }).join('')}</div></section>` : ''}
          ${m.scripts.length ? `<section class="m-group m-anim" style="--i:2"><h3 class="m-label">Skripte</h3><div class="m-list">${m.scripts.map(id => this._renderEntity(id)).join('')}</div></section>` : ''}
          ${m.scenes.length ? `<section class="m-group m-anim" style="--i:3"><h3 class="m-label">Szenen</h3><div class="m-list">${m.scenes.map(id => this._renderEntity(id)).join('')}</div></section>` : ''}
          ${!ids.length ? `<div class="m-empty">${icon('mdi:robot-outline')}Noch keine Automationen</div>` : ''}
        </div>` },
      ],
    };
  }

  // ─── SYSTEM ────────────────────────────────────────────────────────────────

  _systemDevices() {
    // entities without area, grouped by device — NAS, phones, bridges …
    const h = this._hass, m = this._model();
    const groups = new Map();
    for (const id of m.all) {
      if (m.areaOf(id) || !['sensor', 'binary_sensor', 'switch'].includes(domainOf(id))) continue;
      const e = h.entities[id]; const dev = e?.device_id ? h.devices[e.device_id] : null;
      if (!dev) continue;
      const name = dev.name_by_user || dev.name;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(id);
    }
    return [...groups.entries()].filter(([, ids]) => ids.some(id => isAvail(this._st(id)))).sort((a, b) => b[1].length - a[1].length);
  }

  _pageSystem() {
    const m = this._model();
    const backups = () => m.all.filter(id => /^sensor\.backup_/.test(id));
    return {
      title: 'System',
      blocks: [
        { key: 'head', sig: () => this._hass.config.version, render: () => this._head('System', `Home Assistant ${x(this._hass.config.version)} · ${x(this._hass.config.location_name || '')}`, `<button class="m-pill m-press" data-nav="/config/dashboard">${icon('mdi:cog-outline')}HA-Einstellungen</button>`) },
        { key: 'top', sig: () => this._sigOf([...m.updates, ...backups()]), render: () => {
            const pending = m.updates.filter(id => this._st(id).state === 'on');
            return `<div class="m-duo">
              <div class="m-card m-anim" style="--i:1"><div class="m-card__head"><h3>${icon('mdi:package-up')}Updates</h3><span class="m-count${pending.length ? ' is-accent' : ''}">${pending.length}</span></div>
                ${pending.length ? `<div class="m-list">${pending.map(id => { const s = this._st(id); return `<div class="m-row"><span class="m-row__icon">${icon('mdi:package-up')}</span><button class="m-row__name" data-more="${x(id)}">${x(s.attributes.title || s.attributes.friendly_name)}<small>${x(s.attributes.installed_version || '')} → ${x(s.attributes.latest_version || '')}</small></button></div>`; }).join('')}</div><div class="m-card__actions"><button class="m-pill m-press is-primary" data-nav="/config/updates">Updates öffnen</button></div>`
                  : `<div class="m-empty">${icon('mdi:check-circle-outline')}Alles aktuell</div>`}</div>
              <div class="m-card m-anim" style="--i:2"><div class="m-card__head"><h3>${icon('mdi:backup-restore')}Backups</h3></div>
                ${backups().length ? `<div class="m-list">${backups().map(id => this._sensorRow(this._st(id), '', this._shortName(this._name(id), 'Backup'))).join('')}</div>` : `<div class="m-empty">Keine Backup-Sensoren</div>`}
                <div class="m-card__actions"><button class="m-pill m-press" data-nav="/config/backup">Backups öffnen</button></div></div>
            </div>`; } },
        { key: 'devices', sig: () => this._sigOf(this._systemDevices().flatMap(([, ids]) => ids)), render: () => `<div class="m-groups">${this._systemDevices().map(([name, ids], i) => `
            <section class="m-group m-anim" style="--i:${i + 3}"><h3 class="m-label">${x(name)}</h3><div class="m-list">${ids.filter(id => isAvail(this._st(id))).slice(0, 12).map(id => this._systemRow(id, name)).join('')}</div></section>`).join('')}</div>` },
      ],
    };
  }

  _systemRow(id, device = '') {
    const s = this._st(id);
    const unit = s.attributes.unit_of_measurement;
    const n = Number(s.state);
    const name = this._shortName(s.attributes.friendly_name || id, device);
    const load = /cpu|speicher|volume|disk|memory|auslastung|ram/i.test(id + name);
    if (unit === '%' && isFinite(n)) return `<div class="m-row is-meter">${this._meter(name, n, '%', this._entityIcon(s), load && n >= 90, 'sys-' + id, id)}</div>`;
    return this._sensorRow(s, '', name);
  }

  // "NAS-FH CPU-Auslastung" under the "NAS-FH" heading → "CPU-Auslastung"
  _shortName(name, prefix) {
    if (prefix && name.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) {
      const rest = name.slice(prefix.length + 1).replace(/^[(]([^)]+)[)]\s*/, '$1 · ');
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return name;
  }

  _renderSystemMini() {
    const devs = this._systemDevices();
    const isPct = (id) => this._st(id).attributes.unit_of_measurement === '%' && isFinite(Number(this._st(id).state));
    const ranked = devs.flatMap(([, ids]) => ids).filter(isPct)
      .map(id => [/(cpu|prozessor).*(gesamt|total)|speichernutzung|memory|volume.*nutzung|disk|ram/i.test(id + this._name(id)) ? 0 : /cpu|speicher|auslastung|batter/i.test(id + this._name(id)) ? 1 : 2, id])
      .filter(([r]) => r < 2).sort((a, b) => a[0] - b[0]).map(([, id]) => id);
    const pct = ranked.slice(0, 4);
    return `
      <div class="m-card m-anim" style="--i:10">
        <div class="m-card__head"><h3>${icon('mdi:server-outline')}System</h3><a class="m-link" data-nav="/system" href="#">Details ${icon('mdi:chevron-right')}</a></div>
        <div class="m-sys">${pct.map(id => { const s = this._st(id); const n = Number(s.state); return this._meter(s.attributes.friendly_name, n, '%', this._entityIcon(s), n >= 90, 'mini-' + id, id); }).join('') || `<div class="m-empty">${icon('mdi:check-circle-outline')}Alles im grünen Bereich</div>`}</div>
      </div>`;
  }

  // ─── SETTINGS ──────────────────────────────────────────────────────────────

  _pageSettings() {
    const m = this._model();
    const opt = (ids, cur) => ids.map(id => `<option value="${x(id)}"${id === cur ? ' selected' : ''}>${x(this._name(id))}</option>`).join('');
    return {
      title: 'Einstellungen',
      blocks: [
        { key: 'head', sig: () => 'h', render: () => this._head('Einstellungen', `Meridian ${VERSION}`) },
        { key: 'form', sig: () => JSON.stringify(this._layout) + m.calendars.join() + m.todos.join(), render: () => `
          <div class="m-settings">
            <section class="m-card m-anim" style="--i:1">
              <div class="m-card__head"><h3>${icon('mdi:monitor')}Darstellung</h3></div>
              <label class="m-setting"><span><b>Vollbild</b><small>Blendet die Home-Assistant-Seitenleiste aus. Über „Home Assistant“ in der Navigation kommst du jederzeit zurück.</small></span>${this._switch('__fullscreen', this._layout.fullscreen)}</label>
              <p class="m-hint">${icon('mdi:palette-outline')}Farben und Hell/Dunkel kommen aus dem Theme „Meridian“ – einstellbar in deinem <a class="m-link" data-nav="/profile/general" href="#">HA-Profil</a>.</p>
            </section>
            <section class="m-card m-anim" style="--i:2">
              <div class="m-card__head"><h3>${icon('mdi:format-list-checks')}Listen &amp; Kalender</h3></div>
              <label class="m-setting"><span><b>Aufgabenliste</b><small>Wird auf der Übersicht gezeigt</small></span><select class="m-select" data-setting="tasks">${opt(m.todos, m.tasks)}</select></label>
              <label class="m-setting"><span><b>Einkaufsliste</b><small>Für die Schnellaktion „Einkauf“</small></span><select class="m-select" data-setting="shopping"><option value="">–</option>${opt(m.todos, m.shopping)}</select></label>
              <label class="m-setting"><span><b>Müllkalender</b><small>Termine erscheinen als Abhol-Chips</small></span><select class="m-select" data-setting="wasteCalendar"><option value="">–</option>${opt(m.calendars, m.wasteCal)}</select></label>
            </section>
            <section class="m-card m-anim" style="--i:3">
              <div class="m-card__head"><h3>${icon('mdi:floor-plan')}Räume</h3></div>
              <div class="m-list">${m.areas.map(a => { const hid = this._layout.hiddenAreas.includes(a.id); return `<div class="m-row${hid ? ' is-hiddenent' : ''}"><span class="m-row__icon">${icon(a.icon)}</span><span class="m-row__name">${x(a.name)}<small>${a.ents.length} Geräte</small></span><button class="m-mini" data-move-area="${x(a.id)}" data-dir="-1" aria-label="Nach oben">${icon('mdi:arrow-up')}</button><button class="m-mini" data-move-area="${x(a.id)}" data-dir="1" aria-label="Nach unten">${icon('mdi:arrow-down')}</button><button class="m-mini" data-${hid ? 'show' : 'hide'}-area="${x(a.id)}" aria-label="${hid ? 'Einblenden' : 'Ausblenden'}">${icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline')}</button></div>`; }).join('')}</div>
            </section>
            <section class="m-card m-anim" style="--i:4">
              <div class="m-card__head"><h3>${icon('mdi:restore')}Zurücksetzen</h3></div>
              <p class="m-hint">Setzt Widgets, ausgeblendete Geräte und Reihenfolgen auf den Standard zurück.</p>
              <div class="m-card__actions"><button class="m-pill m-press is-danger" data-action="reset">Layout zurücksetzen</button></div>
            </section>
          </div>` },
      ],
    };
  }

  // ─── widgets (any Lovelace card) ───────────────────────────────────────────

  _widgetList(scope) {
    if (scope === 'home') return this._layout.home.widgets;
    const area = scope.slice(5);
    this._layout.rooms[area] ||= {};
    return (this._layout.rooms[area].widgets ||= []);
  }

  _renderWidgetArea(scope) {
    const list = scope === 'home' ? this._layout.home.widgets : (this._layout.rooms?.[scope.slice(5)]?.widgets || []);
    if (!list.length && !this._edit) return '';
    return `
      ${list.length || this._edit ? `<div class="m-sectionhead m-anim" style="--i:11"><h2>Widgets</h2>${this._edit ? '' : `<span>${list.length}</span>`}</div>` : ''}
      <div class="m-widgets">
        ${list.map(w => `<div class="m-widget-wrap m-anim" style="--i:12">${this._edit ? `<button class="m-widget-del m-press" data-del-widget="${x(w.id)}" data-scope="${x(scope)}" aria-label="Entfernen">${icon('mdi:close')}</button>` : ''}<div class="m-widget" data-wid="${x(w.id)}"></div></div>`).join('')}
        ${this._edit ? `<button class="m-widget-add m-press m-anim" style="--i:13" data-add-widget="${x(scope)}">${icon('mdi:plus')}<span>Widget hinzufügen</span><small>Gerät oder beliebige HA-Karte</small></button>` : ''}
      </div>`;
  }

  async _attachWidgets(root) {
    const slots = root.querySelectorAll('[data-wid]');
    if (!slots.length) return;
    const helpers = await (window.loadCardHelpers ? window.loadCardHelpers() : null);
    for (const slot of slots) {
      const wid = slot.dataset.wid;
      let el = this._widgets.get(wid);
      if (!el) {
        const conf = wid === '__meal' ? { type: 'custom:alh-meal-card', title: 'Mahlzeitenplaner' } : this._findWidget(wid);
        if (!conf) continue;
        const cardConf = conf.type ? conf : conf.config || { type: 'tile', entity: conf.entity };
        try { el = helpers ? helpers.createCardElement(cardConf) : document.createElement('div'); }
        catch (e) { el = document.createElement('div'); el.textContent = 'Karte konnte nicht geladen werden'; }
        this._widgets.set(wid, el);
      }
      el.hass = this._hass;
      slot.replaceChildren(el);
    }
  }

  _findWidget(wid) {
    const all = [...this._layout.home.widgets, ...Object.values(this._layout.rooms || {}).flatMap(r => r.widgets || [])];
    return all.find(w => w.id === wid);
  }

  // ─── overlays (sheets, palette) ────────────────────────────────────────────

  _renderOverlay() {
    const el = this.shadowRoot.querySelector('[data-slot="overlay"]');
    const sig = JSON.stringify([this._sheet, this._palette?.q, this._palette?.i]);
    if (this._sigs.overlay === sig) return;
    const wasOpen = !!el.firstElementChild;
    this._sigs.overlay = sig;
    if (!this._sheet && !this._palette) { el.innerHTML = ''; return; }
    if (this._palette) {
      const keep = el.querySelector('.m-palette');
      const results = this._paletteResults();
      const list = results.map((r, i) => `<button class="m-pal__item${i === this._palette.i ? ' is-active' : ''}" data-pal="${i}">${icon(r.icon)}<span>${x(r.label)}<small>${x(r.sub || '')}</small></span>${r.toggle ? `<em>${x(r.state)}</em>` : ''}</button>`).join('') || `<div class="m-empty">${icon('mdi:magnify-close')}Nichts gefunden</div>`;
      if (keep) { keep.querySelector('.m-pal__list').innerHTML = list; return; }
      el.innerHTML = `<div class="m-scrim" data-close></div><div class="m-palette" role="dialog" aria-label="Suche">
        <div class="m-pal__input">${icon('mdi:magnify')}<input class="m-pal__q" placeholder="Seite, Raum oder Gerät suchen…" value="${x(this._palette.q)}" autocomplete="off"/><kbd>esc</kbd></div>
        <div class="m-pal__list">${list}</div></div>`;
      setTimeout(() => el.querySelector('.m-pal__q')?.focus(), 30);
      return;
    }
    if (this._sheet.type === 'more-nav') {
      el.innerHTML = `<div class="m-scrim" data-close></div><div class="m-sheet" role="dialog"><div class="m-sheet__grab"></div>
        <div class="m-morenav">${[...NAV.filter(n => !MOBILE_TABS.includes(n.path)), { path: '/einstellungen', label: 'Einstellungen', icon: 'mdi:cog-outline' }, { path: '/config/dashboard', label: 'Home Assistant', icon: 'mdi:home-assistant' }].map(n => `<button class="m-morenav__item m-press" data-nav="${n.path}">${icon(n.icon)}<span>${n.label}</span></button>`).join('')}
        <button class="m-morenav__item m-press" data-action="edit">${icon('mdi:pencil-outline')}<span>${this._edit ? 'Fertig' : 'Anpassen'}</span></button></div></div>`;
      return;
    }
    if (this._sheet.type === 'add-widget') {
      const q = (this._sheet.q || '').toLowerCase();
      const ents = this._model().all.filter(id => !q || (id + this._name(id)).toLowerCase().includes(q)).slice(0, 40);
      const keep = el.querySelector('.m-sheet [data-ent-list]');
      const listHtml = ents.map(id => `<button class="m-pal__item" data-pick-ent="${x(id)}">${icon(this._entityIcon(this._st(id)))}<span>${x(this._name(id))}<small>${x(id)}</small></span></button>`).join('');
      if (keep && wasOpen) { keep.innerHTML = listHtml; return; }
      el.innerHTML = `<div class="m-scrim" data-close></div><div class="m-sheet is-wide" role="dialog" aria-label="Widget hinzufügen">
        <div class="m-sheet__head"><div><div class="m-eyebrow">Widget hinzufügen</div><h2 class="m-sheet__title">Was soll hierhin?</h2></div><button class="m-icon-btn m-press" data-close aria-label="Schließen">${icon('mdi:close')}</button></div>
        <div class="m-label">Gerät</div>
        <div class="m-pal__input is-boxed">${icon('mdi:magnify')}<input class="m-widget-q" placeholder="Gerät suchen…" value="${x(this._sheet.q || '')}" autocomplete="off"/></div>
        <div class="m-pal__list is-short" data-ent-list>${listHtml}</div>
        <div class="m-label">Oder beliebige HA-Karte (YAML oder JSON)</div>
        <textarea class="m-code" placeholder="type: custom:mushroom-light-card&#10;entity: light.wohnzimmer" spellcheck="false">${x(this._sheet.code || '')}</textarea>
        ${this._sheet.error ? `<div class="m-error">${x(this._sheet.error)}</div>` : ''}
        <div class="m-card__actions"><button class="m-pill m-press is-primary" data-action="add-code">Karte einfügen</button></div>
      </div>`;
    }
  }

  _openPalette() { this._palette = { q: '', i: 0 }; this._sigs.overlay = null; this._update(); }

  _paletteResults() {
    const q = (this._palette?.q || '').toLowerCase().trim();
    const m = this._model();
    const pages = [...NAV, { path: '/einstellungen', label: 'Einstellungen', icon: 'mdi:cog-outline' }].map(n => ({ label: n.label, sub: 'Seite', icon: n.icon, nav: n.path }));
    const rooms = m.areas.map(a => ({ label: a.name, sub: 'Raum', icon: a.icon, nav: '/raum/' + a.id }));
    const ents = m.all.filter(id => ['light', 'switch', 'fan', 'climate', 'media_player', 'cover', 'lock', 'scene', 'script', 'vacuum', 'camera', 'sensor', 'binary_sensor', 'automation', 'todo', 'button'].includes(domainOf(id)))
      .map(id => { const s = this._st(id); const tg = ['light', 'switch', 'fan', 'automation'].includes(domainOf(id)) && isAvail(s); const a = m.areas.find(a => a.id === m.areaOf(id)); return { label: this._name(id), sub: [a?.name, this._stateLabel(s)].filter(Boolean).join(' · '), icon: this._entityIcon(s), entity: id, toggle: tg, state: tg ? (s.state === 'on' ? 'An' : 'Aus') : '' }; });
    const all = [...pages, ...rooms, ...ents];
    if (!q) return [...pages, ...rooms].slice(0, 12);
    const score = (r) => { const l = r.label.toLowerCase(); return l.startsWith(q) ? 0 : l.includes(q) ? 1 : (r.sub || '').toLowerCase().includes(q) ? 2 : 9; };
    return all.map(r => [score(r), r]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).slice(0, 14).map(([, r]) => r);
  }

  _palettePick(i) {
    const r = this._paletteResults()[i];
    if (!r) return;
    if (r.nav) { this._palette = null; this._go(r.nav); this._update(); return; }
    if (r.toggle) { this._svc(domainOf(r.entity) === 'automation' ? 'automation' : 'homeassistant', 'toggle', {}, { entity_id: r.entity }); this._sigs.overlay = null; setTimeout(() => this._update(), 300); return; }
    this._palette = null; this._update();
    this._more(r.entity);
  }

  _more(id) { this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true })); }

  _toast(msg, err = false) {
    const el = this.shadowRoot.querySelector('[data-slot="toast"]');
    if (!el) return;
    el.innerHTML = `<div class="m-toast__in${err ? ' is-err' : ''}">${icon(err ? 'mdi:alert-circle-outline' : 'mdi:check-circle-outline')}${x(msg)}</div>`;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.innerHTML = ''; }, 2600);
  }

  // ─── events (delegated) ────────────────────────────────────────────────────

  _onClick(e) {
    const t = e.target.closest('[data-nav],[data-more],[data-action],[data-toggle],[data-room-toggle],[data-temp],[data-hvac],[data-vac],[data-media],[data-cover],[data-press],[data-run],[data-done],[data-del-item],[data-cal],[data-hide-ent],[data-hide-area],[data-show-area],[data-move-area],[data-add-widget],[data-del-widget],[data-pick-ent],[data-pal],[data-close]');
    if (!t) return;
    const d = t.dataset;
    if (t.tagName === 'A') e.preventDefault();
    if ('close' in d) { if (e.target === t || t.matches('button')) { this._sheet = null; this._palette = null; this._update(); } return; }
    if (d.nav) { this._sheet = null; this._palette = null; this._go(d.nav); return; }
    if (d.more) { e.stopPropagation(); this._more(d.more); return; }
    if (d.pal !== undefined) { this._palettePick(Number(d.pal)); return; }
    if (d.action) return this._action(d.action, t);
    if (d.toggle) {
      e.stopPropagation();
      if (d.toggle === '__fullscreen') { this._layout.fullscreen = !this._layout.fullscreen; this._dock(this._layout.fullscreen ? 'always_hidden' : 'docked'); this._saveLayout(); this._sigs = {}; this._update(); return; }
      t.classList.toggle('is-on'); t.closest('.m-row')?.classList.toggle('is-on');
      const dom = domainOf(d.toggle);
      this._svc(['light', 'switch', 'fan', 'input_boolean', 'automation'].includes(dom) ? dom : 'homeassistant', dom === 'lock' ? (this._st(d.toggle).state === 'locked' ? 'unlock' : 'lock') : 'toggle', {}, { entity_id: d.toggle });
      return;
    }
    if (d.roomToggle) {
      e.stopPropagation(); e.preventDefault();
      const a = this._model().areas.find(a => a.id === d.roomToggle);
      const lights = this._roomEntities(a).filter(id => domainOf(id) === 'light' && isAvail(this._st(id)));
      const anyOn = lights.some(id => this._st(id).state === 'on');
      t.classList.toggle('is-on', !anyOn); t.closest('.m-room')?.classList.toggle('is-lit', !anyOn);
      this._svc('light', anyOn ? 'turn_off' : 'turn_on', {}, { entity_id: lights });
      return;
    }
    if (d.temp) { const s = this._st(d.temp); this._svc('climate', 'set_temperature', { temperature: Math.round((Number(s.attributes.temperature) + Number(d.step)) * 2) / 2 }, { entity_id: d.temp }); return; }
    if (d.hvac) { const s = this._st(d.hvac); const modes = s.attributes.hvac_modes || ['off', 'heat']; this._svc('climate', 'set_hvac_mode', { hvac_mode: s.state === 'off' ? (modes.find(m => m !== 'off') || 'heat') : 'off' }, { entity_id: d.hvac }); return; }
    if (d.vac) { this._svc('vacuum', d.vac, {}, { entity_id: d.entity }); this._toast({ start: 'Saugroboter startet', return_to_base: 'Fährt zur Station', pause: 'Pausiert', locate: 'Saugroboter piept' }[d.vac] || 'OK'); return; }
    if (d.media) { this._svc('media_player', d.media, {}, { entity_id: d.entity }); return; }
    if (d.cover) { this._svc('cover', d.cover, {}, { entity_id: d.entity }); return; }
    if (d.press) { t.classList.add('is-done'); this._svc('button', 'press', {}, { entity_id: d.press }); this._toast('Ausgeführt'); return; }
    if (d.run) { const dom = domainOf(d.run); this._svc(dom, dom === 'automation' ? 'trigger' : 'turn_on', {}, { entity_id: d.run }); this._toast(dom === 'scene' ? 'Szene aktiviert' : 'Gestartet'); t.classList.add('is-done'); return; }
    if (d.done) {
      e.preventDefault();
      const row = t.closest('.m-task');
      const toDone = d.status === 'completed';
      row.classList.toggle('is-done', toDone);
      setTimeout(() => {
        row.classList.add('is-leaving');
        this._svc('todo', 'update_item', { item: d.done, status: d.status }, { entity_id: d.list }).then(() => setTimeout(() => this._fetchTodos([d.list]), 250));
      }, toDone ? 450 : 50);
      return;
    }
    if (d.delItem) { t.closest('.m-task')?.classList.add('is-leaving'); this._svc('todo', 'remove_item', { item: d.delItem }, { entity_id: d.list }).then(() => setTimeout(() => this._fetchTodos([d.list]), 250)); return; }
    if (d.cal) { const h = this._layout.hiddenCalendars; const i = h.indexOf(d.cal); i >= 0 ? h.splice(i, 1) : h.push(d.cal); this._saveLayout(); this._sigs = {}; this._update(); return; }
    if (d.hideEnt) { e.stopPropagation(); const r = (this._layout.rooms[d.area] ||= {}); const h = (r.hidden ||= []); const i = h.indexOf(d.hideEnt); i >= 0 ? h.splice(i, 1) : h.push(d.hideEnt); this._layoutChanged(); return; }
    if (d.hideArea) { e.stopPropagation(); e.preventDefault(); this._layout.hiddenAreas.push(d.hideArea); this._layoutChanged(); return; }
    if (d.showArea) { e.stopPropagation(); this._layout.hiddenAreas = this._layout.hiddenAreas.filter(a => a !== d.showArea); this._layoutChanged(); return; }
    if (d.moveArea) {
      e.stopPropagation(); e.preventDefault();
      const ids = this._model().areas.map(a => a.id);
      const i = ids.indexOf(d.moveArea), j = i + Number(d.dir);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      this._layout.areaOrder = ids; this._layoutChanged(); return;
    }
    if (d.addWidget) { this._sheet = { type: 'add-widget', scope: d.addWidget, q: '', code: '' }; this._sigs.overlay = null; this._update(); return; }
    if (d.delWidget) { const list = this._widgetList(d.scope); const i = list.findIndex(w => w.id === d.delWidget); if (i >= 0) list.splice(i, 1); this._widgets.delete(d.delWidget); this._layoutChanged(); return; }
    if (d.pickEnt) { this._widgetList(this._sheet.scope).push({ id: uid(), entity: d.pickEnt }); this._sheet = null; this._layoutChanged(); this._toast('Widget hinzugefügt'); return; }
  }

  _layoutChanged() { this._layoutVer = (this._layoutVer || 0) + 1; this._saveLayout(); this._sigs = {}; this._pageKey = null; this._update(); }

  _action(a, t) {
    const m = this._model();
    if (a === 'palette') return this._openPalette();
    if (a === 'edit') { this._edit = !this._edit; this._sheet = null; this._sigs = {}; this._update(); return; }
    if (a === 'more') { this._sheet = { type: 'more-nav' }; this._update(); return; }
    if (a === 'all-off') {
      const on = m.lights.filter(id => this._st(id)?.state === 'on');
      if (on.length) this._svc('light', 'turn_off', {}, { entity_id: on });
      t.classList.add('is-done'); this._toast(`${on.length} ${on.length === 1 ? 'Licht' : 'Lichter'} ausgeschaltet`);
      return;
    }
    if (a === 'reset') { if (!confirm('Layout wirklich zurücksetzen?')) return; this._layout = { fullscreen: this._layout.fullscreen, home: { widgets: [] }, rooms: {}, hiddenAreas: [], areaOrder: [], hiddenCalendars: [] }; this._widgets.clear(); this._layoutChanged(); this._toast('Layout zurückgesetzt'); return; }
    if (a === 'add-code') {
      const raw = this.shadowRoot.querySelector('.m-code')?.value || '';
      try {
        const config = parseLooseYaml(raw);
        if (!config?.type) throw new Error('Die Karte braucht ein „type“.');
        this._widgetList(this._sheet.scope).push({ id: uid(), config });
        this._sheet = null; this._layoutChanged(); this._toast('Karte eingefügt');
      } catch (err) {
        this._sheet.code = raw; this._sheet.error = err.message; this._sigs.overlay = null;
        this.shadowRoot.querySelector('[data-slot="overlay"]').innerHTML = '';
        this._update();
      }
    }
  }

  _onSubmit(e) {
    const form = e.target.closest('[data-add-item]');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input');
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    const list = form.dataset.addItem;
    this._svc('todo', 'add_item', { item: v }, { entity_id: list }).then(() => this._fetchTodos([list]));
  }

  _onInput(e) {
    if (e.target.matches('.m-pal__q')) { this._palette.q = e.target.value; this._palette.i = 0; this._sigs.overlay = null; this._renderOverlay(); }
    if (e.target.matches('.m-widget-q')) { this._sheet.q = e.target.value; this._sigs.overlay = null; this._renderOverlay(); }
    if (e.target.matches('.m-code')) { this._sheet.code = e.target.value; }
  }

  _onChange(e) {
    const s = e.target.closest('[data-setting]');
    if (!s) return;
    this._layout[s.dataset.setting] = s.value || undefined;
    this._modelCache = null; this._todos = {};
    this._saveLayout(); this._sigs = {}; this._fetchEvents(); this._update(); this._toast('Gespeichert');
  }

  _onKey(e) {
    if (this._palette && e.target.matches('.m-pal__q')) {
      const n = this._paletteResults().length;
      if (e.key === 'ArrowDown') { e.preventDefault(); this._palette.i = (this._palette.i + 1) % Math.max(1, n); this._sigs.overlay = null; this._renderOverlay(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._palette.i = (this._palette.i - 1 + n) % Math.max(1, n); this._sigs.overlay = null; this._renderOverlay(); }
      if (e.key === 'Enter') { e.preventDefault(); this._palettePick(this._palette.i); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.m-room[data-nav]')) { e.preventDefault(); this._go(e.target.dataset.nav); }
  }

  _onPointerDown(e) {
    const hold = e.target.closest('[data-hold]');
    if (hold) return this._hold(hold, e);
    const row = e.target.closest('[data-slider]');
    if (row && !e.target.closest('.m-switch, [data-more], .m-mini')) return this._slide(row, e);
  }

  _hold(el, e) {
    e.preventDefault();
    const hint = el.querySelector('.m-hold__hint');
    el.classList.add('is-holding');
    const timer = setTimeout(() => {
      el.classList.remove('is-holding'); el.classList.add('is-confirmed');
      if (hint) hint.textContent = 'Geöffnet';
      this._svc('button', 'press', {}, { entity_id: el.dataset.hold });
      this._toast('Tür wird geöffnet');
      setTimeout(() => { el.classList.remove('is-confirmed'); if (hint) hint.textContent = hint.closest('.is-inline') ? 'Halten' : 'Gedrückt halten'; }, 2200);
    }, 1100);
    const cancel = () => { clearTimeout(timer); el.classList.remove('is-holding'); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.removeEventListener(t, cancel)); };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, cancel));
  }

  _slide(row, e) {
    const id = row.dataset.slider;
    const startX = e.clientX;
    let moved = false, pct = 0;
    row.setPointerCapture?.(e.pointerId);
    this._dragging = true;
    const move = (ev) => {
      if (Math.abs(ev.clientX - startX) > 4) moved = true;
      if (!moved) return;
      row.classList.add('is-dragging', 'is-on');
      const r = row.getBoundingClientRect();
      pct = Math.max(1, Math.min(100, Math.round((ev.clientX - r.left) / r.width * 100)));
      row.style.setProperty('--pct', pct + '%');
      const small = row.querySelector('.m-row__name small'); if (small) small.textContent = `${pct} %`;
    };
    const up = () => {
      row.removeEventListener('pointermove', move); row.removeEventListener('pointerup', up); row.removeEventListener('pointercancel', up);
      row.classList.remove('is-dragging');
      this._dragging = false;
      if (moved) this._svc('light', 'turn_on', { brightness_pct: pct }, { entity_id: id });
    };
    row.addEventListener('pointermove', move); row.addEventListener('pointerup', up); row.addEventListener('pointercancel', up);
  }
}

// Minimal YAML (block maps/lists + scalars) or JSON for pasted card configs
function parseLooseYaml(src) {
  const t = src.trim();
  if (!t) throw new Error('Bitte eine Karten-Konfiguration einfügen.');
  if (t.startsWith('{')) return JSON.parse(t);
  const lines = t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  const scalar = (v) => { v = v.trim(); if (/^(['"]).*\1$/.test(v)) return v.slice(1, -1); if (v === 'true') return true; if (v === 'false') return false; if (v === 'null' || v === '~') return null; if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v); if (v.startsWith('[') || v.startsWith('{')) { try { return JSON.parse(v); } catch (e) { /* fall through */ } } return v; };
  let i = 0;
  const indent = (l) => l.length - l.trimStart().length;
  function block(ind) {
    if (i >= lines.length) return null;
    if (lines[i].trimStart().startsWith('- ')) {
      const arr = [];
      while (i < lines.length && indent(lines[i]) === ind && lines[i].trimStart().startsWith('- ')) {
        const rest = lines[i].trimStart().slice(2);
        if (/^[^:\s][^:]*:(\s|$)/.test(rest)) { lines[i] = ' '.repeat(ind + 2) + rest; arr.push(block(ind + 2)); }
        else { arr.push(scalar(rest)); i++; }
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && indent(lines[i]) === ind) {
      const line = lines[i].trim();
      const k = line.slice(0, line.indexOf(':')).trim(), v = line.slice(line.indexOf(':') + 1);
      i++;
      if (v.trim() === '') obj[k] = i < lines.length && indent(lines[i]) > ind ? block(indent(lines[i])) : null;
      else if (v.trim() === '|' || v.trim() === '>') { const parts = []; while (i < lines.length && indent(lines[i]) > ind) parts.push(lines[i++].trim()); obj[k] = parts.join(v.trim() === '|' ? '\n' : ' '); }
      else obj[k] = scalar(v);
    }
    return obj;
  }
  return block(indent(lines[0]));
}

// ─── styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  :host {
    --m-bg: var(--primary-background-color, #F4F5F8);
    --m-card: var(--ha-card-background, var(--card-background-color, #fff));
    --m-nav-bg: var(--sidebar-background-color, var(--m-card));
    --m-line: var(--ha-card-border-color, var(--divider-color, rgba(127,127,127,.18)));
    --m-text: var(--primary-text-color, #101828);
    --m-muted: var(--secondary-text-color, #667085);
    --m-accent: var(--primary-color, #4F46E5);
    --m-accent-rgb: var(--rgb-primary-color, 79, 70, 229);
    --m-fill: rgba(127,127,127,.10);
    --m-fill-2: rgba(127,127,127,.17);
    --m-warm: 245, 166, 35;
    --m-heat: 247, 104, 8;
    --m-cloud: #C9D1DE; --m-cloud-2: #AEB7C6;
    --m-radius: 20px;
    --m-ease: cubic-bezier(.2,.8,.2,1);
    --m-spring: cubic-bezier(.34,1.56,.64,1);
    display: block; height: 100%;
    font-family: var(--ha-font-family-body, var(--primary-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
    color: var(--m-text); background: var(--m-bg); -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
  button, a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; text-decoration: none; }
  ha-icon { --mdc-icon-size: 20px; display: inline-flex; flex-shrink: 0; }
  h1, h2, h3, p { margin: 0; }
  kbd { font: 600 11px/1 inherit; padding: 3px 6px; border-radius: 6px; background: var(--m-fill); color: var(--m-muted); }

  /* ── shell ── */
  .m-app { display: grid; grid-template-columns: 252px minmax(0, 1fr); height: 100vh; height: 100dvh; }
  .m-app > [data-slot="overlay"] { display: contents; }
  .m-nav { background: var(--m-nav-bg); border-right: 1px solid var(--m-line); padding: 18px 12px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
  .m-brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 16px; }
  .m-brand__mark { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; color: #fff;
    background: linear-gradient(135deg, var(--m-accent), rgba(var(--m-accent-rgb), .65)); box-shadow: 0 6px 16px -6px rgba(var(--m-accent-rgb), .7); }
  .m-brand__mark ha-icon { --mdc-icon-size: 18px; }
  .m-brand__name { font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
  .m-search { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 12px; border-radius: 10px; background: var(--m-fill); color: var(--m-muted); font-size: 13px; }
  .m-search span { flex: 1; }
  .m-search:hover { background: var(--m-fill-2); }
  .m-nav__group { display: flex; flex-direction: column; gap: 2px; }
  .m-nav__item { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; font-size: 14px; font-weight: 500; color: var(--m-muted); transition: background .2s, color .2s; width: 100%; }
  .m-nav__item:hover { background: var(--m-fill); color: var(--m-text); }
  .m-nav__item.is-active { background: rgba(var(--m-accent-rgb), .10); color: var(--m-accent); font-weight: 600; }
  .m-nav__item.is-active::before { content: ''; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--m-accent); animation: m-grow-y .3s var(--m-spring); }
  @keyframes m-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .m-nav__item span { flex: 1; }
  .m-ext { --mdc-icon-size: 14px; opacity: .6; }
  .m-badge { font-style: normal; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--m-accent); color: #fff; display: grid; place-items: center; }
  .m-nav__sub { display: flex; flex-direction: column; margin: 2px 0 6px 20px; padding-left: 12px; border-left: 1px solid var(--m-line); }
  .m-nav__subitem { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; font-size: 13px; color: var(--m-muted); }
  .m-nav__subitem:hover { color: var(--m-text); background: var(--m-fill); }
  .m-nav__subitem.is-active { color: var(--m-text); font-weight: 600; }
  .m-nav__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--m-fill-2); transition: background .4s, box-shadow .4s; }
  .m-nav__dot.is-lit { background: rgb(var(--m-warm)); box-shadow: 0 0 8px rgba(var(--m-warm), .8); }
  .m-nav__bottom { margin-top: auto; padding-top: 16px; display: flex; flex-direction: column; gap: 2px; border-top: 1px solid var(--m-line); }
  .m-user { display: flex; align-items: center; gap: 10px; padding: 10px; font-size: 13px; font-weight: 600; }
  .m-avatar { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--m-accent-rgb), .14); color: var(--m-accent); font-size: 12px; }

  .m-content { overflow-y: auto; height: 100%; overscroll-behavior: contain; scroll-behavior: smooth; }
  .m-topbar { display: none; }
  .m-tabbar { display: none; }
  .m-page { max-width: 1280px; margin: 0 auto; padding: 32px 32px 64px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .m-block { min-width: 0; }
  .m-page.is-home { grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: auto auto auto auto auto 1fr; align-items: start; }
  .m-page.is-home > [data-block="hero"], .m-page.is-home > [data-block="actions"], .m-page.is-home > .is-full { grid-column: 1 / -1; }
  .m-page.is-home > .is-side { grid-column: 2; grid-row: 3 / 7; display: grid; gap: 16px; position: sticky; top: 16px; }
  .m-page.is-home > [data-block="widgets"] { grid-column: 1; }
  .m-page.is-home > .is-main { grid-column: 1; }
  .m-block:empty { display: none; }

  /* entrance (per page) */
  .m-anim { animation: none; }
  .is-entering .m-anim { animation: m-rise .6s var(--m-ease) both; animation-delay: calc(var(--i, 0) * 45ms); }
  @keyframes m-rise { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: none; } }
  .m-press { transition: transform .25s var(--m-spring), background-color .2s, box-shadow .25s, border-color .2s, color .2s; }
  .m-press:active { transform: scale(.97); }

  /* page heads */
  .m-pagehead { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
  .m-pagehead h1 { font-size: clamp(26px, 3vw, 34px); font-weight: 700; letter-spacing: -.025em; }
  .m-pagehead p { margin-top: 6px; color: var(--m-muted); font-size: 15px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
  .m-meta { display: inline-flex; align-items: center; gap: 4px; }
  .m-meta ha-icon { --mdc-icon-size: 16px; }
  .m-eyebrow { font-size: 13px; font-weight: 600; letter-spacing: .02em; color: var(--m-muted); text-transform: capitalize; }
  .m-title { font-size: clamp(28px, 3.4vw, 40px); font-weight: 700; letter-spacing: -.025em; line-height: 1.1; margin-top: 6px; }
  .m-summary { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--m-muted); font-size: 15px; }
  .m-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: .5; display: inline-block; }
  .m-sectionhead { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
  .m-sectionhead h2 { font-size: 18px; font-weight: 650; letter-spacing: -.01em; }
  .m-sectionhead > span { font-size: 13px; color: var(--m-muted); }
  .m-link { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 600; color: var(--m-accent); margin-left: auto; }
  .m-link ha-icon { --mdc-icon-size: 16px; }
  .m-hint { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: var(--m-muted); line-height: 1.5; }
  .m-hint ha-icon { --mdc-icon-size: 16px; margin-top: 2px; }
  .m-hint .m-link { margin-left: 4px; }

  /* hero */
  .m-hero { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
  .m-weather { display: flex; gap: 22px; align-items: center; padding: 14px 18px; border-radius: var(--m-radius); background: var(--m-card); border: 1px solid var(--m-line); }
  .m-weather:hover { border-color: rgba(var(--m-accent-rgb), .35); }
  .m-weather__now { display: flex; align-items: center; gap: 10px; }
  .m-weather__temp { font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
  .m-weather__label { font-size: 13px; color: var(--m-muted); margin-top: 4px; }
  .m-weather__days { display: flex; gap: 14px; padding-left: 18px; border-left: 1px solid var(--m-line); }
  .m-weather__day { display: grid; justify-items: center; gap: 2px; font-size: 12px; color: var(--m-muted); }
  .m-weather__day b { color: var(--m-text); font-weight: 600; font-size: 13px; }
  .m-weather__day em { font-style: normal; font-size: 11px; }
  .wx-sun { transform-origin: 24px 24px; animation: m-spin 30s linear infinite; }
  .wx-cloud { animation: m-drift 6s ease-in-out infinite alternate; }
  .wx-rain line { animation: m-rain 1.1s linear infinite; }
  .wx-snow circle { animation: m-snow 2s ease-in-out infinite; }
  .wx-moon { animation: m-float 5s ease-in-out infinite alternate; }
  @keyframes m-spin { to { transform: rotate(360deg); } }
  @keyframes m-drift { from { transform: translateX(-1.5px); } to { transform: translateX(1.5px); } }
  @keyframes m-rain { 0% { opacity: 0; transform: translateY(-3px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(4px); } }
  @keyframes m-snow { 0%,100% { transform: translateY(-1px); opacity: .5; } 50% { transform: translateY(2px); opacity: 1; } }
  @keyframes m-float { from { transform: translateY(-1px); } to { transform: translateY(1.5px); } }

  /* quick actions */
  .m-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .m-action { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px; background: var(--m-card); border: 1px solid var(--m-line); }
  .m-action:hover:not(:disabled) { border-color: rgba(var(--m-accent-rgb), .35); box-shadow: 0 6px 20px -12px rgba(var(--m-accent-rgb), .45); }
  .m-action:disabled { cursor: default; }
  .m-action b { display: block; font-size: 14px; font-weight: 600; }
  .m-action small { display: block; font-size: 12px; color: var(--m-muted); margin-top: 2px; }
  .m-action__icon { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: var(--m-fill); color: var(--m-muted); position: relative; transition: background .3s, color .3s; }
  .m-action.is-active .m-action__icon { background: rgba(var(--m-accent-rgb), .12); color: var(--m-accent); }
  .is-done .m-action__icon, .m-pill.is-done { animation: m-pop .5s var(--m-spring); }
  @keyframes m-pop { 0% { transform: scale(1); } 40% { transform: scale(.85); } 100% { transform: scale(1); } }
  .is-spin { animation: m-spin 1.6s linear infinite; }
  .m-hold__ring::after { content: ''; position: absolute; inset: -3px; border-radius: 14px; background: conic-gradient(var(--m-accent) calc(var(--hold, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); opacity: 0; }
  .m-hold.is-holding .m-hold__ring::after { opacity: 1; animation: m-hold 1.1s linear forwards; }
  .m-hold__ring--pill { position: absolute; inset: 0; border-radius: inherit; }
  .m-hold__ring--pill::after { inset: 0; border-radius: inherit; background: rgba(var(--m-accent-rgb), .25); -webkit-mask: none; mask: none; transform-origin: left; transform: scaleX(var(--hold, 0)); }
  .m-hold.is-inline { position: relative; overflow: hidden; }
  @property --hold { syntax: '<number>'; inherits: false; initial-value: 0; }
  @keyframes m-hold { from { --hold: 0; } to { --hold: 1; } }
  .m-hold.is-confirmed .m-action__icon { background: rgba(18,183,106,.14); color: #12B76A; animation: m-pop .5s var(--m-spring); }
  .m-hold.is-confirmed.is-inline { background: rgba(18,183,106,.14); color: #12B76A; }

  /* rooms */
  .m-rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
  .m-rooms.is-large { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .m-room { position: relative; overflow: hidden; isolation: isolate; cursor: pointer; padding: 16px; min-height: 168px; border-radius: var(--m-radius);
    background: var(--m-card); border: 1px solid var(--m-line); display: flex; flex-direction: column; outline: none; }
  .m-room:hover { border-color: rgba(var(--m-accent-rgb), .3); transform: translateY(-2px); box-shadow: 0 14px 30px -20px rgba(16,24,40,.35); }
  .m-room:focus-visible { box-shadow: 0 0 0 3px rgba(var(--m-accent-rgb), .35); }
  .m-room__glow { position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity .6s var(--m-ease);
    background: radial-gradient(120% 90% at 0% 0%, rgba(var(--m-warm), calc(.10 + var(--glow, .5) * .22)), transparent 60%), radial-gradient(90% 70% at 100% 100%, rgba(var(--m-warm), .07), transparent 70%); }
  .m-room.is-lit { border-color: rgba(var(--m-warm), .38); }
  .m-room.is-lit .m-room__glow { opacity: 1; animation: m-breathe 5s ease-in-out infinite; }
  @keyframes m-breathe { 0%,100% { filter: saturate(1); } 50% { filter: saturate(1.25) brightness(1.04); } }
  .m-room__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .m-room__icon { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: var(--m-fill); color: var(--m-muted); transition: background .4s, color .4s, box-shadow .4s; }
  .m-room__icon ha-icon { --mdc-icon-size: 24px; }
  .m-room.is-lit .m-room__icon { background: rgba(var(--m-warm), .18); color: rgb(var(--m-warm)); box-shadow: 0 0 24px -4px rgba(var(--m-warm), .55); }
  .m-room__name { margin-top: auto; padding-top: 18px; font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
  .m-room__state { font-size: 13px; color: var(--m-muted); margin-top: 3px; }
  .m-room__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .m-room.is-ringing { border-color: rgba(var(--m-accent-rgb), .5); }
  .m-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 999px; background: var(--m-fill); font-size: 12px; font-weight: 500; }
  .m-chip ha-icon { --mdc-icon-size: 14px; color: var(--m-muted); }
  .m-chip b { font-weight: 600; }
  .m-chip.is-heat { background: rgba(var(--m-heat), .12); color: rgb(var(--m-heat)); }
  .m-chip.is-heat ha-icon { color: inherit; }
  .m-chip.is-on ha-icon { color: var(--m-accent); }
  .m-chip.is-ring { background: rgba(var(--m-accent-rgb), .12); color: var(--m-accent); }
  .m-shake { animation: m-shake 1.2s ease-in-out infinite; transform-origin: 50% 10%; }
  @keyframes m-shake { 0%,60%,100% { transform: rotate(0); } 10%,30% { transform: rotate(14deg); } 20%,40% { transform: rotate(-14deg); } }
  .m-edit-tools { display: flex; gap: 4px; }
  .m-hidden-list { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 16px; font-size: 13px; color: var(--m-muted); }

  /* switch */
  .m-switch { width: 44px; height: 26px; border-radius: 999px; background: var(--m-fill-2); position: relative; flex-shrink: 0; transition: background .3s var(--m-ease); }
  .m-switch__thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.25); transition: transform .45s var(--m-spring), width .2s; }
  .m-switch:active .m-switch__thumb { width: 24px; }
  .m-switch.is-on { background: var(--m-accent); }
  .m-switch.is-warm.is-on { background: rgb(var(--m-warm)); }
  .m-switch.is-on .m-switch__thumb { transform: translateX(18px); }
  .m-switch.is-on:active .m-switch__thumb { transform: translateX(14px); }

  /* cards */
  .m-card { background: var(--m-card); border: 1px solid var(--m-line); border-radius: var(--m-radius); padding: 18px; min-width: 0; }
  .m-card.is-flush { padding: 0; overflow: hidden; }
  .m-card__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .m-card__head h3 { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 650; flex: 1; min-width: 0; }
  .m-card__head h3 ha-icon { --mdc-icon-size: 18px; color: var(--m-muted); }
  .m-card__head .m-link { margin-left: 0; }
  .m-count { font-size: 12px; font-weight: 600; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--m-fill); display: inline-grid; place-items: center; color: var(--m-muted); }
  .m-count.is-accent { background: var(--m-accent); color: #fff; }
  .m-card__actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; align-items: center; }
  .m-card__actions .m-link { margin-left: auto; }
  .m-empty { display: flex; align-items: center; gap: 8px; color: var(--m-muted); font-size: 14px; padding: 10px 0; }
  .m-empty ha-icon { --mdc-icon-size: 18px; }
  .m-empty-page { display: grid; justify-items: center; gap: 12px; padding: 80px 0; color: var(--m-muted); }
  .m-empty-page ha-icon { --mdc-icon-size: 40px; }
  .m-skel { height: 40px; border-radius: 10px; margin: 8px 0; background: linear-gradient(90deg, var(--m-fill) 0%, var(--m-fill-2) 40%, var(--m-fill) 80%); background-size: 300% 100%; animation: m-shimmer 1.4s ease-in-out infinite; }
  .m-skel.is-short { width: 60%; }
  @keyframes m-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  .m-duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }

  /* agenda + waste */
  .m-agenda__day { font-size: 12px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: var(--m-muted); margin: 14px 0 6px; }
  .m-agenda__day:first-of-type { margin-top: 0; }
  .m-agenda__item { display: grid; grid-template-columns: 70px 3px 1fr; gap: 10px; align-items: center; padding: 7px 0; }
  .m-agenda__time { font-size: 13px; color: var(--m-muted); font-variant-numeric: tabular-nums; }
  .m-agenda__bar { align-self: stretch; border-radius: 3px; background: var(--c); }
  .m-agenda__title { font-size: 14px; font-weight: 550; line-height: 1.3; }
  .m-agenda__title small { display: block; font-size: 12px; font-weight: 400; color: var(--m-muted); }
  .m-waste { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--m-line); }
  .m-waste__chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 5px 9px; border-radius: 999px; background: var(--m-fill); }
  .m-waste__chip i, .m-waste__row i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); flex-shrink: 0; }
  .m-waste__row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--m-line); font-size: 14px; }
  .m-waste__row:last-child { border-bottom: 0; }
  .m-waste__row span { flex: 1; }
  .m-waste__row em { font-style: normal; color: var(--m-muted); font-size: 13px; }
  .m-cal { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
  .m-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .m-filter { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: var(--m-fill); font-size: 13px; font-weight: 500; color: var(--m-muted); transition: background .2s, color .2s; }
  .m-filter i { width: 8px; height: 8px; border-radius: 50%; border: 2px solid var(--c); transition: background .2s; }
  .m-filter.is-on { color: var(--m-text); }
  .m-filter.is-on i { background: var(--c); }

  /* tasks */
  .m-tasks { display: grid; }
  .m-task { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--m-line); font-size: 14px; max-height: 90px; overflow: hidden;
    transition: opacity .3s, transform .35s var(--m-ease), max-height .35s var(--m-ease), padding .35s; }
  .m-task:last-child { border-bottom: 0; }
  .m-task__text { flex: 1; min-width: 0; }
  .m-task__text small { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--m-muted); margin-top: 2px; }
  .m-task__text small ha-icon { --mdc-icon-size: 13px; }
  .m-task__del { opacity: 0; transition: opacity .2s; }
  .m-task:hover .m-task__del { opacity: 1; }
  .m-check { width: 22px; height: 22px; border-radius: 50%; border: 1.8px solid var(--m-fill-2); flex-shrink: 0; display: grid; place-items: center; transition: background .25s, border-color .25s, transform .3s var(--m-spring); }
  .m-check:hover { border-color: var(--m-accent); }
  .m-check svg { width: 14px; height: 14px; fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 22; stroke-dashoffset: 22; transition: stroke-dashoffset .35s .1s var(--m-ease); }
  .m-task.is-done .m-check { background: var(--m-accent); border-color: var(--m-accent); transform: scale(1.1); }
  .m-task.is-done.is-static .m-check { transform: none; }
  .m-task.is-done .m-check svg { stroke-dashoffset: 0; }
  .m-task.is-done .m-task__text { color: var(--m-muted); text-decoration: line-through; }
  .m-task.is-leaving { opacity: 0; transform: translateX(12px); max-height: 0; padding: 0; border-color: transparent; }
  .m-add { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; padding: 9px 12px; border-radius: 12px; background: var(--m-fill); color: var(--m-muted); }
  .m-add:focus-within { box-shadow: 0 0 0 2px rgba(var(--m-accent-rgb), .35); }
  .m-add__input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; font-size: 14px; color: var(--m-text); }
  .m-add__input::placeholder { color: var(--m-muted); }
  .m-more { margin: 8px 0 0; }
  .m-done { margin-top: 12px; font-size: 13px; color: var(--m-muted); }
  .m-done summary { cursor: pointer; padding: 6px 0; }

  /* tabs */
  .m-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-top: 18px; }
  .m-tabs::-webkit-scrollbar { display: none; }
  .m-tabbtn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: var(--m-fill); font-size: 13px; font-weight: 600; color: var(--m-muted); white-space: nowrap; transition: background .2s, color .2s; }
  .m-tabbtn ha-icon { --mdc-icon-size: 16px; }
  .m-tabbtn em { font-style: normal; font-size: 11px; opacity: .7; }
  .m-tabbtn:hover { color: var(--m-text); }
  .m-tabbtn.is-active { background: var(--m-text); color: var(--m-bg); }

  /* groups + rows */
  .m-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px 16px; align-items: start; }
  .m-group.is-wide { grid-column: 1 / -1; }
  .m-label { font-size: 12px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; color: var(--m-muted); margin: 0 0 8px 2px; }
  .m-sheet .m-label { margin: 18px 0 8px; }
  .m-list { display: grid; gap: 8px; }
  .m-list.is-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); margin-top: 10px; }
  .m-group.is-wide .m-list { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
  .m-row { position: relative; overflow: hidden; isolation: isolate; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--m-card); border: 1px solid var(--m-line); min-width: 0; }
  .m-row__icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--m-fill); color: var(--m-muted); flex-shrink: 0; transition: background .3s, color .3s; }
  .m-row__icon ha-icon { --mdc-icon-size: 18px; }
  .m-row__name { flex: 1; font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .m-row__name small { display: block; font-size: 12px; font-weight: 400; color: var(--m-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-row__value { font-size: 14px; font-weight: 600; color: var(--m-text); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .m-row.is-on .m-row__icon { background: rgba(var(--m-accent-rgb), .14); color: var(--m-accent); }
  .m-light.is-on .m-row__icon { background: rgba(var(--m-warm), .2); color: rgb(var(--m-warm)); }
  .m-row.is-off { opacity: .55; }
  .m-row.is-hiddenent { opacity: .4; border-style: dashed; }
  .m-row.is-meter { display: block; padding: 12px 14px; }
  .m-light { touch-action: pan-y; cursor: ew-resize; user-select: none; }
  .m-light__fill { position: absolute; inset: 0; z-index: -1; width: var(--pct); background: linear-gradient(90deg, rgba(var(--m-warm), .12), rgba(var(--m-warm), .26)); transition: width .45s var(--m-ease); }
  .m-light.is-dragging .m-light__fill { transition: none; }
  .m-light.is-dragging { box-shadow: 0 0 0 2px rgba(var(--m-warm), .45); }
  .m-mini { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--m-fill); color: var(--m-muted); flex-shrink: 0; }
  .m-mini ha-icon { --mdc-icon-size: 16px; }
  .m-mini:hover { background: var(--m-fill-2); color: var(--m-text); }
  .m-seg { display: inline-flex; background: var(--m-fill); border-radius: 12px; padding: 3px; flex-shrink: 0; }
  .m-seg button { width: 34px; height: 30px; border-radius: 9px; display: grid; place-items: center; transition: background .2s; }
  .m-seg button:hover { background: var(--m-fill-2); }
  .m-seg ha-icon { --mdc-icon-size: 18px; }

  /* media */
  .m-media__art { position: relative; flex-shrink: 0; }
  .m-art { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; display: grid; place-items: center; background: var(--m-fill); color: var(--m-muted); }
  .m-eq { position: absolute; right: -4px; bottom: -4px; display: flex; gap: 2px; align-items: flex-end; height: 14px; padding: 2px 3px; border-radius: 6px; background: var(--m-accent); }
  .m-eq i { width: 2px; background: #fff; border-radius: 1px; animation: m-eq .9s ease-in-out infinite; }
  .m-eq i:nth-child(2) { animation-delay: .2s; } .m-eq i:nth-child(3) { animation-delay: .4s; }
  @keyframes m-eq { 0%,100% { height: 3px; } 50% { height: 10px; } }

  /* climate */
  .m-climate { gap: 18px; padding: 14px 18px; }
  .m-climate__side { flex: 1; min-width: 0; display: grid; gap: 12px; }
  .m-dial { position: relative; width: 132px; height: 132px; flex-shrink: 0; }
  .m-dial svg { width: 100%; height: 100%; }
  .m-dial circle { fill: none; stroke-width: 10; stroke-linecap: round; }
  .m-dial__track { stroke: var(--m-fill-2); }
  .m-dial__value { stroke: var(--m-muted); transition: stroke-dasharray .6s var(--m-ease), stroke .4s; }
  .m-climate.is-heat .m-dial__value { stroke: rgb(var(--m-heat)); filter: drop-shadow(0 0 6px rgba(var(--m-heat), .45)); }
  .m-dial__center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
  .m-dial__target { font-size: 30px; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
  .m-dial__target sup { font-size: 15px; font-weight: 600; }
  .m-dial__cur { font-size: 12px; color: var(--m-muted); margin-top: 4px; }
  .m-climate__ctrl { display: flex; align-items: center; gap: 8px; }

  /* pills / buttons */
  .m-pill { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: var(--m-fill); font-size: 13px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
  .m-pill ha-icon { --mdc-icon-size: 16px; }
  .m-pill:hover { background: var(--m-fill-2); }
  .m-pill.is-primary { background: var(--m-accent); color: #fff; }
  .m-pill.is-heat { background: rgba(var(--m-heat), .14); color: rgb(var(--m-heat)); }
  .m-pill.is-warm { background: rgba(var(--m-warm), .16); color: rgb(var(--m-warm)); }
  .m-pill.is-danger { background: rgba(240,68,56,.12); color: #F04438; }
  .m-icon-btn { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: var(--m-fill); flex-shrink: 0; }
  .m-icon-btn:hover { background: var(--m-fill-2); }
  .m-icon-btn.is-on { background: var(--m-accent); color: #fff; }

  /* status / meters */
  .m-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--m-muted); }
  .m-status i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .6; }
  .m-status.is-live { color: #12B76A; }
  .m-status.is-live i { opacity: 1; animation: m-ping 1.6s ease-out infinite; }
  @keyframes m-ping { 0% { box-shadow: 0 0 0 0 rgba(18,183,106,.5); } 100% { box-shadow: 0 0 0 8px rgba(18,183,106,0); } }
  .m-vac, .m-sys { display: grid; gap: 12px; }
  .m-sys__row { display: grid; grid-template-columns: 34px 1fr auto; gap: 4px 10px; align-items: center; }
  .m-sys__row .m-bar { grid-column: 2 / -1; }
  .m-sys__row.is-plain { grid-template-columns: 34px 1fr auto; }
  .m-sys__name { font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .m-sys__val { font-size: 12px; color: var(--m-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .m-sys__val b { font-size: 15px; color: var(--m-text); font-weight: 650; margin-right: 1px; }
  .m-bar { height: 5px; border-radius: 999px; background: var(--m-fill); overflow: hidden; display: block; }
  .m-bar i { display: block; height: 100%; width: var(--w); border-radius: inherit; background: #12B76A; animation: m-growx .9s var(--m-ease) both; transform-origin: left; }
  .m-bar.is-accent i { background: var(--m-accent); }
  .m-bar.is-warn i { background: #F79009; }
  .m-sys .m-bar i, .m-row.is-meter .m-bar i { background: var(--m-accent); }
  .m-row.is-meter .is-warn .m-bar i { background: #F79009; }
  .m-row.is-meter .m-sys__name { font-weight: 600; font-size: 14px; }
  .m-sys .is-warn .m-bar i { background: #F79009; }
  @keyframes m-growx { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  /* widgets */
  .m-widgets { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; align-items: start; }
  .m-widget-wrap { position: relative; }
  .m-widget-del { position: absolute; top: -8px; right: -8px; z-index: 2; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: #F04438; color: #fff; box-shadow: 0 4px 10px -2px rgba(240,68,56,.5); animation: m-pop .4s var(--m-spring); }
  .m-widget-del ha-icon { --mdc-icon-size: 16px; }
  .is-edit .m-widget-wrap { animation: m-wiggle .5s ease-in-out infinite alternate; }
  @keyframes m-wiggle { from { transform: rotate(-.4deg); } to { transform: rotate(.4deg); } }
  .m-widget-add { display: grid; justify-items: center; gap: 4px; padding: 28px; border-radius: var(--m-radius); border: 1.5px dashed var(--m-fill-2); color: var(--m-muted); }
  .m-widget-add:hover { border-color: var(--m-accent); color: var(--m-accent); background: rgba(var(--m-accent-rgb), .04); }
  .m-widget-add ha-icon { --mdc-icon-size: 26px; }
  .m-widget-add span { font-weight: 600; font-size: 14px; }
  .m-widget-add small { font-size: 12px; }

  /* settings */
  .m-settings { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; align-items: start; }
  .m-setting { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--m-line); }
  .m-setting:last-of-type { border-bottom: 0; }
  .m-setting b { display: block; font-size: 14px; }
  .m-setting small { display: block; font-size: 12px; color: var(--m-muted); margin-top: 2px; line-height: 1.4; }
  .m-select { font: inherit; font-size: 13px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--m-line); background: var(--m-fill); color: var(--m-text); max-width: 200px; }

  /* overlays */
  .m-scrim { position: fixed; inset: 0; z-index: 20; background: rgba(10,12,18,.42); backdrop-filter: blur(6px); animation: m-fade .2s var(--m-ease) both; }
  @keyframes m-fade { from { opacity: 0; } to { opacity: 1; } }
  .m-palette { position: fixed; z-index: 21; top: 12vh; left: 50%; transform: translateX(-50%); width: min(620px, calc(100vw - 24px)); background: var(--m-card); border: 1px solid var(--m-line); border-radius: 18px; box-shadow: 0 40px 80px -30px rgba(0,0,0,.5); overflow: hidden; animation: m-pal-in .28s var(--m-spring) both; }
  @keyframes m-pal-in { from { opacity: 0; transform: translate(-50%, -8px) scale(.98); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
  .m-pal__input { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--m-line); color: var(--m-muted); }
  .m-pal__input.is-boxed { border: 1px solid var(--m-line); border-radius: 12px; padding: 10px 12px; }
  .m-pal__input input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px; color: var(--m-text); }
  .m-pal__list { max-height: 50vh; overflow-y: auto; padding: 6px; }
  .m-pal__list.is-short { max-height: 32vh; padding: 6px 0; }
  .m-pal__item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 10px; color: var(--m-text); }
  .m-pal__item ha-icon { color: var(--m-muted); }
  .m-pal__item span { flex: 1; font-size: 14px; font-weight: 550; min-width: 0; }
  .m-pal__item small { display: block; font-size: 12px; font-weight: 400; color: var(--m-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .m-pal__item em { font-style: normal; font-size: 12px; color: var(--m-muted); }
  .m-pal__item:hover, .m-pal__item.is-active { background: rgba(var(--m-accent-rgb), .10); }
  .m-pal__item.is-active ha-icon { color: var(--m-accent); }
  .m-sheet { position: fixed; z-index: 21; top: 50%; left: 50%; width: min(460px, calc(100vw - 24px)); max-height: 86vh; overflow: auto; transform: translate(-50%, -50%); background: var(--m-card); border: 1px solid var(--m-line); border-radius: 24px; padding: 22px; box-shadow: 0 40px 80px -30px rgba(0,0,0,.5); animation: m-sheet-in .38s var(--m-spring) both; overscroll-behavior: contain; }
  .m-sheet.is-wide { width: min(620px, calc(100vw - 24px)); }
  @keyframes m-sheet-in { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  .m-sheet__grab { display: none; }
  .m-sheet__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .m-sheet__title { font-size: 22px; font-weight: 700; letter-spacing: -.02em; margin-top: 4px; }
  .m-code { width: 100%; min-height: 120px; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 12px; border-radius: 12px; border: 1px solid var(--m-line); background: var(--m-fill); color: var(--m-text); resize: vertical; outline: none; }
  .m-code:focus { border-color: var(--m-accent); }
  .m-error { margin-top: 8px; font-size: 13px; color: #F04438; }
  .m-morenav { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .m-morenav__item { display: grid; justify-items: center; gap: 6px; padding: 16px 8px; border-radius: 16px; background: var(--m-fill); font-size: 12px; font-weight: 600; }
  .m-morenav__item ha-icon { --mdc-icon-size: 24px; color: var(--m-accent); }

  .m-toast { position: fixed; z-index: 30; left: 50%; bottom: 28px; transform: translateX(-50%); pointer-events: none; }
  .m-toast__in { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: var(--m-text); color: var(--m-bg); font-size: 13px; font-weight: 600; box-shadow: 0 12px 30px -10px rgba(0,0,0,.4); animation: m-toast 2.6s var(--m-ease) both; }
  .m-toast__in.is-err { background: #F04438; color: #fff; }
  .m-toast__in ha-icon { --mdc-icon-size: 18px; }
  @keyframes m-toast { 0% { opacity: 0; transform: translateY(12px) scale(.96); } 10%, 85% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(6px); } }

  /* ── responsive ── */
  @media (max-width: 1180px) {
    .m-page.is-home { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; }
    .m-page.is-home > .is-side, .m-page.is-home > .is-main { grid-column: 1; grid-row: auto; position: static; }
    .m-page.is-home > [data-block="rooms"] { order: 1; } .m-page.is-home > .is-side { order: 2; } .m-page.is-home > [data-block="status"] { order: 3; } .m-page.is-home > [data-block="widgets"] { order: 4; }
    .m-page.is-home > [data-block="hero"], .m-page.is-home > [data-block="actions"] { order: 0; }
    .m-cal { grid-template-columns: 1fr; }
  }
  @media (max-width: 860px) {
    .m-app { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
    .m-nav { display: none; }
    .m-content { grid-row: 1; }
    .m-topbar { display: flex; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 5; padding: 10px 14px; background: color-mix(in srgb, var(--m-bg) 85%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--m-line); }
    .m-topbar__title { flex: 1; font-weight: 700; font-size: 17px; }
    .m-tabbar { display: grid; grid-template-columns: repeat(5, 1fr); grid-row: 2; padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); background: var(--m-nav-bg); border-top: 1px solid var(--m-line); }
    .m-tab { display: grid; justify-items: center; gap: 2px; padding: 6px 0; font-size: 11px; font-weight: 600; color: var(--m-muted); border-radius: 12px; transition: color .2s; text-align: center; }
    .m-tab ha-icon { --mdc-icon-size: 22px; transition: transform .35s var(--m-spring); }
    .m-tab.is-active { color: var(--m-accent); }
    .m-tab.is-active ha-icon { transform: translateY(-2px) scale(1.08); }
    .m-page { padding: 18px 14px 32px; gap: 18px; }
    .m-hero { grid-template-columns: 1fr; gap: 16px; }
    .m-weather { justify-content: space-between; }
    .m-weather__days { gap: 10px; padding-left: 12px; }
    .m-weather__day:nth-child(n+4) { display: none; }
    .m-actions { display: flex; overflow-x: auto; margin: 0 -14px; padding: 2px 14px; scrollbar-width: none; scroll-snap-type: x mandatory; }
    .m-actions::-webkit-scrollbar { display: none; }
    .m-action { flex: 0 0 auto; min-width: 170px; scroll-snap-align: start; }
    .m-rooms, .m-rooms.is-large { grid-template-columns: 1fr 1fr; gap: 10px; }
    .m-room { min-height: 150px; padding: 14px; }
    .m-groups, .m-group.is-wide .m-list, .m-settings, .m-widgets { grid-template-columns: 1fr; }
    .m-climate { flex-wrap: wrap; }
    .m-setting { flex-wrap: wrap; }
    .m-sheet { top: auto; bottom: 0; left: 0; transform: none; width: 100%; max-height: 86vh; border-radius: 24px 24px 0 0; padding-bottom: calc(22px + env(safe-area-inset-bottom)); animation: m-sheet-up .42s var(--m-spring) both; }
    .m-sheet.is-wide { width: 100%; }
    .m-sheet__grab { display: block; width: 40px; height: 4px; border-radius: 2px; background: var(--m-fill-2); margin: -8px auto 16px; }
    @keyframes m-sheet-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
    .m-palette { top: 8px; }
    .m-toast { bottom: calc(84px + env(safe-area-inset-bottom)); }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
  }
`;

customElements.define('meridian-panel', MeridianPanel);
console.info(`%c MERIDIAN %c ${VERSION} `, 'background:#4F46E5;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px', 'background:#EEF0FF;color:#4F46E5;border-radius:0 4px 4px 0;padding:2px 6px');
