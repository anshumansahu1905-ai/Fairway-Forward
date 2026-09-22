import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import Stripe from 'stripe';
import dns from 'node:dns';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { User, Subscription, Score, Charity, Draw, Winner } from './models.js';
import { asyncHandler, authenticate, requireRole, requireActiveSubscription, errorHandler } from './middleware.js';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, '../.env') });
dotenv.config({ path: path.join(root, '.env') });
const backendRoot = path.join(root, '..');
const frontendRoot = path.join(root, '../../frontend');
dns.setServers(['1.1.1.1', '8.8.8.8']);

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('MONGODB_URI and JWT_SECRET must be set. Copy .env.example to .env.');
const app = express();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const upload = multer({ dest: path.join(backendRoot, 'uploads'), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype)) });
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ message: 'Stripe is not configured.' });
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).json({ message: 'Invalid Stripe webhook signature.' }); }
  const stripeSubscription = event.data.object;
  const updateSubscription = async (subscription, userId) => {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = priceId === process.env.STRIPE_YEARLY_PRICE_ID ? 'yearly' : 'monthly';
    const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status === 'canceled' ? 'cancelled' : 'lapsed';
    await Subscription.findOneAndUpdate(userId ? { user: userId } : { stripeSubscriptionId: subscription.id }, { plan, status, amount: plan === 'yearly' ? 96 : 10, renewalDate: new Date(subscription.current_period_end * 1000), provider: 'stripe', stripeCustomerId: subscription.customer, stripeSubscriptionId: subscription.id }, { new: true, upsert: Boolean(userId) });
  };
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription' && session.subscription) await updateSubscription(await stripe.subscriptions.retrieve(session.subscription), session.client_reference_id);
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') await updateSubscription(stripeSubscription);
  res.json({ received: true });
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(backendRoot, 'uploads')));
app.use(express.static(frontendRoot));

const tokenFor = user => jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role, selectedCharity: user.selectedCharity, contributionPercent: user.contributionPercent });
const dateFromValue = value => { const date = new Date(`${value}T12:00:00.000Z`); if (Number.isNaN(date.valueOf())) throw Object.assign(new Error('A valid date is required.'), { status: 400 }); return date; };

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { name, email, password, plan = 'monthly', charityId, contributionPercent = 10 } = req.body;
  if (!stripe) return res.status(503).json({ message: 'Payments are not configured. Add the Stripe settings to backend/.env.' });
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ message: 'Name, email and an 8-character password are required.' });
  if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ message: 'Choose a monthly or yearly plan.' });
  if (contributionPercent < 10 || contributionPercent > 50) return res.status(400).json({ message: 'Contribution must be between 10% and 50%.' });
  if (charityId && !await Charity.exists({ _id: charityId, active: true })) return res.status(400).json({ message: 'Choose an active charity.' });
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), selectedCharity: charityId, contributionPercent });
  const renewalDate = new Date(); renewalDate.setMonth(renewalDate.getMonth() + (plan === 'yearly' ? 12 : 1));
  await Subscription.create({ user: user._id, plan, amount: plan === 'yearly' ? 96 : 10, renewalDate, status: 'pending', provider: 'stripe' });
  res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}));
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+password');
  if (!user || !await bcrypt.compare(req.body.password || '', user.password)) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ token: tokenFor(user), user: publicUser(user) });
}));
app.post('/api/billing/checkout', authenticate, asyncHandler(async (req, res) => {
  if (!stripe) return res.status(503).json({ message: 'Stripe is not configured. Add STRIPE_SECRET_KEY and Stripe price IDs to backend/.env.' });
  const { plan } = req.body;
  const price = plan === 'yearly' ? process.env.STRIPE_YEARLY_PRICE_ID : plan === 'monthly' ? process.env.STRIPE_MONTHLY_PRICE_ID : null;
  if (!price) return res.status(400).json({ message: 'A valid membership plan is required.' });
  const session = await stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price, quantity: 1 }], customer_email: req.user.email, client_reference_id: String(req.user._id), success_url: `${process.env.CLIENT_URL || 'http://localhost:5000'}/dashboard.html?payment=success`, cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5000'}/index.html?payment=cancelled` });
  res.json({ url: session.url });
}));

app.get('/api/charities', asyncHandler(async (req, res) => res.json(await Charity.find({ active: true }).sort({ featured: -1, name: 1 }))));
app.get('/api/dashboard', authenticate, asyncHandler(async (req, res) => {
  const [subscription, scores, winners, nextDraw] = await Promise.all([
    Subscription.findOne({ user: req.user._id }), Score.find({ user: req.user._id }).sort({ playedOn: -1 }).limit(5),
    Winner.find({ user: req.user._id }).populate('draw', 'month').sort({ createdAt: -1 }), Draw.findOne({ status: 'scheduled' }).sort({ month: 1 })
  ]);
  const totalWon = winners.reduce((sum, winner) => sum + (winner.payoutStatus === 'paid' ? winner.prizeAmount : 0), 0);
  res.json({ user: publicUser(req.user), subscription, scores, totalWon, winners, nextDraw });
}));

