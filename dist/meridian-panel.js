// Meridian loader — keeps the panel URL stable in configuration.yaml while always
// loading the latest app, so updates don't need a Home Assistant restart.
// No top-level await (unreliable in some WebKit builds); the app re-applies props
// that HA set before the element was defined.
import(new URL(`./meridian-app.js?t=${Date.now()}`, import.meta.url).href)
  .catch(e => console.error('[meridian] failed to load app', e));
