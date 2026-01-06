import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface PaymentAttributes {
  id?: number;
  userId: number;
  membershipPlanId: number;
  amount: number;
  currency: string;
  paypalOrderId?: string;
  paypalTransactionId?: string;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PaymentCreationAttributes 
  extends Optional<PaymentAttributes, 'id' | 'paypalOrderId' | 'paypalTransactionId' | 'createdAt' | 'updatedAt'> {}

export class Payment 
  extends Model<PaymentAttributes, PaymentCreationAttributes> 
  implements PaymentAttributes {
  public id!: number;
  public userId!: number;
  public membershipPlanId!: number;
  public amount!: number;
  public currency!: string;
  public paypalOrderId!: string;
  public paypalTransactionId!: string;
  public paymentStatus!: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  public paymentMethod!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initPaymentModel(sequelize: Sequelize) {
  Payment.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'auth',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      membershipPlanId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'membership_plans',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD',
      },
      paypalOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      paypalTransactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      paymentStatus: {
        type: DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'),
        defaultValue: 'PENDING',
      },
      paymentMethod: {
        type: DataTypes.STRING,
        defaultValue: 'paypal',
      },
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'payments',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['paymentStatus'] },
        { fields: ['paypalOrderId'] },
      ],
    }
  );
  return Payment;
}
