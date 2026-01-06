import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface EventsAttributes {
  id?: number;
  Eventtitle: string;
  Eventdate: string;
  Eventtime: string;
  Eventvenue: string;
  EventDescription: string;
  CloudFile?: {
    image: string;
    imagePublicId: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

interface EventsCreationAttributes extends Optional<EventsAttributes, 'id' | 'CloudFile' | 'createdAt' | 'updatedAt'> {}

export class Events extends Model<EventsAttributes, EventsCreationAttributes> implements EventsAttributes {
  public id!: number;
  public Eventtitle!: string;
  public Eventdate!: string;
  public Eventtime!: string;
  public Eventvenue!: string;
  public EventDescription!: string;
  public CloudFile?: { image: string; imagePublicId: string };
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}


export function initEventsModel(sequelize: Sequelize) {
  Events.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      Eventtitle: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Eventdate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Eventtime: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Eventvenue: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      EventDescription: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      CloudFile: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Events',
      tableName: 'events',
      timestamps: true,
    }
  );
  return Events;
}
