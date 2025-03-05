const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// 定义Website模型
let Website;

// 初始化数据库
function initDatabase(sequelizeInstance) {
  // 如果已经传入Sequelize实例，使用它
  const sequelize = sequelizeInstance || new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database', 'websites.db'),
    logging: false
  });

  // 定义Website模型
  Website = sequelize.define('Website', {
    domain: {
      type: DataTypes.STRING,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lastCheck: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isAccessible: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    sslStatus: {
      type: DataTypes.STRING,
      allowNull: false
    },
    protocol: {
      type: DataTypes.STRING,
      allowNull: false
    },
    error: {
      type: DataTypes.STRING,
      allowNull: true
    },
    certificateInfo: {
      type: DataTypes.JSON,
      allowNull: true
    },
    responseTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  });

  // 使用alter: true更新数据库表结构
  sequelize.sync({ alter: true });

  return {
    Website,
    sequelize
  };
};

module.exports = initDatabase;
