import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface HomepageHighlightAttributes {
    id?: number;
    eventName: string;
    highlightText: string;
    CloudFile?: {
        image: string;
        imagePublicId: string;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

interface HomepageHighlightCreationAttributes extends Optional<HomepageHighlightAttributes, 'id' | 'CloudFile' | 'createdAt' | 'updatedAt'> { }

export class HomepageHighlight extends Model<HomepageHighlightAttributes, HomepageHighlightCreationAttributes> implements HomepageHighlightAttributes {
    public id!: number;
    public eventName!: string;
    public highlightText!: string;
    public CloudFile?: { image: string; imagePublicId: string };
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

export function initHomepageHighlightModel(sequelize: Sequelize) {
    HomepageHighlight.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            eventName: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            highlightText: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            CloudFile: {
                type: DataTypes.JSON,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'HomepageHighlight',
            tableName: 'homepageHighlight',
            timestamps: true,
        }
    );
    return HomepageHighlight;
}
