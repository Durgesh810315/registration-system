CREATE DATABASE IF NOT EXISTS registration_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE registration_system;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  father_name VARCHAR(120) NOT NULL,
  mother_name VARCHAR(120) NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('male','female','other','prefer_not_to_say') NOT NULL,
  email VARCHAR(254) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  alternate_mobile VARCHAR(20) NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  pin_code VARCHAR(12) NOT NULL,
  education VARCHAR(120) NOT NULL,
  occupation VARCHAR(120) NOT NULL,
  username VARCHAR(40) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_photo_path VARCHAR(255) NULL,
  account_status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_mobile (mobile),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_created_at (created_at),
  KEY idx_users_education (education),
  KEY idx_users_status (account_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner','admin') NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
) ENGINE=InnoDB;
