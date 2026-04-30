# Python 附录（与本仓库 TypeScript 约定对齐）

当仓库中新增 **Python** 脚本或服务端工具时，建议与 [`CONTRIBUTING.md`](CONTRIBUTING.md)、工程规则保持同一套「署名 + 文档 + Git」理念。

## 文件头模版（模块顶部）

```python
"""
@Project     : LLMira
@File        : scripts/example.py
@Author      : fangtoast
@Email       : fangtoast@foxmail.com
@Date        : 2026-04-30
@Function    :
    - 职责要点 1
    - 职责要点 2
@Description :
    本模块在仓库中的角色；若消费 TS 侧导出的 JSON，说明字段映射关系。
"""
```

## Docstring（Google 风格示例）

```python
def normalize_messages(rows: list[dict]) -> list[dict]:
    """将会话导出的 JSON 行整理为统一结构。

    Args:
        rows: 每项至少包含 role、content、createdAt（与前端 ChatMessage 对齐）。

    Returns:
        按 createdAt 升序排序后的列表。

    Raises:
        ValueError: 当缺少必填字段时。
    """
    # Why：与 IndexedDB 导出格式一致，避免脚本与前端各维护一套 schema
    ...
```

## 与 TypeScript 类型对齐

前端的 `ChatMessage` / `Conversation` 定义见 `src/types/index.ts`。Python 处理导入的 JSON 时，建议以 **显式 TypedDict 或 Pydantic 模型** 对照该结构，减少静默字段丢失。

## Cursor 中仅对 Python 生效的规则

若 `**/*.py` 文件增多，可在 `.cursor/rules/` 下新增一条规则，设置 `globs: **/*.py`，内容可引用本附录，避免在全局规则中重复长模版。

## 日志

Python 侧请使用标准库 `logging`（禁止生产代码依赖裸 `print` 作为唯一诊断手段）；关键异常用 `logger.exception` 记录堆栈。
