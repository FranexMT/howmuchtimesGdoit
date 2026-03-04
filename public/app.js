const API_URL = window.location.origin;

let bathroomStartTime = null;
let bathroomInterval = null;
let currentPeriod = 'daily';
let bathroomChart, bathroomTimeChart, bathroomVisitChart, foodChart, expenseChart;
let appStarted = false;

const chartColors = {
  violet: 'rgba(166, 125, 255, 0.95)',
  violetBg: 'rgba(166, 125, 255, 0.24)',
  pink: 'rgba(255, 138, 199, 0.95)',
  pinkBg: 'rgba(255, 138, 199, 0.22)',
  mint: 'rgba(127, 243, 203, 0.95)',
  mintBg: 'rgba(127, 243, 203, 0.22)',
  grid: 'rgba(191, 164, 255, 0.16)',
  ticks: 'rgba(205, 188, 242, 0.9)'
};

function normalizeString(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.ticks, font: { size: 10 } }
      },
      y: {
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.ticks, font: { size: 10 } },
        beginAtZero: true
      }
    }
  };

  bathroomChart = new Chart(document.getElementById('bathroomChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: chartColors.violetBg,
        borderColor: chartColors.violet,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: commonOptions
  });

  bathroomTimeChart = new Chart(document.getElementById('bathroomTimeChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: chartColors.mintBg,
        borderColor: chartColors.mint,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: commonOptions
  });

  bathroomVisitChart = new Chart(document.getElementById('bathroomVisitChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: chartColors.violet,
        backgroundColor: chartColors.violetBg,
        borderWidth: 2,
        fill: false,
        tension: 0.25,
        pointRadius: 4,
        pointBackgroundColor: chartColors.violet
      }]
    },
    options: commonOptions
  });

  foodChart = new Chart(document.getElementById('foodChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: chartColors.pink,
        backgroundColor: chartColors.pinkBg,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: chartColors.pink
      }]
    },
    options: commonOptions
  });

  expenseChart = new Chart(document.getElementById('expenseChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: chartColors.mintBg,
        borderColor: chartColors.mint,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: commonOptions
  });
}

function startApp() {
  if (appStarted) {
    return;
  }

  initCharts();
  loadStats();
  updateCharts(currentPeriod);
  appStarted = true;
}

function lockApp() {
  document.body.classList.add('app-locked');
  document.getElementById('auth-gate').classList.remove('hidden');
  document.getElementById('auth-password').value = '';
}

function unlockApp() {
  document.body.classList.remove('app-locked');
  document.getElementById('auth-gate').classList.add('hidden');
  startApp();
}

async function apiFetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 401) {
    lockApp();
    throw new Error('unauthorized');
  }

  if (!response.ok) {
    throw new Error(`request_failed_${response.status}`);
  }

  return response.json();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const passwordInput = document.getElementById('auth-password');
  const errorNode = document.getElementById('auth-error');
  const attempt = normalizeString(passwordInput.value).charAt(0);

  if (!attempt) {
    errorNode.textContent = 'Contraseña incorrecta.';
    passwordInput.value = '';
    passwordInput.focus();
    return;
  }

  try {
    await apiFetchJson(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: attempt })
    });
    errorNode.textContent = '';
    unlockApp();
  } catch (error) {
    errorNode.textContent = 'Contraseña incorrecta.';
    passwordInput.value = '';
    passwordInput.focus();
  }
}

async function setupAuthGate() {
  const authForm = document.getElementById('auth-form');
  const passwordInput = document.getElementById('auth-password');
  authForm.addEventListener('submit', handleAuthSubmit);

  try {
    const status = await apiFetchJson(`${API_URL}/api/auth/status`);
    if (status.authenticated) {
      unlockApp();
      return;
    }
  } catch (error) {
    // Keep gate closed when status check fails.
  }

  lockApp();
  passwordInput.focus();
}

