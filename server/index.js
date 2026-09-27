const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Allow both local dev and the deployed frontend to call this API.
// Add more origins here later if you add a custom domain or CloudFront URL.
const allowedOrigins = [
  'http://localhost:3000',
  'http://skillmatch-frontend-ayushman.s3-website.ap-south-1.amazonaws.com',
];

app.use(cors({
  origin: function (origin, callback) {
    // requests with no origin (like curl, Postman, or server-to-server) are allowed
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

app.get('/', (req, res) => res.json({ message: 'Job Board API Running' }));

const { sequelize } = require('./models');

sequelize.sync({ alter: true })
  .then(() => console.log('Database synced'))
  .catch(err => console.error('DB sync error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));