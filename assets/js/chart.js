const ctx = document.getElementById('chartCanvas').getContext('2d');
const errorMsg = document.getElementById('errorMsg');
let currentChart = null;
let currentType = 'bar';
let currentView = 'both';
let parsedData = null;

// Full table data (unfiltered) for search/sort
let tableHeaders = [];
let tableRows = [];
let sortColIndex = -1;
let sortAsc = true;

const PALETTE = [
  '#378ADD','#1D9E75','#D85A30','#7F77DD','#D4537E',
  '#639922','#BA7517','#E24B4A','#888780'
];

function hslColor(i) { return PALETTE[i % PALETTE.length]; }

function setError(msg) {
  errorMsg.textContent = msg || '';
  errorMsg.style.display = msg ? 'block' : 'none';
}

// ── JSON beautify ──────────────────────────────────────────
function beautifyJSON() {
  const ta = document.getElementById('jsonInput');
  const val = ta.value.trim();
  if (!val) return;
  try {
    ta.value = JSON.stringify(JSON.parse(val), null, 2);
    validateJSON();
  } catch (e) {
    setError('Cannot beautify: invalid JSON — ' + e.message);
  }
}

// ── Live JSON validation indicator ────────────────────────
function validateJSON() {
  const val = document.getElementById('jsonInput').value.trim();
  const el = document.getElementById('jsonStatus');
  if (!val) { el.textContent = ''; el.className = 'json-status'; return; }
  try {
    JSON.parse(val);
    el.textContent = '✓ Valid JSON';
    el.className = 'json-status valid';
  } catch {
    el.textContent = '✗ Invalid JSON';
    el.className = 'json-status invalid';
  }
}

// ── Download chart as PNG ──────────────────────────────────
function downloadChart() {
  if (!currentChart) { setError('No chart to download. Render a chart first.'); return; }
  const canvas = document.getElementById('chartCanvas');
  const link = document.createElement('a');
  link.download = 'chart.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── View toggle ────────────────────────────────────────────
function activateChartBtn(type) {
  document.querySelectorAll('.chart-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === v);
  });
  const chartSec = document.getElementById('chartSection');
  const tableSec = document.getElementById('tableSection');
  const body = document.getElementById('rightBody');
  body.className = 'right-body view-' + v;
  if (v === 'chart') { chartSec.style.display = 'flex'; tableSec.style.display = 'none'; }
  else if (v === 'table') { chartSec.style.display = 'none'; tableSec.style.display = 'flex'; }
  else { chartSec.style.display = 'flex'; tableSec.style.display = 'flex'; }
  if (currentChart) setTimeout(() => currentChart.resize(), 50);
}

// ── Chart data builder ─────────────────────────────────────
function buildChartData(parsed, type) {
  if (parsed && !Array.isArray(parsed) && parsed.labels && parsed.datasets) {
    const result = JSON.parse(JSON.stringify(parsed));
    result.datasets.forEach(ds => {
      ds._rawData = ds.data.slice();
      ds.data = ds.data.map(v => {
        const n = Number(v);
        return (!isNaN(n) && v !== '' && v !== null) ? n : null;
      });
      if (!ds.backgroundColor) ds.backgroundColor = ds.data.map((_, i) => hslColor(i));
    });
    return result;
  }
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array or Chart.js object.');
  const labels = parsed.map(r => r.label || r.name || r.category || String(Object.values(r)[0]));
  const values = parsed.map(r => {
    const v = r.value ?? r.count ?? r.amount ?? Object.values(r)[1];
    const n = Number(v);
    return isNaN(n) ? null : n;
  });
  const colors = parsed.map((_, i) => hslColor(i));
  return {
    labels,
    datasets: [{
      label: 'Value',
      data: values,
      backgroundColor: type === 'line' ? 'rgba(55,138,221,0.15)' : colors,
      borderColor: type === 'line' ? '#378ADD' : colors,
      fill: type === 'line',
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: type === 'line' ? 2 : 0
    }]
  };
}

// ── Table rendering ────────────────────────────────────────
function setRowCount(visible, total) {
  const el = document.getElementById('rowCount');
  if (!el) return;
  if (total !== undefined && visible !== total) {
    el.textContent = `${visible} of ${total} rows`;
  } else {
    const n = visible;
    el.textContent = n + ' row' + (n !== 1 ? 's' : '');
  }
}

