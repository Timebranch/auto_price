"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.requireAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../models/database");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// JWT认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({ error: '访问令牌缺失' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: '无效的访问令牌' });
        }
        // 验证用户是否仍然存在且活跃
        database_1.db.get('SELECT id, username, email, role, phone, is_active FROM users WHERE id = ? AND is_active = 1', [decoded.userId], (dbErr, user) => {
            if (dbErr) {
                return res.status(500).json({ error: '数据库错误' });
            }
            if (!user) {
                return res.status(403).json({ error: '用户不存在或已被禁用' });
            }
            req.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                phone: user.phone
            };
            next();
        });
    });
};
exports.authenticateToken = authenticateToken;
// 管理员权限检查中间件
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: '未认证' });
    }
    // 允许 admin 与 finance 访问管理员接口
    if (req.user.role !== 'admin' && req.user.role !== 'finance') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};
exports.requireAdmin = requireAdmin;
// 生成JWT令牌
const generateToken = (userId, username, role) => {
    return jsonwebtoken_1.default.sign({ userId, username, role }, JWT_SECRET, { expiresIn: '24h' });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.js.map