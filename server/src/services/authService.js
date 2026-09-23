import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'expenseflow_super_secret_jwt_key_development_2026';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

export const hashPassword = async (password) => {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export default {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
};
