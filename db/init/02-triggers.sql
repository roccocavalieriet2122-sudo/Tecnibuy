-- TecniBuy Database Triggers
-- MariaDB 11+

DELIMITER $$

-- ============================================================
-- AUTO UPDATE updated_at TIMESTAMPS
-- ============================================================

CREATE TRIGGER `trg_users_updated_at`
BEFORE UPDATE ON `users`
FOR EACH ROW
BEGIN
    SET NEW.`updated_at` = CURRENT_TIMESTAMP(3);
END$$

CREATE TRIGGER `trg_categories_updated_at`
BEFORE UPDATE ON `categories`
FOR EACH ROW
BEGIN
    SET NEW.`updated_at` = CURRENT_TIMESTAMP(3);
END$$

CREATE TRIGGER `trg_products_updated_at`
BEFORE UPDATE ON `products`
FOR EACH ROW
BEGIN
    SET NEW.`updated_at` = CURRENT_TIMESTAMP(3);
END$$

-- ============================================================
-- AUDIT LOG TRIGGERS - USERS
-- ============================================================

CREATE TRIGGER `trg_users_audit_insert`
AFTER INSERT ON `users`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_log` (`table_name`, `action`, `entity_id`, `user_id`, `new_data`)
    VALUES ('users', 'INSERT', NEW.`id`, NEW.`id`, JSON_OBJECT(
        'username', NEW.`username`,
        'email', NEW.`email`,
        'role', NEW.`role`,
        'is_active', NEW.`is_active`
    ));
END$$

CREATE TRIGGER `trg_users_audit_update`
AFTER UPDATE ON `users`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_log` (`table_name`, `action`, `entity_id`, `user_id`, `old_data`, `new_data`)
    VALUES ('users', 'UPDATE', NEW.`id`, NEW.`id`, JSON_OBJECT(
        'username', OLD.`username`,
        'email', OLD.`email`,
        'role', OLD.`role`,
        'is_active', OLD.`is_active`
    ), JSON_OBJECT(
        'username', NEW.`username`,
        'email', NEW.`email`,
        'role', NEW.`role`,
        'is_active', NEW.`is_active`
    ));
END$$

CREATE TRIGGER `trg_users_audit_delete`
AFTER DELETE ON `users`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_log` (`table_name`, `action`, `entity_id`, `user_id`, `old_data`)
    VALUES ('users', 'DELETE', OLD.`id`, OLD.`id`, JSON_OBJECT(
        'username', OLD.`username`,
        'email', OLD.`email`,
        'role', OLD.`role`,
        'is_active', OLD.`is_active`
    ));
END$$

-- ============================================================
-- AUDIT LOG TRIGGERS - PRODUCTS
-- ============================================================

CREATE TRIGGER `trg_products_audit_insert`
AFTER INSERT ON `products`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_log` (`table_name`, `action`, `entity_id`, `user_id`, `new_data`)
    VALUES ('products', 'INSERT', NEW.`id`, NEW.`seller_id`, JSON_OBJECT(
        'title', NEW.`title`,
        'price', NEW.`price`,
        'stock', NEW.`stock`,
        'condition', NEW.`condition`,
        'category_id', NEW.`category_id`,
        'status', NEW.`status`
    ));
END$$

CREATE TRIGGER `trg_products_audit_update`
AFTER UPDATE ON `products`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_log` (`table_name`, `action`, `entity_id`, `user_id`, `old_data`, `new_data`)
    VALUES ('products', 'UPDATE', NEW.`id`, NEW.`seller_id`, JSON_OBJECT(
        'title', OLD.`title`,
        'price', OLD.`price`,
        'stock', OLD.`stock`,
        'condition', OLD.`condition`,
        'category_id', OLD.`category_id`,
        'status', OLD.`status`
    ), JSON_OBJECT(
        'title', NEW.`title`,
        'price', NEW.`price`,
        'stock', NEW.`stock`,
        'condition', NEW.`condition`,
        'category_id', NEW.`category_id`,
        'status', NEW.`status`
    ));
END$$

CREATE TRIGGER `trg_products_audit_delete`
AFTER DELETE ON `products`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_log` (`table_name`, `action`, `entity_id`, `user_id`, `old_data`)
    VALUES ('products', 'DELETE', OLD.`id`, OLD.`seller_id`, JSON_OBJECT(
        'title', OLD.`title`,
        'price', OLD.`price`,
        'stock', OLD.`stock`,
        'condition', OLD.`condition`,
        'category_id', OLD.`category_id`,
        'status', OLD.`status`
    ));
END$$

-- ============================================================
-- DATA VALIDATION TRIGGERS
-- ============================================================

CREATE TRIGGER `trg_products_validate_insert`
BEFORE INSERT ON `products`
FOR EACH ROW
BEGIN
    IF NEW.`price` < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Price must be >= 0';
    END IF;
    IF NEW.`stock` < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock must be >= 0';
    END IF;
END$$

CREATE TRIGGER `trg_products_validate_update`
BEFORE UPDATE ON `products`
FOR EACH ROW
BEGIN
    IF NEW.`price` < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Price must be >= 0';
    END IF;
    IF NEW.`stock` < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock must be >= 0';
    END IF;
END$$

CREATE TRIGGER `trg_ratings_validate_insert`
BEFORE INSERT ON `ratings`
FOR EACH ROW
BEGIN
    IF NEW.`rating` < 1 OR NEW.`rating` > 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rating must be between 1 and 5';
    END IF;
END$$

CREATE TRIGGER `trg_ratings_validate_update`
BEFORE UPDATE ON `ratings`
FOR EACH ROW
BEGIN
    IF NEW.`rating` < 1 OR NEW.`rating` > 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rating must be between 1 and 5';
    END IF;
END$$

-- ============================================================
-- CONVERSATION UNIQUE CONSTRAINT HELPER
-- Ensure user_a_id < user_b_id for consistent uniqueness
-- ============================================================

CREATE TRIGGER `trg_conversations_order_users`
BEFORE INSERT ON `conversations`
FOR EACH ROW
BEGIN
    IF NEW.`user_a_id` > NEW.`user_b_id` THEN
        SET @tmp = NEW.`user_a_id`;
        SET NEW.`user_a_id` = NEW.`user_b_id`;
        SET NEW.`user_b_id` = @tmp;
    END IF;
END$$

CREATE TRIGGER `trg_conversations_update_activity`
BEFORE UPDATE ON `conversations`
FOR EACH ROW
BEGIN
    SET NEW.`last_activity` = CURRENT_TIMESTAMP(3);
END$$

DELIMITER ;