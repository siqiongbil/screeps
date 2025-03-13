# Screeps AI

## 项目简介
本项目是一个完整的 Screeps AI 实现，提供了全自动化的房间管理、Creep 角色分工、入侵与防御等功能。通过模块化设计，使得代码结构清晰，易于维护和扩展。

## 主要功能
- 🏠 自动化房间管理
  - 智能建筑布局
  - 资源调度与分配
  - 自动修复受损建筑
- 👥 Creep 角色系统
  - 智能角色分配
  - 多样化任务处理
  - 动态数量调整
- ⚔️ 战斗系统
  - 入侵策略制定
  - 自动防御机制
  - 多角色协同作战
- 🔄 资源管理
  - 能量采集与分配
  - 矿物开采与运输
  - 市场交易策略

## 目录结构
```
/src
├── main.js                  // 主循环：整合各模块并依次执行
├── cleanup.js               // 内存清理模块：清除死亡 creep 内存
├── spawner.js               // 自动孵化模块：根据房间状态生成所需 creep
├── invasion.js              // 入侵模块：选择合适的入侵目标房间，并判断入侵队伍是否能够成功
├── tower.js                 // 塔防模块：塔自动攻击敌人及维修建筑
├── constructionManager.js   // 建筑调度模块：自动创建 Terminal、Labs 等施工工地
├── utils.js                 // 工具函数：输出房间状态、日志等辅助功能
└── roles                    // 各角色行为逻辑，每个文件对应一种角色
    ├── harvester.js         // 采集者：采集能量、回收尸体和残骸中的能量
    ├── upgrader.js          // 升级者：获取能量后升级房间控制器
    ├── builder.js           // 建造者：建造工地，无任务时升级控制器
    ├── repairer.js         // 维修者：维修受损建筑，无任务时升级控制器
    ├── soldier.js          // 肉搏战士：入侵作战，近战攻击敌人
    ├── claimer.js          // 宣称者：占领或预定房间控制器
    ├── mineralHarvester.js // 矿物采集者：采集矿物资源
    ├── defender.js         // 防御者：保护自己房间，拦截敌人
    ├── ranger.js           // 远程狙击手：远程攻击支援
    └── healer.js           // 治疗者：为受伤友军恢复生命
```

## 开发指南
1. **添加新角色**
   - 在 `roles` 目录下创建新的角色文件
   - 在 `spawner.js` 中添加相应的生成逻辑
   - 在 `main.js` 中注册新角色的行为逻辑

2. **调试技巧**
   - 使用 `utils.js` 中的日志函数输出调试信息
   - 在游戏控制台中使用 `Memory` 查看运行状态
   - 观察房间可视化效果进行调试

## 贡献指南
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 版本历史
- v1.0.0
  - 基础功能实现
  - 完整的角色系统
  - 自动化房间管理

## 许可证
本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 致谢
- 感谢所有贡献者的付出
- 感谢 Screeps 游戏开发团队

