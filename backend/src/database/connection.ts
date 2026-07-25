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

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', '..', 'database.sqlite'),
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
