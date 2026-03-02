const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = process.env.PORT || 3009;
const HOST = process.env.HOST || '0.0.0.0';
const prisma = new PrismaClient();
const SESSION_COOKIE = 'gcontrol_session';
const sessions = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
    const { duration_seconds } = req.body;
    const result = await prisma.bathroomLog.create({
      data: { durationSeconds: duration_seconds }
    });
    res.json({ id: result.id, duration_seconds: result.durationSeconds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/food', async (req, res) => {
  try {
    const { food_type, estimated_price } = req.body;
    const result = await prisma.foodLog.create({
      data: { 
        foodType: food_type, 
        estimatedPrice: estimated_price 
      }
    });
    res.json({ 
      id: result.id, 
      food_type: result.foodType, 
      estimated_price: result.estimatedPrice 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/bathroom/:id', async (req, res) => {
  try {
    await prisma.bathroomLog.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/food/:id', async (req, res) => {
  try {
    await prisma.foodLog.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/daily', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bathroom = await prisma.bathroomLog.aggregate({
      where: { timestamp: { gte: today } },
      _count: { id: true },
      _sum: { durationSeconds: true }
    });

    const food = await prisma.foodLog.aggregate({
      where: { timestamp: { gte: today } },
      _count: { id: true },
      _sum: { estimatedPrice: true }
    });

    res.json({
      bathroom: {
        bathroom_count: bathroom._count.id,
        bathroom_total_time: bathroom._sum.durationSeconds || 0
      },
      food: {
        food_count: food._count.id,
        food_total_price: food._sum.estimatedPrice || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/weekly', async (req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const bathroom = await prisma.bathroomLog.aggregate({
      where: { timestamp: { gte: weekAgo } },
      _count: { id: true },
      _sum: { durationSeconds: true }
    });

    const food = await prisma.foodLog.aggregate({
      where: { timestamp: { gte: weekAgo } },
      _count: { id: true },
      _sum: { estimatedPrice: true }
    });

    res.json({
      bathroom: {
        bathroom_count: bathroom._count.id,
        bathroom_total_time: bathroom._sum.durationSeconds || 0
      },
      food: {
        food_count: food._count.id,
        food_total_price: food._sum.estimatedPrice || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/monthly', async (req, res) => {
  try {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const bathroom = await prisma.bathroomLog.aggregate({
      where: { timestamp: { gte: monthAgo } },
      _count: { id: true },
      _sum: { durationSeconds: true }
    });

    const food = await prisma.foodLog.aggregate({
      where: { timestamp: { gte: monthAgo } },
      _count: { id: true },
      _sum: { estimatedPrice: true }
    });

    res.json({
      bathroom: {
        bathroom_count: bathroom._count.id,
        bathroom_total_time: bathroom._sum.durationSeconds || 0
      },
      food: {
        food_count: food._count.id,
        food_total_price: food._sum.estimatedPrice || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chart/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const days = period === 'daily' ? 7 : period === 'weekly' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const bathroomLogs = await prisma.bathroomLog.findMany({
      where: { timestamp: { gte: startDate } },
      orderBy: { timestamp: 'asc' }
    });

    const foodLogs = await prisma.foodLog.findMany({
      where: { timestamp: { gte: startDate } },
      orderBy: { timestamp: 'asc' }
    });

    const bathroomByDay = {};
    const foodByDay = {};
    const expenseByDay = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      bathroomByDay[key] = 0;
      foodByDay[key] = 0;
      expenseByDay[key] = 0;
    }

    bathroomLogs.forEach(log => {
      const key = log.timestamp.toISOString().split('T')[0];
      if (bathroomByDay[key] !== undefined) {
        bathroomByDay[key]++;
      }
    });

    foodLogs.forEach(log => {
      const key = log.timestamp.toISOString().split('T')[0];
      if (foodByDay[key] !== undefined) {
        foodByDay[key]++;
        expenseByDay[key] += log.estimatedPrice;
      }
    });

    const labels = Object.keys(bathroomByDay).map(date => {
      const d = new Date(date);
      return period === 'monthly' ? (d.getMonth() + 1) : 
        ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
    });

    res.json({
      bathroomChart: Object.values(bathroomByDay),
      foodChart: Object.values(foodByDay),
      expenseChart: Object.values(expenseByDay),
      labels
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, HOST, async () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
