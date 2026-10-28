// Tavi & Ellis — Mon-Fri Drop-off, Pick-up & Activities Schedule
// Cloudflare Worker + KV persistence

const DEFAULT_DATA = {
  days: {
    mon: {
      dropoff: { tavi: "unassigned", ellis: "unassigned" },
      pickup: { tavi: "unassigned", ellis: "unassigned" },
      activities: []
    },
    tue: {
      dropoff: { tavi: "unassigned", ellis: "unassigned" },
      pickup: { tavi: "unassigned", ellis: "unassigned" },
      activities: []
    },
    wed: {
      dropoff: { tavi: "unassigned", ellis: "unassigned" },
      pickup: { tavi: "unassigned", ellis: "unassigned" },
      activities: []
    },
    thu: {
      dropoff: { tavi: "unassigned", ellis: "unassigned" },
      pickup: { tavi: "unassigned", ellis: "unassigned" },
      activities: []
    },
    fri: {
      dropoff: { tavi: "unassigned", ellis: "unassigned" },
      pickup: { tavi: "unassigned", ellis: "unassigned" },
      activities: []
    }
  },
  updatedAt: 0
};

function sanitizeData(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_DATA));
  if (!raw || typeof raw !== "object" || !raw.days) return base;
  const dayKeys = ["mon", "tue", "wed", "thu", "fri"];
  for (const k of dayKeys) {
    const src = raw.days[k];
    if (!src || typeof src !== "object") continue;
    if (src.dropoff && typeof src.dropoff === "object") {
      if (["mum", "dad", "unassigned"].includes(src.dropoff.tavi)) base.days[k].dropoff.tavi = src.dropoff.tavi;
      if (["mum", "dad", "unassigned"].includes(src.dropoff.ellis)) base.days[k].dropoff.ellis = src.dropoff.ellis;
    }
    if (src.pickup && typeof src.pickup === "object") {
      if (["mum", "dad", "unassigned"].includes(src.pickup.tavi)) base.days[k].pickup.tavi = src.pickup.tavi;
      if (["mum", "dad", "unassigned"].includes(src.pickup.ellis)) base.days[k].pickup.ellis = src.pickup.ellis;
    }
    if (Array.isArray(src.activities)) {
      base.days[k].activities = src.activities
        .filter(a => a && typeof a === "object" && String(a.title || "").trim())
        .map(a => ({
          id: String(a.id || Date.now() + "_" + Math.random().toString(36).slice(2, 7)),
          title: String(a.title || "").trim().slice(0, 60),
          time: String(a.time || "").trim().slice(0, 20),
          kids: ["tavi", "ellis", "both"].includes(a.kids) ? a.kids : "both",
          dropoff: ["mum", "dad", "unassigned"].includes(a.dropoff) ? a.dropoff : "unassigned",
          pickup: ["mum", "dad", "unassigned"].includes(a.pickup) ? a.pickup : "unassigned"
        }));
    }
  }
  base.updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now();
  return base;
}

