const knex = require('knex');
const knexConfig = require('../knexfile');
const config = require('./config');

const env = config.NODE_ENV === 'production' ? 'production' : 'development';
const db = knex(knexConfig[env] || knexConfig.development);

module.exports = db;
