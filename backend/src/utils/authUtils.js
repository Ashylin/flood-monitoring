/**
 * Pure(ish) auth helpers, kept separate from Express so they're trivial to
 * unit test without spinning up a server, DB, or Redis.
 */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "12h";

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function signToken(payload, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.verify(token, secret);
}

const VALID_ROLES = ["admin", "operator", "viewer"];

module.exports = { hashPassword, comparePassword, signToken, verifyToken, VALID_ROLES };
