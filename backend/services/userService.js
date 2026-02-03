// Simple in-memory user service for development without database
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class UserService {
  constructor() {
    this.users = new Map(); // In-memory storage
    this.nextId = 1;
  }

  // Create a new user
  async create(userData) {
    const { email, phone, password, firstName, lastName } = userData;

    // Check if user already exists
    if (this.users.has(email) || Array.from(this.users.values()).some(u => u.phone === phone)) {
      throw new Error('User already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user object
    const user = {
      id: this.nextId++,
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store user
    this.users.set(email, user);

    return user;
  }

  // Find user by email
  async findByEmail(email) {
    return this.users.get(email) || null;
  }

  // Find user by phone
  async findByPhone(phone) {
    for (const user of this.users.values()) {
      if (user.phone === phone) {
        return user;
      }
    }
    return null;
  }

  // Verify password
  async verifyPassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }

  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  // Get user profile
  toProfile(user) {
    const { password, ...profile } = user;
    return profile;
  }

  // Update user
  async update(userId, updateData) {
    for (const [email, user] of this.users.entries()) {
      if (user.id === userId) {
        const updatedUser = {
          ...user,
          ...updateData,
          updatedAt: new Date(),
        };
        this.users.set(email, updatedUser);
        return updatedUser;
      }
    }
    throw new Error('User not found');
  }
}

module.exports = new UserService();