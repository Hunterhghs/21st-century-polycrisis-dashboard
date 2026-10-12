(() => {
  "use strict";

  const DOMAINS = window.DOMAINS;
  const EVENTS = window.EVENTS;
  const ISO_NUM = window.ISO_NUM;
  const INDICATORS = window.INDICATORS;
  const MIN_YEAR = 2000;
  const MAX_YEAR = 2025;
  const YEARS = d3.range(MIN_YEAR, MAX_YEAR + 1);
  const DOMAIN_BY_KEY = Object.fromEntries(DOMAINS.map(d => [d.key, d]));
  const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

  const SYMBOLS = {
    circle: d3.symbolCircle, triangle: d3.symbolTriangle, cross: d3.symbolCross,
    square: d3.symbolSquare, diamond: d3.symbolDiamond, star: d3.symbolStar
  };
  const SEV_AREA = { 1: 64, 2: 130, 3: 230 };
  const SEV_LABEL = { 1: "Significant", 2: "Major", 3: "Catastrophic / systemic" };

  const color = key => `var(--c-${key})`;
  const symbolPath = (key, area) => d3.symbol().type(SYMBOLS[DOMAIN_BY_KEY[key].symbol]).size(area)();
  const glyph = (key, size = 12) => {
    const s = size;
    return `<svg width="${s}" height="${s}" viewBox="${-s / 2} ${-s / 2} ${s} ${s}" aria-hidden="true"><path d="${symbolPath(key, s * s * 0.42)}" fill="${color(key)}"/></svg>`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const yearsLabel = e => e.s === (e.e ?? MAX_YEAR) && e.e !== null ? `${e.s}` : `${e.s}–${e.e === null ? "ongoing" : e.e}`;
  const eventDomains = e => [e.d, ...(e.also || [])];

  EVENTS.forEach(e => { e.ids = e.c.map(a => ISO_NUM[a]).filter(Boolean); });

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    year: MAX_YEAR,
    mode: "year",
    shade: "domains",
    includeGlobal: true,
    domains: new Set(DOMAINS.map(d => d.key)),
    country: null,   // numeric id
    event: null,     // event id
    playing: false
  };

  let countries = [];          // GeoJSON features
  let countryName = new Map(); // id -> name
  let stats = new Map();       // id -> { domains:Set, events:[] }
  let active = [];

  const tooltip = document.getElementById("tooltip");

  // ── Derivations ────────────────────────────────────────────────────────
  const inWindow = e => {
    const end = e.e ?? MAX_YEAR;
    return state.mode === "year" ? e.s <= state.year && end >= state.year : e.s <= state.year;
  };
  const activeInYear = (e, y) => e.s <= y && (e.e ?? MAX_YEAR) >= y;

  function compute() {
    active = EVENTS.filter(e => state.domains.has(e.d) && inWindow(e));
    stats = new Map();
    const get = id => {
      if (!stats.has(id)) stats.set(id, { domains: new Set(), events: [] });
      return stats.get(id);
    };
    const allIds = countries.map(f => f.id);
    for (const e of active) {
      const doms = eventDomains(e).filter(k => state.domains.has(k));
      for (const id of e.ids) {
        const s = get(id);
        doms.forEach(k => s.domains.add(k));
        s.events.push(e);
      }
      if (e.g && state.includeGlobal) {
        const listed = new Set(e.ids);
        for (const id of allIds) {
          if (listed.has(id)) continue;
          const s = get(id);
          s.domains.add(e.d);
          s.events.push(e);
        }
      }
    }
  }

  const shadeValue = id => {
    const s = stats.get(id);
    if (!s) return 0;
    return state.shade === "events" ? s.events.length : s.domains.size;
  };
  const EVENT_BREAKS = [1, 2, 3, 4, 6, 9]; // lower bounds of steps 1..6
  const shadeStep = v => {
    if (state.shade === "none" || v <= 0) return 0;
    if (state.shade === "domains") return Math.min(v, 6);
    let step = 0;
    EVENT_BREAKS.forEach((b, i) => { if (v >= b) step = i + 1; });
    return step;
  };
  const shadeFill = id => {
    const step = shadeStep(shadeValue(id));
    return step === 0 ? "var(--land)" : `var(--s${step})`;
  };

  const latestValue = (ind, y) => {
    let best = null;
    for (const k of Object.keys(ind.data)) { const yr = +k; if (yr <= y && (best === null || yr > best)) best = yr; }
    return best === null ? null : { year: best, value: ind.data[best] };
  };

  // ── Map ────────────────────────────────────────────────────────────────
  const W = 960, H = 470;
  const svg = d3.select("#map");
  const projection = d3.geoEqualEarth();
  const path = d3.geoPath(projection);
  const zoomLayer = svg.append("g");
  const gBase = zoomLayer.append("g");
  const gCountries = zoomLayer.append("g");
  const gMarkers = zoomLayer.append("g");
  let zoomK = 1;

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [W, H]])
    .on("zoom", ev => {
      zoomK = ev.transform.k;
      zoomLayer.attr("transform", ev.transform);
      gMarkers.selectAll("g.marker").attr("transform", d => markerTransform(d));
    });
  svg.call(zoom).on("dblclick.zoom", null);
  document.getElementById("zoomIn").onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 1.6);
  document.getElementById("zoomOut").onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6);
  document.getElementById("zoomReset").onclick = () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);

  function markerTransform(e) {
    const [x, y] = projection([e.lon, e.lat]);
    return `translate(${x},${y}) scale(${1 / Math.sqrt(zoomK)})`;
  }

  function initMap(world) {
    const fc = topojson.feature(world, world.objects.countries);
    countries = fc.features
      .filter(f => f.properties.name !== "Antarctica")
      .map(f => ({ ...f, id: f.id === undefined ? null : +f.id }));
    countries.forEach(f => { if (f.id !== null) countryName.set(f.id, f.properties.name); });
    projection.fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: countries });
    // Shift the fitted frame to also include the sphere edge cleanly
    gBase.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));
    gBase.append("path").attr("class", "graticule").attr("d", path(d3.geoGraticule10()));

    gCountries.selectAll("path.country")
      .data(countries)
      .join("path")
      .attr("class", "country")
      .attr("d", path)
      .on("pointermove", (ev, f) => showCountryTip(ev, f))
      .on("pointerleave", hideTip)
      .on("click", (ev, f) => {
        if (f.id === null) return;
        state.country = state.country === f.id ? null : f.id;
        state.event = null;
        render();
      });
    document.getElementById("mapStatus").textContent = "";
  }

  function renderMap() {
    const selEvent = state.event ? EVENTS.find(e => e.id === state.event) : null;
    const selIds = selEvent ? new Set(selEvent.ids) : null;
    gCountries.selectAll("path.country")
      .attr("fill", f => f.id === null ? "var(--land)" : shadeFill(f.id))
      .classed("selected", f => f.id !== null && (f.id === state.country || (selIds && selIds.has(f.id))))
      .classed("dim", f => !!selIds && !selIds.has(f.id) && !(selEvent.g && state.includeGlobal));

    const data = active.slice().sort((a, b) => b.sev - a.sev || a.s - b.s);
    const countryEvents = state.country ? new Set((stats.get(state.country)?.events || []).map(e => e.id)) : null;

    const m = gMarkers.selectAll("g.marker").data(data, d => d.id);
    m.exit().transition().duration(200).attr("opacity", 0).remove();
    const enter = m.enter().append("g")
      .attr("class", "marker")
      .attr("transform", d => markerTransform(d))
      .attr("opacity", 0)
      .on("pointermove", (ev, d) => showEventTip(ev, d))
      .on("pointerleave", hideTip)
      .on("click", (ev, d) => {
        ev.stopPropagation();
        state.event = state.event === d.id ? null : d.id;
        render();
      });
    enter.append("circle").attr("class", "hit").attr("r", 14).attr("fill", "transparent");
    enter.filter(d => d.g).append("circle").attr("class", "global-ring").attr("r", d => Math.sqrt(SEV_AREA[d.sev]) * 0.9 + 4);
    enter.append("path").attr("class", "glyph")
      .attr("d", d => symbolPath(d.d, SEV_AREA[d.sev]))
      .attr("fill", d => color(d.d));
    enter.transition().duration(250).attr("opacity", 1);

    gMarkers.selectAll("g.marker")
      .data(data, d => d.id)
      .order()
      .classed("selected", d => d.id === state.event)
      .classed("faded", d => (selEvent && d.id !== selEvent.id) || (countryEvents && !countryEvents.has(d.id)));

    const title = state.mode === "year"
      ? `Crises active in ${state.year}`
      : `All crises, 2000–${state.year}`;
    document.getElementById("mapTitle").textContent = title;
    renderLegend();
  }

  function renderLegend() {
    const el = document.getElementById("mapLegend");
    let ramp = "";
    if (state.shade !== "none") {
      const label = state.shade === "domains" ? "Concurrent crisis domains" : "Number of crises";
      const ticks = state.shade === "domains" ? ["0", "1", "2", "3", "4", "5", "6"] : ["0", "1", "2", "3", "4–5", "6–8", "9+"];
      ramp = `<div class="legend-ramp"><span>${label}</span><div>
        <div class="swatches">${[0, 1, 2, 3, 4, 5, 6].map(i => `<span class="sw" style="background:${i === 0 ? "var(--land)" : `var(--s${i})`}"></span>`).join("")}</div>
        <div class="ticks">${ticks.map(t => `<span>${t}</span>`).join("")}</div></div></div>`;
    }
    const sizes = [1, 2, 3].map(s => `<span><svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true"><path d="${d3.symbol().type(d3.symbolCircle).size(SEV_AREA[s])()}" fill="var(--muted)"/></svg>${SEV_LABEL[s].split(" ")[0]}</span>`).join("");
    const ring = `<span><svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="10" fill="none" stroke="var(--ink-2)" stroke-width="1.2" stroke-dasharray="2.5 2.5"/><circle r="5" fill="var(--muted)"/></svg>Global shock</span>`;
    el.innerHTML = `${ramp}<div class="legend-sizes"><span>Marker size:</span>${sizes}${ring}</div>`;
  }

  // ── Tooltips ───────────────────────────────────────────────────────────
  function placeTip(ev) {
    tooltip.hidden = false;
    const pad = 14;
    const r = tooltip.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    tooltip.style.left = Math.max(8, x) + "px";
    tooltip.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { tooltip.hidden = true; }

  function showCountryTip(ev, f) {
    const name = f.properties.name;
    const s = f.id !== null ? stats.get(f.id) : null;
    let html = `<div class="tt-title">${esc(name)}</div>`;
    if (!s || s.events.length === 0) {
      html += `<div class="tt-sub">No catalogued crises in this window</div>`;
    } else {
      html += `<div class="tt-sub">${s.domains.size} crisis domain${s.domains.size === 1 ? "" : "s"} · ${s.events.length} crisis${s.events.length === 1 ? "" : "es"}</div>`;
      const list = s.events.slice().sort((a, b) => b.sev - a.sev).slice(0, 6);
      html += `<ul>${list.map(e => `<li>${glyph(e.d, 11)}<span>${esc(e.name)}${e.g && !e.ids.includes(f.id) ? " <em style='color:var(--muted)'>(global)</em>" : ""}</span></li>`).join("")}</ul>`;
      if (s.events.length > 6) html += `<div class="tt-sub" style="margin:4px 0 0">+${s.events.length - 6} more — click for details</div>`;
    }
    tooltip.innerHTML = html;
    placeTip(ev);
  }

  function showEventTip(ev, e) {
    const doms = eventDomains(e);
    tooltip.innerHTML = `<div class="tt-title">${esc(e.name)}</div>
      <div class="tt-sub">${yearsLabel(e)} · ${DOMAIN_BY_KEY[e.d].label}${e.g ? " · global shock" : ""}</div>
      <div><b>${esc(e.impact)}</b></div>
      ${doms.length > 1 ? `<div class="tt-sub" style="margin:6px 0 0">Also: ${doms.slice(1).map(k => DOMAIN_BY_KEY[k].short).join(", ")}</div>` : ""}`;
    placeTip(ev);
  }

  // ── Side panel ─────────────────────────────────────────────────────────
  const panel = document.getElementById("panel");

  function tagsFor(e) {
    return `<div class="tagrow">${eventDomains(e).map((k, i) =>
      `<span class="tag${i ? " secondary" : ""}">${glyph(k, 11)}${DOMAIN_BY_KEY[k].short}</span>`).join("")}</div>`;
  }
  function evItem(e, countryId) {
    const globalNote = e.g && countryId != null && !e.ids.includes(countryId) ? " · global" : "";
    return `<li><button class="ev-item" data-event="${e.id}">${glyph(e.d, 13)}<span><span class="ev-name">${esc(e.name)}</span><br><span class="ev-sub">${yearsLabel(e)}${globalNote} · ${esc(e.impact)}</span></span></button></li>`;
  }

  function renderPanel() {
    if (state.event) return renderEventPanel(EVENTS.find(e => e.id === state.event));
    if (state.country !== null) return renderCountryPanel(state.country);
    renderHotspots();
  }

  function renderHotspots() {
    const ranked = [...stats.entries()]
      .filter(([id]) => countryName.has(id))
      .map(([id, s]) => ({ id, s, local: s.events.filter(e => e.ids.includes(id)).length }))
      .sort((a, b) => b.s.domains.size - a.s.domains.size || b.local - a.local || b.s.events.length - a.s.events.length)
      .slice(0, 12);
    const windowLabel = state.mode === "year" ? `in ${state.year}` : `2000–${state.year}`;
    const globals = active.filter(e => e.g);
    panel.innerHTML = `
      <div>
        <h3>Polycrisis hotspots</h3>
        <p class="panel-meta" style="margin:4px 0 0">Countries with the most concurrent crisis domains ${windowLabel}. Click a country on the map or below.</p>
      </div>
      ${ranked.length ? `<ul class="hot-list">${ranked.map((r, i) => {
        const doms = DOMAINS.filter(d => r.s.domains.has(d.key));
        return `<li><button class="hot-item" data-country="${r.id}">
          <span class="hot-rank">${i + 1}</span>
          <span class="hot-name">${esc(countryName.get(r.id))}</span>
          <span class="hot-glyphs" aria-label="${doms.map(d => d.short).join(", ")}">${doms.map(d => glyph(d.key, 11)).join("")}</span>
          <span></span>
          <span class="hot-bar" style="grid-column:2/4">${doms.map(d => `<span style="background:${color(d.key)}"></span>`).join("")}</span>
        </button></li>`;
      }).join("")}</ul>` : `<p class="empty">No crises match the current filters.</p>`}
      <div>
        <h3>Global shocks in view</h3>
        ${globals.length ? `<ul class="ev-list">${globals.map(e => evItem(e)).join("")}</ul>` : `<p class="empty" style="margin:6px 0 0">None in this window.</p>`}
      </div>`;
  }

  function renderCountryPanel(id) {
    const s = stats.get(id);
    const name = countryName.get(id) || "Unknown";
    const evs = s ? s.events.slice().sort((a, b) => a.s - b.s || b.sev - a.sev) : [];
    const local = evs.filter(e => e.ids.includes(id));
    const global = evs.filter(e => !e.ids.includes(id));
    const doms = s ? DOMAINS.filter(d => s.domains.has(d.key)) : [];
    const windowLabel = state.mode === "year" ? `in ${state.year}` : `2000–${state.year}`;
    panel.innerHTML = `
      <button class="back" data-back>← All hotspots</button>
      <div>
        <div class="panel-title">${esc(name)}</div>
        <div class="panel-meta">${doms.length} concurrent crisis domain${doms.length === 1 ? "" : "s"} ${windowLabel}</div>
      </div>
      ${doms.length ? `<div class="tagrow">${doms.map(d => `<span class="tag">${glyph(d.key, 11)}${d.short}</span>`).join("")}</div>` : ""}
      <div>
        <h3>Crises centred here</h3>
        ${local.length ? `<ul class="ev-list">${local.map(e => evItem(e, id)).join("")}</ul>` : `<p class="empty" style="margin:6px 0 0">None catalogued in this window.</p>`}
      </div>
      ${global.length ? `<div><h3>Global shocks felt here</h3><ul class="ev-list">${global.map(e => evItem(e, id)).join("")}</ul></div>` : ""}`;
  }

  function renderEventPanel(e) {
    if (!e) { state.event = null; return renderPanel(); }
    const names = e.ids.map(id => countryName.get(id)).filter(Boolean);
    const visible = inWindow(e) && state.domains.has(e.d);
    panel.innerHTML = `
      <button class="back" data-back>← ${state.country !== null ? esc(countryName.get(state.country) || "Back") : "All hotspots"}</button>
      <div>
        <div class="panel-title">${esc(e.name)}</div>
        <div class="panel-meta">${yearsLabel(e)} · ${SEV_LABEL[e.sev]}${e.g ? " · Global shock" : ""}</div>
      </div>
      ${tagsFor(e)}
      <div class="impact">${esc(e.impact)}</div>
      <p class="note">${esc(e.note)}</p>
      <div>
        <h3>Most affected</h3>
        <p class="countries-list" style="margin:6px 0 0">${names.length ? names.map(esc).join(" · ") : "—"}${e.g ? "<br><em>…plus most of the world as a global shock.</em>" : ""}</p>
      </div>
      ${visible ? "" : `<p class="empty">This crisis is outside the current time window or filters.</p>`}`;
  }

  panel.addEventListener("click", ev => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.back !== undefined) {
      if (state.event) state.event = null; else state.country = null;
    } else if (b.dataset.country) {
      state.country = +b.dataset.country; state.event = null;
    } else if (b.dataset.event) {
      state.event = b.dataset.event;
    }
    render();
  });

  // ── KPIs ───────────────────────────────────────────────────────────────
  function renderKpis() {
    const affected = [...stats.entries()].filter(([id, s]) => countryName.has(id) && s.events.length).length;
    const hotspots = [...stats.entries()].filter(([id, s]) => countryName.has(id) && s.domains.size >= 3).length;
    const windowLabel = state.mode === "year" ? `active in ${state.year}` : `2000–${state.year}`;
    const disp = latestValue(INDICATORS.find(i => i.key === "displaced"), state.year);
    const temp = latestValue(INDICATORS.find(i => i.key === "temp"), state.year);
    const tiles = [
      { label: "Crises in view", value: active.length, sub: windowLabel },
      { label: "Countries affected", value: affected, sub: state.includeGlobal ? "incl. global shocks" : "excl. global shocks" },
      { label: "Polycrisis hotspots", value: hotspots, sub: "countries with 3+ crisis domains" },
      { label: "Forcibly displaced", value: disp ? `${disp.value.toFixed(1)}M` : "—", sub: disp ? `UNHCR, end ${disp.year}` : "UNHCR series starts 2008" },
      { label: "Warming", value: temp ? `+${temp.value.toFixed(2)}°C` : "—", sub: temp ? `vs 1951–80 · ${temp.year}` : "" }
    ];
    document.getElementById("kpis").innerHTML = tiles.map(t =>
      `<div class="kpi"><div class="kpi-label">${t.label}</div><div class="kpi-value">${t.value}</div><div class="kpi-sub">${t.sub}</div></div>`).join("");
  }

  // ── Domain chips (legend + filter) ─────────────────────────────────────
  function renderChips() {
    const counts = Object.fromEntries(DOMAINS.map(d => [d.key, 0]));
    EVENTS.filter(inWindow).forEach(e => counts[e.d]++);
    const allOn = state.domains.size === DOMAINS.length;
    document.getElementById("domainChips").innerHTML = DOMAINS.map(d =>
      `<button type="button" class="chip" data-domain="${d.key}" aria-pressed="${state.domains.has(d.key)}">${glyph(d.key, 14)}${d.label}<span class="count">${counts[d.key]}</span></button>`).join("")
      + (allOn ? "" : `<button type="button" class="chip chip-reset" data-domain="__all">Show all</button>`);
  }
  document.getElementById("domainChips").addEventListener("click", ev => {
    const b = ev.target.closest("button.chip");
    if (!b) return;
    const k = b.dataset.domain;
    if (k === "__all") DOMAINS.forEach(d => state.domains.add(d.key));
    else if (ev.altKey || ev.metaKey) { state.domains = new Set([k]); }
    else if (state.domains.has(k)) { if (state.domains.size > 1) state.domains.delete(k); }
    else state.domains.add(k);
    render();
  });

  // ── Timeline (stacked bars + global-shock lanes) ───────────────────────
  const tl = d3.select("#timeline");
  const TL = { w: 960, h: 300, m: { t: 14, r: 12, b: 24, l: 34 }, barsH: 170 };

  function renderTimeline() {
    tl.selectAll("*").remove();
    const { w, m } = TL;
    const keys = DOMAINS.map(d => d.key).filter(k => state.domains.has(k));
    const rows = YEARS.map(y => {
      const row = { year: y };
      keys.forEach(k => { row[k] = 0; });
      EVENTS.forEach(e => { if (keys.includes(e.d) && activeInYear(e, y)) row[e.d]++; });
      row.total = keys.reduce((s, k) => s + row[k], 0);
      return row;
    });
    const x = d3.scaleBand().domain(YEARS).range([m.l, w - m.r]).paddingInner(0.22).paddingOuter(0.1);
    const yMax = d3.max(rows, r => r.total) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([m.t + TL.barsH, m.t]);
    const stack = d3.stack().keys(keys)(rows);

    // grid
    const g = tl.append("g");
    y.ticks(4).forEach(t => {
      g.append("line").attr("class", t === 0 ? "baseline" : "gridline").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(t)).attr("y2", y(t));
      g.append("text").attr("class", "tick-label").attr("x", m.l - 8).attr("y", y(t)).attr("dy", "0.32em").attr("text-anchor", "end").text(t);
    });

    const highlighted = yr => state.mode === "year" ? yr === state.year : yr <= state.year;
    stack.forEach(layer => {
      g.append("g").selectAll("rect").data(layer).join("rect")
        .attr("x", d => x(d.data.year))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d[1]))
        .attr("height", d => Math.max(0, y(d[0]) - y(d[1])))
        .attr("fill", color(layer.key))
        .attr("stroke", "var(--surface)")
        .attr("stroke-width", 1)
        .attr("opacity", d => highlighted(d.data.year) ? 1 : 0.32);
    });

    // year labels
    YEARS.forEach(yr => {
      if (yr % 5 === 0 || yr === MAX_YEAR || yr === state.year) {
        g.append("text").attr("class", "tick-label")
          .attr("x", x(yr) + x.bandwidth() / 2).attr("y", m.t + TL.barsH + 15)
          .attr("text-anchor", "middle")
          .style("font-weight", yr === state.year ? 700 : null)
          .style("fill", yr === state.year ? "var(--ink)" : null)
          .text(yr);
      }
    });

    // total label on selected year
    const sel = rows.find(r => r.year === state.year);
    if (sel && sel.total) {
      g.append("text").attr("class", "tick-label")
        .attr("x", x(state.year) + x.bandwidth() / 2).attr("y", y(sel.total) - 5)
        .attr("text-anchor", "middle").style("fill", "var(--ink)").style("font-weight", 650).text(sel.total);
    }

    // global shock lanes
    const globals = EVENTS.filter(e => e.g && keys.includes(e.d)).sort((a, b) => a.s - b.s);
    const lanes = [];
    const laneTop = m.t + TL.barsH + 40;
    const laneH = 18;
    const labelW = e => e.name.length * 5.6 + 8;
    globals.forEach(e => {
      const x0 = x(e.s), x1 = x(e.e ?? MAX_YEAR) + x.bandwidth();
      e._anchorEnd = x0 + labelW(e) > w - m.r;
      const extent = e._anchorEnd ? x1 : Math.max(x1, x0 + labelW(e) + 4);
      const start = e._anchorEnd ? Math.min(x0, x1 - labelW(e)) : x0;
      let lane = lanes.findIndex(end => end < start - 4);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = extent;
      e._lane = lane; e._x0 = x0; e._x1 = x1;
    });
    g.append("text").attr("class", "lane-title").attr("x", m.l).attr("y", laneTop - 8).text("Global shocks");
    const lg = g.append("g");
    globals.forEach(e => {
      const yy = laneTop + e._lane * laneH;
      const on = state.mode === "year" ? activeInYear(e, state.year) : e.s <= state.year;
      const gg = lg.append("g").style("cursor", "pointer").attr("opacity", on ? 1 : 0.45)
        .on("pointermove", ev => showEventTip(ev, e)).on("pointerleave", hideTip)
        .on("click", () => { state.event = e.id; if (!inWindow(e)) setYear(e.s, false); render(); });
      gg.append("rect").attr("x", e._x0).attr("y", yy).attr("width", e._x1 - e._x0).attr("height", 6).attr("rx", 3).attr("fill", color(e.d));
      gg.append("text").attr("class", "lane-label")
        .attr("x", e._anchorEnd ? e._x1 : e._x0).attr("text-anchor", e._anchorEnd ? "end" : "start")
        .attr("y", yy + 16).text(e.name);
    });
    const totalH = laneTop + lanes.length * laneH + 8;
    tl.attr("viewBox", `0 0 ${w} ${totalH}`);

    // hover / click targets per year
    g.append("g").selectAll("rect").data(rows).join("rect")
      .attr("x", d => x(d.year) - x.step() * x.paddingInner() / 2)
      .attr("width", x.step())
      .attr("y", m.t).attr("height", TL.barsH + 20)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("pointermove", (ev, d) => {
        tooltip.innerHTML = `<div class="tt-title">${d.year}</div><div class="tt-sub">${d.total} crises active</div>` +
          keys.slice().reverse().map(k => `<div class="tt-row"><span>${glyph(k, 11)}${DOMAIN_BY_KEY[k].short}</span><b>${d[k]}</b></div>`).join("");
        placeTip(ev);
      })
      .on("pointerleave", hideTip)
      .on("click", (ev, d) => setYear(d.year));
  }

  // ── Indicator small multiples ──────────────────────────────────────────
  const IW = 300, IH = 110, IM = { t: 8, r: 10, b: 20, l: 34 };
  const indEls = new Map();

  function initIndicators() {
    const root = document.getElementById("indicators");
    INDICATORS.forEach(ind => {
      const card = document.createElement("div");
      card.className = "card ind";
      card.innerHTML = `<div class="ind-head"><div><div class="ind-title">${ind.title}</div><div class="ind-sub">${ind.sub}</div></div>
        <div class="ind-val"><strong></strong><span></span></div></div>
        <svg viewBox="0 0 ${IW} ${IH}" role="img" aria-label="${ind.title} line chart"></svg>
        <div class="ind-src">Source: ${ind.source}</div>`;
      root.appendChild(card);
      const pts = Object.entries(ind.data).map(([k, v]) => ({ year: +k, value: v }));
      const x = d3.scaleLinear().domain([MIN_YEAR, MAX_YEAR]).range([IM.l, IW - IM.r]);
      const ext = d3.extent(pts, d => d.value);
      const pad = (ext[1] - ext[0]) * 0.12;
      const y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).nice(4).range([IH - IM.b, IM.t]);
      const s = d3.select(card).select("svg");
      y.ticks(3).forEach(t => {
        s.append("line").attr("class", "gridline").attr("x1", IM.l).attr("x2", IW - IM.r).attr("y1", y(t)).attr("y2", y(t));
        s.append("text").attr("class", "tick-label").attr("x", IM.l - 6).attr("y", y(t)).attr("dy", "0.32em").attr("text-anchor", "end").text(Math.abs(t) >= 1000 ? d3.format("~s")(t) : d3.format("~g")(t));
      });
      [2000, 2010, 2020].forEach(t => s.append("text").attr("class", "tick-label").attr("x", x(t)).attr("y", IH - 5).attr("text-anchor", "middle").text(t));
      s.append("path").attr("class", "area").attr("d", d3.area().x(d => x(d.year)).y0(IH - IM.b).y1(d => y(d.value)).curve(d3.curveMonotoneX)(pts));
      s.append("path").attr("class", "line").attr("d", d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX)(pts));
      const cursor = s.append("line").attr("class", "cursor").attr("y1", IM.t).attr("y2", IH - IM.b);
      const dot = s.append("circle").attr("class", "dot").attr("r", 4.5);
      const hoverDot = s.append("circle").attr("class", "hover-dot").attr("r", 4).style("display", "none");
      s.append("rect").attr("x", IM.l).attr("y", 0).attr("width", IW - IM.l - IM.r).attr("height", IH).attr("fill", "transparent")
        .on("pointermove", ev => {
          const [mx] = d3.pointer(ev);
          const yr = Math.round(x.invert(mx));
          const p = pts.reduce((a, b) => Math.abs(b.year - yr) < Math.abs(a.year - yr) ? b : a);
          hoverDot.style("display", null).attr("cx", x(p.year)).attr("cy", y(p.value));
          tooltip.innerHTML = `<div class="tt-title">${ind.fmt(p.value)}</div><div class="tt-sub" style="margin:0">${ind.title}, ${p.year}</div>`;
          placeTip(ev);
        })
        .on("pointerleave", () => { hoverDot.style("display", "none"); hideTip(); })
        .on("click", ev => { const [mx] = d3.pointer(ev); setYear(Math.round(x.invert(mx))); });
      indEls.set(ind.key, { card, x, y, cursor, dot, ind });
    });
  }

  function renderIndicators() {
    indEls.forEach(({ card, x, y, cursor, dot, ind }) => {
      const lv = latestValue(ind, state.year);
      card.querySelector(".ind-val strong").textContent = lv ? ind.fmt(lv.value) : "—";
      card.querySelector(".ind-val span").textContent = lv ? (lv.year === state.year ? `${lv.year}` : `latest: ${lv.year}`) : `series starts ${Object.keys(ind.data)[0]}`;
      cursor.attr("x1", x(state.year)).attr("x2", x(state.year));
      if (lv) dot.style("display", null).attr("cx", x(lv.year)).attr("cy", y(lv.value));
      else dot.style("display", "none");
    });
  }

  // ── Data table ─────────────────────────────────────────────────────────
  function renderTable() {
    const rows = active.slice().sort((a, b) => a.s - b.s || a.name.localeCompare(b.name));
    document.getElementById("eventTable").innerHTML =
      `<thead><tr><th>Crisis</th><th>Years</th><th>Domains</th><th>Most affected</th><th>Headline impact</th></tr></thead><tbody>` +
      rows.map(e => `<tr><td>${esc(e.name)}${e.g ? " <em>(global)</em>" : ""}</td><td class="num">${yearsLabel(e)}</td>
        <td>${eventDomains(e).map(k => DOMAIN_BY_KEY[k].short).join(", ")}</td>
        <td>${e.ids.map(id => countryName.get(id) || "").filter(Boolean).join(", ")}</td><td>${esc(e.impact)}</td></tr>`).join("") +
      `</tbody>`;
  }

  // ── Controls ───────────────────────────────────────────────────────────
  const slider = document.getElementById("yearSlider");
  const yearOut = document.getElementById("yearOut");

  function setYear(y, rerender = true) {
    state.year = Math.max(MIN_YEAR, Math.min(MAX_YEAR, y));
    slider.value = state.year;
    yearOut.textContent = state.year;
    if (rerender) render();
  }
  slider.addEventListener("input", () => setYear(+slider.value));

  document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll(".seg button").forEach(o => o.setAttribute("aria-pressed", o === b));
    render();
  }));
  document.getElementById("shadeSelect").addEventListener("change", ev => { state.shade = ev.target.value; render(); });
  document.getElementById("globalToggle").addEventListener("change", ev => { state.includeGlobal = ev.target.checked; render(); });

  let playTimer = null;
  const playBtn = document.getElementById("playBtn");
  const playIcon = document.getElementById("playIcon");
  function stopPlay() {
    clearInterval(playTimer); playTimer = null; state.playing = false;
    playIcon.setAttribute("d", "M7 5v14l12-7z"); playBtn.setAttribute("aria-label", "Play timeline");
  }
  playBtn.addEventListener("click", () => {
    if (state.playing) return stopPlay();
    state.playing = true;
    playIcon.setAttribute("d", "M6 5h4v14H6zM14 5h4v14h-4z"); playBtn.setAttribute("aria-label", "Pause timeline");
    if (state.year >= MAX_YEAR) setYear(MIN_YEAR);
    playTimer = setInterval(() => {
      if (state.year >= MAX_YEAR) return stopPlay();
      setYear(state.year + 1);
    }, 900);
  });

  document.addEventListener("keydown", ev => {
    if (ev.target.matches("input, select, textarea")) return;
    if (ev.key === "ArrowLeft") setYear(state.year - 1);
    if (ev.key === "ArrowRight") setYear(state.year + 1);
    if (ev.key === "Escape") { state.event = null; state.country = null; render(); }
  });

  // Theme toggle
  const themeLabel = document.getElementById("themeLabel");
  const currentTheme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const syncThemeLabel = () => { themeLabel.textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode"; };
  document.getElementById("themeToggle").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("polycrisis-theme", next); } catch (e) {}
    syncThemeLabel();
  });
  syncThemeLabel();

  // ── Render loop ────────────────────────────────────────────────────────
  function render() {
    compute();
    renderKpis();
    renderChips();
    if (countries.length) renderMap();
    renderPanel();
    renderTimeline();
    renderIndicators();
    renderTable();
  }

  document.getElementById("eventCount").textContent = EVENTS.length;
  initIndicators();
  render();

  d3.json(WORLD_URL)
    .then(world => { initMap(world); render(); })
    .catch(err => {
      console.error(err);
      document.getElementById("mapStatus").textContent = "Couldn't load the world map. Check your connection and reload.";
    });
})();
