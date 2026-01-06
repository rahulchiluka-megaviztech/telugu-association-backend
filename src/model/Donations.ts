import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface DonationAttributes {
  id?: number;
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  paymentinformation: string;
  orderId?: string;
  transactionId?: string;
  totalAmount: number;
  status?: 'pending' | 'completed' | 'failed';
  createdAt?: Date;
  updatedAt?: Date;
}

interface DonationCreationAttributes extends Optional<DonationAttributes, 'id' | 'status' | 'createdAt' | 'updatedAt'> { }

export class Donation extends Model<DonationAttributes, DonationCreationAttributes> implements DonationAttributes {
  public id!: number;
  public firstname!: string;
  public lastname!: string;
  public email!: string;
  public mobile!: string;
  public paymentinformation!: string;
  public orderId!: string;
  public transactionId!: string;
  public totalAmount!: number;
  public status!: 'pending' | 'completed' | 'failed';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initDonationModel(sequelize: Sequelize) {
  Donation.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      firstname: { type: DataTypes.STRING, allowNull: false },
      lastname: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false },
      mobile: { type: DataTypes.STRING, allowNull: false },
      paymentinformation: { type: DataTypes.STRING, allowNull: false },
      orderId: { type: DataTypes.STRING, allowNull: true },
      transactionId: { type: DataTypes.STRING, allowNull: true },
      totalAmount: { type: DataTypes.FLOAT, allowNull: false },
      status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'pending' },
    },
    {
      sequelize,
      modelName: 'Donation',
      tableName: 'donations',
      timestamps: true,
    }
  );
  return Donation;
}
