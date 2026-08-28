const { query } = require("../config/db");
const { hashPassword, comparePassword, signToken, VALID_ROLES } = require("../utils/authUtils");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Self-service registration, but only for the 'viewer' and 'operator' roles.
 * Admin accounts must be created via the seed script (see
 * backend/src/db/seedAdmin.js) or promoted by an existing admin — nobody
 * should be able to grant themselves admin over a public endpoint.
 */
async function register(req, res, next) {
  try {
    const { email, password, role = "viewer" } = req.body;

    if (!isValidEmail(email)) {
      const err = new Error("A valid email is required");
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }
    if (!password || String(password).length < 8) {
      const err = new Error("Password must be at least 8 characters");
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }
    if (!["viewer", "operator"].includes(role)) {
      const err = new Error("role must be 'viewer' or 'operator' for self-registration");
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) {
      const err = new Error("An account with this email already exists");
      err.status = 409;
      err.publicMessage = err.message;
      throw err;
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id, email, role, created_at`,
      [email.toLowerCase(), passwordHash, role]
    );
    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email) || !password) {
      const err = new Error("email and password are required");
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }

    const result = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];

    // Deliberately identical error for "no such user" and "wrong password"
    // so login can't be used to enumerate valid emails.
    const invalidCredsErr = () => {
      const err = new Error("Invalid email or password");
      err.status = 401;
      err.publicMessage = err.message;
      return err;
    };

    if (!user) throw invalidCredsErr();
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw invalidCredsErr();

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      success: true,
      data: { user: { id: user.id, email: user.email, role: user.role }, token },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ success: true, data: req.user });
}

module.exports = { register, login, me, VALID_ROLES };
