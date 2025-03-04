const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite'
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
    }
});

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        await Website.sync();
        console.log('Website model synchronized successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

module.exports = {
    Website,
    initDatabase
};
