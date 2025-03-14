# Screeps AI 自动化管理系统

## 项目简介

这是一个为游戏 [Screeps](https://screeps.com/) 开发的高度自动化 AI 系统，通过模块化设计实现了房间管理、资源分配、creep 生产与控制等全方位功能。本系统特别注重能源管理和紧急状态处理，确保在各种情况下都能高效运行。

## 主要功能

- 🏠 **智能房间管理**
  - 自动规划建筑布局
  - 道路网络自动规划与建设
  - 城墙与防御设施管理
  - 能源分配与紧急状态处理

- 👥 **Creep 角色系统**
  - 多种专业角色（采集者、运输者、升级者、建造者等）
  - 基于房间状态的动态角色比例调整
  - 紧急状态下的角色优先级重排
  - 临时角色转换机制

- 🔋 **能源管理系统**
  - 精确的能源状态监控
  - 多级紧急状态响应
  - 容器、存储和扩展能源统一管理
  - 能源分配优先级控制

- 🔄 **资源管理系统**
  - 矿物资源开采与处理
  - 资源存储与分配
  - 资源清理与回收

- ⚔️ **战斗与防御系统**
  - 自动防御入侵者
  - 塔防自动攻击与修复
  - 多种战斗单位协同作战
  - 远征系统支持

- 🔍 **监控与可视化**
  - 房间状态实时监控
  - 能源水平可视化
  - CPU 使用统计
  - 控制台命令系统

## 核心模块说明

### 基础系统
- `main.js` - 主循环，整合所有模块并依次执行
- `memoryOptimizer.js` - 内存优化，清理无效数据
- `cpuManager.js` - CPU 使用管理，优化性能
- `roomManager.js` - 房间管理，处理房间相关操作

### 能源与资源
- `energyUtils.js` - 能源工具，计算能源状态和紧急情况
- `energyDistributor.js` - 能源分配，管理能源流动
- `resourceManager.js` - 资源管理，处理各类资源
- `resourceCleaner.js` - 资源清理，回收废弃资源
- `storageManager.js` - 存储管理，控制资源存储

### 建筑与规划
- `buildingPlanner.js` - 建筑规划，自动布局建筑
- `roadPlanner.js` - 道路规划，优化路径网络
- `towerManager.js` - 塔防管理，控制防御塔行为
- `linkNetwork.js` - 链接网络，管理能源传输
- `rampartManager.js` - 城墙管理，控制防御设施

### Creep 系统
- `spawner.js` - 孵化系统，生产所需 creep
- `prototype.creep.js` - creep 原型扩展，增强基础功能
- 各种角色模块 (`role.*.js`) - 定义不同角色的行为逻辑

### 战斗与探索
- `battleSystem.js` - 战斗系统，处理战斗逻辑
- `expedition.js` - 远征系统，管理外部房间活动
- `nukeManager.js` - 核弹管理，控制核武器使用
- `observerManager.js` - 观察者管理，监控远程房间

### 工具与辅助
- `commands.js` - 全局命令，提供控制台交互功能
- `console_commands.js` - 控制台命令，提供更多交互功能
- `visualizer.js` - 可视化工具，显示游戏状态
- `monitor.js` - 监控系统，跟踪游戏数据
- `utils.js` - 通用工具函数

## 使用指南

### 安装与部署
1. 克隆本仓库到本地
2. 将 `src` 目录下的所有文件上传到 Screeps 游戏
3. 系统将自动初始化并开始运行

### 控制台命令
系统提供了丰富的控制台命令，方便监控和控制游戏状态：

#### 能源管理命令
- `checkEnergy(roomName)` - 检查指定房间的能源状态
- `setEmergencyThresholds(roomName, severe, moderate, mild)` - 设置紧急状态阈值
- `clearEmergencyThresholds(roomName)` - 清除自定义紧急状态阈值

#### 房间管理命令
- `status()` - 显示所有房间状态
- `room(roomName)` - 显示指定房间的详细信息
- `creeps(roomName)` - 显示指定房间的所有爬虫
- `energy(roomName)` - 显示指定房间的能量状态
- `towers(roomName)` - 显示指定房间的塔状态
- `links(roomName)` - 显示指定房间的链接网络状态
- `storage(roomName)` - 显示指定房间的存储状态

#### Creep 管理命令
- `spawn(roomName, role, [count])` - 在指定房间生成指定角色的爬虫
- `cleanupExcessCreeps(role)` - 清理多余creep

#### 建筑管理命令
- `ramparts(roomName)` - 显示指定房间的城墙状态
- `openRamparts(roomName, duration)` - 打开指定房间的所有城墙
- `closeRamparts(roomName)` - 关闭指定房间的所有城墙
- `planSpawn(roomName, x, y)` - 手动规划母巢位置
- `removePlanSpawn(roomName, x, y)` - 删除规划的母巢位置

#### 高级功能命令
- `nuker(roomName)` - 显示指定房间的核弹发射器状态
- `launchNuke(roomName, targetRoom, x, y)` - 从指定房间发射核弹到目标位置
- `observer(roomName)` - 显示指定房间的观察器状态
- `observe(roomName, targetRoom)` - 使用观察器观察目标房间

## 紧急状态系统

本系统特别设计了紧急状态响应机制，当房间能源水平低于阈值时会触发：

- **严重紧急** - 能源水平极低，优先生产采集者，暂停非必要活动
- **中度紧急** - 能源水平较低，增加采集者比例，减少其他角色
- **轻度紧急** - 能源水平略低，适当调整角色比例

紧急状态下，系统会自动：
1. 调整 creep 角色比例，增加采集者数量
2. 临时将部分 creep 转换为采集者
3. 暂停升级控制器和建造活动
4. 优先修复受损能源设施

## 开发与扩展

### 添加新角色
1. 在 `src` 目录创建新的角色文件 `role.newrole.js`
2. 在 `spawner.js` 中添加相应的生成逻辑
3. 在 `main.js` 中注册新角色

### 调试技巧
- 使用控制台命令检查系统状态
- 观察可视化效果进行调试
- 利用 `Memory` 查看运行状态

## 版本历史

- v2.0.0
  - 增强能源管理系统
  - 添加紧急状态响应机制
  - 优化 creep 角色系统
  - 改进控制台命令系统

- v1.0.0
  - 基础功能实现
  - 完整的角色系统
  - 自动化房间管理

## 许可证

本项目采用 MIT 许可证
