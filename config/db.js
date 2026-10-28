const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing. Add it to your .env file (see .env.example).');
  }

  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri).catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }

  await connectionPromise;
}

module.exports = connectDB;
