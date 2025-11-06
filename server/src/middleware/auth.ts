import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../models/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
    phone?: string;
  };
}

// JWT认证中间件
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: '无效的访问令牌' });
    }

    // 验证用户是否仍然存在且活跃
    db.get(
      'SELECT id, username, email, role, phone, is_active FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId],
      (dbErr, user: any) => {
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
      }
    );
  });
};

// 管理员权限检查中间件
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  // 允许 admin 与 finance 访问管理员接口
  if (req.user.role !== 'admin' && req.user.role !== 'finance') {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  next();
};

// 生成JWT令牌
export const generateToken = (userId: number, username: string, role: string): string => {
  return jwt.sign(
    { userId, username, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};