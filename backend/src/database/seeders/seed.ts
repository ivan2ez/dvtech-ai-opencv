import 'reflect-metadata';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import sequelize from '../connection';
import {
  User,
  AirconProduct,
  ProductImage,
  Brand,
  ServiceType,
  BtuFactor,
  ServiceRequest,
  RoomAssessment,
  AiRecommendation,
  TechnicianDetail,
  TechnicianSchedule,
  Report,
} from '../../models';

// Explicitly load environment variables
dotenv.config();

async function seed() {
  try {
    // Safety guard: this seeder drops and recreates every table. Never allow it
    // to run against a production database.
    if (process.env.NODE_ENV === 'production') {
      console.error('Refusing to run the seeder with NODE_ENV=production (it drops all tables).');
      process.exit(1);
    }

    // Sync all models (force: true drops and recreates tables)
    await sequelize.sync({ force: true });
    console.log('Database synced (tables recreated).');

    // ─── 1. USERS ───────────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('Password123', 10);

    const users = await User.bulkCreate([
      { name: 'Admin User', email: 'admin@dvtech.com', password: hashedPassword, role: 'admin', isActive: true },
      { name: 'Juan Dela Cruz', email: 'juan@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Pedro Santos', email: 'pedro@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Maria Garcia', email: 'maria@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Carlos Reyes', email: 'carlos@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Ana Mendoza', email: 'ana@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Customer One', email: 'customer1@email.com', password: hashedPassword, role: 'customer', isActive: true, contactNumber: '09171110001', street: '12 Rizal St.', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila' },
      { name: 'Customer Two', email: 'customer2@email.com', password: hashedPassword, role: 'customer', isActive: true, contactNumber: '09171110002', street: '88 Mabini Ave.', barangay: 'San Antonio', city: 'Pasig', province: 'Metro Manila' },
      { name: 'Customer Three', email: 'customer3@email.com', password: hashedPassword, role: 'customer', isActive: true, contactNumber: '09171110003', street: '5 Bonifacio Rd.', barangay: 'Alabang', city: 'Muntinlupa', province: 'Metro Manila' },
      { name: 'Customer Four', email: 'customer4@email.com', password: hashedPassword, role: 'customer', isActive: true, contactNumber: '09171110004', street: '210 Aguinaldo Hwy', barangay: 'Salawag', city: 'Dasmariñas', province: 'Cavite' },
    ]);
    console.log(`Seeded ${users.length} users.`);

    // ─── 2. SERVICE TYPES ───────────────────────────────────────────────────────
    const serviceTypes = await ServiceType.bulkCreate([
      { name: 'Installation', description: 'New air conditioning unit installation including mounting, piping, and electrical connections.', price: 5000.00, isActive: true },
      { name: 'Preventive Maintenance', description: 'Routine cleaning and inspection to keep units running efficiently.', price: 1500.00, isActive: true },
      { name: 'Repair', description: 'Diagnosis and repair of malfunctioning air conditioning units.', price: 3000.00, isActive: true },
      { name: 'General Cleaning', description: 'Deep cleaning of filters, coils, and drainage system.', price: 800.00, isActive: true },
      { name: 'Freon Recharge', description: 'Refrigerant top-up and leak inspection.', price: 2500.00, isActive: true },
      { name: 'Relocation', description: 'Moving and reinstalling existing AC unit to a new location.', price: 4000.00, isActive: true },
      { name: 'Duct Cleaning', description: 'Thorough cleaning of ductwork for centralized AC systems.', price: 3500.00, isActive: true },
      { name: 'Thermostat Replacement', description: 'Replacing faulty thermostats with new digital or smart models.', price: 2000.00, isActive: true },
      { name: 'Compressor Repair', description: 'Specialized repair or replacement of compressor units.', price: 6000.00, isActive: true },
      { name: 'Consultation', description: 'On-site assessment and recommendation for AC requirements.', price: 500.00, isActive: true },
    ]);
    console.log(`Seeded ${serviceTypes.length} service types.`);

    // ─── 3. AIRCON PRODUCTS ─────────────────────────────────────────────────────
    // First, seed brands
    const brands = await Brand.bulkCreate([
      { name: 'Carrier', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Carrier', isActive: true },
      { name: 'Panasonic', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Panasonic', isActive: true },
      { name: 'Samsung', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Samsung', isActive: true },
      { name: 'LG', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=LG', isActive: true },
      { name: 'Daikin', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Daikin', isActive: true },
      { name: 'Condura', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Condura', isActive: true },
      { name: 'Kolin', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Kolin', isActive: true },
      { name: 'Sharp', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Sharp', isActive: true },
      { name: 'Midea', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=Midea', isActive: true },
      { name: 'TCL', logoUrl: 'https://placehold.co/100x100/e2e8f0/475569?text=TCL', isActive: true },
    ]);
    console.log(`Seeded ${brands.length} brands.`);

    const products = await AirconProduct.bulkCreate([
      { brand: 'Carrier', model: 'Crystal 2 Inverter', type: 'window-type', horsepower: 1.0, btuCapacity: 9000, price: 22990.00, description: 'Energy-efficient window-type inverter AC with R32 refrigerant.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Carrier+Crystal+2', isActive: true },
      { brand: 'Carrier', model: 'Alpha Inverter', type: 'split-type', horsepower: 1.5, btuCapacity: 12000, price: 36990.00, description: 'Premium split-type inverter for medium-sized rooms.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Carrier+Alpha', isActive: true },
      { brand: 'Panasonic', model: 'CS-S10VKQ', type: 'split-type', horsepower: 1.0, btuCapacity: 9500, price: 28990.00, description: 'Nanoe-X split-type with air purification technology.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Panasonic+CS-S10VKQ', isActive: true },
      { brand: 'Panasonic', model: 'CS-S18VKQ', type: 'split-type', horsepower: 2.0, btuCapacity: 18000, price: 48990.00, description: 'High-capacity split-type for large rooms and offices.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Panasonic+CS-S18VKQ', isActive: true },
      { brand: 'Samsung', model: 'Wind-Free AR9500T', type: 'split-type', horsepower: 1.5, btuCapacity: 12000, price: 39990.00, description: 'Wind-Free cooling with AI auto mode.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Samsung+Wind-Free', isActive: true },
      { brand: 'LG', model: 'Dual Inverter S4-Q12JA3QG', type: 'split-type', horsepower: 1.5, btuCapacity: 12000, price: 34990.00, description: 'Dual inverter compressor with 10-year warranty.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=LG+Dual+Inverter', isActive: true },
      { brand: 'Daikin', model: 'FTV35BXV1', type: 'split-type', horsepower: 1.5, btuCapacity: 11900, price: 32990.00, description: 'Reliable non-inverter split-type with Comfort Cooling mode.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Daikin+FTV35BXV1', isActive: true },
      { brand: 'Condura', model: 'FP-51KMF010', type: 'window-type', horsepower: 0.75, btuCapacity: 7500, price: 14990.00, description: 'Budget-friendly window-type for small bedrooms.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Condura+FP-51KMF', isActive: true },
      { brand: 'Kolin', model: 'KAG-150HME4', type: 'window-type', horsepower: 1.5, btuCapacity: 12000, price: 18990.00, description: 'Inverter-grade window-type with timer function.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Kolin+KAG-150', isActive: true },
      { brand: 'Sharp', model: 'AH-X12VEV', type: 'split-type', horsepower: 1.5, btuCapacity: 12000, price: 31990.00, description: 'Plasmacluster split-type with self-cleaning function.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Sharp+AH-X12VEV', isActive: true },
      // Additional products in the 18000 BTU range for better multi-product recommendations
      { brand: 'Carrier', model: 'Optima Pro 42KHR018', type: 'split-type', horsepower: 2.0, btuCapacity: 18000, price: 52990.00, description: 'Premium 2HP split-type with advanced filtration and Wi-Fi control.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Carrier+Optima+Pro', isActive: true },
      { brand: 'LG', model: 'Dual Inverter V18API', type: 'split-type', horsepower: 2.0, btuCapacity: 18500, price: 46990.00, description: 'Energy-efficient dual inverter with Active Energy Control.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=LG+V18API', isActive: true },
      { brand: 'Daikin', model: 'FTKM50TV', type: 'split-type', horsepower: 2.0, btuCapacity: 17500, price: 44990.00, description: 'Reliable split-type with Comfort Mode and strong cooling performance.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Daikin+FTKM50', isActive: true },
      { brand: 'Samsung', model: 'Wind-Free Elite AR18', type: 'split-type', horsepower: 2.0, btuCapacity: 18200, price: 54990.00, description: 'Premium Wind-Free technology with AI energy optimization.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Samsung+Elite', isActive: true },
      { brand: 'Sharp', model: 'AH-X18YMD', type: 'split-type', horsepower: 2.0, btuCapacity: 18000, price: 43990.00, description: 'Plasmacluster Ion technology with self-clean and anti-bacterial filter.', imageUrl: 'https://placehold.co/400x300/e2e8f0/475569?text=Sharp+X18', isActive: true },
    ]);
    console.log(`Seeded ${products.length} aircon products.`);

    // ─── 3b. PRODUCT IMAGES ──────────────────────────────────────────────────────
    const productImages = await ProductImage.bulkCreate([
      // Carrier Crystal 2 Inverter (product 1) - 3 images
      { productId: 1, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Carrier+Crystal+2+Front', isCover: true, sortOrder: 0 },
      { productId: 1, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Carrier+Crystal+2+Side', isCover: false, sortOrder: 1 },
      { productId: 1, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Carrier+Crystal+2+Installed', isCover: false, sortOrder: 2 },
      // Carrier Alpha Inverter (product 2) - 3 images
      { productId: 2, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Carrier+Alpha+Front', isCover: true, sortOrder: 0 },
      { productId: 2, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Carrier+Alpha+Side', isCover: false, sortOrder: 1 },
      { productId: 2, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Carrier+Alpha+Remote', isCover: false, sortOrder: 2 },
      // Panasonic CS-S10VKQ (product 3) - 2 images
      { productId: 3, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Panasonic+S10+Front', isCover: true, sortOrder: 0 },
      { productId: 3, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Panasonic+S10+Angle', isCover: false, sortOrder: 1 },
      // Panasonic CS-S18VKQ (product 4) - 2 images
      { productId: 4, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Panasonic+S18+Front', isCover: true, sortOrder: 0 },
      { productId: 4, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Panasonic+S18+Installed', isCover: false, sortOrder: 1 },
      // Samsung Wind-Free (product 5) - 3 images
      { productId: 5, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Samsung+WindFree+Front', isCover: true, sortOrder: 0 },
      { productId: 5, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Samsung+WindFree+Side', isCover: false, sortOrder: 1 },
      { productId: 5, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Samsung+WindFree+Display', isCover: false, sortOrder: 2 },
      // LG Dual Inverter (product 6) - 2 images
      { productId: 6, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=LG+Dual+Inverter+Front', isCover: true, sortOrder: 0 },
      { productId: 6, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=LG+Dual+Inverter+Room', isCover: false, sortOrder: 1 },
      // Daikin FTV35BXV1 (product 7) - 2 images
      { productId: 7, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Daikin+FTV35+Front', isCover: true, sortOrder: 0 },
      { productId: 7, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Daikin+FTV35+Side', isCover: false, sortOrder: 1 },
      // Condura (product 8) - 2 images
      { productId: 8, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Condura+Window+Front', isCover: true, sortOrder: 0 },
      { productId: 8, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Condura+Window+Back', isCover: false, sortOrder: 1 },
      // Kolin (product 9) - 2 images
      { productId: 9, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Kolin+KAG+Front', isCover: true, sortOrder: 0 },
      { productId: 9, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Kolin+KAG+Panel', isCover: false, sortOrder: 1 },
      // Sharp (product 10) - 3 images
      { productId: 10, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Sharp+AH-X12+Front', isCover: true, sortOrder: 0 },
      { productId: 10, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Sharp+AH-X12+Side', isCover: false, sortOrder: 1 },
      { productId: 10, imageUrl: 'https://placehold.co/600x400/e2e8f0/475569?text=Sharp+AH-X12+Filter', isCover: false, sortOrder: 2 },
    ]);
    console.log(`Seeded ${productImages.length} product images.`);

    // ─── 4. TECHNICIAN DETAILS ──────────────────────────────────────────────────
    const technicianDetails = await TechnicianDetail.bulkCreate([
      { userId: 2, specialization: 'Installation, Split-type', contactNumber: '09171234567', availabilityStatus: 'available', street: '3 Buendia St.', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila' },
      { userId: 3, specialization: 'Repair, Compressor', contactNumber: '09181234567', availabilityStatus: 'available', street: '47 Ortigas Ave.', barangay: 'San Antonio', city: 'Pasig', province: 'Metro Manila' },
      { userId: 4, specialization: 'Maintenance, Cleaning', contactNumber: '09191234567', availabilityStatus: 'available', street: '19 Filinvest Ave.', barangay: 'Alabang', city: 'Muntinlupa', province: 'Metro Manila' },
      { userId: 5, specialization: 'Installation, Window-type', contactNumber: '09201234567', availabilityStatus: 'available', street: '102 Molino Blvd.', barangay: 'Salawag', city: 'Dasmariñas', province: 'Cavite' },
      { userId: 6, specialization: 'Duct Systems, Centralized AC', contactNumber: '09211234567', availabilityStatus: 'unavailable', street: '7 Katipunan Ave.', barangay: 'Loyola Heights', city: 'Quezon City', province: 'Metro Manila' },
    ]);
    console.log(`Seeded ${technicianDetails.length} technician details.`);

    // ─── 5. BTU FACTORS ─────────────────────────────────────────────────────────
    // Names MUST match the canonical keys in btuCalculationService.ts
    // (CORE_FACTOR_NAMES + APPLIANCE_FACTORS) so the deterministic BTU formula
    // picks them up. Values are admin-editable; editing one changes the
    // computation live. Core factors come first, then the appliance adders that
    // the room analysis can contribute.
    const btuFactors = await BtuFactor.bulkCreate([
      // Core formula factors (from the revisions table)
      { userId: 1, factorName: 'Room Area (per sqm)', factorValue: 337, description: 'BTU per square meter of floor area (Area x 337).' },
      { userId: 1, factorName: 'Ceiling Height (per meter above 2.5m)', factorValue: 100, description: 'BTU per meter of ceiling height above the 2.5m baseline.' },
      { userId: 1, factorName: 'Occupants (per person)', factorValue: 600, description: 'BTU added per occupant.' },
      { userId: 1, factorName: 'Sunlight (per level)', factorValue: 500, description: 'BTU per sunlight level: low x1, medium x2, high x3.' },
      // Appliance adders (detected/declared, added per unit)
      { userId: 1, factorName: 'Television (per unit)', factorValue: 400, description: 'BTU added per television.' },
      { userId: 1, factorName: 'Desktop Computer (per unit)', factorValue: 500, description: 'BTU added per desktop computer.' },
      { userId: 1, factorName: 'Laptop (per unit)', factorValue: 200, description: 'BTU added per laptop.' },
      { userId: 1, factorName: 'Refrigerator (per unit)', factorValue: 500, description: 'BTU added per refrigerator.' },
      { userId: 1, factorName: 'Microwave Oven (per unit)', factorValue: 1000, description: 'BTU added per microwave oven.' },
      { userId: 1, factorName: 'Electric Fan (per unit)', factorValue: 100, description: 'BTU added per electric fan.' },
      { userId: 1, factorName: 'Printer (per unit)', factorValue: 300, description: 'BTU added per printer.' },
      { userId: 1, factorName: 'Lighting Fixtures (per fixture)', factorValue: 100, description: 'BTU added per lighting fixture.' },
      { userId: 1, factorName: 'Gaming PC (per unit)', factorValue: 700, description: 'BTU added per gaming PC.' },
      { userId: 1, factorName: 'Server / Network Equipment (per unit)', factorValue: 1000, description: 'BTU added per server or network equipment rack.' },
    ]);
    console.log(`Seeded ${btuFactors.length} BTU factors.`);

    // ─── 6. SERVICE REQUESTS ────────────────────────────────────────────────────
    const serviceRequests = await ServiceRequest.bulkCreate([
      { userId: 7, serviceType: 'Installation', acDetails: 'New split-type AC for master bedroom, approximately 20 sqm room.', status: 'completed', contactNumber: '09171110001', serviceStreet: '12 Rizal St.', serviceBarangay: 'Poblacion', serviceCity: 'Makati', serviceProvince: 'Metro Manila' },
      { userId: 7, serviceType: 'Preventive Maintenance', acDetails: 'Annual checkup for Carrier 1.5HP split-type in living room.', status: 'in-progress', contactNumber: '09171110001', serviceStreet: '12 Rizal St.', serviceBarangay: 'Poblacion', serviceCity: 'Makati', serviceProvince: 'Metro Manila' },
      { userId: 8, serviceType: 'Repair', acDetails: 'AC not cooling properly, possible freon leak. Unit is LG 1HP window-type.', status: 'assigned', contactNumber: '09171110002', serviceStreet: '88 Mabini Ave.', serviceBarangay: 'San Antonio', serviceCity: 'Pasig', serviceProvince: 'Metro Manila' },
      { userId: 8, serviceType: 'General Cleaning', acDetails: 'Deep clean needed for 2 window-type units. Both are Condura 0.75HP.', status: 'approved', contactNumber: '09171110002', serviceStreet: '88 Mabini Ave.', serviceBarangay: 'San Antonio', serviceCity: 'Pasig', serviceProvince: 'Metro Manila' },
      { userId: 9, serviceType: 'Installation', acDetails: 'Need 2HP split-type installed in open-plan office (approx 35 sqm).', status: 'pending', contactNumber: '09171110003', serviceStreet: '5 Bonifacio Rd.', serviceBarangay: 'Alabang', serviceCity: 'Muntinlupa', serviceProvince: 'Metro Manila' },
      { userId: 9, serviceType: 'Freon Recharge', acDetails: 'Samsung split-type not blowing cold air. 3 years old.', status: 'pending', contactNumber: '09171110003', serviceStreet: '5 Bonifacio Rd.', serviceBarangay: 'Alabang', serviceCity: 'Muntinlupa', serviceProvince: 'Metro Manila' },
      { userId: 10, serviceType: 'Consultation', acDetails: 'Want advice on best AC setup for newly renovated 3-bedroom apartment.', status: 'approved', contactNumber: '09171110004', serviceStreet: '210 Aguinaldo Hwy', serviceBarangay: 'Salawag', serviceCity: 'Dasmariñas', serviceProvince: 'Cavite' },
      { userId: 10, serviceType: 'Relocation', acDetails: 'Moving Panasonic 1HP split-type from bedroom to home office.', status: 'assigned', contactNumber: '09171110004', serviceStreet: '210 Aguinaldo Hwy', serviceBarangay: 'Salawag', serviceCity: 'Dasmariñas', serviceProvince: 'Cavite' },
      { userId: 7, serviceType: 'Compressor Repair', acDetails: 'Compressor making loud noise and unit auto-shuts after 10 mins.', status: 'pending', contactNumber: '09171110001', serviceStreet: '12 Rizal St.', serviceBarangay: 'Poblacion', serviceCity: 'Makati', serviceProvince: 'Metro Manila' },
      { userId: 8, serviceType: 'Thermostat Replacement', acDetails: 'Old dial thermostat needs upgrade to digital for Carrier window-type.', status: 'completed', contactNumber: '09171110002', serviceStreet: '88 Mabini Ave.', serviceBarangay: 'San Antonio', serviceCity: 'Pasig', serviceProvince: 'Metro Manila' },
    ]);
    console.log(`Seeded ${serviceRequests.length} service requests.`);

    // ─── 7. ROOM ASSESSMENTS ────────────────────────────────────────────────────
    const roomAssessments = await RoomAssessment.bulkCreate([
      { userId: 7, serviceRequestId: 1, area: 20, ceilingHeight: 2.8, occupancy: 2, sunlightLevel: 'medium', imagePath: null },
      { userId: 7, serviceRequestId: 2, area: 30, ceilingHeight: 3.0, occupancy: 4, sunlightLevel: 'high', imagePath: null },
      { userId: 8, serviceRequestId: 3, area: 12, ceilingHeight: 2.6, occupancy: 1, sunlightLevel: 'low', imagePath: null },
      { userId: 9, serviceRequestId: 5, area: 35, ceilingHeight: 3.2, occupancy: 8, sunlightLevel: 'high', imagePath: null },
      { userId: 10, serviceRequestId: 7, area: 25, ceilingHeight: 2.8, occupancy: 3, sunlightLevel: 'medium', imagePath: null },
      { userId: 10, serviceRequestId: 8, area: 14, ceilingHeight: 2.6, occupancy: 1, sunlightLevel: 'low', imagePath: null },
    ]);
    console.log(`Seeded ${roomAssessments.length} room assessments.`);

    // ─── 8. AI RECOMMENDATIONS ──────────────────────────────────────────────────
    const aiRecommendations = await AiRecommendation.bulkCreate([
      { roomAssessmentId: 1, totalBtu: 14400, recommendedHp: 1.5, unitType: 'split-type', productId: 2, troubleshootingNotes: null, reasoning: 'Based on 20 sqm area with medium sunlight and 2 occupants, a 1.5HP split-type provides optimal cooling with energy efficiency.' },
      { roomAssessmentId: 2, totalBtu: 24000, recommendedHp: 2.0, unitType: 'split-type', productId: 4, troubleshootingNotes: null, reasoning: 'Large 30 sqm living room with high sunlight and 4 occupants requires a 2HP unit for adequate cooling coverage.' },
      { roomAssessmentId: 3, totalBtu: 7200, recommendedHp: 0.75, unitType: 'window-type', productId: 8, troubleshootingNotes: 'Check refrigerant levels. Possible leak at pipe joints. Recommend pressure test before recharge.', reasoning: '12 sqm room with low sunlight and single occupant. Budget-friendly window-type is sufficient.' },
      { roomAssessmentId: 4, totalBtu: 28000, recommendedHp: 2.5, unitType: 'split-type', productId: 4, troubleshootingNotes: null, reasoning: 'Open-plan 35 sqm office with 8 occupants and high sunlight requires high-capacity cooling. Recommend 2HP minimum or dual units.' },
      { roomAssessmentId: 5, totalBtu: 17000, recommendedHp: 1.5, unitType: 'split-type', productId: 6, troubleshootingNotes: null, reasoning: '25 sqm room with 3 occupants and medium sunlight. 1.5HP split-type with inverter recommended for energy savings.' },
    ]);
    console.log(`Seeded ${aiRecommendations.length} AI recommendations.`);

    // ─── 9. TECHNICIAN SCHEDULES ────────────────────────────────────────────────
    const schedules = await TechnicianSchedule.bulkCreate([
      { technicianId: 2, serviceRequestId: 1, scheduledDate: '2026-07-10', status: 'completed', priority: 'high', report: 'Installation completed successfully. Split-type mounted, piping connected, tested cooling output at 16°C.' },
      { technicianId: 4, serviceRequestId: 2, scheduledDate: '2026-07-20', status: 'in-progress', priority: 'medium', report: null },
      { technicianId: 3, serviceRequestId: 3, scheduledDate: '2026-07-22', status: 'accepted', priority: 'high', report: null },
      { technicianId: 2, serviceRequestId: 8, scheduledDate: '2026-07-25', status: 'assigned', priority: 'low', report: null },
      { technicianId: 5, serviceRequestId: 10, scheduledDate: '2026-07-05', status: 'completed', priority: 'medium', report: 'Old dial thermostat removed. New digital thermostat installed and calibrated. Customer briefed on usage.' },
    ]);
    console.log(`Seeded ${schedules.length} technician schedules.`);

    // ─── 10. REPORTS ────────────────────────────────────────────────────────────
    const reports = await Report.bulkCreate([
      { serviceRequestId: 1, reportType: 'Service Completion', summary: 'AC installation completed on July 10, 2026. Carrier Alpha Inverter 1.5HP split-type installed in master bedroom. All tests passed.', generatedDate: new Date('2026-07-10') },
      { serviceRequestId: 10, reportType: 'Service Completion', summary: 'Thermostat replacement completed on July 5, 2026. Digital thermostat installed on Carrier window-type unit.', generatedDate: new Date('2026-07-05') },
      { serviceRequestId: null, reportType: 'Monthly Summary', summary: 'July 2026 summary: 15 total requests, 8 completed, 3 in-progress, 4 pending. Top service: Installation (40%). Average completion time: 3.2 days.', generatedDate: new Date('2026-07-31') },
      { serviceRequestId: null, reportType: 'Technician Performance', summary: 'Juan Dela Cruz: 6 tasks completed, avg rating 4.8/5. Pedro Santos: 4 tasks, avg rating 4.5/5. Maria Garcia: 5 tasks, avg rating 4.9/5.', generatedDate: new Date('2026-07-31') },
      { serviceRequestId: null, reportType: 'AI Recommendation Report', summary: 'AI module processed 12 room assessments this month. 10 resulted in product matches. Most recommended: 1.5HP Split-type (60%). Avg calculated BTU: 15,200.', generatedDate: new Date('2026-07-31') },
    ]);
    console.log(`Seeded ${reports.length} reports.`);

    console.log('\n✅ All mock data seeded successfully!');
    console.log('─────────────────────────────────────');
    console.log('Login credentials (all users):');
    console.log('  Password: Password123');
    console.log('  Admin:    admin@dvtech.com');
    console.log('  Tech:     juan@dvtech.com, pedro@dvtech.com, maria@dvtech.com, carlos@dvtech.com, ana@dvtech.com');
    console.log('  Customer: customer1@email.com ... customer4@email.com');
    console.log('─────────────────────────────────────');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
