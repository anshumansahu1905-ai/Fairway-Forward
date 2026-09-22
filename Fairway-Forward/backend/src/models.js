import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['member', 'admin'], default: 'member' },
  selectedCharity: { type: Schema.Types.ObjectId, ref: 'Charity' },
  contributionPercent: { type: Number, min: 10, max: 50, default: 10 }
}, { timestamps: true });

const subscriptionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  plan: { type: String, enum: ['monthly', 'yearly'], required: true },
  status: { type: String, enum: ['pending', 'active', 'cancelled', 'lapsed'], default: 'pending' },
  amount: { type: Number, required: true },
  renewalDate: { type: Date, required: true },
  provider: { type: String, enum: ['stripe', 'manual'], default: 'manual' },
  stripeCustomerId: String,
  stripeSubscriptionId: String
}, { timestamps: true });

const scoreSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  score: { type: Number, required: true, min: 1, max: 45 },
  playedOn: { type: Date, required: true }
}, { timestamps: true });
scoreSchema.index({ user: 1, playedOn: 1 }, { unique: true });

const charitySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  imageUrl: String,
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const drawSchema = new Schema({
  month: { type: String, required: true, unique: true },
  type: { type: String, enum: ['random', 'algorithmic'], default: 'random' },
  status: { type: String, enum: ['scheduled', 'published'], default: 'scheduled' },
  poolAmount: { type: Number, required: true },
  jackpotCarryover: { type: Number, default: 0 },
  winningNumbers: [{ type: Number, min: 1, max: 45 }],
  publishedAt: Date
}, { timestamps: true });

const winnerSchema = new Schema({
  draw: { type: Schema.Types.ObjectId, ref: 'Draw', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tier: { type: Number, enum: [3, 4, 5], required: true },
  prizeAmount: { type: Number, required: true },
  proofUrl: String,
  verificationStatus: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'pending' },
  payoutStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' }
}, { timestamps: true });

export const User = model('User', userSchema);
export const Subscription = model('Subscription', subscriptionSchema);
export const Score = model('Score', scoreSchema);
export const Charity = model('Charity', charitySchema);
export const Draw = model('Draw', drawSchema);
export const Winner = model('Winner', winnerSchema);
