const { Sequelize } = require('sequelize');

const conectarDB = async () => {
  try {
    // Verifica que la conexión con la base de datos se ha establecido correctamente.
    await sequelize.authenticate();
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error);
  }
};

module.exports = { sequelize, conectarDB };