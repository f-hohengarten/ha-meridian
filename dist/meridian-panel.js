// Meridian loader — keeps the panel URL stable in configuration.yaml while always
// loading the latest app, so updates don't need a Home Assistant restart.
await import(new URL(`./meridian-app.js?t=${Date.now()}`, import.meta.url).href);
