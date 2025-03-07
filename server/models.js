const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite')
});

const Website = sequelize.define('Website', {
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

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        
        // 使用alter: true更新数据库表结构
        await Website.sync({ alter: true });
        console.log('Website model synchronized successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

module.exports = {
    Website,
    initDatabase
};
