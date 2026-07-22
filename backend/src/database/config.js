const path = require('path');
require('dotenv').config();

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'database.sqlite'),
    logging: console.log,
  },
  test: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'database.test.sqlite'),
    logging: false,
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false,
  },
};
