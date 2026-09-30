import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const SECRET  = process.env.JWT_SECRET  || 'CHANGE_ME_dev_secret';
const EXPIRES = process.env.JWT_EXPIRES || '12h';

// Vérifie les identifiants et renvoie { token, user } ou null.
export function login(username, password) {
  if (!username || !password) return null;
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return null;
  const payload = { sub: u.username, role: u.role, name: u.name };
  const token = jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
  return { token, user: { username: u.username, role: u.role, name: u.name } };
}

// Exige un jeton valide ; peuple req.user = { sub, role, name }.
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Jeton invalide ou expiré' });
  }
}

// Exige un rôle parmi ceux fournis (admin est toujours autorisé).
export function requireRole(...roles) {
  return (req, res, next) =>
    (req.user && (roles.includes(req.user.role) || req.user.role === 'admin'))
      ? next()
      : res.status(403).json({ error: `Réservé aux rôles : ${roles.join(', ')}` });
}