app.route('/api/scores').get(authenticate, requireActiveSubscription, asyncHandler(async (req, res) => res.json(await Score.find({ user: req.user._id }).sort({ playedOn: -1 }).limit(5))))
  .post(authenticate, requireActiveSubscription, asyncHandler(async (req, res) => {
    const score = Number(req.body.score); if (!Number.isInteger(score) || score < 1 || score > 45) return res.status(400).json({ message: 'Stableford score must be a whole number from 1 to 45.' });
    const playedOn = dateFromValue(req.body.playedOn); const start = new Date(playedOn); const end = new Date(playedOn); end.setUTCDate(end.getUTCDate() + 1);
    if (await Score.exists({ user: req.user._id, playedOn: { $gte: start, $lt: end } })) return res.status(409).json({ message: 'Only one score can be entered for a date.' });
    const newScore = await Score.create({ user: req.user._id, score, playedOn });
    const allScores = await Score.find({ user: req.user._id }).sort({ playedOn: -1 });
    if (allScores.length > 5) await Score.deleteMany({ _id: { $in: allScores.slice(5).map(item => item._id) } });
    res.status(201).json(newScore);
  }));
app.delete('/api/scores/:id', authenticate, requireActiveSubscription, asyncHandler(async (req, res) => { const deleted = await Score.findOneAndDelete({ _id: req.params.id, user: req.user._id }); if (!deleted) return res.status(404).json({ message: 'Score not found.' }); res.status(204).end(); }));

app.patch('/api/me/charity', authenticate, asyncHandler(async (req, res) => { const { charityId, contributionPercent } = req.body; if (!await Charity.exists({ _id: charityId, active: true })) return res.status(400).json({ message: 'Choose an active charity.' }); if (contributionPercent < 10 || contributionPercent > 50) return res.status(400).json({ message: 'Contribution must be between 10% and 50%.' }); req.user.selectedCharity = charityId; req.user.contributionPercent = contributionPercent; await req.user.save(); res.json(publicUser(req.user)); }));

app.get('/api/draws', authenticate, requireActiveSubscription, asyncHandler(async (req, res) => res.json(await Draw.find().sort({ month: -1 }))));
app.get('/api/draws/:id/entry', authenticate, requireActiveSubscription, asyncHandler(async (req, res) => { const draw = await Draw.findById(req.params.id); if (!draw) return res.status(404).json({ message: 'Draw not found.' }); const scores = await Score.find({ user: req.user._id }).sort({ playedOn: -1 }).limit(5); res.json({ draw, numbers: scores.map(score => score.score) }); }));

app.post('/api/admin/draws/:id/publish', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const draw = await Draw.findById(req.params.id); if (!draw || draw.status === 'published') return res.status(400).json({ message: 'Draw is not available to publish.' });
  const numbers = req.body.winningNumbers?.map(Number) || Array.from({ length: 5 }, () => Math.floor(Math.random() * 45) + 1); if (numbers.length !== 5 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 45)) return res.status(400).json({ message: 'Provide five numbers between 1 and 45.' });
  draw.winningNumbers = numbers; draw.status = 'published'; draw.publishedAt = new Date(); await draw.save();
  const subscriptions = await Subscription.find({ status: 'active', renewalDate: { $gt: new Date() } }); const tiers = { 5: .4, 4: .35, 3: .25 }; const matchesByTier = { 3: [], 4: [], 5: [] };
  for (const sub of subscriptions) { const scores = await Score.find({ user: sub.user }).sort({ playedOn: -1 }).limit(5); const matches = scores.filter(item => numbers.includes(item.score)).length; if (matches >= 3) matchesByTier[matches].push(sub.user); }
  for (const tier of [3, 4, 5]) { const people = matchesByTier[tier]; if (people.length) await Winner.insertMany(people.map(user => ({ draw: draw._id, user, tier, prizeAmount: Number((draw.poolAmount * tiers[tier] / people.length).toFixed(2)) }))); else if (tier === 5) { draw.jackpotCarryover += draw.poolAmount * tiers[tier]; await draw.save(); } }
  res.json({ draw, winners: Object.fromEntries(Object.entries(matchesByTier).map(([tier, people]) => [tier, people.length])) });
}));
app.get('/api/admin/winners', authenticate, requireRole('admin'), asyncHandler(async (req, res) => res.json(await Winner.find().populate('user', 'name email').populate('draw', 'month').sort({ createdAt: -1 }))));
app.post('/api/winners/:id/proof', authenticate, upload.single('proof'), asyncHandler(async (req, res) => { const winner = await Winner.findOne({ _id: req.params.id, user: req.user._id }); if (!winner) return res.status(404).json({ message: 'Winner record not found.' }); if (!req.file) return res.status(400).json({ message: 'Upload a PNG, JPG or WEBP screenshot under 5MB.' }); winner.proofUrl = `/uploads/${req.file.filename}`; winner.verificationStatus = 'pending'; await winner.save(); res.json(winner); }));
app.patch('/api/admin/winners/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => { const { verificationStatus, payoutStatus } = req.body; const winner = await Winner.findById(req.params.id); if (!winner) return res.status(404).json({ message: 'Winner not found.' }); if (verificationStatus) winner.verificationStatus = verificationStatus; if (payoutStatus) winner.payoutStatus = payoutStatus; await winner.save(); res.json(winner); }));
app.get('*', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(frontendRoot, 'index.html')));
app.use(errorHandler);
mongoose.connect(process.env.MONGODB_URI).then(() => app.listen(process.env.PORT || 5000, () => console.log(`API listening on port http://localhost:${process.env.PORT || 5000}`))).catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
