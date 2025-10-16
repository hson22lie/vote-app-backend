const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Build MongoDB connection string with authentication
    let mongoURI;
    
    if (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD) {
      // Authenticated connection
      const host = process.env.MONGODB_HOST || 'localhost';
      const port = process.env.MONGODB_PORT || '27017';
      const database = process.env.MONGODB_DATABASE || 'voting-app';
      const authDatabase = process.env.MONGODB_AUTH_DATABASE || 'admin';
      
      mongoURI = `mongodb://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@${host}:${port}/${database}?authSource=${authDatabase}`;
    } else if (process.env.MONGODB_URI) {
      // Use direct URI if provided
      mongoURI = process.env.MONGODB_URI;
    } else {
      // Default local connection without auth
      mongoURI = 'mongodb://localhost:27017/voting-app';
    }
    
    await mongoose.connect(mongoURI);

    console.log(`MongoDB connected: ${mongoose.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
