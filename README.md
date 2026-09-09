# 服务心跳台

多设备服务状态的统一看板与上报协议。

- 在线状态页：https://liangzai4322.github.io/service-status-hub/
- 在线接入文档：https://liangzai4322.github.io/service-status-hub/integration.html
- HTTPS API：https://liangzai666.com/status-api

## 接入约定

每台设备定时向 `POST /v1/status` 上报 JSON。`service_id` 使用 `<服务>.<设备>` 格式，写入令牌通过设备环境变量 `STATUS_HUB_TOKEN` 提供，不进入公开仓库。

