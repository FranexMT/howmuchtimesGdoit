const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 3009);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_COOKIE = 'gcontrol_session';
const sessions = new Map();
const RECENT_LIMIT = 30;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeString(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getTodayInitial() {
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date());
  return normalizeString(weekday).charAt(0);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  if (!header) {
    return {};
  }

  return header.split(';').reduce((acc, cookiePart) => {
    const [rawName, ...rawValue] = cookiePart.trim().split('=');
    if (!rawName) {
      return acc;
    }
    acc[rawName] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function getValidSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session || session.dayKey !== getTodayKey()) {
    sessions.delete(token);
    return null;
  }

  return { token, session };
}

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'daily') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === 'weekly') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return start;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapBathroomRecord(record) {
  return {
    id: record.id,
    timestamp: record.timestamp,
    duration_seconds: record.durationSeconds
  };
}

function mapFoodRecord(record) {
  return {
    id: record.id,
    timestamp: record.timestamp,
    food_type: record.foodType,
    estimated_price: record.estimatedPrice
  };
}

function mapSalidaRecord(record) {
  return {
    id: record.id,
    timestamp: record.timestamp,
    duration_seconds: record.durationSeconds
  };
}

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  const attempt = normalizeString(password).charAt(0);

  if (!attempt || attempt !== getTodayInitial()) {
    return res.status(401).json({ authenticated: false, error: 'invalid_credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { dayKey: getTodayKey(), createdAt: Date.now() });
  setSessionCookie(res, token);
  return res.json({ authenticated: true });
});

app.get('/api/auth/status', (req, res) => {
  const validSession = getValidSession(req);
  if (!validSession) {
    clearSessionCookie(res);
    return res.json({ authenticated: false });
  }

  return res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  const validSession = getValidSession(req);
  if (validSession) {
    sessions.delete(validSession.token);
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  const validSession = getValidSession(req);
  if (!validSession) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'unauthorized' });
  }

  return next();
});

