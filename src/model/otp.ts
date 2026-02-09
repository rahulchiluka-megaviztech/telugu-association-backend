import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface OTPAttributes {
  id?: number;
  email: string;
  otp: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface OTPCreationAttributes extends Optional<OTPAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class OTP extends Model<OTPAttributes, OTPCreationAttributes> implements OTPAttributes {
  public id!: number;
  public email!: string;
  public otp!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}


export function initOTPModel(sequelize: Sequelize) {
  OTP.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'OTP',
      tableName: 'otp',
      timestamps: true,
      indexes: [
        // email index removed as it is already unique: true above
      ],
    }
  );
  return OTP;
}
