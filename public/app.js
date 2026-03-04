const API_URL = window.location.origin;

let bathroomStartTime = null;
let bathroomInterval = null;
let salidaStartTime = null;
let salidaInterval = null;
let currentPeriod = 'daily';
let bathroomChart, bathroomTimeChart, bathroomVisitChart, foodChart, expenseChart, salidaChart, salidaTimeChart;
let appStarted = false;

const ACTIVE_TIMER_KEY = 'gcontrol_active_timer';
const MAX_TIMER_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

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

function formatUserAgent(ua) {
  if (!ua) return 'Desconocido';
  
  const browsers = [
    { pattern: /Edg/i, name: 'Edge' },
    { pattern: /Chrome/i, name: 'Chrome' },
    { pattern: /Safari/i, name: 'Safari' },
    { pattern: /Firefox/i, name: 'Firefox' },
    { pattern: /Opera|OPR/i, name: 'Opera' },
    { pattern: /MSIE|Trident/i, name: 'IE' }
  ];
  
  const os = [
    { pattern: /Windows/i, name: 'Windows' },
    { pattern: /Mac OS X/i, name: 'macOS' },
    { pattern: /Linux/i, name: 'Linux' },
    { pattern: /Android/i, name: 'Android' },
    { pattern: /iOS|iPhone|iPad/i, name: 'iOS' }
  ];
  
  let browser = 'Navegador';
  for (const b of browsers) {
    if (b.pattern.test(ua)) {
      browser = b.name;
      break;
    }
  }
  
  let osName = 'OS';
  for (const o of os) {
    if (o.pattern.test(ua)) {
      osName = o.name;
      break;
    }
  }
  
  // Remove version numbers for cleaner display
  browser = browser.replace(/\s+\d+\.\d+/, '');
  
  return `${browser} / ${osName}`;
}

function normalizeString(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function saveActiveTimerToStorage(type, startTime) {
  localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify({ type, startTime }));
}

function clearActiveTimerFromStorage() {
  localStorage.removeItem(ACTIVE_TIMER_KEY);
}

function getActiveTimerFromStorage() {
  const data = localStorage.getItem(ACTIVE_TIMER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Error parsing active timer:', e);
    return null;
  }
}

function restoreActiveTimer() {
  const saved = getActiveTimerFromStorage();
  if (!saved) return;

  const now = Date.now();
  if (now - saved.startTime > MAX_TIMER_AGE_MS) {
    clearActiveTimerFromStorage();
    return;
  }

  if (saved.type === 'bathroom') {
    bathroomStartTime = saved.startTime;
    document.getElementById('bathroom-btn').classList.add('active');
    bathroomInterval = setInterval(updateBathroomTimer, 1000);
    updateBathroomTimer();
  } else if (saved.type === 'salida') {
    salidaStartTime = saved.startTime;
    document.getElementById('salida-btn').classList.add('active');
    salidaInterval = setInterval(updateSalidaTimer, 1000);
    updateSalidaTimer();
  }
}

