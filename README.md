# Meridian for Home Assistant

A complete, software-like UI for Home Assistant — plus a matching global theme.

## Meridian app (custom panel) — `dist/meridian-panel.js`

Own navigation (sidebar on desktop, tab bar on mobile), real routes and pages:
Home · Räume (+ one page per area) · Kalender · Listen (all to-do lists + meal planner) ·
Geräte (Licht, Klima, Medien, Kameras) · Haushalt · Automationen · System · Einstellungen.
Everything is discovered from your HA areas, devices and entities. An edit mode lets you
reorder/hide rooms, hide devices and add any entity or Lovelace card as a widget
(stored per user in HA). ⌘K opens a command palette. Micro-animations throughout.

```yaml
# configuration.yaml
panel_custom:
  - name: meridian-panel
    url_path: meridian
    sidebar_title: Meridian
    sidebar_icon: mdi:home-variant-outline
    module_url: /local/meridian/meridian-panel.js?v=0.2.0
```
Copy `dist/meridian-panel.js` to `/config/www/meridian/`, add the block above, restart HA.

## Lovelace card — `dist/meridian-home-card.js`

- **`dist/meridian-home-card.js`** – `custom:meridian-home-card`: greeting, live weather,
  quick actions, room cards (warm glow when lights are on, tap for a room sheet with
  draggable brightness, thermostat dial, fan, camera), "Als Nächstes" agenda with waste
  pickups, tasks with animated check-off, vacuum and system status.
  Micro-animations throughout; respects "reduce motion".
- **`themes/meridian.yaml`** – global light/dark theme (classic vars, HA 2025+ design
  tokens, Mushroom vars). Light: cool grey canvas, white cards with hairlines, one indigo
  accent. Dark: near-black blue-grey, cards one step lighter, softer indigo.
- **`dashboards/home.yaml`** – a ready dashboard config using the card.

## Install

1. Copy `dist/meridian-home-card.js` to `/config/www/meridian/` and add the resource
   `/local/meridian/meridian-home-card.js` (type: JavaScript module).
2. Copy `themes/meridian.yaml` to `/config/themes/` (needs
   `frontend: themes: !include_dir_merge_named themes`), run `frontend.reload_themes`,
   pick **Meridian** in your profile.
3. Create a dashboard and paste `dashboards/home.yaml` into the raw configuration editor.

## Card options

| Option | Description |
|---|---|
| `name` | Name in the greeting (default: HA user) |
| `weather` | Weather entity (auto) |
| `calendars` | Calendars for "Als Nächstes" (auto: all) |
| `waste_calendar` | Calendar shown as waste pickup chips |
| `tasks` / `shopping` | To-do entities |
| `vacuum` | Vacuum entity (auto) |
| `door` | `{ area, open: button.x, bell: event.y }` – hold-to-open action + bell on the room card |
| `rooms` | `[{ area, name, icon, lights, climate, fan, camera, temperature, humidity }]` (auto from areas) |
| `system` | `[{ entity, name, icon, max, warn_above, warn_below }]` |

## Known limits

Cards with hard-coded colours (e.g. some thermostat or calendar cards) ignore
theme variables and keep their own look.
