-- TecniBuy Database Schema
-- MariaDB 11+ with utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS `TECNIBUY`;
CREATE DATABASE `TECNIBUY` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `TECNIBUY`;
-- Users table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `email` VARCHAR(100) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) DEFAULT 'user' NOT NULL,
    `salt` VARCHAR(32) NOT NULL,
    `pubkey` LONGBLOB NULL,
    `points` INT DEFAULT 0,
    `avatar` VARCHAR(255) NULL,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) NOT NULL,
    `is_active` BOOLEAN DEFAULT TRUE NOT NULL,
    INDEX `idx_users_username` (`username`),
    INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories table (self-referencing for tree structure)
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) UNIQUE NOT NULL,
    `parent_id` INT NULL,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) NOT NULL,
    INDEX `idx_categories_slug` (`slug`),
    INDEX `idx_categories_parent` (`parent_id`),
    FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products table
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `seller_id` INT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `stock` INT DEFAULT 1 NOT NULL,
    `condition` ENUM('new', 'used', 'refurbished') DEFAULT 'used' NOT NULL,
    `category_id` INT NOT NULL,
    `status` ENUM('active', 'sold', 'deleted') DEFAULT 'active' NOT NULL,
    `views` INT DEFAULT 0,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) NOT NULL,
    INDEX `idx_products_seller` (`seller_id`),
    INDEX `idx_products_category` (`category_id`),
    INDEX `idx_products_status` (`status`),
    INDEX `idx_products_created` (`created_at`),
    FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product images table
CREATE TABLE IF NOT EXISTS `product_images` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `object_key` VARCHAR(255) NOT NULL,
    `alt` VARCHAR(200) NULL,
    `position` INT DEFAULT 0,
    INDEX `idx_product_images_product` (`product_id`),
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ratings table
CREATE TABLE IF NOT EXISTS `ratings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `rating` TINYINT NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
    `comment` TEXT NULL,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    UNIQUE KEY `uq_product_user_rating` (`product_id`, `user_id`),
    INDEX `idx_ratings_product` (`product_id`),
    INDEX `idx_ratings_user` (`user_id`),
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversations table
CREATE TABLE IF NOT EXISTS `conversations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_a_id` INT NOT NULL,
    `user_b_id` INT NOT NULL,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `last_activity` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) NOT NULL,
    UNIQUE KEY `uq_conversation_users` (`user_a_id`, `user_b_id`),
    INDEX `idx_conversations_user_a` (`user_a_id`),
    INDEX `idx_conversations_user_b` (`user_b_id`),
    INDEX `idx_conversations_activity` (`last_activity`),
    FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages table (E2E encrypted)
CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` INT NOT NULL,
    `sender_id` INT NOT NULL,
    `recipient_id` INT NOT NULL,
    `ciphertext` LONGBLOB NOT NULL,
    `nonce` VARBINARY(12) NOT NULL,
    `sender_pubkey_ref` CHAR(64) NOT NULL COMMENT 'SHA-256 hex of sender public key',
    `meta_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hex of metadata for tamper detection',
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    INDEX `idx_messages_conversation` (`conversation_id`),
    INDEX `idx_messages_sender` (`sender_id`),
    INDEX `idx_messages_recipient` (`recipient_id`),
    INDEX `idx_messages_created` (`created_at`),
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log table
CREATE TABLE IF NOT EXISTS `audit_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `table_name` VARCHAR(50) NOT NULL,
    `action` VARCHAR(10) NOT NULL COMMENT 'INSERT, UPDATE, DELETE',
    `entity_id` INT NOT NULL,
    `user_id` INT NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    INDEX `idx_audit_table_entity` (`table_name`, `entity_id`),
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_created` (`created_at`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `token_hash` CHAR(64) UNIQUE NOT NULL COMMENT 'SHA-256 hex of raw token',
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    INDEX `idx_refresh_user` (`user_id`),
    INDEX `idx_refresh_expires` (`expires_at`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;