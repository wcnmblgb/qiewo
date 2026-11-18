-- 每日一言：句子库 + 功能开关
-- 可重复执行：建表/索引 IF NOT EXISTS，种子按 text 去重
CREATE TABLE IF NOT EXISTS daily_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_daily_quotes_enabled ON daily_quotes(enabled, id);

-- 功能开关：'1' 开启（默认），'0' 关闭后首页卡片与接口都不再返回句子
INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_quote_enabled', '1');

-- 种子句子（按 text 去重，重复执行不会重复插入）
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '能用一行 shell 解决的问题，就不该写成一页脚本。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='能用一行 shell 解决的问题，就不该写成一页脚本。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '备份不是万能的，没有备份是万万不能的。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='备份不是万能的，没有备份是万万不能的。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '不要在生产环境上调试，除非你就是那个生产环境。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='不要在生产环境上调试，除非你就是那个生产环境。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '先看日志，再猜原因。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='先看日志，再猜原因。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT 'rm -rf 之前，先 ls 一遍。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='rm -rf 之前，先 ls 一遍。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '内核崩溃了，但你还可以重启。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='内核崩溃了，但你还可以重启。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '好的运维不是在救火，而是在防火。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='好的运维不是在救火，而是在防火。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '写文档最好的时机是现在，其次是上线前。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='写文档最好的时机是现在，其次是上线前。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '复杂度要交学费，简单则直接收费。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='复杂度要交学费，简单则直接收费。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '阅读源码是理解系统的最短路径。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='阅读源码是理解系统的最短路径。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '容器不是虚拟机，别把它当虚拟机用。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='容器不是虚拟机，别把它当虚拟机用。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '慢就是快：先跑通，再优化。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='慢就是快：先跑通，再优化。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '量变引起质变，包括磁盘占用。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='量变引起质变，包括磁盘占用。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '监控不报警的机器，不是因为健康，是因为没人看。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='监控不报警的机器，不是因为健康，是因为没人看。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '任何一次手动操作，都值得写成脚本。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='任何一次手动操作，都值得写成脚本。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '世界上没有玄学，只有还没读的日志。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='世界上没有玄学，只有还没读的日志。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '配置即代码，代码即文档。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='配置即代码，代码即文档。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '版本不锁定，上线就随缘。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='版本不锁定，上线就随缘。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '先确认问题存在，再动手修。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='先确认问题存在，再动手修。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT 'sudo 是一把好用的锤子，但不是每个问题都是钉子。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='sudo 是一把好用的锤子，但不是每个问题都是钉子。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '把密码写进脚本的人，迟早会出名。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='把密码写进脚本的人，迟早会出名。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT 'Linux 不会骗你，它只会沉默。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='Linux 不会骗你，它只会沉默。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '一次复现胜过十次猜测。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='一次复现胜过十次猜测。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '读 man 页，比读十篇博客都靠谱。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='读 man 页，比读十篇博客都靠谱。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '别怕重启，怕的是不知道为什么要重启。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='别怕重启，怕的是不知道为什么要重启。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '把复杂留在自己这边，把简单留给用户。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='把复杂留在自己这边，把简单留给用户。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '定时任务失败时不会喊，只会默默不来。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='定时任务失败时不会喊，只会默默不来。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '注释写的是为什么，代码写的是怎么做。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='注释写的是为什么，代码写的是怎么做。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '重构之前先写测试，除非你想重构两次。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='重构之前先写测试，除非你想重构两次。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '能自动化的重复劳动，都是在向你收税。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='能自动化的重复劳动，都是在向你收税。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '路径里带空格，是 shell 给你的第一课。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='路径里带空格，是 shell 给你的第一课。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '不要相信时间同步，除非你是 NTP 服务器。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='不要相信时间同步，除非你是 NTP 服务器。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '性能优化前，先量一量。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='性能优化前，先量一量。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '数据库的备份要能恢复，才算备份。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='数据库的备份要能恢复，才算备份。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '看见 500 先看错误日志，别先搜搜索引擎。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='看见 500 先看错误日志，别先搜搜索引擎。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '上线清单越短，回滚越快。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='上线清单越短，回滚越快。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '永远给系统留 10% 的余量，给人生留 20% 的余地。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='永远给系统留 10% 的余量，给人生留 20% 的余地。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '工具越少，故障面越小。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='工具越少，故障面越小。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '先让它跑起来，再让它跑得漂亮。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='先让它跑起来，再让它跑得漂亮。');
INSERT INTO daily_quotes (text, author, enabled, created_at) SELECT '改一行配置，读十页文档，这是运维的礼貌。', '企鹅窝', 1, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quotes WHERE text='改一行配置，读十页文档，这是运维的礼貌。');
