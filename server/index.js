const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const { sequelize } = require('./models');
const { startScoreQueue } = require('./services/scoreQueue');

const allowedOrigins = [
  'http://localhost:3000',
  'http://skillmatch-frontend-ayushman.s3-website.ap-south-1.amazonaws.com',
  'https://skill-match-ebon.vercel.app',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// Routes
const authRouter = require('./routes/authRouter');
app.use('/api/auth', authRouter);

const jobRouter = require('./routes/jobRouter');
app.use('/api/jobs', jobRouter);

const applicationRouter = require('./routes/applicationRouter');
app.use('/api/applications', applicationRouter);

// Diagnostic endpoint
app.get('/api/debug/routes', (req, res) => {
  res.json({
    message: 'Current SkillMatch backend is running',
    googleRouteExpected: '/api/auth/google',
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Job Board API Running' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.sync();
    console.log('Database synced');

    startScoreQueue();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

startServer();
