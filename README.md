# Global Polycrisis Atlas, 2000–2025

An interactive map dashboard of overlapping global crises in the 21st century: armed conflict, climate and natural hazards, pandemics, food and energy shocks, political upheaval, and financial crises.

**Live site:** https://hunterhghs.github.io/21st-century-polycrisis-dashboard/ (after GitHub Pages is enabled)

## Features

- **World map** (D3, Equal Earth projection) with 112 curated crises as markers. Shape and colour show the domain, size shows severity, and a dashed ring marks a global shock.
- **Country shading** by *concurrence*: the number of distinct crisis domains a country faced in the selected window, or the raw number of crises.
- **Time controls**: a year slider with play/pause (← / → keys work too), plus *Active in year* vs *Cumulative since 2000* modes.
- **Domain filters** that double as the legend (⌥/⌘-click to isolate one domain).
- **Side panel**: a polycrisis hotspot ranking, country profiles, and event details.
- **Timeline**: stacked bars of active crises per year by domain, with global-shock lanes.
- **Indicators**: small multiples of global temperature, CO₂, armed conflicts, displacement, food prices and acute hunger, synced to the selected year.
- Light and dark themes, a responsive layout, and a full data table for accessibility.

## Deploying on GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`. There is no build step; it's plain static HTML, CSS and JS.

To run it locally:

```bash
python3 -m http.server 8000
```

## Data

| File | Contents |
|---|---|
| `data/events.js` | Crisis catalogue: domain(s), years, affected countries (ISO-3), epicentre, severity, headline impact |
| `data/indicators.js` | Annual global indicator series |

Sources: UN OCHA, UNHCR, WHO, IPC, EM-DAT, UCDP, Costs of War, World Bank, IMF, NASA GISTEMP, NOAA GML, FAO, Global Report on Food Crises. Figures are rounded, and many are contested estimates. The catalogue is illustrative, not exhaustive. Country boundaries come from Natural Earth via [`world-atlas`](https://github.com/topojson/world-atlas).

### Colour

Domain colours use a categorical palette checked for colour-vision-deficiency separation. Because six hues on a map can't all be told apart by colour alone, every domain also has its own marker shape: circle, triangle, cross, square, diamond and star.
