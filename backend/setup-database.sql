-- Create database for DVTech AI application
CREATE DATABASE IF NOT EXISTS dvtech_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Optional: Create a dedicated user for this app (recommended)
-- Uncomment the lines below if you want a separate user
-- CREATE USER IF NOT EXISTS 'dvtech'@'localhost' IDENTIFIED BY '';
-- GRANT ALL PRIVILEGES ON dvtech_ai.* TO 'dvtech'@'localhost';
-- FLUSH PRIVILEGES;

-- Show confirmation
SELECT 'Database dvtech_ai created successfully!' AS message;
