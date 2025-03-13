// 导入原型扩展
require('prototype.creep');

// 导入所有角色模块
const roleHarvester = require('role.harvester');
const roleMiner = require('role.miner');
const roleCarrier = require('role.carrier');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleRepairer = require('role.repairer');
const roleDefender = require('role.defender');
const roleHealer = require('role.healer');
const roleRangedAttacker = require('role.rangedAttacker');
const roleScout = require('role.scout');

// 导入其他模块
const buildingPlanner = require('buildingPlanner');
const utils = require('utils');
const roadPlanner = require('roadPlanner');

// 导入系统模块
const battleSystem = require('battleSystem');
const resourceManager = require('resourceManager');
const expedition = require('expedition');
const monitor = require('monitor');
const resourceCleaner = require('resourceCleaner');

// CPU使用统计
let lastTime = Game.time;
let cpuUsage = {};

// 创建角色运行映射
const roleMap = {
    'harvester': roleHarvester,
    'miner': roleMiner,
    'carrier': roleCarrier,
    'upgrader': roleUpgrader,
    'builder': roleBuilder,
    'repairer': roleRepairer,
    'defender': roleDefender,
    'healer': roleHealer,
    'rangedAttacker': roleRangedAttacker,
    'scout': roleScout
};

module.exports.loop = function() {
    // 性能监控开始
    const startCpu = Game.cpu.getUsed();
    
    try {
        // 初始化全局内存
        if(!Memory.rooms) {
            Memory.rooms = {};
        }
        
        // 清理内存（每100 ticks执行一次）
        if(Game.time % 100 === 0) {
            // 清理死亡creep的内存
            for(let name in Memory.creeps) {
                if(!Game.creeps[name]) {
                    delete Memory.creeps[name];
                    console.log(`清理死亡creep内存: ${name}`);
                }
            }

            // 清理无效的房间内存
            for(let roomName in Memory.rooms) {
                if(!Game.rooms[roomName]) {
                    delete Memory.rooms[roomName];
                    console.log(`清理无效房间内存: ${roomName}`);
                }
            }
        }
        
        // 遍历所有房间
        for(let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            // 检查是否是我们的房间
            if(!room.controller || !room.controller.my) continue;

            // 初始化房间内存
            if(!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {
                    sources: room.find(FIND_SOURCES).map(s => s.id),
                    structures: {},
                    defenseStatus: {},
                    resourceStatus: {},
                    lastUpdate: Game.time
                };
            }

            // 每100 ticks更新房间缓存
            if(Game.time % 100 === 0 || !Memory.rooms[roomName].structures) {
                Memory.rooms[roomName].structures = {
                    spawns: room.find(FIND_MY_SPAWNS).map(s => s.id),
                    extensions: room.find(FIND_MY_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_EXTENSION
                    }).map(s => s.id),
                    containers: room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    }).map(s => s.id),
                    towers: room.find(FIND_MY_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_TOWER
                    }).map(s => s.id)
                };
            }

            // 检查房间威胁
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            const isUnderAttack = hostiles.length > 0;

            // 更新房间状态
            const roomStatus = {
                energy: room.energyAvailable,
                energyCapacity: room.energyCapacityAvailable,
                hostileCount: hostiles.length,
                defenseStatus: Memory.rooms[roomName].defenseStatus || {},
                resources: Memory.rooms[roomName].resourceStatus || {}
            };

            // 每100 ticks更新一次房间状态
            if(Game.time % 100 === 0) {
                console.log(`房间 ${roomName} 状态报告：`);
                console.log(`能量：${roomStatus.energy}/${roomStatus.energyCapacity}`);
                console.log(`敌人数量：${roomStatus.hostileCount}`);
                if(roomStatus.defenseStatus.threatLevel) {
                    console.log(`威胁等级：${roomStatus.defenseStatus.threatLevel}`);
                }
            }

            // 创建建筑工地（每50 ticks检查一次）
            if(Game.time % 50 === 0) {
                buildingPlanner.run(room);
                roadPlanner.run(room);
            }

            // 获取该房间需要的creep配置
            const creepSetup = buildingPlanner.getCreepSetup(room);

            // 生成所需的creeps
            const spawn = room.find(FIND_MY_SPAWNS)[0];
            if(spawn && !spawn.spawning) {
                // 获取当前房间的creep数量
                const roomCreeps = _.filter(Game.creeps, creep => creep.room.name === roomName);
                const harvesters = _.filter(roomCreeps, creep => creep.memory.role === 'harvester');
                
                // 如果没有采集者，立即生成一个基础采集者
                if(harvesters.length === 0) {
                    const newName = 'Harvester' + Game.time;
                    const result = spawn.spawnCreep([WORK, CARRY, MOVE], newName, {
                        memory: {role: 'harvester', room: roomName, working: false}
                    });
                    if(result === OK) {
                        console.log(`紧急情况：生成新的采集者 ${newName}`);
                    }
                } else {
                    // 根据房间状态确定需要的角色
                    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length > 0;
                    const damagedStructures = room.find(FIND_STRUCTURES, {
                        filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
                    }).length > 0;
                    const hasContainers = room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    }).length > 0;
                    
                    // 定义基于条件的角色顺序
                    let roleOrder = ['harvester'];  // 采集者始终是第一优先级
                    
                    // 只有当有足够的采集者时才添加其他角色
                    if(harvesters.length >= 2) {
                        roleOrder.push('upgrader');  // 升级者是第二优先级
                        
                        // 添加建筑相关角色
                        if(constructionSites) roleOrder.push('builder');
                        if(damagedStructures) roleOrder.push('repairer');
                        
                        // 添加资源优化角色（只在有容器和控制器等级>=3时）
                        if(hasContainers && room.controller.level >= 3) {
                            roleOrder.push('carrier');
                            roleOrder.push('miner');
                        }
                        
                        // 添加防御角色（只在有敌人时）
                        if(hostiles.length > 0) {
                            roleOrder.push('defender');
                            roleOrder.push('healer');
                            roleOrder.push('rangedAttacker');
                        }
                        
                        // 添加侦察兵（只在控制器等级>=4时）
                        if(room.controller.level >= 4) {
                            roleOrder.push('scout');
                        }
                    }
                    
                    // 生成creep
                    for(let role of roleOrder) {
                        const roleCreeps = _.filter(roomCreeps, creep => creep.memory.role === role);
                        if(roleCreeps.length < creepSetup[role].count) {
                            const newName = role.charAt(0).toUpperCase() + role.slice(1) + Game.time;
                            const result = spawn.spawnCreep(creepSetup[role].body, newName, {
                                memory: {
                                    role: role,
                                    room: roomName,
                                    working: false,
                                    upgrading: role === 'upgrader' ? false : undefined  // 为升级者添加特定的内存
                                }
                            });
                            if(result === OK) {
                                console.log(`生成新的 ${role}: ${newName}`);
                            }
                            break;  // 每次只生成一个creep
                        }
                    }
                }
            }

            // 运行所有creeps的逻辑
            for(let name in Game.creeps) {
                const creep = Game.creeps[name];
                if(creep.room.name != roomName) continue;

                try {
                    // 根据角色运行creep
                    if(creep.memory.role && roleMap[creep.memory.role]) {
                        try {
                            // 尝试运行资源清理任务
                            if(!resourceCleaner.runCollector(creep)) {
                                // 如果没有清理任务，执行正常角色任务
                                roleMap[creep.memory.role].run(creep);
                            }
                        } catch(error) {
                            console.log(`Error running ${creep.memory.role} ${creep.name}: ${error}`);
                        }
                    }
                } catch(error) {
                    console.log(`Error running ${creep.memory.role} ${creep.name}: ${error}`);
                }
            }

            // 运行防御塔
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: {structureType: STRUCTURE_TOWER}
            });
            
            towers.forEach(tower => {
                if(tower.store[RESOURCE_ENERGY] < 10) return;

                // 如果有敌人，优先攻击
                if(hostiles.length > 0) {
                    const target = tower.pos.findClosestByRange(hostiles);
                    if(target) {
                        tower.attack(target);
                        return;
                    }
                }

                // 如果没有敌人且能量充足，修复建筑
                if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
                    const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => structure.hits < structure.hitsMax &&
                            (structure.structureType != STRUCTURE_WALL || structure.hits < 10000)
                    });
                    if(closestDamagedStructure) {
                        tower.repair(closestDamagedStructure);
                    }
                }
            });

            // 更新房间防御状态
            if(isUnderAttack) {
                room.memory.defenseStatus = {
                    threatLevel: Math.min(10, hostiles.length * 2),
                    lastAttack: Game.time,
                    attackerCount: hostiles.length
                };
            }
        }
        
        // 每100个tick显示状态报告
        if(Game.time % 100 === 0) {
            // 显示房间状态
            for(let roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                if(room.controller && room.controller.my) {
                    const status = utils.getRoomStatus(room);
                    const battleStatus = battleSystem.getBattleStatus(room);
                    const creepSetup = buildingPlanner.getCreepSetup(room);
                    
                    // 统计防御单位
                    const defenders = _.filter(Game.creeps, creep => 
                        creep.memory.role === 'defender' && creep.room.name === roomName
                    );
                    
                    console.log(`房间 ${roomName} 状态:
                        控制器等级: ${room.controller.level}
                        能量: ${status.energy}/${status.energyCapacity}
                        建筑工地: ${status.constructionSites}
                        待修建筑: ${status.damagedStructures}
                        
                        战斗状态:
                        威胁等级: ${battleStatus.threatLevel}
                        敌人数量: ${battleStatus.hostileCount}
                        治疗者: ${battleStatus.healerCount}
                        攻击者: ${battleStatus.attackerCount}
                        远程攻击者: ${battleStatus.rangedCount}
                        防御塔: ${battleStatus.towerCount}
                        防御塔能量: ${battleStatus.towerEnergy}
                        墙壁数量: ${battleStatus.wallCount}
                        平均墙壁生命: ${Math.floor(battleStatus.averageWallHits)}
                        安全模式: ${battleStatus.safeMode.active ? '激活' : '未激活'} (剩余: ${battleStatus.safeMode.available})
                        防御者数量: ${defenders.length}/${creepSetup.defender.count}
                        
                        Creep配置:
                        采集者: ${_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === roomName).length}/${creepSetup.harvester.count}
                        升级者: ${_.filter(Game.creeps, c => c.memory.role === 'upgrader' && c.room.name === roomName).length}/${creepSetup.upgrader.count}
                        建造者: ${_.filter(Game.creeps, c => c.memory.role === 'builder' && c.room.name === roomName).length}/${creepSetup.builder.count}
                        维修者: ${_.filter(Game.creeps, c => c.memory.role === 'repairer' && c.room.name === roomName).length}/${creepSetup.repairer.count}`);
                    
                    // 显示资源状态
                    if(room.storage || room.terminal) {
                        const resourceStatus = resourceManager.getResourceStatus(room);
                        console.log(`资源状态:
                            能量: ${resourceStatus.energy.available}/${resourceStatus.energy.capacity}
                            储存: ${resourceStatus.energy.storage}
                            终端: ${resourceStatus.energy.terminal}
                            矿物: ${Object.keys(resourceStatus.minerals).length}
                            化合物: ${Object.keys(resourceStatus.compounds).length}
                            市场订单: ${resourceStatus.market.orders}
                            信用点数: ${resourceStatus.market.credits}`);
                    }

                    // 显示能量分布
                    const distribution = resourceManager.calculateResourceDistribution(room);
                    console.log(`房间 ${roomName} 能量分布:`, JSON.stringify(distribution, null, 2));
                    
                    // 显示道路状态报告
                    const roadReport = roadPlanner.getRoadReport(room);
                    console.log(`房间 ${roomName} 道路状态:
                        总数: ${roadReport.total}
                        受损: ${roadReport.damaged}
                        严重受损: ${roadReport.criticallyDamaged}
                        平均健康度: ${roadReport.averageHealth.toFixed(2)}%
                        维护成本: ${roadReport.maintenanceCost.toFixed(2)}`);
                }
            }
            
            // CPU使用统计
            if(Game.time % 10 === 0) {
                const used = Game.cpu.getUsed();
                cpuUsage.current = used;
                cpuUsage.average = (cpuUsage.average || used) * 0.9 + used * 0.1;
                
                if(Game.time % 100 === 0) {
                    console.log(`CPU使用情况 - 当前: ${cpuUsage.current.toFixed(2)}, 平均: ${cpuUsage.average.toFixed(2)}`);
                }
            }
        }
        
    } catch(error) {
        console.log('主循环错误:', error);
    }
}; 