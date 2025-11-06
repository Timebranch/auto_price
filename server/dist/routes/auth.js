"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../models/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// 用户注册
router.post('/register', (req, res) => {
    const { username, email, phone, password, fullName } = req.body;
    // 验证必填字段（邮箱非必填，手机号可选）
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码为必填项' });
    }
    // 检查用户名/邮箱/手机号是否已存在
    const emailNormalized = (typeof email === 'string' && email.trim().length > 0)
        ? email.trim()
        : `${String(username).trim()}@noemail.local`;
    database_1.db.get('SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?', [username, emailNormalized, phone || ''], (err, existingUser) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        if (existingUser) {
            return res.status(400).json({ error: '用户名、邮箱或手机号已存在' });
        }
        // 加密密码
        const hashedPassword = bcryptjs_1.default.hashSync(password, 10);
        // 创建新用户（email/phone 可为空字符串）
        database_1.db.run(`INSERT INTO users (username, email, phone, password_hash, full_name, role, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [username, emailNormalized, phone || '', hashedPassword, fullName || '', 'sales', 1], function (err) {
            if (err) {
                return res.status(500).json({ error: '创建用户失败' });
            }
            // 生成JWT令牌
            const token = (0, auth_1.generateToken)(this.lastID, username, 'sales');
            res.status(201).json({
                message: '注册成功',
                token,
                user: {
                    id: this.lastID,
                    username,
                    email: emailNormalized,
                    phone: phone || '',
                    fullName: fullName || '',
                    role: 'sales'
                }
            });
        });
    });
});
// 用户登录
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码为必填项' });
    }
    // 查找用户（支持用户名、邮箱或手机号）
    database_1.db.get('SELECT id, username, email, phone, password_hash, full_name, role, is_active FROM users WHERE username = ? OR email = ? OR phone = ?', [username, username, username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        if (!user.is_active) {
            return res.status(401).json({ error: '账户已被禁用' });
        }
        // 验证密码
        if (!bcryptjs_1.default.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        // 生成JWT令牌
        const token = (0, auth_1.generateToken)(user.id, user.username, user.role);
        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                fullName: user.full_name,
                role: user.role
            }
        });
    });
});
// 获取当前用户信息
router.get('/me', auth_1.authenticateToken, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '未认证' });
    }
    // 获取完整用户信息
    database_1.db.get('SELECT id, username, email, phone, full_name, avatar_url, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                fullName: user.full_name,
                avatarUrl: user.avatar_url,
                role: user.role,
                createdAt: user.created_at
            }
        });
    });
});
// 更新用户信息
router.put('/profile', auth_1.authenticateToken, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: '未认证' });
    }
    const { fullName, email, phone } = req.body;
    if (!fullName && !email && !phone) {
        return res.status(400).json({ error: '至少需要提供一个要更新的字段' });
    }
    let updateFields = [];
    let updateValues = [];
    if (fullName) {
        updateFields.push('full_name = ?');
        updateValues.push(fullName);
    }
    if (email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(email || '');
    }
    if (phone !== undefined) {
        updateFields.push('phone = ?');
        updateValues.push(phone || '');
    }
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.user.id);
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    database_1.db.run(sql, updateValues, function (err) {
        if (err) {
            return res.status(500).json({ error: '更新用户信息失败' });
        }
        res.json({ message: '用户信息更新成功' });
    });
});
exports.default = router;
//# sourceMappingURL=auth.js.map