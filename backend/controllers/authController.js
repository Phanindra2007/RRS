import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export async function register(req, res) {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password are required' });
    }

    const [existing] = await pool.query('SELECT user_id FROM `USER` WHERE email = ? LIMIT 1', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO `USER` (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, phone || null]
    );

    return res.status(201).json({ userId: result.insertId, message: 'Registered successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register', error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT user_id, name, email, password_hash FROM `USER` WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.user_id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    return res.json({ token, user: { userId: user.user_id, name: user.name, email: user.email } });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
}
