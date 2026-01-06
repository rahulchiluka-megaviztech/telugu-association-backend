import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface NewsAttributes {
    id?: number;
    description: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface NewsCreationAttributes extends Optional<NewsAttributes, 'id' | 'createdAt' | 'updatedAt'> { }

export class News extends Model<NewsAttributes, NewsCreationAttributes> implements NewsAttributes {
    public id!: number;
    public description!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

export function initNewsModel(sequelize: Sequelize) {
    News.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
        },
        {
            sequelize,
            modelName: 'News',
            tableName: 'news',
            timestamps: true,
        }
    );
    return News;
}