function updateBathroomTimer() {
  if (!bathroomStartTime) return;
  const elapsed = Math.floor((Date.now() - bathroomStartTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('bathroom-timer').textContent = `${mins}:${secs}`;
}

function updateSalidaTimer() {
  if (!salidaStartTime) return;
  const elapsed = Math.floor((Date.now() - salidaStartTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('salida-timer').textContent = `${mins}:${secs}`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

  salidaChart = new Chart(document.getElementById('salidaChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: chartColors.pinkBg,
        borderColor: chartColors.pink,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: commonOptions
  });

  salidaTimeChart = new Chart(document.getElementById('salidaTimeChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: 'rgba(255, 200, 87, 0.4)',
        borderColor: 'rgba(255, 200, 87, 0.95)',
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
  restoreActiveTimer();
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

    salidaChart.data.labels = data.labels;
    salidaChart.data.datasets[0].data = data.salidaChart || [];
    salidaChart.update();

    salidaTimeChart.data.labels = data.labels;
    salidaTimeChart.data.datasets[0].data = data.salidaTimeChart || [];
    salidaTimeChart.update();
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
    }
  }
}

document.getElementById('bathroom-btn').addEventListener('click', toggleBathroom);
document.getElementById('food-btn').addEventListener('click', openFoodModal);
document.getElementById('salida-btn').addEventListener('click', toggleSalida);
document.getElementById('save-food').addEventListener('click', saveFood);
document.getElementById('cancel-food').addEventListener('click', closeFoodModal);
document.getElementById('toggle-stats-btn').addEventListener('click', toggleStatsSection);
document.getElementById('toggle-records-btn').addEventListener('click', toggleRecordsSection);
document.getElementById('inject-btn').addEventListener('click', openInjectModal);
document.getElementById('cancel-inject').addEventListener('click', closeInjectModal);
document.getElementById('save-inject').addEventListener('click', saveInjectedRecord);
document.getElementById('cancel-edit').addEventListener('click', closeEditModal);
document.getElementById('save-edit').addEventListener('click', saveEditedRecord);
document.getElementById('inject-type').addEventListener('change', toggleInjectFields);

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
    clearActiveTimerFromStorage();
    const duration = Math.floor((Date.now() - bathroomStartTime) / 1000);
    saveBathroom(duration);
    bathroomStartTime = null;
    btn.classList.remove('active');
    timer.textContent = '00:00';
  } else {
    if (salidaStartTime) {
      clearInterval(salidaInterval);
      salidaStartTime = null;
      document.getElementById('salida-btn').classList.remove('active');
      document.getElementById('salida-timer').textContent = '00:00';
      clearActiveTimerFromStorage();
    }
    bathroomStartTime = Date.now();
    saveActiveTimerToStorage('bathroom', bathroomStartTime);
    btn.classList.add('active');
    bathroomInterval = setInterval(updateBathroomTimer, 1000);
    updateBathroomTimer();
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
    showToast('Baño registrado', 'success');
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
      showToast('Error al registrar baño', 'error');
    }
  }
}

function toggleSalida() {
  const btn = document.getElementById('salida-btn');
  const timer = document.getElementById('salida-timer');

  if (salidaStartTime) {
    clearInterval(salidaInterval);
    clearActiveTimerFromStorage();
    const duration = Math.floor((Date.now() - salidaStartTime) / 1000);
    saveSalida(duration);
    salidaStartTime = null;
    btn.classList.remove('active');
    timer.textContent = '00:00';
  } else {
    if (bathroomStartTime) {
      clearInterval(bathroomInterval);
      bathroomStartTime = null;
      document.getElementById('bathroom-btn').classList.remove('active');
      document.getElementById('bathroom-timer').textContent = '00:00';
      clearActiveTimerFromStorage();
    }
    salidaStartTime = Date.now();
    saveActiveTimerToStorage('salida', salidaStartTime);
    btn.classList.add('active');
    salidaInterval = setInterval(updateSalidaTimer, 1000);
    updateSalidaTimer();
  }
}

async function saveSalida(duration) {
  try {
    await apiFetchJson(`${API_URL}/api/salida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: duration })
    });
    loadStats();
    updateCharts(currentPeriod);
    showToast('Salida registrada', 'success');
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
      showToast('Error al registrar salida', 'error');
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
    showToast('Por favor ingresa el tipo de comida', 'error');
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
    showToast('Comida registrada', 'success');
  } catch (error) {
    if (error.message !== 'unauthorized') {
      console.error('Error:', error);
      showToast('Error al registrar comida', 'error');
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

    document.getElementById('salida-count').textContent = data.salida?.salida_count || 0;
    const salidaTotalSeconds = data.salida?.salida_total_time || 0;
    const salidaHours = Math.floor(salidaTotalSeconds / 3600);
    const salidaMins = Math.floor((salidaTotalSeconds % 3600) / 60);
    document.getElementById('salida-time').textContent =
      salidaHours > 0 ? `${salidaHours}h ${salidaMins}m` : `${salidaMins} min`;

    // Calcular promedios
    const bathroomCount = data.bathroom?.bathroom_count || 0;
    const bathroomAvgSeconds = bathroomCount > 0 ? totalSeconds / bathroomCount : 0;
    const bathroomAvgMins = Math.floor(bathroomAvgSeconds / 60);
    document.getElementById('bathroom-avg').textContent = `${bathroomAvgMins}m`;

    const salidaCount = data.salida?.salida_count || 0;
    const salidaAvgSeconds = salidaCount > 0 ? salidaTotalSeconds / salidaCount : 0;
    const salidaAvgMins = Math.floor(salidaAvgSeconds / 60);
    document.getElementById('salida-avg').textContent = `${salidaAvgMins}m`;

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
        user_agent: formatUserAgent(r.user_agent),
        sortKey: new Date(r.timestamp).getTime()
      })),
      ...(data.food_details || []).map(r => ({ 
        type: 'food', 
        label: `${r.food_type} ($${r.estimated_price})`,
        time: formatTime(r.timestamp),
        user_agent: formatUserAgent(r.user_agent),
        sortKey: new Date(r.timestamp).getTime()
      })),
      ...(data.salida_details || []).map(r => ({ 
        type: 'salida', 
        label: `Salida (${formatDuration(r.duration_seconds)})`,
        time: formatTime(r.timestamp),
        user_agent: formatUserAgent(r.user_agent),
        sortKey: new Date(r.timestamp).getTime()
      }))
    ].sort((a, b) => b.sortKey - a.sortKey);

    if (allRecords.length === 0) {
      detailsContainer.innerHTML = '<p class="no-records">No hay registros en este periodo.</p>';
      return;
    }

    detailsContainer.innerHTML = allRecords.map(r => `
      <div class="detail-item">
        <span class="detail-icon">${r.type === 'bathroom' ? '🚽' : r.type === 'food' ? '🍽️' : '🚪'}</span>
        <div class="detail-info">
          <span class="detail-label">${r.label}</span>
          <span class="detail-device" title="${r.user_agent}">${r.user_agent}</span>
        </div>
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
  const tabs = document.querySelector('.tabs');
  const isHidden = section.classList.toggle('is-hidden');

  toggleBtn.textContent = isHidden ? 'Ver estadísticas' : 'Ocultar estadísticas';
  toggleBtn.setAttribute('aria-expanded', String(!isHidden));

  if (tabs) {
    tabs.classList.toggle('is-hidden');
  }

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
        <button class="edit-btn" data-id="${r.id}" data-type="${r.type}">✎</button>
        <button class="delete-btn" data-id="${r.id}" data-type="${r.type}">✕</button>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;
        const record = allRecords.find(r => r.id == id && r.type === type);
        if (record) {
          openEditModal(record);
        }
      });
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
    showToast('Registro eliminado', 'success');
  } catch (error) {
    console.error('Error deleting record:', error);
    showToast('Error al eliminar registro', 'error');
  }
}

