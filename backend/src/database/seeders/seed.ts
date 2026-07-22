import 'reflect-metadata';
import bcrypt from 'bcrypt';
import sequelize from '../connection';
import {
  User,
  AirconProduct,
  ServiceType,
  BtuFactor,
  ServiceRequest,
  RoomAssessment,
  AiRecommendation,
  TechnicianDetail,
  TechnicianSchedule,
  Report,
} from '../../models';

async function seed() {
  try {
    // Sync all models (creates tables if not exist)
    await sequelize.sync({ force: true });
    console.log('Database synced (tables recreated).');

    // ─── 1. USERS ───────────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await User.bulkCreate([
      { name: 'Admin User', email: 'admin@dvtech.com', password: hashedPassword, role: 'admin', isActive: true },
      { name: 'Juan Dela Cruz', email: 'juan@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Pedro Santos', email: 'pedro@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Maria Garcia', email: 'maria@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Carlos Reyes', email: 'carlos@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Ana Mendoza', email: 'ana@dvtech.com', password: hashedPassword, role: 'technician', isActive: true },
      { name: 'Customer One', email: 'customer1@email.com', password: hashedPassword, role: 'customer', isActive: true },
      { name: 'Customer Two', email: 'customer2@email.com', password: hashedPassword, role: 'customer', isActive: true },
      { name: 'Customer Three', email: 'customer3@email.com', password: hashedPassword, role: 'customer', isActive: true },
      { name: 'Customer Four', email: 'customer4@email.com', password: hashedPassword, role: 'customer', isActive: true },
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
    const products = await AirconProduct.bulkCreate([
      { brand: 'Carrier', model: 'Crystal 2 Inverter', type: 'Window', horsepower: 1.0, btuCapacity: 9000, price: 22990.00, description: 'Energy-efficient window-type inverter AC with R32 refrigerant.', imageUrl: null, isActive: true },
      { brand: 'Carrier', model: 'Alpha Inverter', type: 'Split', horsepower: 1.5, btuCapacity: 12000, price: 36990.00, description: 'Premium split-type inverter for medium-sized rooms.', imageUrl: null, isActive: true },
      { brand: 'Panasonic', model: 'CS-S10VKQ', type: 'Split', horsepower: 1.0, btuCapacity: 9500, price: 28990.00, description: 'Nanoe-X split-type with air purification technology.', imageUrl: null, isActive: true },
      { brand: 'Panasonic', model: 'CS-S18VKQ', type: 'Split', horsepower: 2.0, btuCapacity: 18000, price: 48990.00, description: 'High-capacity split-type for large rooms and offices.', imageUrl: null, isActive: true },
      { brand: 'Samsung', model: 'Wind-Free AR9500T', type: 'Split', horsepower: 1.5, btuCapacity: 12000, price: 39990.00, description: 'Wind-Free cooling with AI auto mode.', imageUrl: null, isActive: true },
      { brand: 'LG', model: 'Dual Inverter S4-Q12JA3QG', type: 'Split', horsepower: 1.5, btuCapacity: 12000, price: 34990.00, description: 'Dual inverter compressor with 10-year warranty.', imageUrl: null, isActive: true },
      { brand: 'Daikin', model: 'FTV35BXV1', type: 'Split', horsepower: 1.5, btuCapacity: 11900, price: 32990.00, description: 'Reliable non-inverter split-type with Comfort Cooling mode.', imageUrl: null, isActive: true },
      { brand: 'Condura', model: 'FP-51KMF010', type: 'Window', horsepower: 0.75, btuCapacity: 7500, price: 14990.00, description: 'Budget-friendly window-type for small bedrooms.', imageUrl: null, isActive: true },
      { brand: 'Kolin', model: 'KAG-150HME4', type: 'Window', horsepower: 1.5, btuCapacity: 12000, price: 18990.00, description: 'Inverter-grade window-type with timer function.', imageUrl: null, isActive: true },
      { brand: 'Sharp', model: 'AH-X12VEV', type: 'Split', horsepower: 1.5, btuCapacity: 12000, price: 31990.00, description: 'Plasmacluster split-type with self-cleaning function.', imageUrl: null, isActive: true },
    ]);
    console.log(`Seeded ${products.length} aircon products.`);

    // ─── 4. TECHNICIAN DETAILS ──────────────────────────────────────────────────
    const technicianDetails = await TechnicianDetail.bulkCreate([
      { userId: 2, specialization: 'Installation, Split-type', contactNumber: '09171234567', availabilityStatus: 'available' },
      { userId: 3, specialization: 'Repair, Compressor', contactNumber: '09181234567', availabilityStatus: 'available' },
      { userId: 4, specialization: 'Maintenance, Cleaning', contactNumber: '09191234567', availabilityStatus: 'busy' },
      { userId: 5, specialization: 'Installation, Window-type', contactNumber: '09201234567', availabilityStatus: 'available' },
      { userId: 6, specialization: 'Duct Systems, Centralized AC', contactNumber: '09211234567', availabilityStatus: 'unavailable' },
    ]);
    console.log(`Seeded ${technicianDetails.length} technician details.`);

    // ─── 5. BTU FACTORS ─────────────────────────────────────────────────────────
    const btuFactors = await BtuFactor.bulkCreate([
      { userId: 1, factorName: 'Base BTU per sqm', factorValue: 600, description: 'Base BTU requirement per square meter of floor area.' },
      { userId: 1, factorName: 'Ceiling Height Multiplier', factorValue: 1.2, description: 'Additional multiplier for ceilings above 2.8m.' },
      { userId: 1, factorName: 'Occupancy Factor', factorValue: 400, description: 'Additional BTU per person beyond the first occupant.' },
      { userId: 1, factorName: 'High Sunlight Multiplier', factorValue: 1.3, description: 'Multiplier for rooms with heavy direct sunlight.' },
      { userId: 1, factorName: 'Medium Sunlight Multiplier', factorValue: 1.15, description: 'Multiplier for rooms with moderate sunlight.' },
      { userId: 1, factorName: 'Low Sunlight Multiplier', factorValue: 1.0, description: 'No additional BTU needed for shaded rooms.' },
      { userId: 1, factorName: 'Kitchen Appliance Factor', factorValue: 1500, description: 'Extra BTU for rooms with heat-generating appliances.' },
      { userId: 1, factorName: 'Top Floor Factor', factorValue: 1.1, description: 'Multiplier for top-floor rooms with roof heat absorption.' },
      { userId: 1, factorName: 'Glass Wall Factor', factorValue: 1.25, description: 'Multiplier for rooms with large glass windows or walls.' },
      { userId: 1, factorName: 'Insulation Discount', factorValue: 0.9, description: 'Reduction factor for well-insulated rooms.' },
    ]);
    console.log(`Seeded ${btuFactors.length} BTU factors.`);

    // ─── 6. SERVICE REQUESTS ────────────────────────────────────────────────────
    const serviceRequests = await ServiceRequest.bulkCreate([
      { userId: 7, serviceType: 'Installation', acDetails: 'New split-type AC for master bedroom, approximately 20 sqm room.', status: 'completed' },
      { userId: 7, serviceType: 'Preventive Maintenance', acDetails: 'Annual checkup for Carrier 1.5HP split-type in living room.', status: 'in-progress' },
      { userId: 8, serviceType: 'Repair', acDetails: 'AC not cooling properly, possible freon leak. Unit is LG 1HP window-type.', status: 'assigned' },
      { userId: 8, serviceType: 'General Cleaning', acDetails: 'Deep clean needed for 2 window-type units. Both are Condura 0.75HP.', status: 'approved' },
      { userId: 9, serviceType: 'Installation', acDetails: 'Need 2HP split-type installed in open-plan office (approx 35 sqm).', status: 'pending' },
      { userId: 9, serviceType: 'Freon Recharge', acDetails: 'Samsung split-type not blowing cold air. 3 years old.', status: 'pending' },
      { userId: 10, serviceType: 'Consultation', acDetails: 'Want advice on best AC setup for newly renovated 3-bedroom apartment.', status: 'approved' },
      { userId: 10, serviceType: 'Relocation', acDetails: 'Moving Panasonic 1HP split-type from bedroom to home office.', status: 'assigned' },
      { userId: 7, serviceType: 'Compressor Repair', acDetails: 'Compressor making loud noise and unit auto-shuts after 10 mins.', status: 'pending' },
      { userId: 8, serviceType: 'Thermostat Replacement', acDetails: 'Old dial thermostat needs upgrade to digital for Carrier window-type.', status: 'completed' },
    ]);
    console.log(`Seeded ${serviceRequests.length} service requests.`);

    // ─── 7. ROOM ASSESSMENTS ────────────────────────────────────────────────────
    const roomAssessments = await RoomAssessment.bulkCreate([
      { serviceRequestId: 1, area: 20, ceilingHeight: 2.8, occupancy: 2, sunlightLevel: 'medium', imagePath: null },
      { serviceRequestId: 2, area: 30, ceilingHeight: 3.0, occupancy: 4, sunlightLevel: 'high', imagePath: null },
      { serviceRequestId: 3, area: 12, ceilingHeight: 2.6, occupancy: 1, sunlightLevel: 'low', imagePath: null },
      { serviceRequestId: 5, area: 35, ceilingHeight: 3.2, occupancy: 8, sunlightLevel: 'high', imagePath: null },
      { serviceRequestId: 7, area: 25, ceilingHeight: 2.8, occupancy: 3, sunlightLevel: 'medium', imagePath: null },
      { serviceRequestId: 8, area: 14, ceilingHeight: 2.6, occupancy: 1, sunlightLevel: 'low', imagePath: null },
    ]);
    console.log(`Seeded ${roomAssessments.length} room assessments.`);

    // ─── 8. AI RECOMMENDATIONS ──────────────────────────────────────────────────
    const aiRecommendations = await AiRecommendation.bulkCreate([
      { roomAssessmentId: 1, totalBtu: 14400, recommendedHp: 1.5, unitType: 'Split', productId: 2, troubleshootingNotes: null, reasoning: 'Based on 20 sqm area with medium sunlight and 2 occupants, a 1.5HP split-type provides optimal cooling with energy efficiency.' },
      { roomAssessmentId: 2, totalBtu: 24000, recommendedHp: 2.0, unitType: 'Split', productId: 4, troubleshootingNotes: null, reasoning: 'Large 30 sqm living room with high sunlight and 4 occupants requires a 2HP unit for adequate cooling coverage.' },
      { roomAssessmentId: 3, totalBtu: 7200, recommendedHp: 0.75, unitType: 'Window', productId: 8, troubleshootingNotes: 'Check refrigerant levels. Possible leak at pipe joints. Recommend pressure test before recharge.', reasoning: '12 sqm room with low sunlight and single occupant. Budget-friendly window-type is sufficient.' },
      { roomAssessmentId: 4, totalBtu: 28000, recommendedHp: 2.5, unitType: 'Split', productId: 4, troubleshootingNotes: null, reasoning: 'Open-plan 35 sqm office with 8 occupants and high sunlight requires high-capacity cooling. Recommend 2HP minimum or dual units.' },
      { roomAssessmentId: 5, totalBtu: 17000, recommendedHp: 1.5, unitType: 'Split', productId: 6, troubleshootingNotes: null, reasoning: '25 sqm room with 3 occupants and medium sunlight. 1.5HP split-type with inverter recommended for energy savings.' },
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
    console.log('  Password: password123');
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
