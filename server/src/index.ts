import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { initDatabase } from './models/database';
import quoteRoutes from './routes/quotes';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import knowledgeRoutes from './routes/knowledge';
import deliveriesRoutes from './routes/deliveries';
import settlementsRoutes from './routes/settlements';
import technicalTaskRoutes from './routes/technical_tasks';

const app = express();
// 关闭 ETag，避免浏览器对 JSON 响应产生 304 缓存导致前端请求失败
app.set('etag', false);
const PORT = process.env.PORT || 3005;

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（放宽跨源资源策略，保证 Puppeteer 可加载图片）
app.use('/uploads', helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }), express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/settlements', settlementsRoutes);
app.use('/api/technical-tasks', technicalTaskRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 初始化数据库并启动服务器
async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化成功');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();