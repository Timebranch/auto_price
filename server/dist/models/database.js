"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDatabase = initDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dbPath = path_1.default.join(__dirname, '../../data/quotes.db');
// 创建数据库连接
exports.db = new sqlite3_1.default.Database(dbPath);
// 初始化数据库
async function initDatabase() {
    return new Promise((resolve, reject) => {
        // 创建用户表
        exports.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        role TEXT DEFAULT 'sales',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                reject(err);
                return;
            }
            // 迁移：如果缺少 phone 字段，添加之
            exports.db.all(`PRAGMA table_info(users)`, (pragmaErr, rows) => {
                if (pragmaErr) {
                    reject(pragmaErr);
                    return;
                }
                const hasPhone = rows?.some((r) => r.name === 'phone');
                const ensureNext = () => {
                    // 迁移：统一历史用户角色，将 'user' 改为 'sales'
                    exports.db.run(`UPDATE users SET role = 'sales' WHERE role = 'user'`, (roleErr) => {
                        if (roleErr) {
                            reject(roleErr);
                            return;
                        }
                        // 创建报价模板表
                        exports.db.run(`
              CREATE TABLE IF NOT EXISTS quote_templates (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              description TEXT,
              template_html TEXT NOT NULL,
              fields TEXT NOT NULL,
              created_by INTEGER NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (created_by) REFERENCES users (id)
            )
          `, (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            // 创建报价记录表
                            exports.db.run(`
              CREATE TABLE IF NOT EXISTS quote_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                form_data TEXT NOT NULL,
                generated_pdf_path TEXT,
                status TEXT DEFAULT 'draft',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (template_id) REFERENCES quote_templates (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
              )
            `, (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                // 迁移：如果旧表缺少列，则进行增补
                                exports.db.all(`PRAGMA table_info(quote_records)`, (pragmaErr, cols) => {
                                    if (pragmaErr) {
                                        reject(pragmaErr);
                                        return;
                                    }
                                    const colNames = (cols || []).map(c => c.name);
                                    const tasks = [];
                                    // user_id 列
                                    if (!colNames.includes('user_id')) {
                                        tasks.push(() => {
                                            exports.db.run(`ALTER TABLE quote_records ADD COLUMN user_id INTEGER`, (alterErr) => {
                                                if (alterErr) {
                                                    reject(alterErr);
                                                    return;
                                                }
                                                // 将历史数据归属管理员用户（如存在）
                                                exports.db.get(`SELECT id FROM users WHERE username = ?`, ['admin'], (getErr, row) => {
                                                    if (getErr) {
                                                        reject(getErr);
                                                        return;
                                                    }
                                                    const adminId = row?.id || null;
                                                    if (adminId) {
                                                        exports.db.run(`UPDATE quote_records SET user_id = ? WHERE user_id IS NULL`, [adminId], (updErr) => {
                                                            if (updErr) {
                                                                reject(updErr);
                                                                return;
                                                            }
                                                            runNextTask();
                                                        });
                                                    }
                                                    else {
                                                        runNextTask();
                                                    }
                                                });
                                            });
                                        });
                                    }
                                    // generated_pdf_path 列
                                    if (!colNames.includes('generated_pdf_path')) {
                                        tasks.push(() => {
                                            exports.db.run(`ALTER TABLE quote_records ADD COLUMN generated_pdf_path TEXT`, (alterErr) => {
                                                if (alterErr) {
                                                    reject(alterErr);
                                                    return;
                                                }
                                                runNextTask();
                                            });
                                        });
                                    }
                                    // status 列
                                    if (!colNames.includes('status')) {
                                        tasks.push(() => {
                                            exports.db.run(`ALTER TABLE quote_records ADD COLUMN status TEXT DEFAULT 'draft'`, (alterErr) => {
                                                if (alterErr) {
                                                    reject(alterErr);
                                                    return;
                                                }
                                                runNextTask();
                                            });
                                        });
                                    }
                                    // created_at 列
                                    if (!colNames.includes('created_at')) {
                                        tasks.push(() => {
                                            exports.db.run(`ALTER TABLE quote_records ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (alterErr) => {
                                                if (alterErr) {
                                                    reject(alterErr);
                                                    return;
                                                }
                                                runNextTask();
                                            });
                                        });
                                    }
                                    // updated_at 列
                                    if (!colNames.includes('updated_at')) {
                                        tasks.push(() => {
                                            exports.db.run(`ALTER TABLE quote_records ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (alterErr) => {
                                                if (alterErr) {
                                                    reject(alterErr);
                                                    return;
                                                }
                                                runNextTask();
                                            });
                                        });
                                    }
                                    const runNextTask = () => {
                                        if (tasks.length === 0) {
                                            // 创建发货单表后再创建知识库表
                                            exports.db.run(`
                      CREATE TABLE IF NOT EXISTS delivery_notes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_name TEXT NOT NULL,
                        customer_name TEXT NOT NULL,
                        delivery_time DATETIME NOT NULL,
                        created_by INTEGER NOT NULL,
                        file_path TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (created_by) REFERENCES users (id)
                      )
                    `, (deliveryErr) => {
                                                if (deliveryErr) {
                                                    reject(deliveryErr);
                                                    return;
                                                }
                                                // 迁移：补充发货单额外字段
                                                exports.db.all(`PRAGMA table_info(delivery_notes)`, (pragmaErr2, cols2) => {
                                                    if (pragmaErr2) {
                                                        reject(pragmaErr2);
                                                        return;
                                                    }
                                                    const names = (cols2 || []).map((c) => c.name);
                                                    const alters = [];
                                                    const addCol = (def) => () => exports.db.run(`ALTER TABLE delivery_notes ADD COLUMN ${def}`, (e) => { if (e) {
                                                        reject(e);
                                                        return;
                                                    } runNextAlter(); });
                                                    if (!names.includes('status'))
                                                        alters.push(addCol(`status TEXT DEFAULT 'draft'`));
                                                    if (!names.includes('license_plate'))
                                                        alters.push(addCol(`license_plate TEXT`));
                                                    if (!names.includes('driver_name'))
                                                        alters.push(addCol(`driver_name TEXT`));
                                                    if (!names.includes('driver_phone'))
                                                        alters.push(addCol(`driver_phone TEXT`));
                                                    if (!names.includes('receiver_name'))
                                                        alters.push(addCol(`receiver_name TEXT`));
                                                    if (!names.includes('receiver_phone'))
                                                        alters.push(addCol(`receiver_phone TEXT`));
                                                    if (!names.includes('shipper_name'))
                                                        alters.push(addCol(`shipper_name TEXT`));
                                                    if (!names.includes('shipper_phone'))
                                                        alters.push(addCol(`shipper_phone TEXT`));
                                                    if (!names.includes('address'))
                                                        alters.push(addCol(`address TEXT`));
                                                    if (!names.includes('note'))
                                                        alters.push(addCol(`note TEXT`));
                                                    const runNextAlter = () => {
                                                        if (alters.length === 0) {
                                                            // 迁移：将历史状态 'generated' 统一改为 'pending_review'
                                                            exports.db.run(`UPDATE delivery_notes SET status = 'pending_review' WHERE status = 'generated'`, (mErr) => {
                                                                if (mErr) {
                                                                    reject(mErr);
                                                                    return;
                                                                }
                                                                // 创建发货单明细表
                                                                exports.db.run(`
                              CREATE TABLE IF NOT EXISTS delivery_items (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                delivery_id INTEGER NOT NULL,
                                product_name TEXT NOT NULL,
                                spec TEXT NOT NULL,
                                length TEXT NOT NULL,
                                quantity REAL NOT NULL,
                                unit TEXT NOT NULL,
                                remark TEXT,
                                sort_order INTEGER DEFAULT 0,
                                FOREIGN KEY (delivery_id) REFERENCES delivery_notes (id)
                              )
                            `, (itemsErr) => {
                                                                    if (itemsErr) {
                                                                        reject(itemsErr);
                                                                        return;
                                                                    }
                                                                    // 迁移 delivery_items：补充材质/单重/总重字段
                                                                    exports.db.all(`PRAGMA table_info(delivery_items)`, (pragmaErr3, cols3) => {
                                                                        if (pragmaErr3) {
                                                                            reject(pragmaErr3);
                                                                            return;
                                                                        }
                                                                        const names3 = (cols3 || []).map((c) => c.name);
                                                                        const alters3 = [];
                                                                        const addCol3 = (def) => () => exports.db.run(`ALTER TABLE delivery_items ADD COLUMN ${def}`, (e) => { if (e) {
                                                                            reject(e);
                                                                            return;
                                                                        } runNextAlter3(); });
                                                                        if (!names3.includes('material'))
                                                                            alters3.push(addCol3(`material TEXT`));
                                                                        if (!names3.includes('unit_weight'))
                                                                            alters3.push(addCol3(`unit_weight TEXT`));
                                                                        if (!names3.includes('total_weight'))
                                                                            alters3.push(addCol3(`total_weight TEXT`));
                                                                        const runNextAlter3 = () => {
                                                                            if (alters3.length === 0) {
                                                                                // 创建结算单表（与发货单一对一，重复生成覆盖）
                                                                                exports.db.run(`
                                      CREATE TABLE IF NOT EXISTS settlements (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        delivery_id INTEGER UNIQUE NOT NULL,
                                        order_name TEXT NOT NULL,
                                        customer_name TEXT NOT NULL,
                                        delivery_date TEXT NOT NULL,
                                        address TEXT,
                                        shipper_name TEXT,
                                        created_by INTEGER NOT NULL,
                                        items TEXT NOT NULL,
                                        total_price REAL NOT NULL,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        FOREIGN KEY (delivery_id) REFERENCES delivery_notes (id),
                                        FOREIGN KEY (created_by) REFERENCES users (id)
                                      )
                                    `, (settErr) => {
                                                                                    if (settErr) {
                                                                                        reject(settErr);
                                                                                        return;
                                                                                    }
                                                                                    // 创建知识库表
                                                                                    exports.db.run(`
                                        CREATE TABLE IF NOT EXISTS knowledge_articles (
                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                          title TEXT NOT NULL,
                                          content TEXT NOT NULL,
                                          author_id INTEGER,
                                          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                          FOREIGN KEY (author_id) REFERENCES users (id)
                                        )
                                      `, (tableErr) => {
                                                                                        if (tableErr) {
                                                                                            reject(tableErr);
                                                                                            return;
                                                                                        }
                                                                                        // 创建技术任务表
                                                                                        exports.db.run(`
                                          CREATE TABLE IF NOT EXISTS technical_tasks (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            project_name TEXT NOT NULL,
                                            customer_name TEXT NOT NULL,
                                            sales_owner_id INTEGER NOT NULL,
                                            technician_id INTEGER,
                                            client_contact_name TEXT NOT NULL,
                                            client_contact_phone TEXT NOT NULL,
                                            start_time DATETIME NOT NULL,
                                            deadline DATETIME NOT NULL,
                                            deliverables TEXT NOT NULL,
                                            attachments_path TEXT,
                                            status TEXT DEFAULT 'active',
                                            author_id INTEGER NOT NULL,
                                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                            FOREIGN KEY (sales_owner_id) REFERENCES users (id),
                                            FOREIGN KEY (technician_id) REFERENCES users (id),
                                            FOREIGN KEY (author_id) REFERENCES users (id)
                                          )
                                        `, (ttErr) => {
                                                                                            if (ttErr) {
                                                                                                reject(ttErr);
                                                                                                return;
                                                                                            }
                                                                                            insertDefaultData().then(() => resolve()).catch(reject);
                                                                                        });
                                                                                    });
                                                                                });
                                                                                return;
                                                                            }
                                                                            const t3 = alters3.shift();
                                                                            if (t3)
                                                                                t3();
                                                                        };
                                                                        runNextAlter3();
                                                                    });
                                                                });
                                                            });
                                                            return;
                                                        }
                                                        const t = alters.shift();
                                                        if (t)
                                                            t();
                                                    };
                                                    runNextAlter();
                                                });
                                            });
                                            return;
                                        }
                                        const task = tasks.shift();
                                        if (task)
                                            task();
                                    };
                                    // 启动迁移任务链
                                    runNextTask();
                                });
                            });
                        });
                    });
                };
                if (!hasPhone) {
                    exports.db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (alterErr) => {
                        if (alterErr) {
                            reject(alterErr);
                            return;
                        }
                        ensureNext();
                    });
                }
                else {
                    ensureNext();
                }
            });
        });
    });
}
// 插入默认数据（管理员用户和模板）
async function insertDefaultData() {
    return new Promise((resolve, reject) => {
        // 先创建默认管理员用户
        exports.db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (row) {
                // 管理员已存在，直接插入模板
                insertDefaultTemplate(row.id).then(resolve).catch(reject);
                return;
            }
            // 创建默认管理员用户
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            exports.db.run(`
        INSERT INTO users (username, email, password_hash, full_name, role, is_active, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['admin', 'admin@example.com', hashedPassword, '系统管理员', 'admin', 1, '13800000000'], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                // 插入默认模板
                insertDefaultTemplate(this.lastID).then(resolve).catch(reject);
            });
        });
    });
}
// 插入默认报价单模板
async function insertDefaultTemplate(createdBy) {
    return new Promise((resolve, reject) => {
        // 检查是否已存在默认模板
        exports.db.get('SELECT id FROM quote_templates WHERE name = ?', ['默认报价单模板'], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (row) {
                // 已存在默认模板，不提前返回；在下方统一进行更新逻辑
            }
            // 默认模板的HTML结构
            let defaultTemplateHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>天津光大钢铁有限公司报价清单</title>
          <style>
            body { font-family: 'Microsoft YaHei', 'SimSun', sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 16px; }
            .header h1 { font-size: 24px; margin: 0; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
            .meta .left, .meta .right { width: 48%; }
            .meta p { margin: 4px 0; }
            .table-wrap { border: 1px solid #f0a36b; padding: 8px; background: #fff7f0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #f0a36b; padding: 6px 8px; text-align: center; font-size: 12px; }
            th { background: #ffa862; color: #333; }
            tfoot td { font-weight: bold; }
            .footer { margin-top: 10px; font-size: 12px; }
            .footer .remarks { background: #ffe8d6; border: 1px solid #f0a36b; padding: 8px; }
            .bottom { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>天津光大钢铁有限公司报价清单</h1>
          </div>

          <div class="meta">
            <div class="left">
              <p><strong>客户名称：</strong>{{customerName}}</p>
              <p><strong>项目名称：</strong>{{projectName}}</p>
            </div>
            <div class="right">
              <p><strong>报价单号：</strong>{{quoteNumber}}</p>
              <p><strong>报价日期：</strong>{{quoteDate}}</p>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>序号</th>
                  <th>名称</th>
                  <th>规格</th>
                  <th>材质</th>
                  <th>长度/mm</th>
                  <th>单组数量</th>
                  <th>单位</th>
                  <th>含税单价（元）</th>
                  <th>含税总价（元）</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {{#each items}}
                <tr>
                  <td>{{index}}</td>
                  <td>{{itemName}}</td>
                  <td>{{specification}}</td>
                  <td>{{material}}</td>
                  <td>{{lengthMm}}</td>
                  <td>{{groupQuantity}}</td>
                  <td>{{unit}}</td>
                  <td>{{unitPrice}}</td>
                  <td>{{totalPrice}}</td>
                  <td>{{remark}}</td>
                </tr>
                {{/each}}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="7" style="text-align: right;">合计：</td>
                  <td>—</td>
                  <td>{{totalAmount}}</td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="bottom">
            <div><strong>金额大写：</strong>{{grandTotalUppercase}}</div>
            <div><strong>单位：</strong>壹伍贰</div>
          </div>

          <div class="footer">
            <div class="remarks">
              <p>备注：</p>
              <p>{{remarks}}</p>
              <p>有效期：{{validityPeriod}}</p>
            </div>
            <div style="margin-top: 8px;">
              <p><strong>联系人：</strong>{{contactPerson}}　<strong>电话：</strong>{{phone}}　<strong>公司：</strong>{{companyName}}　<strong>邮箱：</strong>{{email}}</p>
            </div>
          </div>
        </body>
        </html>
      `;
            // 如果存在自定义模板文件，则覆盖默认模板
            try {
                const templateFilePath = path_1.default.join(__dirname, '../templates/custom_template.html');
                if (fs_1.default.existsSync(templateFilePath)) {
                    defaultTemplateHtml = fs_1.default.readFileSync(templateFilePath, 'utf-8');
                }
            }
            catch (e) {
                console.warn('读取 custom_template.html 失败，将使用内置默认模板：', e);
            }
            // 插入/更新默认模板字段配置（用于前端动态表单）
            const defaultFieldsConfig = [
                { name: 'customerName', label: '公司名称', type: 'text' },
                { name: 'contactPerson', label: '联系人', type: 'text' },
                { name: 'phone', label: '电话', type: 'text' },
                { name: 'customerAddress', label: '收货地址', type: 'text' },
                { name: 'companyAddress', label: '公司地址', type: 'cascader' },
                { name: 'quoteNumber', label: '报价单号', type: 'text', required: true },
                { name: 'quoteDate', label: '报价日期', type: 'date', required: true },
                { name: 'validityStartDate', label: '有效期开始', type: 'date', required: true },
                { name: 'validityEndDate', label: '有效期结束', type: 'date', required: true },
                { name: 'salesRep', label: '销售代表', type: 'text' },
                // 将销售代表电话默认类型改为文本，避免数字类型规则冲突
                { name: 'salesRepPhone', label: '销售代表电话', type: 'text' },
                {
                    name: 'items',
                    label: '报价项目',
                    type: 'array',
                    fields: [
                        { name: 'itemName', label: '产品名称', type: 'text' },
                        { name: 'specification', label: '规格型号', type: 'text' },
                        { name: 'material', label: '材质', type: 'text' },
                        { name: 'quantity', label: '数量', type: 'number' },
                        { name: 'unit', label: '单位', type: 'text' },
                        { name: 'unitPrice', label: '单价(元)', type: 'number' },
                        { name: 'totalPrice', label: '金额(元)', type: 'number' }
                    ]
                },
                { name: 'taxRatePercent', label: '税率(%)', type: 'number' },
                { name: 'freightIncluded', label: '是否包含运费', type: 'select', options: [{ label: '是', value: '是' }, { label: '否', value: '否' }] },
                { name: 'remarks', label: '备注说明', type: 'textarea' }
            ];
            // 如果已存在默认模板，则更新为最新结构，否则插入
            exports.db.get('SELECT id FROM quote_templates WHERE name = ?', ['默认报价单模板'], (err2, row2) => {
                if (err2) {
                    reject(err2);
                    return;
                }
                if (row2) {
                    exports.db.run('UPDATE quote_templates SET description = ?, template_html = ?, fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                        '适用于常规报价单的模板',
                        defaultTemplateHtml,
                        JSON.stringify(defaultFieldsConfig),
                        row2.id
                    ], (updErr) => {
                        if (updErr) {
                            reject(updErr);
                            return;
                        }
                        resolve();
                    });
                }
                else {
                    exports.db.run(`
            INSERT INTO quote_templates (name, description, template_html, fields, created_by)
            VALUES (?, ?, ?, ?, ?)
            `, ['默认报价单模板', '适用于常规报价单的模板', defaultTemplateHtml, JSON.stringify(defaultFieldsConfig), createdBy], function (err3) {
                        if (err3) {
                            reject(err3);
                            return;
                        }
                        resolve();
                    });
                }
            });
        });
    });
}
//# sourceMappingURL=database.js.map