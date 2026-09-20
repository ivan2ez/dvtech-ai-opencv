import { User } from './User';
import { ServiceRequest } from './ServiceRequest';
import { RoomAssessment } from './RoomAssessment';
import { AiRecommendation } from './AiRecommendation';
import { AirconProduct } from './AirconProduct';
import { ProductImage } from './ProductImage';
import { Brand } from './Brand';
import { TechnicianDetail } from './TechnicianDetail';
import { TechnicianSchedule } from './TechnicianSchedule';
import { ScheduleReassignment } from './ScheduleReassignment';
import { BtuFactor } from './BtuFactor';
import { Report } from './Report';
import { ServiceType } from './ServiceType';
import { PasswordResetToken } from './PasswordResetToken';
import { LoginAttempt } from './LoginAttempt';
import { RecommendedProduct } from './RecommendedProduct';
import { EmailVerification } from './EmailVerification';
import { Quotation } from './Quotation';

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
  ScheduleReassignment,
  BtuFactor,
  Report,
  ServiceType,
  PasswordResetToken,
  LoginAttempt,
  RecommendedProduct,
  EmailVerification,
  Quotation,
  models,
};
