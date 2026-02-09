import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface MembersAuthAttributes {
  id?: number;
  type: 'member' | 'volunteer' | 'admin';
  firstname: string;
  lastname: string;
  email: string;
  mobile?: string;
  password?: string;
  authProvider?: 'local' | 'google' | 'facebook';
  socialId?: string;
  isProfileComplete?: boolean;
  profilePicture?: string;
  state: string;
  city: string;
  country: string;
  zipcode: string;
  address: string;
  address2: string;
  membershipPlanId?: number; // Foreign key to MembershipPlan
  membershipStatus?: 'active' | 'inactive' | 'expired';
  membershipStartDate?: Date;
  membershipEndDate?: Date;
  paymentinformation: string;
  confirm?: boolean;
  IsAdmin?: boolean;
  volunteerHours?: string;
  volunteerStatus?: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

interface MembersAuthCreationAttributes extends Optional<MembersAuthAttributes, 'id' | 'confirm' | 'IsAdmin' | 'createdAt' | 'updatedAt'> {}

export class Auth extends Model<MembersAuthAttributes, MembersAuthCreationAttributes> implements MembersAuthAttributes {
  public id!: number;
  public type!: 'member' | 'volunteer' | 'admin';
  public firstname!: string;
  public lastname!: string;
  public email!: string;
  public mobile!: string;
  public password!: string;
  public authProvider!: 'local' | 'google' | 'facebook';
  public socialId!: string;
  public isProfileComplete!: boolean;
  public profilePicture!: string;
  public state!: string;
  public city!: string;
  public country!: string;
  public zipcode!: string;
  public address!: string;
  public address2!: string;
  public membershipPlanId!: number;
  public membershipStatus!: 'active' | 'inactive' | 'expired';
  public membershipStartDate!: Date;
  public membershipEndDate!: Date;
  public paymentinformation!: string;
  public confirm?: boolean;
  public IsAdmin?: boolean;
  public volunteerHours?: string;
  public volunteerStatus?: 'active' | 'inactive';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}


export function initAuthModel(sequelize: Sequelize) {
  Auth.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: DataTypes.ENUM('member', 'volunteer', 'admin'),
        allowNull: false,
      },
      firstname: { type: DataTypes.STRING },
      lastname: { type: DataTypes.STRING },
      email: { type: DataTypes.STRING, unique: true, allowNull: false },
      mobile: { type: DataTypes.STRING, unique: true, allowNull: true },
      password: { type: DataTypes.STRING, allowNull: true },
      authProvider: {
        type: DataTypes.ENUM('local', 'google', 'facebook'),
        defaultValue: 'local'
      },
      socialId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
      },
      isProfileComplete: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      profilePicture: {
        type: DataTypes.STRING,
        allowNull: true
      },
      state: { type: DataTypes.STRING },
      city: { type: DataTypes.STRING },
      country: { type: DataTypes.STRING },
      zipcode: { type: DataTypes.STRING },
      address: { type: DataTypes.STRING },
      address2: { type: DataTypes.STRING },
      membershipPlanId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'membership_plans',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      membershipStatus: {
        type: DataTypes.ENUM('active', 'inactive', 'expired'),
        defaultValue: 'inactive',
        get() {
          const startDate = this.getDataValue('membershipStartDate');
          const endDate = this.getDataValue('membershipEndDate');
          const now = new Date();

          if (!startDate || !endDate) {
            return 'inactive';
          }
          
          const start = new Date(startDate);
          const end = new Date(endDate);

          if (now < start) {
            return 'inactive';
          }
          
          if (now > end) {
            return 'expired';
          }

          return 'active';
        }
      },
      membershipStartDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      membershipEndDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      paymentinformation: { type: DataTypes.STRING },
      confirm: { type: DataTypes.BOOLEAN, defaultValue: false },
      IsAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
      volunteerHours: { type: DataTypes.STRING, allowNull: true },
      volunteerStatus: { 
        type: DataTypes.ENUM('active', 'inactive'), 
        allowNull: true
      },
    },
    {
      sequelize,
      modelName: 'Auth',
      tableName: 'auth',
      timestamps: true,
      indexes: [
        // Remove redundant indexes for unique fields (email, mobile, socialId) 
        // as Sequelize creates them automatically when unique: true is used.
      ],
    }
  );
  return Auth;
}
