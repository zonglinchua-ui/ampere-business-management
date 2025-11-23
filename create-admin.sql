INSERT INTO "User" (
  id,
  name,
  email,
  password,
  role,
  "createdAt",
  "updatedAt"
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Super Admin',
  'zonglin.chua@ampere.com',
  '$2a$12$EixZaYVK1fsbw1ZfbX3OXe.PVqGqGaWXBJgp7wa9u0J7pKnz03WxO', -- password: admin123
  'SUPERADMIN',
  NOW(),
  NOW()
);
