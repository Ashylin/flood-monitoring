const { verifyToken } = require("../utils/authUtils");

/**
 * Verifies a Bearer JWT and attaches req.user = { id, email, role }.
 * If `allowedRoles` is given, rejects with 403 unless the user's role is
 * in that list. Usage: requireAuth() for "any logged-in user",
 * requireAuth(['admin']) for admin-only, requireAuth(['admin','operator'])
 * for either.
 */
function requireAuth(allowedRoles = null) {
  return (req, res, next) => {
    const header = req.header("Authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      const err = new Error("Missing or malformed Authorization header (expected 'Bearer <token>')");
      err.status = 401;
      err.publicMessage = err.message;
      return next(err);
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      const err = new Error("Invalid or expired token");
      err.status = 401;
      err.publicMessage = err.message;
      return next(err);
    }

    if (allowedRoles && !allowedRoles.includes(payload.role)) {
      const err = new Error(`This action requires one of these roles: ${allowedRoles.join(", ")}`);
      err.status = 403;
      err.publicMessage = err.message;
      return next(err);
    }

    req.user = payload;
    return next();
  };
}

module.exports = { requireAuth };
