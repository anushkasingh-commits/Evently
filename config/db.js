const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Configure it in your environment variables.'
    );
  }

  mongoose.set('strictQuery', true);

  // Already connected
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Connection is already being established
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  connectionPromise = mongoose.connect(uri)
    .then(() => {
      console.log('✓ MongoDB connected');
    })
    .catch((err) => {
      connectionPromise = null;
      throw err;
    });

  await connectionPromise;
}

module.exports = connectDB;