async function updateCharts(period) {
  try {
    const data = await apiFetchJson(`${API_URL}/api/chart/${period}`);
    bathroomChart.data.labels = data.labels;
    bathroomChart.data.datasets[0].data = data.bathroomChart;
    bathroomChart.update();

    bathroomTimeChart.data.labels = data.labels;
    bathroomTimeChart.data.datasets[0].data = data.bathroomTimeChart || [];
    bathroomTimeChart.update();

    foodChart.data.labels = data.labels;
    foodChart.data.datasets[0].data = data.foodChart;
    foodChart.update();

    expenseChart.data.labels = data.labels;
    expenseChart.data.datasets[0].data = data.expenseChart;
    expenseChart.update();
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
    }
  }
}

document.getElementById('bathroom-btn').addEventListener('click', toggleBathroom);
document.getElementById('food-btn').addEventListener('click', openFoodModal);
document.getElementById('save-food').addEventListener('click', saveFood);
document.getElementById('cancel-food').addEventListener('click', closeFoodModal);
document.getElementById('toggle-stats-btn').addEventListener('click', toggleStatsSection);
document.getElementById('toggle-records-btn').addEventListener('click', toggleRecordsSection);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPeriod = tab.dataset.period;
    loadStats();
    updateCharts(currentPeriod);
  });
});

function toggleBathroom() {
  const btn = document.getElementById('bathroom-btn');
  const timer = document.getElementById('bathroom-timer');

  if (bathroomStartTime) {
    clearInterval(bathroomInterval);
    const duration = Math.floor((Date.now() - bathroomStartTime) / 1000);
    saveBathroom(duration);
    bathroomStartTime = null;
    btn.classList.remove('active');
    timer.textContent = '00:00';
  } else {
    bathroomStartTime = Date.now();
    btn.classList.add('active');
    bathroomInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - bathroomStartTime) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      timer.textContent = `${mins}:${secs}`;
    }, 1000);
  }
}

async function saveBathroom(duration) {
  try {
    await apiFetchJson(`${API_URL}/api/bathroom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: duration })
    });
    loadStats();
    updateCharts(currentPeriod);
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
    }
  }
}

function openFoodModal() {
  document.getElementById('food-modal').classList.add('active');
  document.getElementById('food-type').value = '';
  document.getElementById('food-price').value = '';
  document.getElementById('food-type').focus();
}

function closeFoodModal() {
  document.getElementById('food-modal').classList.remove('active');
}

async function saveFood() {
  const foodType = document.getElementById('food-type').value.trim();
  const price = parseFloat(document.getElementById('food-price').value) || 0;

  if (!foodType) {
    alert('Por favor ingresa el tipo de comida');
    return;
  }

  try {
    await apiFetchJson(`${API_URL}/api/food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        food_type: foodType,
        estimated_price: price
      })
    });
    closeFoodModal();
    loadStats();
    updateCharts(currentPeriod);
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
    }
  }
}

