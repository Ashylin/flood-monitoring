process.env.JWT_SECRET = "test-secret-do-not-use-in-production";

const { hashPassword, comparePassword, signToken, verifyToken } = require("../src/utils/authUtils");

describe("password hashing", () => {
  test("hashes a password and can verify it back", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    await expect(comparePassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  test("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(comparePassword("wrong password", hash)).resolves.toBe(false);
  });

  test("two hashes of the same password are different (salted)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("JWT signing/verification", () => {
  test("signs a token and verifies it back to the same payload fields", () => {
    const token = signToken({ id: 1, email: "a@b.com", role: "admin" });
    const payload = verifyToken(token);
    expect(payload.id).toBe(1);
    expect(payload.email).toBe("a@b.com");
    expect(payload.role).toBe("admin");
  });

  test("throws on a tampered/invalid token", () => {
    const token = signToken({ id: 1, email: "a@b.com", role: "admin" });
    expect(() => verifyToken(token + "tampered")).toThrow();
  });

  test("throws when JWT_SECRET is missing", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => signToken({ id: 1 })).toThrow("JWT_SECRET is not configured");
    process.env.JWT_SECRET = original;
  });
});
