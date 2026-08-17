import { Sequelize } from 'sequelize-typescript';
import path from 'path';
import { User } from '../models/User';
import { ServiceRequest } from '../models/ServiceRequest';
import { RoomAssessment } from '../models/RoomAssessment';
import { AiRecommendation } from '../models/AiRecommendation';
import { AirconProduct } from '../models/AirconProduct';
import { ProductImage } from '../models/ProductImage';
import { Brand } from '../models/Brand';
import { TechnicianDetail } from '../models/TechnicianDetail';
import { TechnicianSchedule } from '../models/TechnicianSchedule';
import { BtuFactor } from '../models/BtuFactor';
import { Report } from '../models/Report';
import { ServiceType } from '../models/ServiceType';

// Use /tmp for writable storage on Vercel (serverless), otherwise use project root
const dbStorage = process.env.VERCEL === '1'
  ? '/tmp/database.sqlite'
  : path.join(__dirname, '..', '..', 'database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbStorage,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  models: [
    User,
    ServiceRequest,
    RoomAssessment,
    AiRecommendation,
    AirconProduct,
    ProductImage,
    Brand,
    TechnicianDetail,
    TechnicianSchedule,
    BtuFactor,
    Report,
    ServiceType,
  ],
});

export default sequelize;
