const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

// REGISTER
const register = async (req, res) => {
  try {
    const { name, email, password, role_name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Find role
    const role = await Role.findOne({ where: { role_name } });
    if (!role) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({ name, email, password_hash, role_id: role.id });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: role.role_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, name, email, role: role.role_name } });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email }, include: Role });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.Role.role_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email, role: user.Role.role_name } });

  } catch (err) {
  console.error("LOGIN ERROR:", err);
  res.status(500).json({
    message: 'Server error',
    error: err.message
  });
}
};

module.exports = { register, login };