# 服务心跳台

多设备服务状态的统一看板与上报协议。

- 在线状态页：https://liangzai4322.github.io/service-status-hub/
- 在线接入文档：https://liangzai4322.github.io/service-status-hub/integration.html
- HTTPS API：https://liangzai666.com/status-api

## 接入约定

### 24 小时历史

`GET /v1/history?hours=24` 批量返回所有服务的连续状态区间；添加 `service_id` 查询单个服务。看板每个服务新增 96 格状态条、悬停时间范围及 Uptime 百分比。原快照 API 和写入协议保持兼容。

服务端只保存状态变更点，并按接收时间加 TTL 物化超时。历史启用前的空白为 unknown；Uptime 为 healthy 秒数占整个窗口的比例。详细字段及调用示例见在线接入文档第 7 节。

每台设备定时向 `POST /v1/status` 上报 JSON。`service_id` 使用 `<服务>.<设备>` 格式，写入令牌通过设备环境变量 `STATUS_HUB_TOKEN` 提供，不进入公开仓库。

