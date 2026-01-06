import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface GalleryAttributes {
  id?: number;
  year: string;
  title: string;
  mediaType: 'photos' | 'videos';
  CloudFile: { image: string; imagePublicId: string }[];
  youtubelink?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GalleryCreationAttributes extends Optional<GalleryAttributes, 'id' | 'youtubelink' | 'createdAt' | 'updatedAt'> { }

export class Gallery extends Model<GalleryAttributes, GalleryCreationAttributes> implements GalleryAttributes {
  public id!: number;
  public year!: string;
  public title!: string;
  public mediaType!: 'photos' | 'videos';
  public CloudFile!: { image: string; imagePublicId: string }[];
  public youtubelink?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initGalleryModel(sequelize: Sequelize) {
  Gallery.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      year: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      mediaType: { type: DataTypes.ENUM('photos', 'videos'), allowNull: false },
      CloudFile: { type: DataTypes.JSON, allowNull: false },
      youtubelink: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Gallery',
      tableName: 'gallery',
      timestamps: true,
      indexes: [
        { fields: ['year'] },
      ],
    }
  );
  return Gallery;
}
