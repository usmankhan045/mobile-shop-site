ALTER TABLE admins ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE admins
SET username = lower(split_part(email, '@', 1))
WHERE username IS NULL;

ALTER TABLE admins ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admins_username_idx ON admins(username);
