# PostgreSQL 运行说明

生产环境应使用两个数据库角色：迁移角色拥有表，API/Worker 使用非表所有者运行时角色。运行时每个事务必须设置 `app.current_user_id`，使 RLS 策略参与授权；同时 API 仍执行显式工作区角色检查。

迁移按文件名顺序执行。`001_team_platform.sql` 建立 pgvector、全文索引、团队权限、知识库、Agent、审计与旧数据导入表。
