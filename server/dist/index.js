"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./models/database");
const quotes_1 = __importDefault(require("./routes/quotes"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const auth_1 = __importDefault(require("./routes/auth"));
const admin_1 = __importDefault(require("./routes/admin"));
const knowledge_1 = __importDefault(require("./routes/knowledge"));
const deliveries_1 = __importDefault(require("./routes/deliveries"));
const settlements_1 = __importDefault(require("./routes/settlements"));
const technical_tasks_1 = __importDefault(require("./routes/technical_tasks"));
const app = (0, express_1.default)();
// 关闭 ETag，避免浏览器对 JSON 响应产生 304 缓存导致前端请求失败
app.set('etag', false);
const PORT = process.env.PORT || 3005;
// 中间件
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 静态文件服务（放宽跨源资源策略，保证 Puppeteer 可加载图片）
app.use('/uploads', helmet_1.default.crossOriginResourcePolicy({ policy: 'cross-origin' }), express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// 路由
app.use('/api/auth', auth_1.default);
app.use('/api/quotes', quotes_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/admin/analytics', analytics_1.default);
app.use('/api/knowledge', knowledge_1.default);
app.use('/api/deliveries', deliveries_1.default);
app.use('/api/settlements', settlements_1.default);
app.use('/api/technical-tasks', technical_tasks_1.default);
// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// 初始化数据库并启动服务器
async function startServer() {
    try {
        await (0, database_1.initDatabase)();
        console.log('数据库初始化成功');
        app.listen(PORT, () => {
            console.log(`服务器运行在 http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map