# Screeps AI Bot

## 项目简介
本项目是一个完整的 Screeps ，实现了自动化房间管理、Creep 角色分工、入侵与防御等功能。

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
    ├── harvester.js         // 采集者：采集能量、回收尸体和残骸中的能量，并将能量送往需要的建筑
    ├── upgrader.js          // 升级者：获取能量后升级房间控制器
    ├── builder.js           // 建造者：建造工地，无任务时升级控制器
    ├── repairer.js          // 维修者：维修受损建筑，无任务时升级控制器
    ├── soldier.js           // 肉搏战士：入侵作战，近战攻击敌人或向入侵目标房间前进
    ├── claimer.js           // 宣称者：进入目标房间后，占领或预定房间控制器
    ├── mineralHarvester.js  // 矿物采集者：采集房间中的矿物资源，将采集到的矿物存入 Storage/Terminal
    ├── defender.js          // 防御者：保护自己房间，对入侵敌人进行拦截
    ├── ranger.js            // 远程狙击手：利用远程攻击支援作战，保持适当安全距离
    └── healer.js            // 治疗者：为受伤友军恢复生命，支援作战部队
```

## 安装与使用
1. **克隆项目**
   ```sh
   git clone https://github.com/siqiongbil/screeps/
   cd screeps
   ```



## 贡献
欢迎提交 issue 和 PR 来改进此项目！

