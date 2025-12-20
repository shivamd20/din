PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
-- Migrate User Table
CREATE TABLE user_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    isAnonymous INTEGER DEFAULT 0
);
INSERT INTO user_new (id, name, email, emailVerified, image, createdAt, updatedAt)
SELECT id, name, email, emailVerified, image, createdAt, updatedAt FROM user;
DROP TABLE user;
ALTER TABLE user_new RENAME TO user;
COMMIT;
PRAGMA foreign_keys=ON;
