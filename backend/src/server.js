const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const appraisalRoutes = require('./routes/appraisalRoutes');
const performanceAppraisalRoutes = require('./routes/performanceAppraisalRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const messageRoutes = require('./routes/messageRoutes');
const teamRoutes = require('./routes/teamRoutes');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

app.use(helmet());

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (corsOrigins.includes('*')) return cb(null, true);
        if (corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(morgan('combined'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased for development
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth/login', authLimiter);

app.get('/', (req, res) => {
    res.json({ 
        message: 'Winas Sacco HRMS API',
        version: '1.0.0',
        status: 'running'
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/appraisals', appraisalRoutes);
app.use('/api/performance-appraisals', performanceAppraisalRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/team', teamRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ 
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   Winas Sacco HRMS API Server              ║
║   Environment: ${process.env.NODE_ENV?.toUpperCase().padEnd(28)} ║
║   Port: ${PORT.toString().padEnd(35)} ║
║   Status: RUNNING                          ║
╚════════════════════════════════════════════╝
    `);
});

module.exports = app;
