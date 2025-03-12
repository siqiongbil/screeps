// main.js
// 主循环：整合各模块，每 tick 调用各角色逻辑
const cleanup = require('./cleanup').cleanup;
const spawner = require('./spawner');
const towerModule = require('./tower');
const constructionManager = require('./constructionManager');
const defenseMatrix = require('./defenseMatrix'); // 防御矩阵模块（可选）
const utils = require('./utils');
const formation = require('./formation'); // 阵型管理模块

// 导入各角色模块
const roleHarvester = require('./harvester');

const roleUpgrader = require('./upgrader');
const roleBuilder = require('./builder');
const roleRepairer = require('./repairer');
const roleSoldier = require('./soldier');         // 入侵角色
const roleClaimer = require('./claimer');         // 入侵角色
const roleMineralHarvester = require('./mineralHarvester');
const roleDefender = require('./defender');
const roleRanger = require('./ranger');             // 入侵角色
const roleHealer = require('./healer');             // 入侵角色
const roleLinkManager = require('./linkManager');   // Link 管理角色
const roleStrongHarvester = require('./strongHarvester'); // 加强版采集者
const roleTransporter = require('./transporter');   // 新增资源运送者角色
const roleSpecializedHarvester = require('./specializedHarvester'); // 专精采集者
const roleSpecializedTransporter = require('./specializedTransporter'); // 专精运送者

module.exports.loop = function () {
    // 内存清理：删除所有已死亡 creep 的内存数据
    cleanup();

    // 设置主房间
    if (!Memory.mainRoom) {
        const firstRoomName = Object.keys(Game.rooms)[0];
        Memory.mainRoom = firstRoomName;
        console.log(`Main room set to: ${Memory.mainRoom}`);
    }

    // 遍历所有房间，处理所有控制器属于我的房间（包括新占领的房间）
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            // 输出房间状态（便于调试）
            utils.logRoomStatus(room);

            // 自动孵化：根据当前房间状态生成所需 creep（孵化时设置 homeRoom）
            spawner.spawnCreeps(room);

            // 自动安排关键建筑施工工地（例如 Terminal、Labs）
            constructionManager.scheduleConstruction(room);

            // 每 50 tick 调用一次防御矩阵构建（可根据需要调整频率）
            if (Game.time % 50 === 0) {
                defenseMatrix.scheduleDefenseMatrix(room);
            }

            // 控制房间内所有塔执行攻击或维修任务
            const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            towers.forEach(tower => {
                towerModule.run(tower);
            });

            // 入侵目标管理：如果当前房间名称与入侵目标匹配，则说明入侵成功，清除入侵标记
            if (room.memory.invasionTarget && room.name === room.memory.invasionTarget) {
                delete room.memory.invasionTarget;
                console.log(`Room ${room.name} successfully invaded. Invasion target cleared.`);
            }

            // 规划阵型
            formation.planFormation(room);

            // 检查并补充防御矩阵工地
            checkAndRebuildDefenseMatrix(room);

            // 判断新占领房间生态发展完成，将资源运回主房间
            if (room.name !== Memory.mainRoom) {
                const storage = room.storage;
                if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > storage.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                    room.memory.transportResourcesToMainRoom = true;
                    console.log(`Room ${room.name} is ready to transport resources to main room ${Memory.mainRoom}`);
                }
            }

            // 检查 creep 数量是否足够
            checkCreepCounts(room);
        } else {
            console.log(`Room ${roomName} does not have a controller or is not owned by us.`);
        }
    }

     // 遍历所有 creep，根据其 memory.role 执行对应行为逻辑
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.room.controller && creep.room.controller.my) {
                switch (creep.memory.role) {
                    // 删除原有的 harvester 角色
                    case 'harvester':
                        roleHarvester.run(creep);
                        break;
                    case 'upgrader':
                        roleUpgrader.run(creep);
                        break;
                    case 'builder':
                        roleBuilder.run(creep);
                        break;
                    case 'repairer':
                        roleRepairer.run(creep);
                        break;
                    case 'soldier':
                        roleSoldier.run(creep);
                        break;
                    case 'claimer':
                        roleClaimer.run(creep);
                        break;
                    case 'mineralHarvester':
                        roleMineralHarvester.run(creep);
                        break;
                    case 'defender':
                        roleDefender.run(creep);
                        break;
                    case 'ranger':
                        roleRanger.run(creep);
                        break;
                    case 'healer':
                        roleHealer.run(creep);
                        break;
                    case 'linkManager':
                        roleLinkManager.run(creep);
                        break;
                    case 'strongHarvester':
                        roleStrongHarvester.run(creep);
                        break;
                    case 'transporter':
                        roleTransporter.run(creep); // 新增资源运送者角色
                        break;
                    case 'specializedHarvester':
                        roleSpecializedHarvester.run(creep); // 专精采集者
                        break;
                    case 'specializedTransporter':
                        roleSpecializedTransporter.run(creep); // 专精运送者
                        break;
                    default:
                        // 默认行为：升级当前房间控制器
                        roleUpgrader.run(creep);
                        break;
                }
            } else {
                console.log(`Creep ${creep.name} is in a room without a controller or not owned by us.`);
            }
        }
        // 遍历所有房间，处理所有控制器属于我的房间（包括新占领的房间）
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
    
                // 检测掉落资源并让最近的能捡的 creep 去捡取
                const droppedResources = room.find(FIND_DROPPED_RESOURCES);
                droppedResources.forEach(resource => {
                    const closestCreep = utils.findClosestCreepToPickup(resource.pos);
                    if (closestCreep) {
                        if (closestCreep.pickup(resource) === ERR_NOT_IN_RANGE) {
                            closestCreep.moveTo(resource, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                });
    
            } else {
                console.log(`Room ${roomName} does not have a controller or is not owned by us.`);
            }
        }
        // 在主循环或其他合适的地方检查和修复 creep 的内存
for (const creepName in Game.creeps) {
    const creep = Game.creeps[creepName];
    if (!creep.memory.homeRoom) {
        creep.memory.homeRoom = creep.room.name; // 设置 homeRoom 属性
        console.log(`为 creep ${creep.name} 设置了 homeRoom: ${creep.room.name}`);
    }
}

};