app.post('/api/bathroom', async (req, res) => {
  try {
    const rawDuration = req.body?.duration_seconds;
    const duration = Number(rawDuration);
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : undefined;

    if (!Number.isFinite(duration) || duration < 0) {
      return res.status(400).json({ error: 'invalid_duration_seconds' });
    }
    if (timestamp && isNaN(timestamp.getTime())) {
      return res.status(400).json({ error: 'invalid_timestamp' });
    }

    const result = await prisma.bathroomLog.create({
      data: { 
        durationSeconds: Math.floor(duration),
        ...(timestamp && { timestamp })
      }
    });

    return res.json(mapBathroomRecord(result));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/food', async (req, res) => {
  try {
    const foodType = String(req.body?.food_type || '').trim();
    const estimatedPrice = Number(req.body?.estimated_price || 0);
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : undefined;

    if (!foodType) {
      return res.status(400).json({ error: 'invalid_food_type' });
    }
    if (!Number.isFinite(estimatedPrice) || estimatedPrice < 0) {
      return res.status(400).json({ error: 'invalid_estimated_price' });
    }
    if (timestamp && isNaN(timestamp.getTime())) {
      return res.status(400).json({ error: 'invalid_timestamp' });
    }

    const result = await prisma.foodLog.create({
      data: {
        foodType,
        estimatedPrice,
        ...(timestamp && { timestamp })
      }
    });

    return res.json(mapFoodRecord(result));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/salida', async (req, res) => {
  try {
    const rawDuration = req.body?.duration_seconds;
    const duration = Number(rawDuration);
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : undefined;

    if (!Number.isFinite(duration) || duration < 0) {
      return res.status(400).json({ error: 'invalid_duration_seconds' });
    }
    if (timestamp && isNaN(timestamp.getTime())) {
      return res.status(400).json({ error: 'invalid_timestamp' });
    }

    const result = await prisma.salidaLog.create({
      data: { 
        durationSeconds: Math.floor(duration),
        ...(timestamp && { timestamp })
      }
    });

    return res.json(mapSalidaRecord(result));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/bathroom/recent', async (_req, res) => {
  try {
    const rows = await prisma.bathroomLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: RECENT_LIMIT
    });
    return res.json(rows.map(mapBathroomRecord));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/food/recent', async (_req, res) => {
  try {
    const rows = await prisma.foodLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: RECENT_LIMIT
    });
    return res.json(rows.map(mapFoodRecord));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/salida/recent', async (_req, res) => {
  try {
    const rows = await prisma.salidaLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: RECENT_LIMIT
    });
    return res.json(rows.map(mapSalidaRecord));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/bathroom/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }
    await prisma.bathroomLog.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'record_not_found' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/food/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }
    await prisma.foodLog.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'record_not_found' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/salida/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }
    await prisma.salidaLog.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'record_not_found' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/bathroom/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const rawDuration = req.body?.duration_seconds;
    const duration = rawDuration !== undefined ? Number(rawDuration) : undefined;
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : undefined;

    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
      return res.status(400).json({ error: 'invalid_duration_seconds' });
    }
    if (timestamp && isNaN(timestamp.getTime())) {
      return res.status(400).json({ error: 'invalid_timestamp' });
    }

    const updateData = {};
    if (duration !== undefined) {
      updateData.durationSeconds = Math.floor(duration);
    }
    if (timestamp) {
      updateData.timestamp = timestamp;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const result = await prisma.bathroomLog.update({
      where: { id },
      data: updateData
    });

    return res.json(mapBathroomRecord(result));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'record_not_found' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/food/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const foodType = req.body?.food_type !== undefined ? String(req.body.food_type).trim() : undefined;
    const estimatedPrice = req.body?.estimated_price !== undefined ? Number(req.body.estimated_price) : undefined;
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : undefined;

    if (foodType !== undefined && !foodType) {
      return res.status(400).json({ error: 'invalid_food_type' });
    }
    if (estimatedPrice !== undefined && (!Number.isFinite(estimatedPrice) || estimatedPrice < 0)) {
      return res.status(400).json({ error: 'invalid_estimated_price' });
    }
    if (timestamp && isNaN(timestamp.getTime())) {
      return res.status(400).json({ error: 'invalid_timestamp' });
    }

    const updateData = {};
    if (foodType !== undefined) {
      updateData.foodType = foodType;
    }
    if (estimatedPrice !== undefined) {
      updateData.estimatedPrice = estimatedPrice;
    }
    if (timestamp) {
      updateData.timestamp = timestamp;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const result = await prisma.foodLog.update({
      where: { id },
      data: updateData
    });

    return res.json(mapFoodRecord(result));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'record_not_found' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/salida/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const rawDuration = req.body?.duration_seconds;
    const duration = rawDuration !== undefined ? Number(rawDuration) : undefined;
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : undefined;

    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
      return res.status(400).json({ error: 'invalid_duration_seconds' });
    }
    if (timestamp && isNaN(timestamp.getTime())) {
      return res.status(400).json({ error: 'invalid_timestamp' });
    }

    const updateData = {};
    if (duration !== undefined) {
      updateData.durationSeconds = Math.floor(duration);
    }
    if (timestamp) {
      updateData.timestamp = timestamp;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const result = await prisma.salidaLog.update({
      where: { id },
      data: updateData
    });

    return res.json(mapSalidaRecord(result));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'record_not_found' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/:period', async (req, res) => {
  try {
    const period = req.params.period;
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'invalid_period' });
    }

    const start = getPeriodStart(period);
    const [bathroomAggregate, foodAggregate, salidaAggregate, bathroomDetailsRows, foodDetailsRows, salidaDetailsRows] = await Promise.all([
      prisma.bathroomLog.aggregate({
        where: { timestamp: { gte: start } },
        _count: { id: true },
        _sum: { durationSeconds: true }
      }),
      prisma.foodLog.aggregate({
        where: { timestamp: { gte: start } },
        _count: { id: true },
        _sum: { estimatedPrice: true }
      }),
      prisma.salidaLog.aggregate({
        where: { timestamp: { gte: start } },
        _count: { id: true },
        _sum: { durationSeconds: true }
      }),
      prisma.bathroomLog.findMany({
        where: { timestamp: { gte: start } },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.foodLog.findMany({
        where: { timestamp: { gte: start } },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.salidaLog.findMany({
        where: { timestamp: { gte: start } },
        orderBy: { timestamp: 'desc' }
      })
    ]);

    return res.json({
      bathroom: {
        bathroom_count: bathroomAggregate._count.id,
        bathroom_total_time: bathroomAggregate._sum.durationSeconds || 0
      },
      food: {
        food_count: foodAggregate._count.id,
        food_total_price: foodAggregate._sum.estimatedPrice || 0
      },
      salida: {
        salida_count: salidaAggregate._count.id,
        salida_total_time: salidaAggregate._sum.durationSeconds || 0
      },
      bathroom_details: bathroomDetailsRows.map(mapBathroomRecord),
      food_details: foodDetailsRows.map(mapFoodRecord),
      salida_details: salidaDetailsRows.map(mapSalidaRecord)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/chart/:period', async (req, res) => {
  try {
    const period = req.params.period;
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'invalid_period' });
    }

    const days = period === 'monthly' ? 30 : 7;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const [bathroomLogs, foodLogs, salidaLogs] = await Promise.all([
      prisma.bathroomLog.findMany({
        where: { timestamp: { gte: startDate } },
        orderBy: { timestamp: 'asc' }
      }),
      prisma.foodLog.findMany({
        where: { timestamp: { gte: startDate } },
        orderBy: { timestamp: 'asc' }
      }),
      prisma.salidaLog.findMany({
        where: { timestamp: { gte: startDate } },
        orderBy: { timestamp: 'asc' }
      })
    ]);

    const labels = [];
    const bathroomByDay = {};
    const bathroomTimeByDay = {};
    const foodByDay = {};
    const expenseByDay = {};
    const salidaByDay = {};
    const salidaTimeByDay = {};

    for (let i = 0; i < days; i += 1) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = toDateKey(date);
      labels.push(
        period === 'monthly'
          ? `${date.getDate()}`
          : ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][date.getDay()]
      );
      bathroomByDay[key] = 0;
      bathroomTimeByDay[key] = 0;
      foodByDay[key] = 0;
      expenseByDay[key] = 0;
      salidaByDay[key] = 0;
      salidaTimeByDay[key] = 0;
    }

    bathroomLogs.forEach((log) => {
      const key = toDateKey(log.timestamp);
      if (Object.prototype.hasOwnProperty.call(bathroomByDay, key)) {
        bathroomByDay[key] += 1;
        bathroomTimeByDay[key] += log.durationSeconds / 60;
      }
    });

    foodLogs.forEach((log) => {
      const key = toDateKey(log.timestamp);
      if (Object.prototype.hasOwnProperty.call(foodByDay, key)) {
        foodByDay[key] += 1;
        expenseByDay[key] += log.estimatedPrice;
      }
    });

    salidaLogs.forEach((log) => {
      const key = toDateKey(log.timestamp);
      if (Object.prototype.hasOwnProperty.call(salidaByDay, key)) {
        salidaByDay[key] += 1;
        salidaTimeByDay[key] += log.durationSeconds / 60;
      }
    });

    return res.json({
      labels,
      bathroomChart: Object.values(bathroomByDay),
      bathroomTimeChart: Object.values(bathroomTimeByDay).map((m) => Number(m.toFixed(2))),
      foodChart: Object.values(foodByDay),
      expenseChart: Object.values(expenseByDay).map((v) => Number(v.toFixed(2))),
      salidaChart: Object.values(salidaByDay),
      salidaTimeChart: Object.values(salidaTimeByDay).map((m) => Number(m.toFixed(2)))
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

let httpServer = null;

function startServer(options = {}) {
  const host = options.host || HOST;
  const port = Number(options.port || PORT);

  return new Promise((resolve, reject) => {
    httpServer = app.listen(port, host, () => {
      console.log(`Server running on http://${host}:${port}`);
      resolve(httpServer);
    });

    httpServer.on('error', reject);
  });
}

async function stopServer() {
  if (httpServer) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    httpServer = null;
  }
  await prisma.$disconnect();
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    await stopServer();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await stopServer();
    process.exit(0);
  });
}

module.exports = {
  app,
  startServer,
  stopServer
};
