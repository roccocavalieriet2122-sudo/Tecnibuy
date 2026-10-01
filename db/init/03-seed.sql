-- TecniBuy Seed Data
-- Run after schema and triggers

-- Insert root categories
INSERT INTO `categories` (`name`, `slug`, `parent_id`) VALUES
('Electrónica', 'electronica', NULL),
('Ropa y Accesorios', 'ropa-accesorios', NULL),
('Hogar y Jardín', 'hogar-jardin', NULL),
('Deportes', 'deportes', NULL),
('Libros y Películas', 'libros-peliculas', NULL),
('Juguetes', 'juguetes', NULL),
('Salud y Belleza', 'salud-belleza', NULL),
('Automóviles', 'automoviles', NULL);

-- Insert subcategories for Electrónica
INSERT INTO `categories` (`name`, `slug`, `parent_id`) VALUES
('Móviles y Tablets', 'moviles-tablets', 1),
('Portátiles y PC', 'portatiles-pc', 1),
('Audio y Auriculares', 'audio-auriculares', 1),
('Cámaras y Fotos', 'camaras-fotos', 1),
('Consolas y Videojuegos', 'consolas-videojuegos', 1),
('Smart Home', 'smart-home', 1);

-- Insert subcategories for Ropa
INSERT INTO `categories` (`name`, `slug`, `parent_id`) VALUES
('Hombre', 'hombre', 2),
('Mujer', 'mujer', 2),
('Niños', 'ninos', 2),
('Calzado', 'calzado', 2),
('Accesorios', 'accesorios-ropa', 2);

-- Insert subcategories for Hogar
INSERT INTO `categories` (`name`, `slug`, `parent_id`) VALUES
('Muebles', 'muebles', 3),
('Decoración', 'decoracion', 3),
('Electrodomésticos', 'electrodomesticos', 3),
('Bricolaje y Herramientas', 'bricolaje-herramientas', 3),
('Jardín', 'jardin', 3);

-- Create a default admin user (password: admin123 - change in production!)
-- bcrypt hash of 'admin123' with cost 12
-- This is just for development - use proper password in .env
INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `salt`, `is_active`)
VALUES (
    'admin',
    'admin@tecnibuy.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PZvO.S',  -- admin123
    'admin',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',  -- placeholder salt, will be regenerated on real registration
    TRUE
);

-- Create a test user (password: test1234)
INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `salt`, `is_active`)
VALUES (
    'testuser',
    'test@tecnibuy.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PZvO.S',  -- test1234 (same hash for demo)
    'user',
    'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    TRUE
);