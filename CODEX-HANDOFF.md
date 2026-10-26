# 转交其他 Codex：项目接入心跳台

更新时间：2026-10-26（Asia/Taipei）。

这份文档可直接发给负责其他项目或其他设备的 Codex。任务是先理解已上线能力，再把自己负责的服务接入；不要重建心跳台、另建通知链路或替别的项目改配置。

## 1. 先读这些入口

- 状态页：https://liangzai4322.github.io/service-status-hub/
- 完整上报协议：https://liangzai4322.github.io/service-status-hub/integration.html
- API 基址：https://liangzai666.com/status-api
- 当前快照：GET https://liangzai666.com/status-api/v1/services
- 协议字段：GET https://liangzai666.com/status-api/v1/schema
- 批量历史：GET https://liangzai666.com/status-api/v1/history?hours=24
- 公开仓库：https://github.com/liangzai4322/service-status-hub

公开仓库保存前端和接入资料；后端运行在服务器。后端代码审查需要维护者提供相应实现材料。

## 2. 心跳台已经负责什么

- 汇总多设备服务快照。
- 服务端计算 stale、age_seconds；原上报 reported_state 与裁决 state 分开。
- observed_at 是源观察时间，received_at 是服务端接收时间，二者保留。
- 24 小时历史条：96 格，每格 15 分钟，按时段最差状态显示；unknown 与 down 分开。
- 历史只存变更点。超时事件起点为 received_at + TTL，不是扫描发现时刻。
- 独立后台扫描超时，网页关闭后仍可发现停报。
- 状态变化转给通知中枢：
  - healthy → degraded/down，或超时变 unknown：通知并带 bugFix 建待审批工单。
  - degraded/down/unknown → healthy：普通企微通知，不带 bugFix。
  - 首次异常、首次恢复各一次；从异常周期开始起 10 分钟内的后续波动合并抑制。
- 去重和待发队列持久化；网络重试复用事件键。

当前保持原有 Bearer POST /v1/events 协议。恢复与原工单的关联、自动关闭、自动批准和执行修复都不在本次能力内。

## 3. 普通服务项目的 Codex 应该做什么

### 第一步：确认自己负责的对象

先读当前项目的 AGENTS.md、HANDOFF.MD 和现有启动配置，找到真正运行的服务、已有健康检查和上报器。已有接入时优先复用，避免重复启动两个上报进程。

先列出：

- 这个服务具体做什么；
- 怎样证明它健康、异常、停止或处于维护；
- 当前设备的稳定代号；
- 实际项目绝对路径。

咸鱼项目沿用 CLI 优先和 Worker 互斥规则；接入心跳本身不需要重开账号 WebSocket 会话。

### 第二步：确定标识和环境变量

每个“服务 + 设备”使用固定且唯一的 service_id，例如：

```text
my-service.office-pc-01
```

service_id 最多 80 字符，仅使用小写英文、数字、连字符、下划线和点。设备重启后保持同一标识；不同设备不要共用同一个 service_id。

设备上报器读取：

```text
STATUS_HUB_URL=https://liangzai666.com/status-api/v1/status
STATUS_HUB_TOKEN=<由用户通过设备环境配置注入>
STATUS_DEVICE_ID=<本设备固定英文代号>
```

凭据只从设备环境读取。文档、代码、提交、日志和交接中都不放真实令牌。缺少令牌时明确报告缺少哪个变量，由用户通过受控环境配置注入。

NOTIFY_API_TOKEN 属于心跳台到通知中枢的服务端链路；普通服务上报器不需要它。不要用它代替 STATUS_HUB_TOKEN。

### 第三步：按真实状态定时上报

优先复用已有进程/队列/业务健康信号，再做最小必要检查。healthy 应由被监控服务的核心进程和业务检查结果共同支撑。

- healthy：核心进程与关键功能检查通过。
- degraded：仍运行，但有可证实的部分异常。
- down：明确停止或关键功能失败。
- maintenance：用户明确暂停、维护或计划性停用。
- unknown：信息不足。设备停止上报后的超时判定由心跳台处理，不伪造 healthy。

建议每 30–60 秒检测并上报，ttl_seconds 取间隔的 3–4 倍。observed_at 使用真正执行检查时的 UTC 时间。长周期任务按项目已有的执行事实建模，不把“尚未到执行时间”当故障，也不把收件箱归档状态当执行成功。

