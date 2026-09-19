require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Maintenance = require('../models/Maintenance');
const Notification = require('../models/Notification');
const { makeBookingCode } = require('./bookingHelper');

async function seed() {
  await connectDB();
  await Promise.all([User.deleteMany({}), Venue.deleteMany({}), Booking.deleteMany({}), Maintenance.deleteMany({}), Notification.deleteMany({})]);
  const admin = await User.create({ name: 'Event Admin', email: 'admin@evently.demo', password: 'Admin@123', role: 'admin' });
  const organiser = await User.create({ name: 'Demo Organiser', email: 'organiser@evently.demo', password: 'Organiser@123', role: 'organiser' });
  const venues = await Venue.insertMany([
    { name:'Aurora Auditorium', description:'A grand auditorium for flagship talks, ceremonies and large gatherings.', location:'Central Campus • Main Block', floor:'Ground Floor', roomNumber:'A-001', capacity:800, hourlyRate:2200, facilities:['AC','Projector','Wi-Fi','Stage','Sound System','Microphones','Parking'], images:['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80'] },
    { name:'Nova Convention Hall', description:'Flexible hall with modular seating and a polished stage setup.', location:'Innovation Block', floor:'1st Floor', roomNumber:'I-104', capacity:500, hourlyRate:1800, facilities:['AC','Projector','Wi-Fi','Stage','Sound System','Tables','Lighting'], images:['https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1200&q=80'] },
    { name:'Orbit Seminar Studio', description:'Bright seminar space for workshops, clubs and interactive sessions.', location:'Learning Commons', floor:'2nd Floor', roomNumber:'LC-207', capacity:180, hourlyRate:900, facilities:['AC','Projector','Wi-Fi','Smart Board','Tables','Chairs'], images:['https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80'] },
    { name:'Pulse Open-Air Lawn', description:'An atmospheric outdoor venue for festivals, socials and evening events.', location:'North Quadrangle', floor:'Outdoor', roomNumber:'L-01', capacity:1000, hourlyRate:1400, facilities:['Wi-Fi','Parking','Lighting','Sound System','Stage'], images:['https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1200&q=80'] },
    { name:'Pixel Innovation Lab', description:'Tech-ready lab with smart boards and collaborative tables.', location:'Tech Park', floor:'3rd Floor', roomNumber:'TP-312', capacity:120, hourlyRate:1100, facilities:['AC','Wi-Fi','Smart Board','Projector','Tables','Chairs'], images:['https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80'] },
    { name:'Velvet Community Room', description:'Intimate room for meetings, rehearsals and community gatherings.', location:'Community Centre', floor:'Ground Floor', roomNumber:'CC-03', capacity:80, hourlyRate:650, facilities:['AC','Wi-Fi','Tables','Chairs','Projector'], images:['https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80'] }
  ]);
  const d = (s) => new Date(`${s}T00:00:00`);
  await Booking.create({ bookingCode: makeBookingCode(), organiser, venue: venues[0]._id, eventName:'Campus Founders Night', eventType:'Conference', description:'A flagship founder and alumni evening.', attendees:550, date:d('2026-09-25'), startTime:'18:00', endTime:'21:00', durationHours:3, hourlyRate:2200, totalAmount:6600, facilitiesRequested:['AC','Stage','Sound System'], status:'approved' });
  await Booking.create({ bookingCode: makeBookingCode(), organiser, venue: venues[1]._id, eventName:'Design Sprint', eventType:'Workshop', description:'A collaborative product design sprint.', attendees:220, date:d('2026-09-27'), startTime:'10:00', endTime:'14:00', durationHours:4, hourlyRate:1800, totalAmount:7200, facilitiesRequested:['Projector','Wi-Fi'], status:'pending' });
  await Maintenance.create({ venue: venues[0]._id, date:d('2026-09-24'), startTime:'09:00', endTime:'17:00', reason:'HVAC preventive maintenance', createdBy:admin._id });
  await Notification.create({ user:organiser._id, message:'Welcome to Evently. Your dashboard is ready.', type:'success' });
  console.log('\nSeed complete.');
  console.log('Admin: admin@evently.demo / Admin@123');
  console.log('Organiser: organiser@evently.demo / Organiser@123\n');
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
