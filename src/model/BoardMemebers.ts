import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface BoardMembersAttributes {
  id?: number;
  year: string;
  firstname: string;
  lastname: string;
  role: string;
  CloudFile: { image: string; imagePublicId: string };
  createdAt?: Date;
  updatedAt?: Date;
}

interface BoardMembersCreationAttributes extends Optional<BoardMembersAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class BoardMembers extends Model<BoardMembersAttributes, BoardMembersCreationAttributes> implements BoardMembersAttributes {
  public id!: number;
  public year!: string;
  public firstname!: string;
  public lastname!: string;
  public role!: string;
  public CloudFile!: { image: string; imagePublicId: string };
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}


export function initBoardMembersModel(sequelize: Sequelize) {
  BoardMembers.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      year: { type: DataTypes.STRING, allowNull: false },
      firstname: { type: DataTypes.STRING, allowNull: false },
      lastname: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.STRING, allowNull: false },
      CloudFile: { type: DataTypes.JSON, allowNull: false },
    },
    {
      sequelize,
      modelName: 'BoardMembers',
      tableName: 'boardmembers',
      timestamps: true,
      indexes: [
        { fields: ['year', 'role'] },
      ],
    }
  );
  return BoardMembers;
}
