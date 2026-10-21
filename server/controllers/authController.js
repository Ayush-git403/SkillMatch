const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, Role } = require('../models');

const googleClient = new OAuth2Client();

// Same token/response shape as register and login, so the frontend treats
// every sign-in method identically. roleName is null for a brand-new Google
// user who hasn't picked a role yet; roleMiddleware rejects a null role on
// every protected route, so that token can only reach /auth/role.
const issueSession = (user, roleName) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: roleName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: roleName }
  };
};

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

    // Google-only accounts have no password to compare against.
    if (!user.password_hash) {
      return res.status(400).json({
        message: 'This account uses Google sign-in. Please continue with Google.'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.Role ? user.Role.role_name : null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email, role: user.Role ? user.Role.role_name : null }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// GOOGLE LOGIN
// The frontend sends the ID token (a signed JWT from Google). We verify the
// signature and that it was issued for OUR client id, then find, link, or
// create the user.
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is not set on the server');
      return res.status(500).json({ message: 'Google sign-in is not configured' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      // An audience mismatch (wrong client id) shows up here too.
      console.error('Google token verification failed:', verifyErr.message);
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    if (!payload.email || !payload.email_verified) {
      return res.status(401).json({ message: 'Your Google email is not verified' });
    }

    const googleId = payload.sub;
    const email = payload.email;

    // 1. Returning Google user
    let user = await User.findOne({ where: { google_id: googleId }, include: Role });

    if (!user) {
      // 2. Existing email/password account with the same email: link it
      user = await User.findOne({ where: { email }, include: Role });
      if (user) {
        await user.update({ google_id: googleId });
      } else {
        // 3. Brand-new user. No role yet; they pick one on the next screen.
        user = await User.create({
          name: payload.name || email.split('@')[0],
          email,
          google_id: googleId,
          password_hash: null,
          role_id: null
        });
      }
    }

    const roleName = user.Role ? user.Role.role_name : null;
    res.json(issueSession(user, roleName));

  } catch (err) {
    console.error('GOOGLE LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// SET ROLE (one-time, for users who signed up through Google)
const setRole = async (req, res) => {
  try {
    const { role_name } = req.body;

    // Only these two are selectable here, so 'admin' can never come from this flow.
    if (!['applicant', 'employer'].includes(role_name)) {
      return res.status(400).json({ message: 'Role must be applicant or employer' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ where: { role_name } });
    if (!role) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Conditional update: only succeeds while role_id is still null, and does
    // the check and the write in one statement, so two simultaneous requests
    // can't both win.
    const [updatedCount] = await User.update(
      { role_id: role.id },
      { where: { id: user.id, role_id: null } }
    );
    if (updatedCount === 0) {
      return res.status(403).json({ message: 'Role has already been set' });
    }

    res.json(issueSession(user, role.role_name));

  } catch (err) {
    console.error('SET ROLE ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { register, login, googleLogin, setRole };