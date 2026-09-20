import { Sequelize } from 'sequelize-typescript';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables FIRST before anything else
dotenv.config();

// Explicit import so Vercel's bundler includes mysql2
import 'mysql2';
import { User } from '../models/User';
import { ServiceRequest } from '../models/ServiceRequest';
import { RoomAssessment } from '../models/RoomAssessment';
import { AiRecommendation } from '../models/AiRecommendation';
import { AirconProduct } from '../models/AirconProduct';
import { ProductImage } from '../models/ProductImage';
import { Brand } from '../models/Brand';
import { TechnicianDetail } from '../models/TechnicianDetail';
import { TechnicianSchedule } from '../models/TechnicianSchedule';
import { ScheduleReassignment } from '../models/ScheduleReassignment';
import { BtuFactor } from '../models/BtuFactor';
import { Report } from '../models/Report';
import { ServiceType } from '../models/ServiceType';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { LoginAttempt } from '../models/LoginAttempt';
import { RecommendedProduct } from '../models/RecommendedProduct';
import { EmailVerification } from '../models/EmailVerification';
import { Quotation } from '../models/Quotation';

const models = [
  User,
  ServiceRequest,
  RoomAssessment,
  AiRecommendation,
  AirconProduct,
  ProductImage,
  Brand,
  TechnicianDetail,
  TechnicianSchedule,
  ScheduleReassignment,
  BtuFactor,
  Report,
  ServiceType,
  PasswordResetToken,
  LoginAttempt,
  RecommendedProduct,
  EmailVerification,
  Quotation,
];

let sequelize: Sequelize;

if (process.env.DATABASE_URL) {
  // Production/Vercel: use MySQL via DATABASE_URL
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'mysql',
    logging: false,
    models,
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false,
      },
    },
  });
} else if (process.env.DB_HOST && process.env.DB_NAME) {
  // MySQL with individual env vars
  sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    quoteIdentifiers: true,
    models,
  });
} else {
  // Local development fallback: SQLite
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'database.sqlite'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    models,
  });
}

export default sequelize;
