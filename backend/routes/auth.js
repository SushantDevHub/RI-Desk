import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByUsername, addUser } from '../utils/userStore.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

/**
 * POST /api/auth/register
 * body: { name, username, password }
 * Stores the user (password hashed, never in plain text), then signs
 * a token immediately — registering also logs the person in, so the
 * frontend only needs one click/request to go from nothing to signed in.
 */
router.post('/register', (req, res) => {
  const { name, username, password } = req.body || {};

  if (!name?.trim() || !username?.trim() || !password) {
    return res.status(400).json({ error: 'Name, username, and password are all required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (findUserByUsername(username)) {
    return res.status(409).json({ error: 'A user with that username already exists.' });
  }

  const newUser = {
    name: name.trim(),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
  };
  addUser(newUser);

  const token = jwt.sign(
    { username: newUser.username, name: newUser.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

  res.status(201).json({
    message: 'User registered successfully.',
    token,
    user: { username: newUser.username, name: newUser.name },
  });
});

/**
 * POST /api/auth/login
 * body: { username, password }
 * Compares against the stored record: match -> user found (+ JWT),
 * no match (wrong username OR wrong password) -> user not found.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = findUserByUsername(username);
  const matches = user && bcrypt.compareSync(password, user.passwordHash);

  if (!matches) {
    return res.status(404).json({ error: 'User not found. Check your username and password.' });
  }

  const token = jwt.sign(
    { username: user.username, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

  res.json({
    message: 'User found.',
    token,
    user: { username: user.username, name: user.name },
  });
});

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 * Proves the JWT actually protects something — decodes the token
 * and returns whoever it belongs to.
 */
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
