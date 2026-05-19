/**
 * water-level.js
 * Real-time water level monitoring — polls get_data.php + get_history.php
 */

const POLL_MS   = 10000;
let levelChart  = null;
let chartLabels = [];
let chartData   = [];
const MAX_POINTS = 60; // rolling window

function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Stat cards ─────────────────────────────────────────────── */
function updateCards(data) {
    const { reading, level_status, thresholds, stats_24h } = data;
    const level = parseFloat(reading.level);
    const flow  = parseFloat(reading.flow);

    // Hero value
    const heroEl = document.getElementById('wl-hero-value');
    if (heroEl) heroEl.textContent = level.toFixed(1);

    // Status text + card colour
    const heroCard = document.getElementById('wl-hero-card');
    if (heroCard) {
        heroCard.className = 'stat-card glass-panel ' +
            (level_status === 'CRITICAL' ? 'critical' :
             level_status === 'WARNING'  ? 'warning'  : 'success');
    }
    const statusEl = document.getElementById('wl-status-text');
    if (statusEl) {
        statusEl.textContent = level_status === 'CRITICAL' ? '⚠ Critical — refill immediately!' :
                               level_status === 'WARNING'  ? '⚠ Low — approaching critical'    :
                                                             '✔ Normal';
        statusEl.style.color = level_status === 'CRITICAL' ? '#ef4444' :
                               level_status === 'WARNING'  ? '#f59e0b' : 'var(--success-color)';
    }

    // Time to empty estimate (mins at avg flow)
    const avgFlow = parseFloat(stats_24h?.avg_flow || flow || 1);
    const estVol  = level * 50; // assume 5000 L full tank
    const minsToEmpty = avgFlow > 0 ? Math.round(estVol / avgFlow) : 0;
    const hoursToEmpty = (minsToEmpty / 60).toFixed(1);
    const ttEl = document.getElementById('wl-time-empty');
    const ttStrip = document.getElementById('wl-time-empty-strip');
    const ttText = minsToEmpty > 60 ? `~${hoursToEmpty} hrs` : `~${minsToEmpty} min`;
    if (ttEl)    ttEl.textContent    = ttText;
    if (ttStrip) ttStrip.textContent = ttText;

    // 24h stats
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('wl-avg',  (stats_24h?.avg_level ?? '—') + '%');
    set('wl-min',  (stats_24h?.min_level ?? '—') + '%');
    set('wl-max',  (stats_24h?.max_level ?? '—') + '%');

    // Estimated volume
    set('wl-est-vol', Math.round(level * 50).toLocaleString() + ' L');

    // Threshold badges
    set('wl-thresh-crit', thresholds.critical_level + '%');
    set('wl-thresh-warn', thresholds.warning_level  + '%');

    // Tank visual
    const tankFill = document.getElementById('wl-tank-fill');
    if (tankFill) {
        tankFill.style.height = level.toFixed(0) + '%';
        tankFill.style.background =
            level_status === 'CRITICAL' ? 'linear-gradient(to top,#ef4444,#f87171)' :
            level_status === 'WARNING'  ? 'linear-gradient(to top,#f59e0b,#fcd34d)' :
                                          'linear-gradient(to top,var(--primary-color),#60a5fa)';
    }
    const tankPct = document.getElementById('wl-tank-pct');
    if (tankPct) tankPct.textContent = level.toFixed(0) + '%';

    // Last updated
    set('wl-last-updated', 'Updated ' + new Date(reading.timestamp).toLocaleTimeString());
}

/* ── Rolling chart ──────────────────────────────────────────── */
function pushToChart(ts, level) {
    chartLabels.push(fmtTime(ts));
    chartData.push(level);
    if (chartLabels.length > MAX_POINTS) { chartLabels.shift(); chartData.shift(); }

    if (levelChart) {
        levelChart.update('none'); // no animation on rolling update
    }
}

function initChart(historyRows) {
    const ctx = document.getElementById('wl-history-chart');
    if (!ctx) return;

    chartLabels = historyRows.map(r => fmtTime(r.timestamp));
    chartData   = historyRows.map(r => parseFloat(r.level));

    levelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Water Level (%)',
                data:  chartData,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6,182,212,0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor:'#1e293b', borderColor:'#334155', borderWidth:1 }
            },
            scales: {
                x: {
                    ticks: { color:'#94a3b8', maxTicksLimit:10, font:{family:'Inter'} },
                    grid:  { color:'rgba(255,255,255,0.05)' }
                },
                y: {
                    min: 0, max: 100,
                    ticks: { color:'#06b6d4', callback: v => v+'%', font:{family:'Inter'} },
                    grid:  { color:'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

/* ── Poll ───────────────────────────────────────────────────── */
let chartInitialised = false;

async function poll() {
    try {
        const [dataRes, histRes] = await Promise.all([
            fetch(API_BASE + 'get_data.php'),
            chartInitialised
                ? Promise.resolve(null)
                : fetch(API_BASE + 'get_history.php?hours=24&limit=200')
        ]);

        const data = await dataRes.json();
        if (data.status === 'success') {
            updateCards(data);

            if (!chartInitialised && histRes) {
                const hist = await histRes.json();
                if (hist.status === 'success') {
                    initChart(hist.data);
                    chartInitialised = true;
                }
            } else if (chartInitialised) {
                pushToChart(data.reading.timestamp, parseFloat(data.reading.level));
            }
        }
    } catch(e) { console.warn('Water level poll error:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
    poll();
    setInterval(poll, POLL_MS);
});
