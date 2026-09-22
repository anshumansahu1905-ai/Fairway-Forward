import jwt from 'jsonwebtoken';
import { User, Subscription } from './models.js';

export const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7);
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ message: 'Account no longer exists.' });
    next();
  } catch { return res.status(401).json({ message: 'Invalid or expired token.' }); }
}

export function requireRole(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Insufficient permissions.' }); }

export const requireActiveSubscription = asyncHandler(async (req, res, next) => {
  const subscription = await Subscription.findOne({ user: req.user._id, status: 'active', renewalDate: { $gt: new Date() } });
  if (!subscription) return res.status(403).json({ message: 'An active subscription is required.' });
  req.subscription = subscription;
  next();
});

export function errorHandler(error, req, res, next) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.code === 11000) return res.status(409).json({ message: 'A record already exists with that value.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
}
