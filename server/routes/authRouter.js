const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');
const { register, login, googleLogin, setRole } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleLogin);
// authMiddleware first: setRole reads req.user.id from the decoded token
router.patch('/role', authMiddleware, setRole);

module.exports = router;