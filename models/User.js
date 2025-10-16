const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const saltRounds = 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

class User {
  static async create({ username, email, password, role = 'user' }) {
    // Check if user already exists
    const existingUser = await UserModel.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      throw new Error('User with this username or email already exists');
    }

    const user = new UserModel({
      username,
      email,
      password,
      role
    });

    await user.save();
    return user;
  }

  static async findById(id) {
    return await UserModel.findById(id);
  }

  static async findByUsername(username) {
    return await UserModel.findOne({ username });
  }

  static async findByEmail(email) {
    return await UserModel.findOne({ email });
  }

  static async findAll() {
    return await UserModel.find({});
  }

  static async findAllUsers() {
    return await UserModel.find({ role: 'user' });
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async deleteById(id) {
    return await UserModel.findByIdAndDelete(id);
  }

  // Initialize default admin user
  static async initializeDefaultAdmin() {
    try {
      const adminExists = await UserModel.findOne({ username: 'admin' });
      if (!adminExists) {
        const admin = new UserModel({
          username: 'admin',
          email: 'admin@voting-app.com',
          password: 'admin123', // Will be hashed by pre-save middleware
          role: 'admin'
        });
        await admin.save();
        console.log('Default admin user created');
      }
    } catch (error) {
      console.error('Error creating default admin:', error.message);
    }
  }
}

const UserModel = mongoose.model('User', userSchema);

module.exports = User;
