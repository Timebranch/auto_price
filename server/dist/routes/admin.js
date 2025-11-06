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
// 管理员：获取用户列表
router.get('/users', auth_1.authenticateToken, auth_1.requireAdmin, (req, res) => {
    database_1.db.all('SELECT id, username, email, phone, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: '获取用户列表失败' });
        }
        res.json(rows);
    });
});
// 管理员：创建新用户（默认角色 user）
router.post('/users', auth_1.authenticateToken, auth_1.requireAdmin, (req, res) => {
    const { username, phone, email, password, fullName, role } = req.body;
    if (!username || !phone || !password) {
        return res.status(400).json({ error: '用户名、手机号和密码为必填项' });
    }
    // 检查是否存在（用户名或手机号唯一）
    const emailNormalized = (typeof email === 'string' && email.trim().length > 0)
        ? email.trim()
        : `${String(username).trim()}@noemail.local`;
    database_1.db.get('SELECT id FROM users WHERE username = ? OR phone = ? OR email = ?', [username, phone, emailNormalized], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        if (existing) {
            return res.status(400).json({ error: '用户名、手机号或邮箱已存在' });
        }
        const hashedPassword = bcryptjs_1.default.hashSync(password, 10);
        database_1.db.run(`INSERT INTO users (username, email, phone, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`, [username, emailNormalized, phone, hashedPassword, fullName || '', role === 'admin' ? 'admin' : role === 'finance' ? 'finance' : role === 'technician' ? 'technician' : 'sales'], function (insertErr) {
            if (insertErr) {
                return res.status(500).json({ error: '创建用户失败' });
            }
            res.status(201).json({
                message: '创建用户成功',
                user: {
                    id: this.lastID,
                    username,
                    email: emailNormalized,
                    phone,
                    fullName: fullName || '',
                    role: role === 'admin' ? 'admin' : role === 'finance' ? 'finance' : role === 'technician' ? 'technician' : 'sales',
                    is_active: 1,
                },
            });
        });
    });
});
// 管理员：禁用用户（软删除）
router.delete('/users/:id', auth_1.authenticateToken, auth_1.requireAdmin, (req, res) => {
    const { id } = req.params;
    database_1.db.run('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: '禁用用户失败' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json({ message: '用户已禁用' });
    });
});
// 管理员：启用用户
router.put('/users/:id/activate', auth_1.authenticateToken, auth_1.requireAdmin, (req, res) => {
    const { id } = req.params;
    database_1.db.run('UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: '启用用户失败' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json({ message: '用户已启用' });
    });
});
// 管理员：更新用户角色
router.put('/users/:id/role', auth_1.authenticateToken, auth_1.requireAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user' && role !== 'sales' && role !== 'finance' && role !== 'technician') {
        return res.status(400).json({ error: '角色不合法' });
    }
    database_1.db.run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, id], function (err) {
        if (err) {
            return res.status(500).json({ error: '更新用户角色失败' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json({ message: '用户角色已更新' });
    });
});
// 管理员：更新用户信息（用户名、手机号、邮箱、姓名，可选重置密码）
router.put('/users/:id', auth_1.authenticateToken, auth_1.requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, phone, email, fullName, password } = req.body;
    // 至少提供一个可更新字段
    if (!username && !phone && !email && !fullName && !password) {
        return res.status(400).json({ error: '未提供任何可更新字段' });
    }
    // 读取当前用户
    database_1.db.get('SELECT id, username, email, phone, full_name FROM users WHERE id = ?', [id], (getErr, user) => {
        if (getErr) {
            return res.status(500).json({ error: '数据库错误' });
        }
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        const nextUsername = typeof username === 'string' && username.trim().length > 0 ? username.trim() : user.username;
        const nextPhone = typeof phone === 'string' ? phone.trim() : (user.phone || '');
        let nextEmail;
        if (typeof email === 'string') {
            const e = email.trim();
            nextEmail = e.length > 0 ? e : `${nextUsername}@noemail.local`;
        }
        else {
            nextEmail = user.email;
        }
        const nextFullName = typeof fullName === 'string' ? fullName.trim() : user.full_name;
        // 唯一性检查（除自身外）
        database_1.db.get('SELECT id FROM users WHERE id != ? AND (username = ? OR phone = ? OR email = ?)', [id, nextUsername, nextPhone, nextEmail], (uniqueErr, conflict) => {
            if (uniqueErr) {
                return res.status(500).json({ error: '数据库错误' });
            }
            if (conflict) {
                return res.status(400).json({ error: '用户名、手机号或邮箱已存在' });
            }
            // 构造更新语句
            const fields = [];
            const params = [];
            if (nextUsername !== user.username) {
                fields.push('username = ?');
                params.push(nextUsername);
            }
            if (nextPhone !== user.phone) {
                fields.push('phone = ?');
                params.push(nextPhone);
            }
            if (nextEmail !== user.email) {
                fields.push('email = ?');
                params.push(nextEmail);
            }
            if (nextFullName !== user.full_name) {
                fields.push('full_name = ?');
                params.push(nextFullName);
            }
            if (typeof password === 'string' && password.trim().length > 0) {
                const hashed = bcryptjs_1.default.hashSync(password.trim(), 10);
                fields.push('password_hash = ?');
                params.push(hashed);
            }
            if (fields.length === 0) {
                return res.json({ message: '信息未变更' });
            }
            const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            params.push(id);
            database_1.db.run(sql, params, function (updErr) {
                if (updErr) {
                    return res.status(500).json({ error: '更新用户信息失败' });
                }
                res.json({ message: '用户信息已更新' });
            });
        });
    });
});
exports.default = router;
//# sourceMappingURL=admin.js.map