async function getSchedule(env) {
  if (!env.KIDS_SCHEDULE_DATA) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  const raw = await env.KIDS_SCHEDULE_DATA.get("schedule_v1");
  if (!raw) {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_DATA));
    fresh.updatedAt = Date.now();
    await env.KIDS_SCHEDULE_DATA.put("schedule_v1", JSON.stringify(fresh));
    return fresh;
  }
  try {
    return sanitizeData(JSON.parse(raw));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

async function saveSchedule(env, data) {
  const clean = sanitizeData(data);
  clean.updatedAt = Date.now();
  if (env.KIDS_SCHEDULE_DATA) {
    await env.KIDS_SCHEDULE_DATA.put("schedule_v1", JSON.stringify(clean));
  }
  return clean;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/api/schedule" && request.method === "GET") {
      const data = await getSchedule(env);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (path === "/api/schedule" && request.method === "POST") {
      try {
        const body = await request.json();
        const saved = await saveSchedule(env, body);
        return new Response(JSON.stringify(saved), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const initialData = await getSchedule(env);
    return new Response(renderHTML(initialData), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0"
      }
    });
  }
};

function renderHTML(initialData) {
  const initialJson = JSON.stringify(initialData);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Tavi & Ellis</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F4F5F7;
      --card: #FFFFFF;
      --border: #E5E7EB;
      --text: #111827;
      --muted: #6B7280;
      --mum-bg: #FDF2F8;
      --mum-border: #FBCFE8;
      --mum-text: #DB2777;
      --mum-solid: #EC4899;
      --dad-bg: #EEF2FF;
      --dad-border: #C7D2FE;
      --dad-text: #4F46E5;
      --dad-solid: #4F46E5;
      --tavi-bg: #EFF6FF;
      --tavi-text: #2563EB;
      --tavi-border: #BFDBFE;
      --ellis-bg: #ECFDF5;
      --ellis-text: #059669;
      --ellis-border: #A7F3D0;
      --both-bg: #F5F3FF;
      --both-text: #7C3AED;
      --both-border: #DDD6FE;
    }

    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .kid-badges {
      display: flex;
      gap: 6px;
    }

    .kid-pill {
      font-size: 12px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .kid-pill.tavi {
      background: var(--tavi-bg);
      color: var(--tavi-text);
      border: 1px solid var(--tavi-border);
    }

    .kid-pill.ellis {
      background: var(--ellis-bg);
      color: var(--ellis-text);
      border: 1px solid var(--ellis-border);
    }

    .actions-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sync-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #10B981;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .sync-dot.saving {
      background: #F59E0B;
      transform: scale(1.25);
    }

    .reset-btn {
      background: #F3F4F6;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
    }

    .reset-btn:active {
      background: #E5E7EB;
    }

    .grid {
      max-width: 1400px;
      margin: 0 auto;
      padding: 14px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }

    @media (min-width: 980px) {
      .grid {
        grid-template-columns: repeat(5, 1fr);
        align-items: start;
      }
    }

    .day-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      transition: border-color 0.2s;
    }

    .day-card.today {
      border: 2px solid #111827;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .day-header {
      padding: 12px 14px;
      background: #FAFAFA;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .day-card.today .day-header {
      background: #111827;
      color: #FFFFFF;
      border-bottom-color: #111827;
    }

    .day-name {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .today-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
      padding: 2px 7px;
      border-radius: 6px;
    }

    .day-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .slot-box {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px;
      background: #F9FAFB;
    }

    .slot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .slot-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .quick-both {
      display: flex;
      gap: 4px;
    }

    .both-btn {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #FFFFFF;
      color: var(--muted);
      cursor: pointer;
    }

    .both-btn.active-mum {
      background: var(--mum-solid);
      color: #FFFFFF;
      border-color: var(--mum-solid);
    }

    .both-btn.active-dad {
      background: var(--dad-solid);
      color: #FFFFFF;
      border-color: var(--dad-solid);
    }

    .kid-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .kid-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 6px 8px;
    }

    .kid-label {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .kid-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      display: inline-block;
    }

    .kid-dot.tavi { background: var(--tavi-text); }
    .kid-dot.ellis { background: var(--ellis-text); }

    .parent-toggle {
      display: flex;
      gap: 4px;
    }

    .p-btn {
      font-size: 12px;
      font-weight: 700;
      padding: 5px 11px;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: #F9FAFB;
      color: #4B5563;
      cursor: pointer;
      min-width: 52px;
      text-align: center;
      transition: all 0.12s ease;
    }

    .p-btn.mum.active {
      background: var(--mum-solid);
      color: #FFFFFF;
      border-color: var(--mum-solid);
    }

    .p-btn.dad.active {
      background: var(--dad-solid);
      color: #FFFFFF;
      border-color: var(--dad-solid);
    }

    .activities-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .activities-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2px;
    }

    .activities-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #374151;
    }

    .add-act-btn {
      background: #111827;
      color: #FFFFFF;
      border: none;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 9px;
      cursor: pointer;
    }

    .act-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .act-card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 11px;
      padding: 9px 10px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .act-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
    }

    .act-info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .act-kid-badge {
      font-size: 11px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
    }

    .act-kid-badge.tavi {
      background: var(--tavi-bg);
      color: var(--tavi-text);
      border: 1px solid var(--tavi-border);
    }

    .act-kid-badge.ellis {
      background: var(--ellis-bg);
      color: var(--ellis-text);
      border: 1px solid var(--ellis-border);
    }

    .act-kid-badge.both {
      background: var(--both-bg);
      color: var(--both-text);
      border: 1px solid var(--both-border);
    }

    .act-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }

    .act-time {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
    }

    .act-del {
      background: transparent;
      border: none;
      color: #9CA3AF;
      font-size: 16px;
      line-height: 1;
      padding: 2px 4px;
      cursor: pointer;
    }

    .act-del:hover {
      color: #EF4444;
    }

    .act-runs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .act-run-col {
      background: #F9FAFB;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 5px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }

    .act-run-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
    }

    .mini-toggle {
      display: flex;
      gap: 3px;
    }

    .m-btn {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 7px;
      border-radius: 5px;
      border: 1px solid var(--border);
      background: #FFFFFF;
      color: #4B5563;
      cursor: pointer;
    }

    .m-btn.mum.active {
      background: var(--mum-solid);
      color: #FFFFFF;
      border-color: var(--mum-solid);
    }

    .m-btn.dad.active {
      background: var(--dad-solid);
      color: #FFFFFF;
      border-color: var(--dad-solid);
    }

    .act-form {
      background: #F9FAFB;
      border: 1px solid #D1D5DB;
      border-radius: 11px;
      padding: 10px;
      display: none;
      flex-direction: column;
      gap: 8px;
    }

    .act-form.open {
      display: flex;
    }

    .form-row {
      display: flex;
      gap: 6px;
    }

    .input-text {
      flex: 1;
      padding: 7px 9px;
      border: 1px solid var(--border);
      border-radius: 7px;
      font-size: 13px;
      font-family: inherit;
      font-weight: 600;
      outline: none;
    }

    .input-time {
      width: 90px;
      padding: 7px 9px;
      border: 1px solid var(--border);
      border-radius: 7px;
      font-size: 13px;
      font-family: inherit;
      font-weight: 600;
      outline: none;
    }

    .seg-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .seg-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
    }

    .seg-group {
      display: flex;
      gap: 4px;
    }

    .seg-btn {
      font-size: 12px;
      font-weight: 700;
      padding: 5px 9px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #FFFFFF;
      color: #374151;
      cursor: pointer;
    }

    .seg-btn.selected {
      background: #111827;
      color: #FFFFFF;
      border-color: #111827;
    }

    .seg-btn.mum.selected {
      background: var(--mum-solid);
      border-color: var(--mum-solid);
    }

    .seg-btn.dad.selected {
      background: var(--dad-solid);
      border-color: var(--dad-solid);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 2px;
    }

    .btn-cancel {
      background: #FFFFFF;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      padding: 6px 11px;
      border-radius: 7px;
      cursor: pointer;
    }

    .btn-save {
      background: #111827;
      border: 1px solid #111827;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 13px;
      border-radius: 7px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="title-wrap">
      <h1 class="title">Tavi &amp; Ellis</h1>
      <div class="kid-badges">
        <span class="kid-pill tavi">🌟 Tavi</span>
        <span class="kid-pill ellis">🚀 Ellis</span>
      </div>
    </div>
    <div class="actions-right">
      <div id="syncDot" class="sync-dot" title="Synced"></div>
      <button class="reset-btn" onclick="clearWeek()">Clear Week</button>
    </div>
  </header>

  <main id="scheduleGrid" class="grid"></main>

  <script>
    var state = ${initialJson};
    var openForms = {};
    var formDrafts = {};
    var isSaving = false;

    var DAYS = [
      { key: 'mon', label: 'Monday', jsDay: 1 },
      { key: 'tue', label: 'Tuesday', jsDay: 2 },
      { key: 'wed', label: 'Wednesday', jsDay: 3 },
      { key: 'thu', label: 'Thursday', jsDay: 4 },
      { key: 'fri', label: 'Friday', jsDay: 5 }
    ];

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setSyncStatus(saving) {
      isSaving = saving;
      var dot = document.getElementById('syncDot');
      if (!dot) return;
      if (saving) dot.classList.add('saving');
      else dot.classList.remove('saving');
    }

    async function persistState() {
      setSyncStatus(true);
      state.updatedAt = Date.now();
      render();
      try {
        var res = await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
        if (res.ok) {
          var saved = await res.json();
          state = saved;
        }
      } catch (e) {
        console.error('Save failed', e);
      } finally {
        setSyncStatus(false);
      }
    }

    async function pollState() {
      if (isSaving) return;
      // Do not overwrite while typing in an open activity form
      for (var k in openForms) {
        if (openForms[k]) return;
      }
      try {
        var res = await fetch('/api/schedule');
        if (!res.ok) return;
        var remote = await res.json();
        if (remote && remote.updatedAt && remote.updatedAt > (state.updatedAt || 0)) {
          state = remote;
          render();
        }
      } catch (e) {}
    }

    function toggleParent(dayKey, slot, kid, parent) {
      var current = state.days[dayKey][slot][kid];
      state.days[dayKey][slot][kid] = (current === parent) ? 'unassigned' : parent;
      persistState();
    }

    function setBothParent(dayKey, slot, parent) {
      var d = state.days[dayKey][slot];
      if (d.tavi === parent && d.ellis === parent) {
        d.tavi = 'unassigned';
        d.ellis = 'unassigned';
      } else {
        d.tavi = parent;
        d.ellis = parent;
      }
      persistState();
    }

    function openAddActivity(dayKey) {
      openForms[dayKey] = true;
      formDrafts[dayKey] = {
        title: '',
        time: '',
        kids: 'both',
        dropoff: 'unassigned',
        pickup: 'unassigned'
      };
      render();
      var input = document.getElementById('act-title-' + dayKey);
      if (input) input.focus();
    }

    function closeAddActivity(dayKey) {
      openForms[dayKey] = false;
      render();
    }

    function updateDraftInput(dayKey, field, val) {
      if (!formDrafts[dayKey]) return;
      formDrafts[dayKey][field] = val;
    }

    function selectDraftOption(dayKey, field, val) {
      if (!formDrafts[dayKey]) return;
      if ((field === 'dropoff' || field === 'pickup') && formDrafts[dayKey][field] === val) {
        formDrafts[dayKey][field] = 'unassigned';
      } else {
        formDrafts[dayKey][field] = val;
      }
      render();
    }

    function saveActivity(dayKey) {
      var draft = formDrafts[dayKey];
      if (!draft) return;
      var titleEl = document.getElementById('act-title-' + dayKey);
      var timeEl = document.getElementById('act-time-' + dayKey);
      var title = titleEl ? titleEl.value.trim() : draft.title.trim();
      var time = timeEl ? timeEl.value.trim() : draft.time.trim();
      if (!title) {
        if (titleEl) titleEl.focus();
        return;
      }
      state.days[dayKey].activities.push({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: title,
        time: time,
        kids: draft.kids || 'both',
        dropoff: draft.dropoff || 'unassigned',
        pickup: draft.pickup || 'unassigned'
      });
      openForms[dayKey] = false;
      persistState();
    }

    function toggleActivityParent(dayKey, actId, field, parent) {
      var list = state.days[dayKey].activities;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === actId) {
          list[i][field] = (list[i][field] === parent) ? 'unassigned' : parent;
          break;
        }
      }
      persistState();
    }

    function cycleActivityKids(dayKey, actId) {
      var order = ['both', 'tavi', 'ellis'];
      var list = state.days[dayKey].activities;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === actId) {
          var idx = order.indexOf(list[i].kids);
          list[i].kids = order[(idx + 1) % order.length];
          break;
        }
      }
      persistState();
    }

    function deleteActivity(dayKey, actId) {
      state.days[dayKey].activities = state.days[dayKey].activities.filter(function(a) {
        return a.id !== actId;
      });
      persistState();
    }

    function clearWeek() {
      if (!confirm('Clear all assignments and activities for the week?')) return;
      for (var i = 0; i < DAYS.length; i++) {
        var k = DAYS[i].key;
        state.days[k] = {
          dropoff: { tavi: 'unassigned', ellis: 'unassigned' },
          pickup: { tavi: 'unassigned', ellis: 'unassigned' },
          activities: []
        };
      }
      persistState();
    }

    function renderSlotBox(dayKey, slotKey, slotLabel, icon) {
      var slot = state.days[dayKey][slotKey];
      var bothMum = (slot.tavi === 'mum' && slot.ellis === 'mum');
      var bothDad = (slot.tavi === 'dad' && slot.ellis === 'dad');

      return '<div class="slot-box">' +
        '<div class="slot-header">' +
          '<div class="slot-title"><span>' + icon + '</span> ' + slotLabel + '</div>' +
          '<div class="quick-both">' +
            '<button class="both-btn ' + (bothMum ? 'active-mum' : '') + '" onclick="setBothParent(\\x27' + dayKey + '\\x27, \\x27' + slotKey + '\\x27, \\x27mum\\x27)">Both Mum</button>' +
            '<button class="both-btn ' + (bothDad ? 'active-dad' : '') + '" onclick="setBothParent(\\x27' + dayKey + '\\x27, \\x27' + slotKey + '\\x27, \\x27dad\\x27)">Both Dad</button>' +
          '</div>' +
        '</div>' +
        '<div class="kid-rows">' +
          '<div class="kid-row">' +
            '<div class="kid-label"><span class="kid-dot tavi"></span> Tavi</div>' +
            '<div class="parent-toggle">' +
              '<button class="p-btn mum ' + (slot.tavi === 'mum' ? 'active' : '') + '" onclick="toggleParent(\\x27' + dayKey + '\\x27, \\x27' + slotKey + '\\x27, \\x27tavi\\x27, \\x27mum\\x27)">Mum</button>' +
              '<button class="p-btn dad ' + (slot.tavi === 'dad' ? 'active' : '') + '" onclick="toggleParent(\\x27' + dayKey + '\\x27, \\x27' + slotKey + '\\x27, \\x27tavi\\x27, \\x27dad\\x27)">Dad</button>' +
            '</div>' +
          '</div>' +
          '<div class="kid-row">' +
            '<div class="kid-label"><span class="kid-dot ellis"></span> Ellis</div>' +
            '<div class="parent-toggle">' +
              '<button class="p-btn mum ' + (slot.ellis === 'mum' ? 'active' : '') + '" onclick="toggleParent(\\x27' + dayKey + '\\x27, \\x27' + slotKey + '\\x27, \\x27ellis\\x27, \\x27mum\\x27)">Mum</button>' +
              '<button class="p-btn dad ' + (slot.ellis === 'dad' ? 'active' : '') + '" onclick="toggleParent(\\x27' + dayKey + '\\x27, \\x27' + slotKey + '\\x27, \\x27ellis\\x27, \\x27dad\\x27)">Dad</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function renderActivities(dayKey) {
      var list = state.days[dayKey].activities || [];
      var cardsHtml = list.map(function(act) {
        var kidLabel = act.kids === 'tavi' ? 'Tavi' : (act.kids === 'ellis' ? 'Ellis' : 'Both');
        return '<div class="act-card">' +
          '<div class="act-top">' +
            '<div class="act-info">' +
              '<span class="act-kid-badge ' + act.kids + '" onclick="cycleActivityKids(\\x27' + dayKey + '\\x27, \\x27' + act.id + '\\x27)">' + kidLabel + '</span>' +
              '<span class="act-name">' + escapeHtml(act.title) + '</span>' +
              (act.time ? '<span class="act-time">' + escapeHtml(act.time) + '</span>' : '') +
            '</div>' +
            '<button class="act-del" onclick="deleteActivity(\\x27' + dayKey + '\\x27, \\x27' + act.id + '\\x27)">&times;</button>' +
          '</div>' +
          '<div class="act-runs">' +
            '<div class="act-run-col">' +
              '<span class="act-run-label">Drop</span>' +
              '<div class="mini-toggle">' +
                '<button class="m-btn mum ' + (act.dropoff === 'mum' ? 'active' : '') + '" onclick="toggleActivityParent(\\x27' + dayKey + '\\x27, \\x27' + act.id + '\\x27, \\x27dropoff\\x27, \\x27mum\\x27)">M</button>' +
                '<button class="m-btn dad ' + (act.dropoff === 'dad' ? 'active' : '') + '" onclick="toggleActivityParent(\\x27' + dayKey + '\\x27, \\x27' + act.id + '\\x27, \\x27dropoff\\x27, \\x27dad\\x27)">D</button>' +
              '</div>' +
            '</div>' +
            '<div class="act-run-col">' +
              '<span class="act-run-label">Pick</span>' +
              '<div class="mini-toggle">' +
                '<button class="m-btn mum ' + (act.pickup === 'mum' ? 'active' : '') + '" onclick="toggleActivityParent(\\x27' + dayKey + '\\x27, \\x27' + act.id + '\\x27, \\x27pickup\\x27, \\x27mum\\x27)">M</button>' +
                '<button class="m-btn dad ' + (act.pickup === 'dad' ? 'active' : '') + '" onclick="toggleActivityParent(\\x27' + dayKey + '\\x27, \\x27' + act.id + '\\x27, \\x27pickup\\x27, \\x27dad\\x27)">D</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      var isOpen = !!openForms[dayKey];
      var draft = formDrafts[dayKey] || { title: '', time: '', kids: 'both', dropoff: 'unassigned', pickup: 'unassigned' };

      var formHtml = '<div class="act-form ' + (isOpen ? 'open' : '') + '">' +
        '<div class="form-row">' +
          '<input id="act-title-' + dayKey + '" class="input-text" type="text" placeholder="Activity (e.g. Swimming)" value="' + escapeHtml(draft.title) + '" oninput="updateDraftInput(\\x27' + dayKey + '\\x27, \\x27title\\x27, this.value)" onkeydown="if(event.key===\\x27Enter\\x27)saveActivity(\\x27' + dayKey + '\\x27)" />' +
          '<input id="act-time-' + dayKey + '" class="input-time" type="text" placeholder="Time" value="' + escapeHtml(draft.time) + '" oninput="updateDraftInput(\\x27' + dayKey + '\\x27, \\x27time\\x27, this.value)" onkeydown="if(event.key===\\x27Enter\\x27)saveActivity(\\x27' + dayKey + '\\x27)" />' +
        '</div>' +
        '<div class="seg-row">' +
          '<span class="seg-label">Kid</span>' +
          '<div class="seg-group">' +
            '<button type="button" class="seg-btn ' + (draft.kids === 'tavi' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27kids\\x27, \\x27tavi\\x27)">Tavi</button>' +
            '<button type="button" class="seg-btn ' + (draft.kids === 'ellis' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27kids\\x27, \\x27ellis\\x27)">Ellis</button>' +
            '<button type="button" class="seg-btn ' + (draft.kids === 'both' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27kids\\x27, \\x27both\\x27)">Both</button>' +
          '</div>' +
        '</div>' +
        '<div class="seg-row">' +
          '<span class="seg-label">Drop-off</span>' +
          '<div class="seg-group">' +
            '<button type="button" class="seg-btn mum ' + (draft.dropoff === 'mum' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27dropoff\\x27, \\x27mum\\x27)">Mum</button>' +
            '<button type="button" class="seg-btn dad ' + (draft.dropoff === 'dad' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27dropoff\\x27, \\x27dad\\x27)">Dad</button>' +
          '</div>' +
        '</div>' +
        '<div class="seg-row">' +
          '<span class="seg-label">Pick-up</span>' +
          '<div class="seg-group">' +
            '<button type="button" class="seg-btn mum ' + (draft.pickup === 'mum' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27pickup\\x27, \\x27mum\\x27)">Mum</button>' +
            '<button type="button" class="seg-btn dad ' + (draft.pickup === 'dad' ? 'selected' : '') + '" onclick="selectDraftOption(\\x27' + dayKey + '\\x27, \\x27pickup\\x27, \\x27dad\\x27)">Dad</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn-cancel" onclick="closeAddActivity(\\x27' + dayKey + '\\x27)">Cancel</button>' +
          '<button type="button" class="btn-save" onclick="saveActivity(\\x27' + dayKey + '\\x27)">Add</button>' +
        '</div>' +
      '</div>';

      return '<div class="activities-section">' +
        '<div class="activities-header">' +
          '<span class="activities-title">⚽ Activities</span>' +
          (!isOpen ? '<button class="add-act-btn" onclick="openAddActivity(\\x27' + dayKey + '\\x27)">+ Add</button>' : '') +
        '</div>' +
        (cardsHtml ? '<div class="act-list">' + cardsHtml + '</div>' : '') +
        formHtml +
      '</div>';
    }

    function render() {
      var grid = document.getElementById('scheduleGrid');
      if (!grid) return;
      var currentDay = new Date().getDay();

      grid.innerHTML = DAYS.map(function(d) {
        var isToday = (currentDay === d.jsDay);
        return '<section class="day-card ' + (isToday ? 'today' : '') + '">' +
          '<div class="day-header">' +
            '<span class="day-name">' + d.label + '</span>' +
            (isToday ? '<span class="today-tag">Today</span>' : '') +
          '</div>' +
          '<div class="day-body">' +
            renderSlotBox(d.key, 'dropoff', 'Drop-off', '☀️') +
            renderSlotBox(d.key, 'pickup', 'Pick-up', '🏠') +
            renderActivities(d.key) +
          '</div>' +
        '</section>';
      }).join('');
    }

    render();
    setInterval(pollState, 5000);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) pollState();
    });
  </script>
</body>
</html>`;
}
