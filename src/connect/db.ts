import { Sequelize } from 'sequelize';
import { initAuthModel } from '../model/Auth';
import { initEventsModel } from '../model/Events';
import { initBoardMembersModel } from '../model/BoardMemebers';
import { initSponsorModel } from '../model/Sponsor';
import { initMembershipPlanModel } from '../model/MembershipPlan';
import { initSponsorshipPlanModel } from '../model/SponsorshipPlan';
import { initOTPModel } from '../model/otp';
import { initDonationModel } from '../model/Donations';
import { initGalleryModel } from '../model/Gallery';
import { initPaymentModel } from '../model/Payment';
import { initHomepageHighlightModel } from '../model/HomepageHighlight';
import { initNewsModel } from '../model/News';
import logger from '../Utils/Wiston';

// Create Sequelize instance
export const sequelize = new Sequelize(
  process.env.DB_NAME as string,
  process.env.DB_USER as string,
  process.env.DB_PASS as string,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'mariadb',
    dialectOptions: {
      connectTimeout: 60000, // 60 seconds
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000, // 60 seconds
      idle: 10000
    },
    logging: (msg) => logger.debug(`[Sequelize] ${msg}`),
  }
);

// Initialize all models
export const initializeModels = () => {
  logger.info('Initializing Sequelize models...');
  // Initialize MembershipPlan BEFORE Auth (Auth has foreign key to it)
  const MembershipPlan = initMembershipPlanModel(sequelize);
  // Initialize SponsorshipPlan BEFORE Sponsor (Sponsor has foreign key to it)
  const SponsorshipPlan = initSponsorshipPlanModel(sequelize);
  const Auth = initAuthModel(sequelize);
  initEventsModel(sequelize);
  initBoardMembersModel(sequelize);
  const Sponsor = initSponsorModel(sequelize);
  initOTPModel(sequelize);
  initDonationModel(sequelize);
  initGalleryModel(sequelize);
  const Payment = initPaymentModel(sequelize);
  initHomepageHighlightModel(sequelize);
  initNewsModel(sequelize);

  // Define associations
  Auth.belongsTo(MembershipPlan, { foreignKey: 'membershipPlanId', as: 'membershipPlan' });
  Auth.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
  Sponsor.belongsTo(SponsorshipPlan, { foreignKey: 'sponsorshipPlanId', as: 'sponsorshipPlan' });

  logger.info('All models initialized successfully');
  
};