function renderTableFromData(headers, rows) {
  const container = document.getElementById('tableContainer');
  if (!rows.length) {
    container.innerHTML = '<p class="no-data">No matching rows.</p>';
    return;
  }
  // Build sort indicators
  const thHTML = headers.map((h, i) => {
    let indicator = '';
    if (sortColIndex === i) indicator = sortAsc ? ' <span class="sort-ind">▲</span>' : ' <span class="sort-ind">▼</span>';
    return `<th onclick="sortByColumn(${i})" class="sortable">${h}${indicator}</th>`;
  }).join('');

  const thead = `<thead><tr>${thHTML}</tr></thead>`;
  const tbody = `<tbody>${rows.map((row, i) =>
    `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('')}</tbody>`;
  container.innerHTML = `<table>${thead}${tbody}</table>`;
}

function buildTableFromChartJs(parsed) {
  const labels = parsed.labels || [];
  const datasets = parsed.datasets || [];
  if (!labels.length) {
    document.getElementById('tableContainer').innerHTML = '<p class="no-data">No data.</p>';
    setRowCount(0);
    return;
  }
  tableHeaders = ['Label', ...datasets.map(ds => ds.label || 'Value')];
  tableRows = labels.map((lbl, i) =>
    [lbl, ...datasets.map(ds => (ds._rawData || ds.data)[i] ?? '')]
  );
  sortColIndex = -1; sortAsc = true;
  renderTableFromData(tableHeaders, tableRows);
  setRowCount(tableRows.length);
}

function buildTable(data) {
  if (!Array.isArray(data) || !data.length) {
    document.getElementById('tableContainer').innerHTML = '<p class="no-data">No tabular data.</p>';
    setRowCount(0);
    return;
  }
  tableHeaders = Object.keys(data[0]);
  tableRows = data.map(row => tableHeaders.map(k => row[k] ?? ''));
  sortColIndex = -1; sortAsc = true;
  renderTableFromData(tableHeaders, tableRows);
  setRowCount(tableRows.length);
}

// ── Search / filter ────────────────────────────────────────
function filterTable() {
  const q = document.getElementById('tableSearch').value.toLowerCase().trim();
  const filtered = q
    ? tableRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(q)))
    : tableRows;
  renderTableFromData(tableHeaders, filtered);
  setRowCount(filtered.length, tableRows.length);
}

// ── Sort ───────────────────────────────────────────────────
function sortByColumn(colIndex) {
  if (sortColIndex === colIndex) {
    sortAsc = !sortAsc;
  } else {
    sortColIndex = colIndex;
    sortAsc = true;
  }
  tableRows.sort((a, b) => {
    const av = a[colIndex], bv = b[colIndex];
    const an = Number(av), bn = Number(bv);
    const numCompare = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
    return sortAsc ? numCompare : -numCompare;
  });
  // Re-apply any active search filter
  filterTable();
}

function sortTable() {
  sortByColumn(sortColIndex === 0 ? 0 : 0);
}

// ── Render chart ───────────────────────────────────────────
function renderChart(type) {
  type = type || currentType;
  currentType = type;
  activateChartBtn(type);

  const input = document.getElementById('jsonInput').value.trim();
  setError('');
  if (!input) { setError('Please enter data to render a chart.'); return; }

  let parsed;
  try { parsed = JSON.parse(input); } catch (e) { setError('Invalid JSON: ' + e.message); return; }

  const isChartJsFormat = !Array.isArray(parsed) && parsed && parsed.labels && parsed.datasets;
  parsedData = Array.isArray(parsed) ? parsed : null;

  try {
    const chartData = buildChartData(parsed, type);
    if (currentChart) currentChart.destroy();
    currentChart = new Chart(ctx, {
      type,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
          title: { display: false }
        },
        scales: (type === 'line' || type === 'bar') ? {
          x: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 11 } }, title: { display: true, text: 'Label', font: { size: 12 } } },
          y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 11 } }, beginAtZero: true, title: { display: true, text: 'Value', font: { size: 12 } } }
        } : {}
      }
    });
  } catch (e) { setError('Chart error: ' + e.message); }

  if (isChartJsFormat) buildTableFromChartJs(parsed);
  else if (parsedData) buildTable(parsedData);
}

// ── Utility ────────────────────────────────────────────────
function loadExampleData() {
  const data = [
  { "label": "Jan", "value": 10, "color": "#FF6384" },
  { "label": "Feb", "value": 15, "color": "#36A2EB" },
  { "label": "Mar", "value": 8, "color": "#FFCE56" },
  { "label": "Apr", "value": 20, "color": "#4BC0C0" },
  { "label": "May", "value": 12, "color": "#9966FF" },
  { "label": "Jun", "value": 18, "color": "#FF9F40" },
  { "label": "Jul", "value": 25, "color": "#E7E9ED" },
  { "label": "Aug", "value": 17, "color": "#FF6384" },
  { "label": "Sep", "value": 30, "color": "#36A2EB" },
  { "label": "Oct", "value": 22, "color": "#FFCE56" },
  { "label": "Nov", "value": 19, "color": "#4BC0C0" },
  { "label": "Dec", "value": 27, "color": "#9966FF" },
  { "label": "Q1", "value": 33, "color": "#FF9F40" },
  { "label": "Q2", "value": 28, "color": "#E7E9ED" },
  { "label": "Q3", "value": 24, "color": "#FF6384" },
  { "label": "Q4", "value": 26, "color": "#36A2EB" },
  { "label": "Week1", "value": 14, "color": "#FFCE56" },
  { "label": "Week2", "value": 16, "color": "#4BC0C0" },
  { "label": "Week3", "value": 19, "color": "#9966FF" },
  { "label": "Week4", "value": 21, "color": "#FF9F40" }
  ];
  document.getElementById('jsonInput').value = JSON.stringify(data, null, 2);
  validateJSON();
  renderChart('bar');
}

function clearInput() {
  document.getElementById('jsonInput').value = '';
  document.getElementById('tableSearch').value = '';
  document.getElementById('jsonStatus').textContent = '';
  document.getElementById('jsonStatus').className = 'json-status';
  setError('');
  if (currentChart) { currentChart.destroy(); currentChart = null; }
  document.getElementById('tableContainer').innerHTML = '';
  tableHeaders = []; tableRows = [];
  setRowCount(0);
  parsedData = null;
}

window.addEventListener('DOMContentLoaded', () => {
  switchView('both');
  loadExampleData();
});