// 新增函数：检查并补充防御矩阵工地
function checkAndRebuildDefenseMatrix(room) {
    // 检查是否有防御矩阵结构
    const defenseStructures = room.find(FIND_MY_STRUCTURES, {
        filter: structure => structure.structureType === STRUCTURE_RAMPART || structure.structureType === STRUCTURE_WALL
    });

    // 如果没有找到足够的防御结构，重新安排防御矩阵建设
    if (defenseStructures.length < 10) { // 根据实际情况调整阈值
        console.log(`Room ${room.name}: Defense matrix structures are insufficient. Rebuilding...`);
        constructionManager.scheduleConstruction(room, 'defenseMatrix');
    }
}

// 新增函数：检查 creep 数量是否足够
function checkCreepCounts(room) {
    const counts = {
        harvester:        _.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === room.name).length,
        strongHarvester:  _.filter(Game.creeps, c => c.memory.role === 'strongHarvester' && c.room.name === room.name).length, // 强化版采集者
        upgrader:         _.filter(Game.creeps, c => c.memory.role === 'upgrader' && c.room.name === room.name).length,
        builder:          _.filter(Game.creeps, c => c.memory.role === 'builder' && c.room.name === room.name).length,
        repairer:         _.filter(Game.creeps, c => c.memory.role === 'repairer' && c.room.name === room.name).length,
        soldier:          _.filter(Game.creeps, c => c.memory.role === 'soldier' && c.room.name === room.name).length,
        claimer:          _.filter(Game.creeps, c => c.memory.role === 'claimer' && c.room.name === room.name).length,
        ranger:           _.filter(Game.creeps, c => c.memory.role === 'ranger' && c.room.name === room.name).length,
        healer:           _.filter(Game.creeps, c => c.memory.role === 'healer' && c.room.name === room.name).length,
        defender:         _.filter(Game.creeps, c => c.memory.role === 'defender' && c.room.name === room.name).length,
        mineralHarvester: _.filter(Game.creeps, c => c.memory.role === 'mineralHarvester' && c.room.name === room.name).length,
        linkManager:      _.filter(Game.creeps, c => c.memory.role === 'linkManager' && c.room.name === room.name).length, // 新增 LinkManager 角色
        transporter:      _.filter(Game.creeps, c => c.memory.role === 'transporter' && c.room.name === room.name).length // 新增资源运送者角色
    };

    console.log(`Room ${room.name} creep counts:`, counts);
}