function openEditModal(record) {
  const modal = document.getElementById('edit-modal');
  const editType = document.getElementById('edit-type');
  const editId = document.getElementById('edit-id');
  const bathroomFields = document.getElementById('edit-bathroom-fields');
  const foodFields = document.getElementById('edit-food-fields');

  editType.value = record.type;
  editId.value = record.id;

  if (record.type === 'bathroom') {
    bathroomFields.classList.remove('hidden');
    foodFields.classList.add('hidden');
    document.getElementById('edit-duration').value = record.duration_seconds;
    const date = new Date(record.timestamp);
    document.getElementById('edit-timestamp').value = date.toISOString().slice(0, 16);
  } else {
    bathroomFields.classList.add('hidden');
    foodFields.classList.remove('hidden');
    document.getElementById('edit-food-type').value = record.food_type;
    document.getElementById('edit-price').value = record.estimated_price;
    const date = new Date(record.timestamp);
    document.getElementById('edit-timestamp-food').value = date.toISOString().slice(0, 16);
  }

  modal.classList.add('active');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('active');
}

async function saveEditedRecord() {
  const type = document.getElementById('edit-type').value;
  const id = document.getElementById('edit-id').value;
  let data = {};

  if (type === 'bathroom') {
    data.duration_seconds = parseInt(document.getElementById('edit-duration').value) || 0;
    const timestamp = document.getElementById('edit-timestamp').value;
    if (timestamp) {
      data.timestamp = new Date(timestamp).toISOString();
    }
  } else {
    data.food_type = document.getElementById('edit-food-type').value.trim();
    data.estimated_price = parseFloat(document.getElementById('edit-price').value) || 0;
    const timestamp = document.getElementById('edit-timestamp-food').value;
    if (timestamp) {
      data.timestamp = new Date(timestamp).toISOString();
    }
  }

   try {
     await apiFetchJson(`${API_URL}/api/${type}/${id}`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(data)
     });
     closeEditModal();
     loadRecords();
     loadStats();
     updateCharts(currentPeriod);
     showToast('Cambios guardados', 'success');
   } catch (error) {
     console.error('Error saving edit:', error);
     showToast('Error al guardar cambios', 'error');
   }
 }

