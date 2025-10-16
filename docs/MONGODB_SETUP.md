# MongoDB Authentication Setup

This document explains how to configure MongoDB authentication for the Voting App.

## MongoDB Configuration Options

The application supports two ways to connect to MongoDB:

### Option 1: Direct Connection URI
Use the `MONGODB_URI` environment variable with a complete connection string:

```bash
# For local development without authentication
MONGODB_URI=mongodb://localhost:27017/voting-app

# For authenticated connection
MONGODB_URI=mongodb://username:password@localhost:27017/voting-app?authSource=admin

# For MongoDB Atlas or cloud services
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/voting-app?retryWrites=true&w=majority
```

### Option 2: Individual Components
Use separate environment variables for each connection parameter:

```bash
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=voting-app
MONGODB_USERNAME=your-username
MONGODB_PASSWORD=your-password
MONGODB_AUTH_DATABASE=admin
```

**Note:** If you use Option 2, make sure to comment out or remove the `MONGODB_URI` variable.

## Setting Up MongoDB with Authentication

### 1. Local MongoDB Setup

#### Install MongoDB
```bash
# macOS with Homebrew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community
```

#### Create Admin User
```javascript
// Connect to MongoDB shell
mongosh

// Switch to admin database
use admin

// Create admin user
db.createUser({
  user: "admin",
  pwd: "your-secure-password",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})
```

#### Create Application User
```javascript
// Create a specific user for the voting app
use voting-app
db.createUser({
  user: "voting-user",
  pwd: "voting-password",
  roles: [
    { role: "readWrite", db: "voting-app" }
  ]
})
```

#### Enable Authentication
Edit your MongoDB configuration file (usually `/usr/local/etc/mongod.conf`):

```yaml
security:
  authorization: enabled
```

Then restart MongoDB:
```bash
brew services restart mongodb-community
```

### 2. Update Environment Variables

For the application user created above, update your `.env` file:

```bash
# Comment out the direct URI
# MONGODB_URI=mongodb://localhost:27017/voting-app

# Use individual components with authentication
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=voting-app
MONGODB_USERNAME=voting-user
MONGODB_PASSWORD=voting-password
MONGODB_AUTH_DATABASE=voting-app
```

### 3. MongoDB Atlas (Cloud)

If using MongoDB Atlas:

1. Create a cluster on [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a database user with read/write permissions
3. Whitelist your IP address
4. Get the connection string from Atlas
5. Update your `.env` file:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/voting-app?retryWrites=true&w=majority
```

## Testing the Connection

Start your application and check for successful connection:

```bash
npm run dev
```

Look for the console message:
```
MongoDB connected: your-mongodb-host
Default admin user created
Server is running on port 9099
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**: Ensure username/password are correct and the user exists in the specified auth database.

2. **Connection Refused**: Make sure MongoDB is running and listening on the correct port.

3. **Database Not Found**: The database will be created automatically when you first write data.

4. **Special Characters in Password**: If your password contains special characters, they need to be URL-encoded when using a connection string.

### Connection Test

You can test the MongoDB connection separately:

```javascript
const mongoose = require('mongoose');

// Test connection
const testConnection = async () => {
  try {
    await mongoose.connect('your-mongodb-uri');
    console.log('✅ MongoDB connection successful');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
};

testConnection();
```

## Security Best Practices

1. **Strong Passwords**: Use strong, unique passwords for MongoDB users
2. **Least Privilege**: Create application-specific users with minimal required permissions
3. **Environment Variables**: Never commit credentials to version control
4. **Network Security**: Use firewalls and IP whitelisting in production
5. **SSL/TLS**: Enable SSL/TLS for production deployments
6. **Regular Updates**: Keep MongoDB updated to the latest stable version
