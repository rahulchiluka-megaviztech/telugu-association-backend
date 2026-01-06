import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface SponsorshipPlanAttributes {
  id?: number;
  title: string; // e.g., "Gold Sponsor", "Platinum Sponsor"
  amount: number;
  benefits: string; // Rich text/HTML description of benefits
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SponsorshipPlanCreationAttributes 
  extends Optional<SponsorshipPlanAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt'> {}

export class SponsorshipPlan 
  extends Model<SponsorshipPlanAttributes, SponsorshipPlanCreationAttributes> 
  implements SponsorshipPlanAttributes {
  public id!: number;
  public title!: string;
  public amount!: number;
  public benefits!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initSponsorshipPlanModel(sequelize: Sequelize) {
  SponsorshipPlan.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: { 
        type: DataTypes.STRING, 
        allowNull: false,
        unique: true,
      },
      amount: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false,
      },
      benefits: { 
        type: DataTypes.TEXT, 
        allowNull: false,
      },
      isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'SponsorshipPlan',
      tableName: 'sponsorship_plans',
      timestamps: true,
      indexes: [
        { fields: ['isActive'] },
      ],
    }
  );
  return SponsorshipPlan;
}
