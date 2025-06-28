const ctx = document.getElementById('chartCanvas').getContext('2d');
const errorMsg = document.getElementById('errorMsg');
let currentChart = null;

function renderChart(type) {
  const input = document.getElementById('jsonInput').value.trim();
  errorMsg.textContent = "";
  if (!input) {
    errorMsg.textContent = "Please enter or upload data to render a chart.";
    return;
  }
  try {
    const parsed = JSON.parse(input);
    if (currentChart) currentChart.destroy();
    let chartData;
    if (parsed.labels && parsed.datasets) {
      parsed.datasets.forEach(ds => {
        ds.data = ds.data.map(val => isNaN(val) ? null : Number(val));
      });
      chartData = parsed;
    } else if (Array.isArray(parsed)) {
      const labels = parsed.map(item => item.label);
      const values = parsed.map(item => Number(item.value));
      const colors = parsed.map(item => item.color || `hsl(${Math.random() * 360}, 70%, 60%)`);
      chartData = {
        labels: labels,
        datasets: [{
          label: "Dataset",
          data: values,
          backgroundColor: (type === 'line') ? undefined : colors,
          borderColor: (type === 'line') ? "#3498db" : undefined,
          fill: (type === 'line'),
          tension: 0.4,
          pointRadius: 3
        }]
      };
    } else {
      throw new Error("Invalid JSON format.");
    }
    currentChart = new Chart(ctx, {
      type: type,
      data: chartData,
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: 'bottom' },
          title: { display: true, text: `${type.toUpperCase()} Chart` }
        },
        scales: (type === 'line' || type === 'bar') ? {
          x: { title: { display: true, text: 'Label' } },
          y: { title: { display: true, text: 'Value' }, beginAtZero: true }
        } : {}
      }
    });
  } catch (e) {
    errorMsg.textContent = `Data Error: ${e.message}`;
  }
}
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  const fileName = file.name.toLowerCase();
  reader.onload = function (e) {
    const content = e.target.result;
    if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        document.getElementById('jsonInput').value = JSON.stringify(parsed, null, 2);
        renderChart('bar');
      } catch (err) {
        errorMsg.textContent = "Invalid JSON format.";
      }
    } else if (fileName.endsWith('.csv')) {
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      if (!headers.includes('label') || !headers.includes('value')) {
        errorMsg.textContent = "CSV must have 'label' and 'value' columns.";
        return;
      }
      const labelIdx = headers.indexOf('label');
      const valueIdx = headers.indexOf('value');
      const data = lines.slice(1).map(line => {
        const cols = line.split(',');
        return {
          label: cols[labelIdx].trim(),
          value: Number(cols[valueIdx].trim()),
          color: `hsl(${Math.random() * 360}, 70%, 60%)`
        };
      });
      document.getElementById('jsonInput').value = JSON.stringify(data, null, 2);
      renderChart('bar');
    } else {
      errorMsg.textContent = "Unsupported file type. Please upload a CSV or JSON file.";
    }
  };
  reader.readAsText(file);
}
function loadExampleData() {
  fetch("data/example.json")
    .then(res => {
      if (!res.ok) throw new Error("Unable to load example.json");
      return res.json();
    })
    .then(data => {
      document.getElementById('jsonInput').value = JSON.stringify(data, null, 2);
      renderChart('bar');
    })
    .catch(err => {
      errorMsg.textContent = `Error loading default data: ${err.message}`;
    });
}
function clearInput() {
  document.getElementById('jsonInput').value = '';
  errorMsg.textContent = '';
  if (currentChart) currentChart.destroy();
}
window.addEventListener("DOMContentLoaded", loadExampleData);