function openInjectModal() {
  const modal = document.getElementById('inject-modal');
  document.getElementById('inject-type').value = '';
  document.getElementById('inject-bathroom-fields').classList.add('hidden');
  document.getElementById('inject-food-fields').classList.add('hidden');
  document.getElementById('inject-start-bathroom').value = '';
  document.getElementById('inject-duration').value = '';
  document.getElementById('inject-start-food').value = '';
  document.getElementById('inject-food-type').value = '';
  document.getElementById('inject-price').value = '';
  modal.classList.add('active');
}

function closeInjectModal() {
  document.getElementById('inject-modal').classList.remove('active');
}

function toggleInjectFields() {
  const type = document.getElementById('inject-type').value;
  const bathroomFields = document.getElementById('inject-bathroom-fields');
  const foodFields = document.getElementById('inject-food-fields');
  const salidaFields = document.getElementById('inject-salida-fields');

  if (type === 'bathroom') {
    bathroomFields.classList.remove('hidden');
    foodFields.classList.add('hidden');
    salidaFields.classList.add('hidden');
  } else if (type === 'food') {
    bathroomFields.classList.add('hidden');
    foodFields.classList.remove('hidden');
    salidaFields.classList.add('hidden');
  } else if (type === 'salida') {
    bathroomFields.classList.add('hidden');
    foodFields.classList.add('hidden');
    salidaFields.classList.remove('hidden');
  } else {
    bathroomFields.classList.add('hidden');
    foodFields.classList.add('hidden');
    salidaFields.classList.add('hidden');
  }
}

async function saveInjectedRecord() {
  const type = document.getElementById('inject-type').value;
  if (!type) {
    showToast('Por favor selecciona un tipo', 'error');
    return;
  }

  let data = {};

  if (type === 'bathroom') {
    const durationMinutes = parseInt(document.getElementById('inject-duration').value) || 0;
    const durationSeconds = durationMinutes * 60;
    data.duration_seconds = durationSeconds;
    
    const startTime = document.getElementById('inject-start-bathroom').value;
    let timestamp;
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const now = new Date();
      timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
      timestamp = new Date(timestamp.getTime() - (durationSeconds * 1000));
    } else {
      timestamp = new Date(Date.now() - (durationSeconds * 1000));
    }
    data.timestamp = timestamp.toISOString();
  } else if (type === 'salida') {
    const durationMinutes = parseInt(document.getElementById('inject-duration-salida').value) || 0;
    const durationSeconds = durationMinutes * 60;
    data.duration_seconds = durationSeconds;
    
    const startTime = document.getElementById('inject-start-salida').value;
    let timestamp;
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const now = new Date();
      timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
      timestamp = new Date(timestamp.getTime() - (durationSeconds * 1000));
    } else {
      timestamp = new Date(Date.now() - (durationSeconds * 1000));
    }
    data.timestamp = timestamp.toISOString();
  } else {
    data.food_type = document.getElementById('inject-food-type').value.trim();
    data.estimated_price = parseFloat(document.getElementById('inject-price').value) || 0;
    
    const startTime = document.getElementById('inject-start-food').value;
    let timestamp;
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const now = new Date();
      timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    } else {
      timestamp = new Date();
    }
    data.timestamp = timestamp.toISOString();
  }

  try {
    await apiFetchJson(`${API_URL}/api/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    closeInjectModal();
    loadRecords();
    loadStats();
    updateCharts(currentPeriod);
    showToast('Registro inyectado correctamente', 'success');
  } catch (error) {
    console.error('Error saving inject:', error);
    showToast('Error al inyectar registro', 'error');
  }
}

setupAuthGate();
