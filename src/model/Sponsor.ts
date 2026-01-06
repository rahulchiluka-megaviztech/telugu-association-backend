import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface SponsorAttributes {
  id?: number;
  companyName: string;
  sponsorName: string;
  email: string;
  website: string;
  sponsorshipPlanId: number;
  status: 'active' | 'inactive';
  startDate: Date;
  endDate: Date;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SponsorCreationAttributes extends Optional<SponsorAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Sponsor extends Model<SponsorAttributes, SponsorCreationAttributes> implements SponsorAttributes {
  public id!: number;
  public companyName!: string;
  public sponsorName!: string;
  public email!: string;
  public website!: string;
  public sponsorshipPlanId!: number;
  public status!: 'active' | 'inactive';
  public startDate!: Date;
  public endDate!: Date;
  public imageUrl!: string;
  public imagePublicId!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}


export function initSponsorModel(sequelize: Sequelize) {
  Sponsor.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      companyName: { type: DataTypes.STRING, allowNull: false },
      sponsorName: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false },
      website: { type: DataTypes.STRING },
      sponsorshipPlanId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: {
          model: 'sponsorship_plans',
          key: 'id'
        }
      },
      status: { 
        type: DataTypes.ENUM('active', 'inactive'), 
        allowNull: false,
        defaultValue: 'active'
      },
      startDate: { type: DataTypes.DATE, allowNull: false },
      endDate: { type: DataTypes.DATE, allowNull: false },
      imageUrl: { type: DataTypes.STRING, allowNull: true },
      imagePublicId: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Sponsor',
      tableName: 'sponsor',
      timestamps: true,
      indexes: [
        { fields: ['companyName'] },
        { fields: ['email'] },
      ],
    }
  );
  return Sponsor;
}
