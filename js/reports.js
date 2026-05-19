/**
 * reports.js
 * Fetches aggregated data from get_reports.php.
 * Renders a bar chart and summary table. Handles CSV download.
 */



let reportChart = null;

function fmtNum(n) {
    return n != null ? parseFloat(n).toFixed(1) : '—';
}

function renderSummaryStats(summary) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (!summary) return;
    set('stat-total-readings', parseInt(summary.total_readings || 0).toLocaleString());
    set('stat-avg-level',      fmtNum(summary.overall_avg_level) + '%');
    set('stat-min-level',      fmtNum(summary.overall_min_level) + '%');
    set('stat-max-level',      fmtNum(summary.overall_max_level) + '%');
    set('stat-avg-flow',       fmtNum(summary.overall_avg_flow) + ' L/m');
    set('stat-critical-alerts', summary.critical_alerts || 0);
    set('stat-warning-alerts',  summary.warning_alerts  || 0);
}

function drawReportChart(data) {
    const labels   = data.map(r => r.label);
    const avgLevel = data.map(r => parseFloat(r.avg_level));
    const avgFlow  = data.map(r => parseFloat(r.avg_flow));

    const ctx = document.getElementById('reportChart');
    if (!ctx) return;

    if (reportChart) {
        reportChart.data.labels             = labels;
        reportChart.data.datasets[0].data   = avgLevel;
        reportChart.data.datasets[1].data   = avgFlow;
        reportChart.update();
        return;
    }

    reportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Avg Water Level (%)',
                    data: avgLevel,
                    backgroundColor: 'rgba(59,130,246,0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Avg Flow Rate (L/min)',
                    data: avgFlow,
                    backgroundColor: 'rgba(16,185,129,0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 6,
                    type: 'line',
                    tension: 0.4,
                    yAxisID: 'y1',
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } },
                    grid:  { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    type: 'linear', position: 'left',
                    min: 0, max: 100,
                    ticks: { color: '#3b82f6', callback: v => v + '%', font: { family: 'Inter' } },
                    grid:  { color: 'rgba(255,255,255,0.05)' }
                },
                y1: {
                    type: 'linear', position: 'right',
                    min: 0,
                    ticks: { color: '#10b981', callback: v => v + ' L', font: { family: 'Inter' } },
                    grid:  { drawOnChartArea: false }
                }
            }
        }
    });
}

function renderTable(data) {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:32px;">No data for selected period.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.label}</td>
            <td>${fmtNum(r.avg_level)}%</td>
            <td>${fmtNum(r.min_level)}%</td>
            <td>${fmtNum(r.max_level)}%</td>
            <td>${fmtNum(r.avg_flow)} L/m</td>
            <td>${fmtNum(r.max_flow)} L/m</td>
            <td>${r.readings}</td>
        </tr>
    `).join('');
}

async function loadReport(period = 'daily') {
    const tbody = document.getElementById('reportTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Loading…</td></tr>';

    try {
        const res  = await fetch(`${API_BASE}get_reports.php?period=${period}`);
        const data = await res.json();
        if (data.status === 'success') {
            renderSummaryStats(data.summary);
            drawReportChart(data.data);
            renderTable(data.data);
        }
    } catch(e) {
        console.warn('Reports fetch error:', e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:24px;">Failed to load report data. Ensure the server is running.</td></tr>';
    }
}

function downloadCSV(period) {
    const url = `${API_BASE}get_reports.php?period=${period}&format=csv`;
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `water_report_${period}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

document.addEventListener('DOMContentLoaded', () => {
    // Period selector tabs
    const periodBtns = document.querySelectorAll('[data-period]');
    let activePeriod = 'daily';

    periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            periodBtns.forEach(b => b.classList.remove('active-period'));
            this.classList.add('active-period');
            activePeriod = this.dataset.period;
            loadReport(activePeriod);
        });
    });

    // CSV export button
    const csvBtn = document.getElementById('exportCSVBtn');
    if (csvBtn) csvBtn.addEventListener('click', () => downloadCSV(activePeriod));

    // Initial load
    loadReport('daily');
});
