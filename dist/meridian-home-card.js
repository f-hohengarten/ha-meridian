/*
 * Meridian Home — a software-like home dashboard for Home Assistant.
 *
 *   type: custom:meridian-home-card
 *   (see README.md for all options; everything has sensible auto defaults)
 */

const VERSION = '0.1.0';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const x = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (v, digits = 1) => {
  const n = Number(v);
  if (!isFinite(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const isOn = (s) => s && !['off', 'unavailable', 'unknown', 'idle', 'standby', 'docked', 'closed', 'locked'].includes(s.state);
const isAvail = (s) => s && !['unavailable', 'unknown'].includes(s.state);

function relTime(iso) {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.round(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)} Std.`;
  const d = Math.round(diff / 86400);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

function dayLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 864e5);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' });
}

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

const WASTE = [
  [/bio/i, '#8B5E3C', 'Bio'],
  [/rest/i, '#667085', 'Rest'],
  [/gelb|wertstoff|verpack/i, '#EAB308', 'Gelb'],
  [/papier|blau/i, '#2E90FA', 'Papier'],
  [/glas/i, '#12B76A', 'Glas'],
];

const WEATHER_LABEL = {
  'clear-night': 'Klar', cloudy: 'Bewölkt', exceptional: 'Unwetter', fog: 'Nebel', hail: 'Hagel',
  lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', partlycloudy: 'Teils bewölkt', pouring: 'Starkregen',
  rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'Sonnig', windy: 'Windig', 'windy-variant': 'Windig',
};

// Small animated weather glyphs (pure SVG + CSS)
function weatherSvg(cond, size = 44) {
  const sun = `<g class="wx-sun"><circle cx="24" cy="24" r="8" fill="#F5B841"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="24" y1="9" x2="24" y2="5" stroke="#F5B841" stroke-width="2.5" stroke-linecap="round" transform="rotate(${a} 24 24)"/>`).join('')}</g>`;
  const cloud = (dx = 0, dy = 0, fill = 'var(--m-cloud)') => `<path class="wx-cloud" transform="translate(${dx} ${dy})" d="M15 34h19a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 2 13z" fill="${fill}"/>`;
  const drops = `<g class="wx-rain">${[16, 24, 32].map((cx, i) => `<line x1="${cx}" y1="38" x2="${cx - 2}" y2="44" stroke="#53B1FD" stroke-width="2.2" stroke-linecap="round" style="animation-delay:${i * 0.25}s"/>`).join('')}</g>`;
  const moon = `<path class="wx-moon" d="M30 10a14 14 0 1 0 8 25 11 11 0 0 1-8-25z" fill="#C7C9FF"/>`;
  let body;
  switch (cond) {
    case 'sunny': body = sun; break;
    case 'clear-night': body = moon; break;
    case 'partlycloudy': body = `<g transform="translate(-6 -6) scale(.85)">${sun}</g>${cloud(2, 4)}`; break;
    case 'rainy': case 'pouring': case 'lightning-rainy': body = `${cloud(0, -4)}${drops}`; break;
    case 'snowy': case 'snowy-rainy': body = `${cloud(0, -4)}<g class="wx-snow">${[16, 24, 32].map((cx, i) => `<circle cx="${cx}" cy="41" r="1.8" fill="#C4C7CE" style="animation-delay:${i * 0.3}s"/>`).join('')}</g>`; break;
    case 'fog': body = `${cloud(0, -4)}<g stroke="var(--m-muted)" stroke-width="2" stroke-linecap="round"><line x1="10" y1="40" x2="38" y2="40"/><line x1="14" y1="44" x2="34" y2="44"/></g>`; break;
    default: body = `${cloud(-4, -3, 'var(--m-cloud-2)')}${cloud(3, 2)}`;
  }
  return `<svg class="wx" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
}

const icon = (name, cls = '') => `<ha-icon class="${cls}" icon="${x(name)}"></ha-icon>`;

// ─── Card ─────────────────────────────────────────────────────────────────────

class MeridianHomeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._sigs = {};
    this._first = true;
    this._events = null;      // calendar events
    this._forecast = null;
    this._todos = {};          // entity_id → items
    this._sheet = null;        // open room index
    this._pending = new Set(); // entity ids with optimistic UI
    this._nums = new Map();    // count-up previous values
    this._timers = [];
  }

  static getStubConfig() { return {}; }
  getCardSize() { return 12; }

  setConfig(config) {
    this._config = {
      weather: '',
      calendars: [],
      waste_calendar: '',
      tasks: '',
      shopping: '',
      vacuum: '',
      door: null,          // { open: button.x, bell: event.y, name }
      system: [],          // [{ entity, name, icon, max }]
      rooms: null,         // [{ area, name, icon, lights, climate, fan, camera, temperature, humidity }]
      ...config,
    };
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._boot();
    this._update();
  }

  connectedCallback() {
    if (this._hass && !this._timers.length) this._boot();
  }

  disconnectedCallback() {
    this._timers.forEach(clearInterval);
    this._timers = [];
  }

  // ─── data ──────────────────────────────────────────────────────────────────

  _boot() {
    this._autoConfig();
    this._fetchEvents();
    this._fetchForecast();
    this._fetchTodos();
    this._timers.push(setInterval(() => this._fetchEvents(), 15 * 60e3));
    this._timers.push(setInterval(() => this._fetchForecast(), 30 * 60e3));
    this._timers.push(setInterval(() => { this._sigs.header = null; this._update(); }, 60e3)); // clock / relative times
  }

  _st(id) { return id ? this._hass?.states?.[id] : undefined; }

  // Fills unset options from the HA registries (areas, device classes, domains)
  _autoConfig() {
    const c = this._config, h = this._hass, all = Object.keys(h.states);
    const first = (re, pred = () => true) => all.find(id => re.test(id) && pred(h.states[id])) || '';
    if (!c.weather) c.weather = first(/^weather\./);
    if (!c.vacuum) c.vacuum = first(/^vacuum\./);
    if (!c.calendars.length) c.calendars = all.filter(id => id.startsWith('calendar.') && id !== c.waste_calendar);
    if (!c.tasks) c.tasks = first(/^todo\./);
    if (!c.rooms) {
      const areaOf = (id) => {
        const e = h.entities?.[id];
        if (!e) return null;
        return e.area_id || h.devices?.[e.device_id]?.area_id || null;
      };
      const areas = Object.values(h.areas || {});
      c.rooms = areas.map(a => {
        const ids = all.filter(id => areaOf(id) === a.area_id && !h.entities?.[id]?.entity_category && !h.entities?.[id]?.hidden);
        const avail = (id) => isAvail(h.states[id]);
        const sensor = (dc) => ids.find(id => id.startsWith('sensor.') && h.states[id].attributes.device_class === dc && avail(id));
        return {
          area: a.area_id, name: a.name, icon: a.icon,
          lights: ids.filter(id => id.startsWith('light.')),
          climate: ids.find(id => id.startsWith('climate.') && avail(id)),
          fan: ids.find(id => id.startsWith('fan.')),
          camera: ids.find(id => id.startsWith('camera.') && avail(id)),
          temperature: sensor('temperature'),
          humidity: sensor('humidity'),
        };
      });
    }
  }

  async _fetchEvents() {
    const ids = [...this._config.calendars, this._config.waste_calendar].filter(Boolean);
    if (!ids.length) { this._events = []; return; }
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 14 * 864e5);
    try {
      const res = await this._hass.callService('calendar', 'get_events',
        { start_date_time: start.toISOString(), end_date_time: end.toISOString() },
        { entity_id: ids }, false, true);
      const out = [];
      for (const [cal, v] of Object.entries(res.response || {})) {
        for (const e of v.events || []) {
          const allDay = !String(e.start).includes('T');
          out.push({ cal, summary: String(e.summary || '').trim(), start: new Date(allDay ? e.start + 'T00:00:00' : e.start), allDay, waste: cal === this._config.waste_calendar });
        }
      }
      out.sort((a, b) => a.start - b.start);
      this._events = out;
    } catch (e) {
      console.warn('[meridian] calendar', e);
      this._events = [];
    }
    this._sigs.today = null;
    this._update();
  }

  async _fetchForecast() {
    if (!this._config.weather) return;
    try {
      const res = await this._hass.callService('weather', 'get_forecasts', { type: 'daily' },
        { entity_id: this._config.weather }, false, true);
      this._forecast = res.response?.[this._config.weather]?.forecast || [];
    } catch (e) { this._forecast = []; }
    this._sigs.header = null;
    this._update();
  }

  async _fetchTodos() {
    const ids = [this._config.tasks, this._config.shopping].filter(Boolean);
    if (!ids.length) return;
    try {
      const res = await this._hass.callService('todo', 'get_items', { status: ['needs_action'] },
        { entity_id: ids }, false, true);
      for (const id of ids) this._todos[id] = res.response?.[id]?.items || [];
    } catch (e) { console.warn('[meridian] todo', e); }
    this._lastTodoSig = ids.map(id => this._st(id)?.state).join('|');
    this._sigs.today = null;
    this._update();
  }

  _svc(domain, service, data = {}, target) {
    return this._hass.callService(domain, service, data, target);
  }

  // ─── render orchestration ──────────────────────────────────────────────────

  _update() {
    if (!this._hass || !this._config) return;
    if (!this.shadowRoot.querySelector('.m-root')) this._mount();

    // todo lists changed elsewhere → refetch
    const todoSig = [this._config.tasks, this._config.shopping].map(id => this._st(id)?.state).join('|');
    if (this._lastTodoSig !== undefined && todoSig !== this._lastTodoSig) { this._lastTodoSig = todoSig; this._fetchTodos(); }

    const sections = {
      header:    [() => this._sigHeader(), () => this._renderHeader()],
      actions:   [() => this._sigActions(), () => this._renderActions()],
      rooms:     [() => this._sigRooms(), () => this._renderRooms()],
      today:     [() => this._sigToday(), () => this._renderToday()],
      household: [() => this._sigHousehold(), () => this._renderHousehold()],
      system:    [() => this._sigSystem(), () => this._renderSystem()],
      sheet:     [() => this._sigSheet(), () => this._renderSheet()],
    };
    for (const [key, [sig, render]] of Object.entries(sections)) {
      const s = sig();
      if (s === this._sigs[key]) continue;
      this._sigs[key] = s;
      const el = this.shadowRoot.querySelector(`[data-slot="${key}"]`);
      if (!el) continue;
      if (this._dragging && (key === 'sheet' || key === 'rooms')) { this._sigs[key] = null; continue; }
      const openSheet = key === 'sheet' && this._sheet !== null && el.querySelector(`.m-sheet[data-sheet-room="${this._sheet}"]`);
      if (openSheet) {
        openSheet.innerHTML = this._renderSheetBody();
        this._bind(openSheet);
        this._countUp(openSheet);
        continue;
      }
      el.innerHTML = render();
      this._bind(el);
      this._countUp(el);
    }
    if (this._first) {
      this._first = false;
      requestAnimationFrame(() => this.shadowRoot.querySelector('.m-root')?.classList.add('is-ready'));
      setTimeout(() => this.shadowRoot.querySelector('.m-root')?.classList.add('is-settled'), 1600);
    }
  }

  _mount() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="m-root">
        <header class="m-header" data-slot="header"></header>
        <div class="m-actions" data-slot="actions"></div>
        <div class="m-grid">
          <main class="m-main">
            <section data-slot="rooms"></section>
            <div class="m-duo">
              <section data-slot="household"></section>
              <section data-slot="system"></section>
            </div>
          </main>
          <aside class="m-side" data-slot="today"></aside>
        </div>
        <div data-slot="sheet"></div>
      </div>`;
  }

  // Animated number roll-up for elements with data-count="<value>"
  _countUp(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.countKey || el.dataset.count;
      const to = Number(el.dataset.count);
      const from = this._nums.has(key) ? this._nums.get(key) : (this._first ? 0 : to);
      this._nums.set(key, to);
      if (!isFinite(to) || from === to) return;
      const digits = Number(el.dataset.digits || 0);
      const t0 = performance.now(), dur = 700;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = num(from + (to - from) * e, digits);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ─── signatures (only re-render what changed) ──────────────────────────────

  _sigOf(ids) {
    return ids.filter(Boolean).map(id => {
      const s = this._st(id);
      return s ? `${s.state}~${s.attributes.brightness ?? ''}~${s.attributes.temperature ?? ''}~${s.attributes.current_temperature ?? ''}~${s.last_changed}` : '-';
    }).join('|');
  }

  _allLights() { return [...new Set(this._config.rooms.flatMap(r => r.lights || []))]; }

  _sigHeader() {
    const now = new Date();
    return [now.getHours(), now.getMinutes() >> 4, this._sigOf([this._config.weather, ...this._allLights()]), this._forecast?.length, this._events?.length].join('#');
  }
  _sigActions() { return this._sigOf([...this._allLights(), ...this._config.rooms.map(r => r.fan), this._config.vacuum, this._config.door?.open]) + [...this._pending].join(); }
  _sigRooms() {
    const ids = this._config.rooms.flatMap(r => [...(r.lights || []), r.climate, r.fan, r.temperature, r.humidity]);
    return this._sigOf(ids) + this._sigOf([this._config.door?.bell]) + [...this._pending].join();
  }
  _sigToday() {
    return JSON.stringify([this._events?.length, this._events?.[0]?.summary, this._todos, new Date().getDate()]);
  }
  _sigHousehold() {
    const v = this._config.vacuum;
    const related = v ? Object.keys(this._hass.states).filter(id => id.startsWith('sensor.') && id.includes(v.split('.')[1].replace(/_\d+$/, ''))) : [];
    return this._sigOf([v, ...related]);
  }
  _sigSystem() { return this._sigOf(this._config.system.map(s => s.entity)); }
  _sigSheet() {
    if (this._sheet === null) return 'closed';
    const r = this._config.rooms[this._sheet];
    return `${this._sheet}#` + this._sigOf([...(r.lights || []), r.climate, r.fan, r.temperature, r.humidity, r.camera]);
  }

  // ─── header ────────────────────────────────────────────────────────────────

  _renderHeader() {
    const now = new Date();
    const name = this._config.name || (this._hass.user?.name || '').split(' ')[0];
    const w = this._st(this._config.weather);
    const lightsOn = this._allLights().filter(id => this._st(id)?.state === 'on').length;
    const next = (this._events || []).find(e => !e.waste && (e.allDay ? e.start >= new Date(now.toDateString()) : e.start >= now));
    const fc = (this._forecast || []).slice(0, 5);
    const summary = [
      lightsOn ? `${lightsOn} ${lightsOn === 1 ? 'Licht' : 'Lichter'} an` : 'Alle Lichter aus',
      next ? `${dayLabel(next.start) === 'Heute' ? 'Heute' : dayLabel(next.start)}: ${next.summary}` : null,
    ].filter(Boolean);
    return `
      <div class="m-hello m-anim" style="--i:0">
        <div class="m-date">${x(now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        <h1 class="m-title">${x(greeting(now))}${name ? `, ${x(name)}` : ''}</h1>
        <div class="m-summary">${summary.map(s => `<span>${x(s)}</span>`).join('<i class="m-dot"></i>')}</div>
      </div>
      ${w ? `
        <button class="m-weather m-anim m-press" style="--i:1" data-more="${x(this._config.weather)}" aria-label="Wetter">
          <div class="m-weather__now">
            ${weatherSvg(w.state, 52)}
            <div>
              <div class="m-weather__temp"><span data-count="${w.attributes.temperature}" data-digits="0" data-count-key="wx">${num(w.attributes.temperature, 0)}</span>°</div>
              <div class="m-weather__label">${x(WEATHER_LABEL[w.state] || w.state)}</div>
            </div>
          </div>
          ${fc.length ? `
            <div class="m-weather__days">
              ${fc.map((d, i) => `
                <div class="m-weather__day">
                  <span>${i === 0 ? 'Heute' : x(new Date(d.datetime).toLocaleDateString('de-DE', { weekday: 'short' }))}</span>
                  ${weatherSvg(d.condition, 26)}
                  <b>${num(d.temperature, 0)}°</b><em>${num(d.templow, 0)}°</em>
                </div>`).join('')}
            </div>` : ''}
        </button>` : ''}
    `;
  }

  // ─── quick actions ─────────────────────────────────────────────────────────

  _renderActions() {
    const lightsOn = this._allLights().filter(id => this._st(id)?.state === 'on');
    const v = this._st(this._config.vacuum);
    const cleaning = v && ['cleaning', 'returning'].includes(v.state);
    const door = this._config.door;
    const items = [];
    items.push(`
      <button class="m-action m-press${lightsOn.length ? ' is-active' : ''}" data-act="all-off" ${lightsOn.length ? '' : 'disabled'}>
        <span class="m-action__icon">${icon('mdi:power')}</span>
        <span><b>Alles aus</b><small>${lightsOn.length ? `${lightsOn.length} ${lightsOn.length === 1 ? 'Licht' : 'Lichter'} an` : 'Alles ist aus'}</small></span>
      </button>`);
    if (door?.open) items.push(`
      <button class="m-action m-press m-hold" data-act="door" aria-label="Haustür öffnen – gedrückt halten">
        <span class="m-action__icon m-hold__ring">${icon('mdi:door-open')}</span>
        <span><b>Tür öffnen</b><small class="m-hold__hint">Gedrückt halten</small></span>
      </button>`);
    if (v) items.push(`
      <button class="m-action m-press${cleaning ? ' is-active' : ''}" data-act="vacuum">
        <span class="m-action__icon${cleaning ? ' is-spin' : ''}">${icon('mdi:robot-vacuum')}</span>
        <span><b>${cleaning ? 'Zur Station' : 'Saugen'}</b><small>${x(this._vacuumLabel(v))}</small></span>
      </button>`);
    if (this._config.shopping) {
      const n = Number(this._st(this._config.shopping)?.state) || 0;
      items.push(`
        <button class="m-action m-press" data-nav="/todo?entity_id=${x(this._config.shopping)}">
          <span class="m-action__icon">${icon('mdi:cart-outline')}</span>
          <span><b>Einkauf</b><small>${n ? `${n} offen` : 'Liste leer'}</small></span>
        </button>`);
    }
    return items.map((h, i) => h.replace('class="m-action', `style="--i:${i + 2}" class="m-anim m-action`)).join('');
  }

  _vacuumLabel(v) {
    const map = { docked: 'In der Station', cleaning: 'Saugt gerade', returning: 'Fährt zurück', paused: 'Pausiert', idle: 'Bereit', error: 'Fehler' };
    return map[v.state] || v.state;
  }

  // ─── rooms ─────────────────────────────────────────────────────────────────

  _renderRooms() {
    const rooms = this._config.rooms;
    return `
      <div class="m-section-head m-anim" style="--i:4"><h2>Räume</h2><span>${rooms.length}</span></div>
      <div class="m-rooms">
        ${rooms.map((r, i) => this._renderRoomCard(r, i)).join('')}
      </div>`;
  }

  _roomTemp(r) {
    const t = this._st(r.temperature);
    if (isAvail(t)) return Number(t.state);
    const c = this._st(r.climate);
    return c?.attributes?.current_temperature ?? null;
  }

  _renderRoomCard(r, i) {
    const lights = (r.lights || []).filter(id => this._st(id));
    const on = lights.filter(id => this._st(id).state === 'on');
    const temp = this._roomTemp(r);
    const hum = this._st(r.humidity);
    const clim = this._st(r.climate);
    const heating = clim && clim.state === 'heat';
    const fan = this._st(r.fan);
    const bell = this._config.door?.bell && r.area === this._config.door.area ? this._st(this._config.door.bell) : null;
    const rang = bell && Date.now() - new Date(bell.state).getTime() < 3 * 60e3;
    const brightness = on.length ? Math.round(on.reduce((s, id) => s + (this._st(id).attributes.brightness || 255), 0) / on.length / 2.55) : 0;
    const roomIcon = r.icon || ({ wohnzimmer: 'mdi:sofa-outline', kuche: 'mdi:countertop-outline', kueche: 'mdi:countertop-outline', schlafzimmer: 'mdi:bed-outline', eingang: 'mdi:door', bad: 'mdi:shower' }[r.area] || 'mdi:home-outline');
    const chips = [];
    if (temp !== null && temp !== undefined) chips.push(`<span class="m-chip">${icon('mdi:thermometer')}<b data-count="${temp}" data-digits="1" data-count-key="t-${x(r.area)}">${num(temp)}</b>°</span>`);
    if (isAvail(hum)) chips.push(`<span class="m-chip">${icon('mdi:water-percent')}${num(hum.state, 0)}%</span>`);
    if (heating) chips.push(`<span class="m-chip is-heat">${icon('mdi:fire')}${num(clim.attributes.temperature)}°</span>`);
    if (fan && fan.state === 'on') chips.push(`<span class="m-chip is-on">${icon('mdi:fan', 'is-spin')}An</span>`);
    if (bell) chips.push(`<span class="m-chip${rang ? ' is-ring' : ''}">${icon('mdi:bell-outline', rang ? 'm-shake' : '')}${x(relTime(bell.state))}</span>`);
    return `
      <article class="m-room m-anim m-press${on.length ? ' is-lit' : ''}${rang ? ' is-ringing' : ''}" style="--i:${5 + i};--glow:${brightness / 100}" data-room="${i}" tabindex="0" role="button" aria-label="${x(r.name)} öffnen">
        <div class="m-room__glow"></div>
        <div class="m-room__top">
          <span class="m-room__icon">${icon(roomIcon)}</span>
          ${lights.length ? `
            <button class="m-switch${on.length ? ' is-on' : ''}" data-toggle-room="${i}" role="switch" aria-checked="${!!on.length}" aria-label="Licht ${x(r.name)}">
              <span class="m-switch__thumb"></span>
            </button>` : ''}
        </div>
        <div class="m-room__name">${x(r.name)}</div>
        <div class="m-room__state">${lights.length ? (on.length ? `${on.length} von ${lights.length} Lichtern · ${brightness}%` : `${lights.length} ${lights.length === 1 ? 'Licht' : 'Lichter'} aus`) : (bell ? 'Haustür' : 'Keine Lichter')}</div>
        <div class="m-room__chips">${chips.join('')}</div>
      </article>`;
  }

  // ─── room sheet ────────────────────────────────────────────────────────────

  _renderSheet() {
    if (this._sheet === null) return '';
    const r = this._config.rooms[this._sheet];
    return `
      <div class="m-scrim" data-close-sheet></div>
      <div class="m-sheet" role="dialog" aria-label="${x(r.name)}" data-sheet-room="${this._sheet}">${this._renderSheetBody()}</div>`;
  }

  _renderSheetBody() {
    const r = this._config.rooms[this._sheet];
    const lights = (r.lights || []).filter(id => this._st(id));
    const clim = this._st(r.climate);
    const fan = this._st(r.fan);
    const cam = this._st(r.camera);
    const temp = this._roomTemp(r);
    const hum = this._st(r.humidity);
    return `
        <div class="m-sheet__head">
          <div>
            <div class="m-date">Raum</div>
            <h2 class="m-sheet__title">${x(r.name)}</h2>
            <div class="m-sheet__meta">
              ${temp !== null && temp !== undefined ? `<span>${icon('mdi:thermometer')}${num(temp)} °C</span>` : ''}
              ${isAvail(hum) ? `<span>${icon('mdi:water-percent')}${num(hum.state, 0)} %</span>` : ''}
            </div>
          </div>
          <button class="m-icon-btn m-press" data-close-sheet aria-label="Schließen">${icon('mdi:close')}</button>
        </div>

        ${lights.length ? `
          <div class="m-sheet__label">Licht</div>
          <div class="m-list">
            ${lights.map(id => this._renderLightRow(id)).join('')}
          </div>` : ''}

        ${clim && isAvail(clim) ? this._renderClimate(clim) : ''}

        ${fan ? `
          <div class="m-sheet__label">Geräte</div>
          <div class="m-list">
            <div class="m-row${fan.state === 'on' ? ' is-on' : ''}">
              <span class="m-row__icon">${icon('mdi:fan', fan.state === 'on' ? 'is-spin' : '')}</span>
              <span class="m-row__name">${x(fan.attributes.friendly_name)}<small>${isAvail(fan) ? (fan.state === 'on' ? 'Läuft' : 'Aus') : 'Nicht erreichbar'}</small></span>
              ${isAvail(fan) ? `<button class="m-switch${fan.state === 'on' ? ' is-on' : ''}" data-toggle="${x(r.fan)}" role="switch" aria-checked="${fan.state === 'on'}"><span class="m-switch__thumb"></span></button>` : ''}
            </div>
          </div>` : ''}

        ${cam ? `
          <button class="m-camera m-press" data-more="${x(r.camera)}">
            <span class="m-row__icon">${icon('mdi:cctv')}</span>
            <span class="m-row__name">${x(cam.attributes.friendly_name)}<small>${isAvail(cam) ? 'Livebild öffnen' : 'Nicht erreichbar'}</small></span>
            ${icon('mdi:chevron-right', 'm-chev')}
          </button>` : ''}`;
  }

  _renderLightRow(id) {
    const s = this._st(id);
    const on = s.state === 'on';
    const avail = isAvail(s);
    const pct = on ? Math.max(1, Math.round((s.attributes.brightness ?? 255) / 2.55)) : 0;
    const dimmable = (s.attributes.supported_color_modes || []).some(m => m !== 'onoff');
    return `
      <div class="m-row m-light${on ? ' is-on' : ''}${avail ? '' : ' is-off'}" style="--pct:${pct}%">
        ${dimmable && avail ? `<div class="m-light__fill" data-slider="${x(id)}"></div>` : ''}
        <span class="m-row__icon">${icon(on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline')}</span>
        <span class="m-row__name">${x(s.attributes.friendly_name)}<small>${avail ? (on ? `${pct} %` : 'Aus') : 'Nicht erreichbar'}</small></span>
        ${avail ? `<button class="m-switch${on ? ' is-on' : ''}" data-toggle="${x(id)}" role="switch" aria-checked="${on}" aria-label="${x(s.attributes.friendly_name)}"><span class="m-switch__thumb"></span></button>` : ''}
      </div>`;
  }

  _renderClimate(c) {
    const heat = c.state === 'heat';
    const target = Number(c.attributes.temperature);
    const cur = Number(c.attributes.current_temperature);
    const min = c.attributes.min_temp ?? 5, max = c.attributes.max_temp ?? 30;
    const p = Math.max(0, Math.min(1, (target - min) / (max - min)));
    const R = 54, C = 2 * Math.PI * R, arc = 0.75;
    return `
      <div class="m-sheet__label">Heizung</div>
      <div class="m-climate${heat ? ' is-heat' : ''}">
        <div class="m-dial" style="--p:${p}">
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle class="m-dial__track" cx="64" cy="64" r="${R}" stroke-dasharray="${C * arc} ${C}" transform="rotate(135 64 64)"/>
            <circle class="m-dial__value" cx="64" cy="64" r="${R}" stroke-dasharray="${C * arc * p} ${C}" transform="rotate(135 64 64)"/>
          </svg>
          <div class="m-dial__center">
            <div class="m-dial__target"><span data-count="${target}" data-digits="1" data-count-key="ct-${x(c.entity_id)}">${num(target)}</span><sup>°</sup></div>
            <div class="m-dial__cur">Ist ${num(cur)}°</div>
          </div>
        </div>
        <div class="m-climate__ctrl">
          <button class="m-icon-btn m-press" data-temp="${x(c.entity_id)}" data-step="-0.5" aria-label="Kälter">${icon('mdi:minus')}</button>
          <button class="m-pill m-press${heat ? ' is-on' : ''}" data-hvac="${x(c.entity_id)}">${icon(heat ? 'mdi:fire' : 'mdi:power')}${heat ? 'Heizt' : 'Aus'}</button>
          <button class="m-icon-btn m-press" data-temp="${x(c.entity_id)}" data-step="0.5" aria-label="Wärmer">${icon('mdi:plus')}</button>
        </div>
      </div>`;
  }

  // ─── today column ──────────────────────────────────────────────────────────

  _renderToday() {
    const ev = this._events;
    const loading = ev === null;
    const now = new Date();
    const upcoming = (ev || []).filter(e => !e.waste && (e.allDay ? e.start >= new Date(now.toDateString()) : e.start >= now)).slice(0, 6);
    const waste = (ev || []).filter(e => e.waste).slice(0, 3);
    const groups = [];
    for (const e of upcoming) {
      const label = dayLabel(e.start);
      let g = groups.find(g => g.label === label);
      if (!g) groups.push(g = { label, items: [] });
      g.items.push(e);
    }
    const tasks = this._todos[this._config.tasks] || [];
    const tasksName = this._st(this._config.tasks)?.attributes?.friendly_name || 'Aufgaben';
    return `
      <div class="m-card m-anim" style="--i:3">
        <div class="m-card__head"><h3>${icon('mdi:calendar-blank-outline')}Als Nächstes</h3></div>
        ${loading ? `<div class="m-skel"></div><div class="m-skel"></div><div class="m-skel is-short"></div>` : groups.length ? groups.map(g => `
          <div class="m-agenda__day">${x(g.label)}</div>
          ${g.items.map(e => `
            <div class="m-agenda__item">
              <span class="m-agenda__time">${e.allDay ? 'Ganztägig' : x(e.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))}</span>
              <span class="m-agenda__bar" style="--c:${this._calColor(e.cal)}"></span>
              <span class="m-agenda__title">${x(e.summary)}<small>${x(this._st(e.cal)?.attributes?.friendly_name || '')}</small></span>
            </div>`).join('')}
        `).join('') : `<div class="m-empty">${icon('mdi:calendar-check-outline')}Keine Termine in den nächsten zwei Wochen</div>`}
        ${waste.length ? `
          <div class="m-waste">
            ${waste.map(e => { const w = WASTE.find(([re]) => re.test(e.summary)); return `<span class="m-waste__chip" style="--c:${w ? w[1] : 'var(--m-muted)'}"><i></i>${x(w ? w[2] : e.summary)} · ${x(dayLabel(e.start).replace(/,.*$/, ''))}</span>`; }).join('')}
          </div>` : ''}
      </div>

      ${this._config.tasks ? `
        <div class="m-card m-anim" style="--i:4">
          <div class="m-card__head"><h3>${icon('mdi:checkbox-marked-circle-outline')}${x(tasksName)}</h3><span class="m-count">${tasks.length}</span></div>
          <div class="m-tasks">
            ${tasks.length ? tasks.map(t => `
              <label class="m-task" data-task="${x(t.uid)}">
                <button class="m-check" data-done="${x(t.uid)}" aria-label="${x(t.summary)} erledigen">
                  <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                </button>
                <span>${x(t.summary)}</span>
              </label>`).join('') : `<div class="m-empty">${icon('mdi:party-popper')}Alles erledigt</div>`}
          </div>
          <form class="m-add" data-add-task>
            ${icon('mdi:plus')}
            <input class="m-add__input" placeholder="Aufgabe hinzufügen" aria-label="Aufgabe hinzufügen" />
          </form>
        </div>` : ''}
    `;
  }

  _calColor(cal) {
    const palette = ['#4F46E5', '#12B76A', '#F79009', '#EE46BC', '#2E90FA', '#7A5AF8'];
    const i = this._config.calendars.indexOf(cal);
    return palette[(i < 0 ? 0 : i) % palette.length];
  }

  // ─── household (vacuum) ────────────────────────────────────────────────────

  _renderHousehold() {
    const v = this._st(this._config.vacuum);
    if (!v) return '';
    const base = this._config.vacuum.split('.')[1].replace(/_\d+$/, '');
    const sensor = (re) => Object.values(this._hass.states).find(s => s.entity_id.startsWith('sensor.') && s.entity_id.includes(base) && re.test(s.entity_id));
    const battery = sensor(/batter/);
    const progress = sensor(/fortschritt|progress/);
    const area = sensor(/aktueller_raum|current_room/);
    const cleaning = ['cleaning', 'returning'].includes(v.state);
    const bat = Number(battery?.state);
    const prog = Number(progress?.state);
    return `
      <div class="m-card m-anim" style="--i:9">
        <div class="m-card__head"><h3>${icon('mdi:robot-vacuum')}${x(v.attributes.friendly_name)}</h3>
          <span class="m-status${cleaning ? ' is-live' : ''}"><i></i>${x(this._vacuumLabel(v))}</span></div>
        <div class="m-vac">
          <div class="m-vac__stat">
            <span class="m-vac__label">Akku</span>
            <span class="m-vac__val"><b data-count="${isFinite(bat) ? bat : 0}" data-digits="0" data-count-key="vac-bat">${isFinite(bat) ? bat : '–'}</b> %</span>
            <span class="m-bar"><i style="--w:${isFinite(bat) ? bat : 0}%"></i></span>
          </div>
          ${cleaning && isFinite(prog) ? `
            <div class="m-vac__stat">
              <span class="m-vac__label">Fortschritt${area && isAvail(area) ? ` · ${x(area.state)}` : ''}</span>
              <span class="m-vac__val"><b>${prog}</b> %</span>
              <span class="m-bar is-accent"><i style="--w:${prog}%"></i></span>
            </div>` : ''}
        </div>
        <div class="m-card__actions">
          ${cleaning
            ? `<button class="m-pill m-press" data-vac="pause">${icon('mdi:pause')}Pause</button><button class="m-pill m-press" data-vac="return_to_base">${icon('mdi:home-import-outline')}Zur Station</button>`
            : `<button class="m-pill m-press is-primary" data-vac="start">${icon('mdi:play')}Saugen starten</button>`}
        </div>
      </div>`;
  }

  // ─── system ────────────────────────────────────────────────────────────────

  _renderSystem() {
    const rows = this._config.system.map(s => ({ ...s, st: this._st(s.entity) })).filter(s => s.st);
    if (!rows.length) return '';
    return `
      <div class="m-card m-anim" style="--i:10">
        <div class="m-card__head"><h3>${icon('mdi:server-outline')}System</h3></div>
        <div class="m-sys">
          ${rows.map(s => {
            const ts = s.st.attributes.device_class === 'timestamp';
            const val = Number(s.st.state);
            const pct = s.max ? Math.max(0, Math.min(100, val / s.max * 100)) : val;
            const warn = !ts && isFinite(val) && (s.warn_below ? val < s.warn_below : pct >= (s.warn_above ?? 85));
            return `
              <div class="m-sys__row${warn ? ' is-warn' : ''}">
                <span class="m-row__icon">${icon(s.icon || 'mdi:gauge')}</span>
                <span class="m-sys__name">${x(s.name || s.st.attributes.friendly_name)}</span>
                ${ts
                  ? `<span class="m-sys__val">${x(relTime(s.st.state))}</span>`
                  : `<span class="m-sys__val"><b data-count="${isFinite(val) ? val : 0}" data-digits="0" data-count-key="sys-${x(s.entity)}">${isFinite(val) ? num(val, 0) : x(s.st.state)}</b>${x(s.st.attributes.unit_of_measurement || '')}</span>
                     <span class="m-bar${warn ? ' is-warn' : ''}"><i style="--w:${isFinite(pct) ? pct : 0}%"></i></span>`}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // ─── events ────────────────────────────────────────────────────────────────

  _bind(root) {
    const $ = (sel) => root.querySelectorAll(sel);

    $('[data-more]').forEach(el => el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.more }, bubbles: true, composed: true }));
    }));
    $('[data-nav]').forEach(el => el.addEventListener('click', () => {
      history.pushState(null, '', el.dataset.nav);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    }));

    $('[data-room]').forEach(el => {
      const open = (e) => {
        if (e.target.closest('[data-toggle-room]')) return;
        this._sheet = Number(el.dataset.room);
        this._update();
      };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
    });
    $('[data-close-sheet]').forEach(el => el.addEventListener('click', () => this._closeSheet()));

    $('[data-toggle-room]').forEach(el => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = this._config.rooms[Number(el.dataset.toggleRoom)];
      const lights = (r.lights || []).filter(id => isAvail(this._st(id)));
      const anyOn = lights.some(id => this._st(id).state === 'on');
      el.classList.toggle('is-on', !anyOn);
      el.closest('.m-room')?.classList.toggle('is-lit', !anyOn);
      this._svc('light', anyOn ? 'turn_off' : 'turn_on', {}, { entity_id: lights });
    }));

    $('[data-toggle]').forEach(el => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.toggle;
      el.classList.toggle('is-on');
      el.closest('.m-row')?.classList.toggle('is-on');
      this._svc(id.split('.')[0], 'toggle', {}, { entity_id: id });
    }));

    $('[data-slider]').forEach(el => this._bindSlider(el));

    $('[data-temp]').forEach(el => el.addEventListener('click', () => {
      const s = this._st(el.dataset.temp);
      const t = Math.round((Number(s.attributes.temperature) + Number(el.dataset.step)) * 2) / 2;
      this._svc('climate', 'set_temperature', { temperature: t }, { entity_id: el.dataset.temp });
    }));
    $('[data-hvac]').forEach(el => el.addEventListener('click', () => {
      const s = this._st(el.dataset.hvac);
      this._svc('climate', 'set_hvac_mode', { hvac_mode: s.state === 'heat' ? 'off' : 'heat' }, { entity_id: el.dataset.hvac });
    }));

    $('[data-vac]').forEach(el => el.addEventListener('click', () => {
      this._svc('vacuum', el.dataset.vac, {}, { entity_id: this._config.vacuum });
    }));

    $('[data-act="all-off"]').forEach(el => el.addEventListener('click', () => {
      const lights = this._allLights().filter(id => this._st(id)?.state === 'on');
      const fans = this._config.rooms.map(r => r.fan).filter(id => this._st(id)?.state === 'on');
      el.classList.add('is-done');
      if (lights.length) this._svc('light', 'turn_off', {}, { entity_id: lights });
      if (fans.length) this._svc('fan', 'turn_off', {}, { entity_id: fans });
    }));
    $('[data-act="vacuum"]').forEach(el => el.addEventListener('click', () => {
      const v = this._st(this._config.vacuum);
      this._svc('vacuum', ['cleaning', 'returning'].includes(v.state) ? 'return_to_base' : 'start', {}, { entity_id: this._config.vacuum });
    }));
    $('[data-act="door"]').forEach(el => this._bindHold(el, () => {
      this._svc('button', 'press', {}, { entity_id: this._config.door.open });
    }));

    $('[data-done]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      const uid = el.dataset.done;
      const row = el.closest('.m-task');
      row.classList.add('is-done');
      setTimeout(() => {
        row.classList.add('is-leaving');
        this._svc('todo', 'update_item', { item: uid, status: 'completed' }, { entity_id: this._config.tasks })
          .then(() => setTimeout(() => this._fetchTodos(), 300));
      }, 450);
    }));
    $('[data-add-task]').forEach(form => form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      this._svc('todo', 'add_item', { item: v }, { entity_id: this._config.tasks }).then(() => this._fetchTodos());
    }));
  }

  _closeSheet() {
    const sheet = this.shadowRoot.querySelector('.m-sheet');
    if (!sheet) { this._sheet = null; return; }
    sheet.classList.add('is-closing');
    this.shadowRoot.querySelector('.m-scrim')?.classList.add('is-closing');
    setTimeout(() => { this._sheet = null; this._update(); }, 180);
  }

  // Drag the light row horizontally to set brightness
  _bindSlider(fill) {
    const row = fill.closest('.m-light');
    const id = fill.dataset.slider;
    let startX = 0, moved = false, pct = 0;
    const setPct = (clientX) => {
      const r = row.getBoundingClientRect();
      pct = Math.max(1, Math.min(100, Math.round((clientX - r.left) / r.width * 100)));
      row.style.setProperty('--pct', pct + '%');
      row.classList.add('is-on');
      const small = row.querySelector('.m-row__name small');
      if (small) small.textContent = `${pct} %`;
    };
    row.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.m-switch')) return;
      startX = e.clientX; moved = false;
      row.setPointerCapture(e.pointerId);
      row.classList.add('is-dragging');
      this._dragging = true;
    });
    row.addEventListener('pointermove', (e) => {
      if (!this._dragging || !row.hasPointerCapture(e.pointerId)) return;
      if (Math.abs(e.clientX - startX) > 4) moved = true;
      if (moved) setPct(e.clientX);
    });
    const end = (e) => {
      if (!row.hasPointerCapture?.(e.pointerId)) return;
      row.releasePointerCapture(e.pointerId);
      row.classList.remove('is-dragging');
      this._dragging = false;
      if (moved) this._svc('light', 'turn_on', { brightness_pct: pct }, { entity_id: id });
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  }

  // Press-and-hold for sensitive actions (door): ring fills, then fires
  _bindHold(el, action) {
    const HOLD = 1100;
    let timer = null;
    const hint = el.querySelector('.m-hold__hint');
    const start = (e) => {
      e.preventDefault();
      el.classList.add('is-holding');
      timer = setTimeout(() => {
        el.classList.remove('is-holding');
        el.classList.add('is-confirmed');
        if (hint) hint.textContent = 'Geöffnet';
        action();
        setTimeout(() => { el.classList.remove('is-confirmed'); if (hint) hint.textContent = 'Gedrückt halten'; }, 2200);
      }, HOLD);
    };
    const cancel = () => { clearTimeout(timer); el.classList.remove('is-holding'); };
    el.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, cancel));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) start(e); });
    el.addEventListener('keyup', cancel);
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  :host {
    --m-bg: var(--primary-background-color, #F4F5F8);
    --m-card: var(--ha-card-background, var(--card-background-color, #fff));
    --m-line: var(--ha-card-border-color, var(--divider-color, rgba(127,127,127,.18)));
    --m-text: var(--primary-text-color, #101828);
    --m-muted: var(--secondary-text-color, #667085);
    --m-accent: var(--primary-color, #4F46E5);
    --m-accent-rgb: var(--rgb-primary-color, 79, 70, 229);
    --m-fill: rgba(127,127,127,.10);
    --m-fill-2: rgba(127,127,127,.16);
    --m-warm: 245, 166, 35;
    --m-heat: 247, 104, 8;
    --m-cloud: #C9D1DE;
    --m-cloud-2: #AEB7C6;
    --m-radius: 20px;
    --m-ease: cubic-bezier(.2,.8,.2,1);
    --m-spring: cubic-bezier(.34,1.56,.64,1);
    display: block;
    font-family: var(--ha-font-family-body, var(--primary-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif));
    color: var(--m-text);
    -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }
  ha-icon { --mdc-icon-size: 20px; display: inline-flex; }
  h1, h2, h3 { margin: 0; }

  .m-root { max-width: 1320px; margin: 0 auto; padding: 28px 28px 48px; }

  /* entrance: staggered rise */
  .m-anim { opacity: 0; transform: translateY(10px); }
  .is-ready .m-anim, .m-anim.is-in { animation: m-rise .6s var(--m-ease) both; animation-delay: calc(var(--i, 0) * 45ms); }
  .is-settled .m-anim { animation: none; opacity: 1; transform: none; }
  @keyframes m-rise { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: none; } }

  /* press feedback */
  .m-press { transition: transform .25s var(--m-spring), background-color .2s, box-shadow .25s, border-color .2s; }
  .m-press:active { transform: scale(.97); }

  /* ── header ── */
  .m-header { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; margin-bottom: 22px; }
  .m-date { font-size: 13px; font-weight: 600; letter-spacing: .02em; color: var(--m-muted); text-transform: capitalize; }
  .m-title { font-size: clamp(28px, 3.4vw, 40px); font-weight: 700; letter-spacing: -.025em; line-height: 1.1; margin-top: 6px; }
  .m-summary { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--m-muted); font-size: 15px; }
  .m-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: .5; display: inline-block; }

  .m-weather { display: flex; gap: 22px; align-items: center; padding: 14px 18px; border-radius: var(--m-radius);
    background: var(--m-card); border: 1px solid var(--m-line); }
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
  .wx-moon { animation: m-float 5s ease-in-out infinite alternate; transform-origin: center; }
  @keyframes m-spin { to { transform: rotate(360deg); } }
  @keyframes m-drift { from { transform: translateX(-1.5px); } to { transform: translateX(1.5px); } }
  @keyframes m-rain { 0% { opacity: 0; transform: translateY(-3px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(4px); } }
  @keyframes m-snow { 0%,100% { transform: translateY(-1px); opacity: .5; } 50% { transform: translateY(2px); opacity: 1; } }
  @keyframes m-float { from { transform: translateY(-1px); } to { transform: translateY(1.5px); } }

  /* ── quick actions ── */
  .m-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 26px; }
  .m-action { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px;
    background: var(--m-card); border: 1px solid var(--m-line); }
  .m-action:hover:not(:disabled) { border-color: rgba(var(--m-accent-rgb), .35); box-shadow: 0 6px 20px -12px rgba(var(--m-accent-rgb), .45); }
  .m-action:disabled { cursor: default; }
  .m-action b { display: block; font-size: 14px; font-weight: 600; }
  .m-action small { display: block; font-size: 12px; color: var(--m-muted); margin-top: 2px; }
  .m-action__icon { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0;
    background: var(--m-fill); color: var(--m-muted); position: relative; transition: background .3s, color .3s; }
  .m-action.is-active .m-action__icon { background: rgba(var(--m-accent-rgb), .12); color: var(--m-accent); }
  .m-action.is-done .m-action__icon { animation: m-pop .5s var(--m-spring); }
  @keyframes m-pop { 0% { transform: scale(1); } 40% { transform: scale(.85); } 100% { transform: scale(1); } }
  .is-spin { animation: m-spin 1.6s linear infinite; }

  /* hold-to-confirm ring */
  .m-hold__ring::after { content: ''; position: absolute; inset: -3px; border-radius: 14px;
    background: conic-gradient(var(--m-accent) calc(var(--hold, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); opacity: 0; }
  .m-hold.is-holding .m-hold__ring::after { opacity: 1; animation: m-hold 1.1s linear forwards; }
  @property --hold { syntax: '<number>'; inherits: false; initial-value: 0; }
  @keyframes m-hold { from { --hold: 0; } to { --hold: 1; } }
  .m-hold.is-confirmed .m-action__icon { background: rgba(18,183,106,.14); color: #12B76A; animation: m-pop .5s var(--m-spring); }

  /* ── layout ── */
  .m-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; }
  .m-main { display: grid; gap: 24px; min-width: 0; }
  .m-side { display: grid; gap: 16px; position: sticky; top: 16px; }
  .m-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .m-duo > section:empty { display: none; }

  .m-section-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
  .m-section-head h2 { font-size: 18px; font-weight: 650; letter-spacing: -.01em; }
  .m-section-head span { font-size: 13px; color: var(--m-muted); }

  /* ── rooms ── */
  .m-rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
  .m-room { position: relative; overflow: hidden; isolation: isolate; cursor: pointer; padding: 16px; min-height: 168px;
    border-radius: var(--m-radius); background: var(--m-card); border: 1px solid var(--m-line); display: flex; flex-direction: column; outline: none; }
  .m-room:hover { border-color: rgba(var(--m-accent-rgb), .3); transform: translateY(-2px); box-shadow: 0 14px 30px -20px rgba(16,24,40,.35); }
  .m-room:focus-visible { box-shadow: 0 0 0 3px rgba(var(--m-accent-rgb), .35); }
  .m-room__glow { position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity .6s var(--m-ease);
    background: radial-gradient(120% 90% at 0% 0%, rgba(var(--m-warm), calc(.10 + var(--glow, .5) * .22)), transparent 60%),
                radial-gradient(90% 70% at 100% 100%, rgba(var(--m-warm), .07), transparent 70%); }
  .m-room.is-lit { border-color: rgba(var(--m-warm), .38); }
  .m-room.is-lit .m-room__glow { opacity: 1; animation: m-breathe 5s ease-in-out infinite; }
  @keyframes m-breathe { 0%,100% { filter: saturate(1); } 50% { filter: saturate(1.25) brightness(1.04); } }
  .m-room__top { display: flex; justify-content: space-between; align-items: flex-start; }
  .m-room__icon { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center;
    background: var(--m-fill); color: var(--m-muted); transition: background .4s, color .4s, box-shadow .4s; }
  .m-room__icon ha-icon { --mdc-icon-size: 24px; }
  .m-room.is-lit .m-room__icon { background: rgba(var(--m-warm), .18); color: rgb(var(--m-warm)); box-shadow: 0 0 24px -4px rgba(var(--m-warm), .55); }
  .m-room__name { margin-top: auto; padding-top: 18px; font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
  .m-room__state { font-size: 13px; color: var(--m-muted); margin-top: 3px; }
  .m-room__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .m-room.is-ringing { border-color: rgba(var(--m-accent-rgb), .5); }

  .m-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 999px;
    background: var(--m-fill); font-size: 12px; font-weight: 500; color: var(--m-text); }
  .m-chip ha-icon { --mdc-icon-size: 14px; color: var(--m-muted); }
  .m-chip b { font-weight: 600; }
  .m-chip.is-heat { background: rgba(var(--m-heat), .12); color: rgb(var(--m-heat)); }
  .m-chip.is-heat ha-icon { color: inherit; }
  .m-chip.is-on ha-icon { color: var(--m-accent); }
  .m-chip.is-ring { background: rgba(var(--m-accent-rgb), .12); color: var(--m-accent); }
  .m-shake { animation: m-shake 1.2s ease-in-out infinite; transform-origin: 50% 10%; }
  @keyframes m-shake { 0%,60%,100% { transform: rotate(0); } 10%,30% { transform: rotate(14deg); } 20%,40% { transform: rotate(-14deg); } }

  /* switch with spring */
  .m-switch { width: 44px; height: 26px; border-radius: 999px; background: var(--m-fill-2); position: relative; flex-shrink: 0;
    transition: background .3s var(--m-ease); }
  .m-switch__thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
    box-shadow: 0 1px 3px rgba(16,24,40,.25); transition: transform .45s var(--m-spring), width .2s; }
  .m-switch:active .m-switch__thumb { width: 24px; }
  .m-switch.is-on { background: var(--m-accent); }
  .m-room .m-switch.is-on { background: rgb(var(--m-warm)); }
  .m-switch.is-on .m-switch__thumb { transform: translateX(18px); }
  .m-switch.is-on:active .m-switch__thumb { transform: translateX(14px); }

  /* ── cards ── */
  .m-card { background: var(--m-card); border: 1px solid var(--m-line); border-radius: var(--m-radius); padding: 18px; }
  .m-card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  .m-card__head h3 { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 650; }
  .m-card__head h3 ha-icon { --mdc-icon-size: 18px; color: var(--m-muted); }
  .m-count { font-size: 12px; font-weight: 600; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px;
    background: var(--m-fill); display: inline-grid; place-items: center; color: var(--m-muted); }
  .m-card__actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .m-empty { display: flex; align-items: center; gap: 8px; color: var(--m-muted); font-size: 14px; padding: 10px 0; }
  .m-empty ha-icon { --mdc-icon-size: 18px; }

  .m-skel { height: 40px; border-radius: 10px; margin: 8px 0;
    background: linear-gradient(90deg, var(--m-fill) 0%, var(--m-fill-2) 40%, var(--m-fill) 80%); background-size: 300% 100%;
    animation: m-shimmer 1.4s ease-in-out infinite; }
  .m-skel.is-short { width: 60%; }
  @keyframes m-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }

  /* agenda */
  .m-agenda__day { font-size: 12px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: var(--m-muted); margin: 12px 0 6px; }
  .m-agenda__day:first-of-type { margin-top: 0; }
  .m-agenda__item { display: grid; grid-template-columns: 70px 3px 1fr; gap: 10px; align-items: center; padding: 7px 0; }
  .m-agenda__time { font-size: 13px; color: var(--m-muted); font-variant-numeric: tabular-nums; }
  .m-agenda__bar { align-self: stretch; border-radius: 3px; background: var(--c); }
  .m-agenda__title { font-size: 14px; font-weight: 550; line-height: 1.3; }
  .m-agenda__title small { display: block; font-size: 12px; font-weight: 400; color: var(--m-muted); }
  .m-waste { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--m-line); }
  .m-waste__chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 5px 9px;
    border-radius: 999px; background: var(--m-fill); }
  .m-waste__chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }

  /* tasks */
  .m-tasks { display: grid; }
  .m-task { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--m-line); font-size: 14px;
    transition: opacity .3s, transform .35s var(--m-ease), max-height .35s var(--m-ease), padding .35s; max-height: 60px; overflow: hidden; }
  .m-task:last-child { border-bottom: 0; }
  .m-check { width: 22px; height: 22px; border-radius: 50%; border: 1.8px solid var(--m-fill-2); flex-shrink: 0; display: grid; place-items: center;
    transition: background .25s, border-color .25s, transform .3s var(--m-spring); }
  .m-check:hover { border-color: var(--m-accent); }
  .m-check svg { width: 14px; height: 14px; fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 22; stroke-dashoffset: 22; transition: stroke-dashoffset .35s .1s var(--m-ease); }
  .m-task.is-done .m-check { background: var(--m-accent); border-color: var(--m-accent); transform: scale(1.1); }
  .m-task.is-done .m-check svg { stroke-dashoffset: 0; }
  .m-task.is-done span { color: var(--m-muted); text-decoration: line-through; transition: color .3s; }
  .m-task.is-leaving { opacity: 0; transform: translateX(12px); max-height: 0; padding: 0; border-color: transparent; }
  .m-add { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 8px 10px; border-radius: 12px; background: var(--m-fill); color: var(--m-muted); }
  .m-add:focus-within { box-shadow: 0 0 0 2px rgba(var(--m-accent-rgb), .35); }
  .m-add__input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; font-size: 14px; color: var(--m-text); }
  .m-add__input::placeholder { color: var(--m-muted); }

  /* vacuum + system */
  .m-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--m-muted); }
  .m-status i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .6; }
  .m-status.is-live { color: #12B76A; }
  .m-status.is-live i { opacity: 1; animation: m-ping 1.6s ease-out infinite; }
  @keyframes m-ping { 0% { box-shadow: 0 0 0 0 rgba(18,183,106,.5); } 100% { box-shadow: 0 0 0 8px rgba(18,183,106,0); } }
  .m-vac { display: grid; gap: 14px; }
  .m-vac__stat { display: grid; grid-template-columns: 1fr auto; gap: 6px 10px; align-items: baseline; }
  .m-vac__label { font-size: 13px; color: var(--m-muted); }
  .m-vac__val { font-size: 13px; color: var(--m-muted); }
  .m-vac__val b { font-size: 20px; color: var(--m-text); font-weight: 700; }
  .m-bar { grid-column: 1 / -1; height: 6px; border-radius: 999px; background: var(--m-fill); overflow: hidden; display: block; }
  .m-bar i { display: block; height: 100%; width: var(--w); border-radius: inherit; background: #12B76A;
    animation: m-grow .9s var(--m-ease) both; transform-origin: left; }
  .m-bar.is-accent i { background: var(--m-accent); }
  .m-bar.is-warn i { background: #F79009; }
  @keyframes m-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .m-sys { display: grid; gap: 12px; }
  .m-sys__row { display: grid; grid-template-columns: 32px 1fr auto; gap: 4px 10px; align-items: center; }
  .m-sys__row .m-bar { grid-column: 2 / -1; height: 4px; }
  .m-sys__row .m-bar i { background: var(--m-accent); }
  .m-sys__row.is-warn .m-bar i { background: #F79009; }
  .m-sys__name { font-size: 13px; }
  .m-sys__val { font-size: 12px; color: var(--m-muted); font-variant-numeric: tabular-nums; }
  .m-sys__val b { font-size: 14px; color: var(--m-text); font-weight: 650; margin-right: 1px; }

  .m-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: var(--m-fill);
    font-size: 13px; font-weight: 600; }
  .m-pill ha-icon { --mdc-icon-size: 16px; }
  .m-pill:hover { background: var(--m-fill-2); }
  .m-pill.is-primary { background: var(--m-accent); color: #fff; }
  .m-pill.is-on { background: rgba(var(--m-heat), .14); color: rgb(var(--m-heat)); }
  .m-icon-btn { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--m-fill); }
  .m-icon-btn:hover { background: var(--m-fill-2); }

  /* rows */
  .m-row__icon { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--m-fill);
    color: var(--m-muted); flex-shrink: 0; transition: background .3s, color .3s; }
  .m-row__icon ha-icon { --mdc-icon-size: 18px; }

  /* ── sheet ── */
  .m-scrim { position: fixed; inset: 0; z-index: 10; background: rgba(10,12,18,.42); backdrop-filter: blur(6px);
    animation: m-fade .25s var(--m-ease) both; }
  .m-sheet { position: fixed; z-index: 11; top: 50%; left: 50%; width: min(520px, calc(100vw - 32px)); max-height: min(86vh, 760px); overflow: auto;
    transform: translate(-50%, -50%); background: var(--m-card); border: 1px solid var(--m-line); border-radius: 24px; padding: 22px;
    box-shadow: 0 40px 80px -30px rgba(0,0,0,.45); animation: m-sheet-in .38s var(--m-spring) both; overscroll-behavior: contain; }
  .m-sheet.is-closing, .m-scrim.is-closing { animation: m-fade .18s reverse both; }
  @keyframes m-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes m-sheet-in { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  .m-sheet__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .m-sheet__title { font-size: 24px; font-weight: 700; letter-spacing: -.02em; margin-top: 4px; }
  .m-sheet__meta { display: flex; gap: 12px; margin-top: 8px; font-size: 13px; color: var(--m-muted); }
  .m-sheet__meta span { display: inline-flex; align-items: center; gap: 4px; }
  .m-sheet__meta ha-icon { --mdc-icon-size: 16px; }
  .m-sheet__label { font-size: 12px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; color: var(--m-muted); margin: 20px 0 8px; }
  .m-list { display: grid; gap: 8px; }
  .m-row { position: relative; overflow: hidden; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px;
    background: var(--m-fill); isolation: isolate; }
  .m-row__name { flex: 1; font-size: 14px; font-weight: 600; min-width: 0; }
  .m-row__name small { display: block; font-size: 12px; font-weight: 400; color: var(--m-muted); margin-top: 1px; }
  .m-row.is-on .m-row__icon { background: rgba(var(--m-warm), .2); color: rgb(var(--m-warm)); }
  .m-row.is-off { opacity: .55; }
  .m-light { touch-action: pan-y; cursor: ew-resize; user-select: none; }
  .m-light__fill { position: absolute; inset: 0; z-index: -1; width: var(--pct); border-radius: inherit;
    background: linear-gradient(90deg, rgba(var(--m-warm), .14), rgba(var(--m-warm), .26)); transition: width .45s var(--m-ease); }
  .m-light.is-dragging .m-light__fill { transition: none; }
  .m-light.is-dragging { box-shadow: 0 0 0 2px rgba(var(--m-warm), .45); }
  .m-row .m-switch.is-on { background: rgb(var(--m-warm)); }
  .m-camera { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; margin-top: 12px; border-radius: 16px; background: var(--m-fill); }
  .m-camera:hover { background: var(--m-fill-2); }
  .m-chev { color: var(--m-muted); }

  /* climate dial */
  .m-climate { display: grid; grid-template-columns: 150px 1fr; gap: 18px; align-items: center; padding: 14px; border-radius: 16px; background: var(--m-fill); }
  .m-dial { position: relative; width: 150px; height: 150px; }
  .m-dial svg { width: 100%; height: 100%; }
  .m-dial circle { fill: none; stroke-width: 10; stroke-linecap: round; }
  .m-dial__track { stroke: var(--m-fill-2); }
  .m-dial__value { stroke: var(--m-muted); transition: stroke-dasharray .6s var(--m-ease), stroke .4s; }
  .m-climate.is-heat .m-dial__value { stroke: rgb(var(--m-heat)); filter: drop-shadow(0 0 6px rgba(var(--m-heat), .45)); }
  .m-dial__center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
  .m-dial__target { font-size: 34px; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
  .m-dial__target sup { font-size: 16px; font-weight: 600; }
  .m-dial__cur { font-size: 12px; color: var(--m-muted); margin-top: 4px; }
  .m-climate__ctrl { display: flex; align-items: center; justify-content: center; gap: 10px; }

  /* ── responsive ── */
  @media (max-width: 1100px) {
    .m-grid { grid-template-columns: 1fr; }
    .m-main { display: contents; }
    [data-slot="rooms"] { order: 1; }
    .m-side { order: 2; position: static; grid-template-columns: 1fr 1fr; }
    .m-duo { order: 3; }
  }
  @media (max-width: 760px) {
    .m-root { padding: 18px 14px 32px; }
    .m-header { grid-template-columns: 1fr; gap: 16px; }
    .m-weather { justify-content: space-between; }
    .m-weather__days { gap: 10px; padding-left: 12px; }
    .m-weather__day:nth-child(n+4) { display: none; }
    .m-actions { display: flex; overflow-x: auto; margin: 0 -14px 22px; padding: 2px 14px; scrollbar-width: none; scroll-snap-type: x mandatory; }
    .m-actions::-webkit-scrollbar { display: none; }
    .m-action { flex: 0 0 auto; min-width: 170px; scroll-snap-align: start; }
    .m-side { grid-template-columns: 1fr; }
    .m-duo { grid-template-columns: 1fr; }
    .m-rooms { grid-template-columns: 1fr 1fr; gap: 10px; }
    .m-room { min-height: 150px; padding: 14px; }
    .m-climate { grid-template-columns: 1fr; justify-items: center; }
    .m-sheet { top: auto; bottom: 0; left: 0; transform: none; width: 100%; max-height: 88vh; border-radius: 24px 24px 0 0;
      animation: m-sheet-up .42s var(--m-spring) both; }
    @keyframes m-sheet-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
    .m-anim { opacity: 1; transform: none; }
  }
`;

customElements.define('meridian-home-card', MeridianHomeCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'meridian-home-card', name: 'Meridian Home', description: 'Modernes Home-Dashboard mit Räumen, Agenda, Aufgaben und Mikro-Animationen.' });
console.info(`%c MERIDIAN HOME %c ${VERSION} `, 'background:#4F46E5;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px', 'background:#EEF0FF;color:#4F46E5;border-radius:0 4px 4px 0;padding:2px 6px');
