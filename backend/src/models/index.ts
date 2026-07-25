import { User } from './User';
import { ServiceRequest } from './ServiceRequest';
import { RoomAssessment } from './RoomAssessment';
import { AiRecommendation } from './AiRecommendation';
import { AirconProduct } from './AirconProduct';
import { ProductImage } from './ProductImage';
import { Brand } from './Brand';
import { TechnicianDetail } from './TechnicianDetail';
import { TechnicianSchedule } from './TechnicianSchedule';
import { BtuFactor } from './BtuFactor';
import { Report } from './Report';
import { ServiceType } from './ServiceType';

// All models array for Sequelize instance registration
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
  BtuFactor,
  Report,
  ServiceType,
];

export {
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
  models,
};
