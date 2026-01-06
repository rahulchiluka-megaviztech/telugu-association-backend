import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface MembershipPlanAttributes {
  id?: number;
  title: string; // e.g., "Team Membership 2025", "Team Membership 2025-2026"
  duration: 'One year' | 'Two year' | 'Lifetime';
  amount: number;
  benefits: string; // Rich text/HTML description of benefits
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MembershipPlanCreationAttributes 
  extends Optional<MembershipPlanAttributes, 'id' | 'isActive' | 'validFrom' | 'validUntil' | 'createdAt' | 'updatedAt'> {}

export class MembershipPlan 
  extends Model<MembershipPlanAttributes, MembershipPlanCreationAttributes> 
  implements MembershipPlanAttributes {
  public id!: number;
  public title!: string;
  public duration!: 'One year' | 'Two year' | 'Lifetime';
  public amount!: number;
  public benefits!: string;
  public isActive!: boolean;
  public validFrom!: Date;
  public validUntil!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initMembershipPlanModel(sequelize: Sequelize) {
  MembershipPlan.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: { 
        type: DataTypes.STRING, 
        allowNull: false,
      },
      duration: { 
        type: DataTypes.ENUM('One year', 'Two year', 'Lifetime'), 
        allowNull: false,
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
      validFrom: { 
        type: DataTypes.DATE,
        allowNull: true,
      },
      validUntil: { 
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'MembershipPlan',
      tableName: 'membership_plans',
      timestamps: true,
      indexes: [
        { fields: ['duration'] },
        { fields: ['isActive'] },
      ],
    }
  );
  return MembershipPlan;
}
