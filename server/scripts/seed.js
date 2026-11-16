require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');
const Service = require('../models/Service');
const StaffProfile = require('../models/StaffProfile');
const { DEFAULT_OPERATING_HOURS } = require('../utils/hoursValidator');

const seedData = async () => {
  console.log('Seeding NextUp database...');

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Business.deleteMany({}),
    Service.deleteMany({}),
    StaffProfile.deleteMany({}),
  ]);

  // 1. Create Admin
  const admin = await User.create({
    name: 'Admin Apex',
    email: 'admin@nextup.com',
    password: 'password123',
    role: 'admin',
  });

  // 2. Create Business
  const business = await Business.create({
    name: 'Apex Salon & Spa',
    timezone: 'Asia/Kolkata',
    phone: '+91 98765 43210',
    address: {
      street: '123 High Street, MG Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400001',
    },
    operatingHours: DEFAULT_OPERATING_HOURS,
    ownerId: admin._id,
  });

  // Link admin to business
  admin.businessId = business._id;
  await admin.save();

  // 3. Create 5 Services
  const services = await Service.create([
    {
      name: 'Haircut & Styling',
      description: 'Classic cut and blowdry styling by professionals',
      duration: 45,
      price: 500,
      businessId: business._id,
      isActive: true,
    },
    {
      name: 'Beard Trim & Grooming',
      description: 'Precision beard shaping and hot towel finish',
      duration: 20,
      price: 250,
      businessId: business._id,
      isActive: true,
    },
    {
      name: 'Hair Coloring',
      description: 'Full hair coloring with organic herbal products',
      duration: 90,
      price: 1800,
      businessId: business._id,
      isActive: true,
    },
    {
      name: 'Deep Cleansing Facial',
      description: 'Rejuvenating skin care with exfoliation and mask',
      duration: 60,
      price: 1200,
      businessId: business._id,
      isActive: true,
    },
    {
      name: 'Head & Shoulder Massage',
      description: 'Stress-relieving acupressure oil massage',
      duration: 30,
      price: 700,
      businessId: business._id,
      isActive: true,
    },
  ]);

  // 4. Create 3 Staff Users & StaffProfiles
  const staffConfigs = [
    {
      name: 'Rahul Sharma',
      email: 'rahul@nextup.com',
      serviceIndices: [0, 1], // Haircut, Beard Trim
    },
    {
      name: 'Priya Patel',
      email: 'priya@nextup.com',
      serviceIndices: [0, 2, 3], // Haircut, Hair Coloring, Facial
    },
    {
      name: 'Amit Verma',
      email: 'amit@nextup.com',
      serviceIndices: [3, 4], // Facial, Massage
    },
  ];

  const staffProfiles = [];
  for (const cfg of staffConfigs) {
    const staffUser = await User.create({
      name: cfg.name,
      email: cfg.email,
      password: 'password123',
      role: 'staff',
      businessId: business._id,
    });

    const assignedServiceIds = cfg.serviceIndices.map((idx) => services[idx]._id);

    const profile = await StaffProfile.create({
      userId: staffUser._id,
      businessId: business._id,
      serviceIds: assignedServiceIds,
      isActive: true,
    });

    staffProfiles.push(profile);
  }

  // 5. Create 1 Customer User
  const customer = await User.create({
    name: 'Deep Boghara',
    email: 'customer@nextup.com',
    password: 'password123',
    role: 'customer',
  });

  console.log('Database seeded successfully:');
  console.log(`- 1 Admin: admin@nextup.com / password123`);
  console.log(`- 1 Business: ${business.name}`);
  console.log(`- 5 Services created`);
  console.log(`- 3 Staff members created with service assignments`);
  console.log(`- 1 Customer: customer@nextup.com / password123`);

  return { admin, business, services, staffProfiles, customer };
};

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nextup';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      await seedData();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = seedData;