请求示例：

```http
POST /status-api/v1/status
Authorization: Bearer <STATUS_HUB_TOKEN>
Content-Type: application/json
```

```json
{
  "service_id": "my-service.office-pc-01",
  "name": "我的服务 · 办公电脑 01",
  "state": "healthy",
  "message": "核心进程和业务检查通过",
  "observed_at": "2026-10-26T06:00:00Z",
  "ttl_seconds": 120,
  "metrics": {"queue": 0},
  "details": {"device_id": "office-pc-01"},
  "source": "my-service-reporter"
}
```

示例中的时间仅说明格式，实际发送时生成当前检查时间。metrics/details 只放必要的计数、版本、设备等白名单字段，不放客户消息、日志正文、提示词、Cookie 或凭据。

一次请求成功的证据是 HTTP 成功且 JSON 的 ok=true，返回 service.service_id 与目标一致。再读快照确认目标记录和新接收时间；不要把 HTTP 401/403 或网络失败当上报成功，也不要盲目修改账号登录态。

### 第四步：设置持续运行与最小开销

使用该项目现有的服务管理方式自动启动上报器；复用已有任务/进程，避免重复定时器。不要每个心跳重启应用或浏览器，也不要为健康检查建立竞争会话。

记录上报间隔、启动入口和停用方法。网络重试采用退避；本次联调若超时，先检查已有代理再做适用的一次重试，保持同一目标和鉴权。loopback/内网不强走代理。

### 第五步：补齐工单目录映射

心跳台需要把 service_id 映射到对应设备上的真实项目目录。请向维护者交付以下非秘密信息：

```json
{
  "service_id": "my-service.office-pc-01",
  "device_id": "office-pc-01",
  "project_path": "<该设备上的实际项目绝对路径>"
}
```

这份信息用于中心环境变量 STATUS_ALERT_PROJECT_MAP_JSON。它不是新增上报字段；不要自行把其他服务的映射或通知凭据改掉。

当前默认工单排查目录为心跳台工作区，咸鱼已有单独映射。其他服务接入后，请让心跳台维护者确认其映射，再宣称工单已准确指向该项目。建单成功也不代表修复已获批或已执行。

### 第六步：验收并交接

1. 在隔离测试中验证健康、宕机、恢复和超时逻辑；模拟故障不进入生产通知链路。
2. 生产首次上报使用服务的真实当前状态，确认快照中的 service_id、设备、state、reported_state、received_at 正确。
3. 确认持续上报至少两个周期，刷新网页后只有一条目标记录。
4. 查看历史接口确认区间连续；首次接入前的 unknown 是历史空白，不用改 TTL 或伪造旧心跳将它涂绿。
5. 确认凭据扫描为零；写明上报器的性能开销及自动启动情况。
6. 将实际修改、验证证据、启动/停用方式、项目目录映射和遗留问题写入本项目 HANDOFF.MD。

最后向用户报告：

```text
项目/设备：
service_id：
健康判定依据：
上报间隔/TTL：
环境变量配置情况（仅名称和是否已配置）：
启动与停用方式：
两次成功上报的时间和返回结果摘要：
工单目录映射是否已由维护者确认：
改动文件：
验收结果/遗留事项：
```

## 4. 如果你负责的是通知中枢

你的任务先核验消费协议，不重复开发接入器：

- 心跳台通过现有 Bearer POST /v1/events 提交，source=service-status-hub。
- device 使用上报设备；body 是 JSON 字符串，字段严格为 service_id、device、old_state、new_state、occurred_at、message、last_heartbeat_at。
- 异常 level=2，带 bugFix，等待工单审批。
- 恢复 level=3，不带 bugFix，普通通知一次。
- 本轮不添加恢复关联、自动确认、自动关闭或自动修复。
- 原生事件字段和 body 中的标识保留，供未来关联使用。
- 如发现协议与现网不一致，先列出差异及证据；不要在另一端暗中补出新协议。

## 5. 本轮不要顺手扩展

告警关联、自动关闭工单、“应到未到”清单、多设备聚合、替换现有鉴权，以及全量纳管所有 Codex 任务均需另行明确范围。当前任务只处理用户交给你的项目或已选服务。