async function loadStats() {
  try {
    const data = await apiFetchJson(`${API_URL}/api/stats/${currentPeriod}`);
    document.getElementById('bathroom-count').textContent = data.bathroom.bathroom_count || 0;

    const totalSeconds = data.bathroom.bathroom_total_time || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById('bathroom-time').textContent =
      hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    document.getElementById('food-count').textContent = data.food.food_count || 0;
    document.getElementById('food-total').textContent =
      `$${(data.food.food_total_price || 0).toFixed(2)}`;
    updateBathroomVisitChart(data.bathroom_details || []);

    const detailsContainer = document.getElementById('stats-details');
    const formatTime = (ts) => {
      const d = new Date(ts);
      return d.toLocaleString('es-ES', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
    };

    const formatDuration = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s}s`;
    };

    const allRecords = [
      ...(data.bathroom_details || []).map(r => ({ 
        type: 'bathroom', 
        label: `Baño (${formatDuration(r.duration_seconds)})`,
        time: formatTime(r.timestamp),
        sortKey: new Date(r.timestamp).getTime()
      })),
      ...(data.food_details || []).map(r => ({ 
        type: 'food', 
        label: `${r.food_type} ($${r.estimated_price})`,
        time: formatTime(r.timestamp),
        sortKey: new Date(r.timestamp).getTime()
      }))
    ].sort((a, b) => b.sortKey - a.sortKey);

    if (allRecords.length === 0) {
      detailsContainer.innerHTML = '<p class="no-records">No hay registros en este periodo.</p>';
      return;
    }

    detailsContainer.innerHTML = allRecords.map(r => `
      <div class="detail-item">
        <span class="detail-icon">${r.type === 'bathroom' ? '🚽' : '🍽️'}</span>
        <span class="detail-label">${r.label}</span>
        <span class="detail-time">${r.time}</span>
      </div>
    `).join('');
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
    }
  }
}

function updateBathroomVisitChart(records) {
  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const labels = sorted.map((record, index) => {
    const d = new Date(record.timestamp);
    const day = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${index + 1}. ${day} ${time}`;
  });
  const values = sorted.map(record => Number((record.duration_seconds / 60).toFixed(2)));

  bathroomVisitChart.data.labels = labels;
  bathroomVisitChart.data.datasets[0].data = values;
  bathroomVisitChart.update();
}

function toggleStatsSection() {
  const section = document.getElementById('stats-section');
  const toggleBtn = document.getElementById('toggle-stats-btn');
  const isHidden = section.classList.toggle('is-hidden');

  toggleBtn.textContent = isHidden ? 'Ver estadísticas' : 'Ocultar estadísticas';
  toggleBtn.setAttribute('aria-expanded', String(!isHidden));

  if (!isHidden) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function toggleRecordsSection() {
  const section = document.getElementById('records-section');
  const toggleBtn = document.getElementById('toggle-records-btn');
  const isHidden = section.classList.toggle('is-hidden');

  toggleBtn.textContent = isHidden ? 'Ver registros recientes' : 'Ocultar registros recientes';
  toggleBtn.setAttribute('aria-expanded', String(!isHidden));

  if (!isHidden) {
    await loadRecords();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadRecords() {
  try {
    const [bathroom, food] = await Promise.all([
      apiFetchJson(`${API_URL}/api/bathroom/recent`),
      apiFetchJson(`${API_URL}/api/food/recent`)
    ]);

    const list = document.getElementById('records-list');
    list.innerHTML = '';

    const formatTime = (ts) => {
      const d = new Date(ts);
      return d.toLocaleString('es-ES', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
    };

    const formatDuration = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s}s`;
    };

    const allRecords = [
      ...bathroom.map(r => ({ ...r, type: 'bathroom', label: `Baño (${formatDuration(r.duration_seconds)})` })),
      ...food.map(r => ({ ...r, type: 'food', label: `Comida: ${r.food_type} ($${r.estimated_price})` }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (allRecords.length === 0) {
      list.innerHTML = '<p class="no-records">No hay registros recientes.</p>';
      return;
    }

    allRecords.forEach(r => {
      const item = document.createElement('div');
      item.className = 'record-item';
      item.innerHTML = `
        <span class="record-info">
          <span class="record-type">${r.type === 'bathroom' ? '🚽' : '🍽️'}</span>
          <span class="record-label">${r.label}</span>
          <span class="record-time">${formatTime(r.timestamp)}</span>
        </span>
        <button class="delete-btn" data-id="${r.id}" data-type="${r.type}">✕</button>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;
        if (confirm('¿Eliminar este registro?')) {
          await deleteRecord(id, type);
          loadRecords();
          loadStats();
          updateCharts(currentPeriod);
        }
      });
    });
  } catch (error) {
    console.error('Error loading records:', error);
  }
}

async function deleteRecord(id, type) {
  try {
    await apiFetchJson(`${API_URL}/api/${type}/${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Error deleting record:', error);
    alert('Error al eliminar registro');
  }
}

setupAuthGate();
