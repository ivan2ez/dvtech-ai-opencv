import { User } from './User';
import { ServiceRequest } from './ServiceRequest';
import { RoomAssessment } from './RoomAssessment';
import { AiRecommendation } from './AiRecommendation';
import { AirconProduct } from './AirconProduct';
import { TechnicianDetail } from './TechnicianDetail';
import { TechnicianSchedule } from './TechnicianSchedule';
import { BtuFactor } from './BtuFactor';
import { Report } from './Report';

// All models array for Sequelize instance registration
const models = [
  User,
  ServiceRequest,
  RoomAssessment,
  AiRecommendation,
  AirconProduct,
  TechnicianDetail,
  TechnicianSchedule,
  BtuFactor,
  Report,
];

export {
  User,
  ServiceRequest,
  RoomAssessment,
  AiRecommendation,
  AirconProduct,
  TechnicianDetail,
  TechnicianSchedule,
  BtuFactor,
  Report,
  models,
};
