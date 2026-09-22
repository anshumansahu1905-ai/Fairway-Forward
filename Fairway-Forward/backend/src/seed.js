import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { User, Charity, Draw, Subscription, Score } from './models.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding.');
await mongoose.connect(process.env.MONGODB_URI);
const charities = await Charity.insertMany([
  { name: 'Hope Foundation', slug: 'hope-foundation', description: 'Building safer futures for young people.', category: 'Youth', featured: true },
  { name: 'Water Begins', slug: 'water-begins', description: 'Bringing clean water to every community.', category: 'Climate', featured: true },
  { name: 'Open Minds', slug: 'open-minds', description: 'Making mental health support accessible.', category: 'Wellbeing', featured: true }
].map(item => ({ ...item })), { ordered: false }).catch(() => Charity.find());
const firstCharity = charities[0] || await Charity.findOne();
const admin = await User.findOneAndUpdate({ email: 'admin@fairwayforward.com' }, { name: 'Fairway Admin', email: 'admin@fairwayforward.com', password: await bcrypt.hash('ChangeMe123!', 12), role: 'admin', selectedCharity: firstCharity._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
const renewalDate = new Date(); renewalDate.setFullYear(renewalDate.getFullYear() + 1);
await Subscription.findOneAndUpdate({ user: admin._id }, { plan: 'yearly', status: 'active', amount: 96, renewalDate, provider: 'manual' }, { upsert: true });
await Draw.findOneAndUpdate({ month: '2026-09' }, { month: '2026-09', type: 'random', status: 'scheduled', poolAmount: 8640 }, { upsert: true });
const member = await User.findOneAndUpdate({ email: 'member@fairwayforward.com' }, { name: 'Avery', email: 'member@fairwayforward.com', password: await bcrypt.hash('playforward', 12), role: 'member', selectedCharity: firstCharity._id, contributionPercent: 10 }, { upsert: true, new: true, setDefaultsOnInsert: true });
await Subscription.findOneAndUpdate({ user: member._id }, { plan: 'monthly', status: 'active', amount: 10, renewalDate: new Date('2026-10-12'), provider: 'manual' }, { upsert: true });
for (const [score, playedOn] of [[34, '2026-09-14'], [31, '2026-09-08'], [36, '2026-08-30'], [29, '2026-08-22'], [31, '2026-08-13']]) await Score.findOneAndUpdate({ user: member._id, playedOn: new Date(`${playedOn}T12:00:00.000Z`) }, { user: member._id, score, playedOn: new Date(`${playedOn}T12:00:00.000Z`) }, { upsert: true, setDefaultsOnInsert: true });
console.log('Seed complete. Demo: member@fairwayforward.com / playforward');
await mongoose.disconnect();
