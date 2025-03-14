// 首先加载原型扩展
require('prototype.creep');

// 导入系统模块
const memoryOptimizer = require('memoryOptimizer');
const cpuManager = require('cpuManager');
const battleSystem = require('battleSystem');
const buildingPlanner = require('buildingPlanner');
const roadPlanner = require('roadPlanner');
const resourceCleaner = require('resourceCleaner');
const RoomManager = require('roomManager');
const utils = require('utils');
const storageUtils = require('storageUtils');
const spawner = require('spawner');

// 导入角色模块
const roles = {
    harvester: require('role.harvester'),
    miner: require('role.miner'),
    carrier: require('role.carrier'),
    upgrader: require('role.upgrader'),
    builder: require('role.builder'),
    repairer: require('role.repairer'),
    defender: require('role.defender'),
    healer: require('role.healer'),
    rangedAttacker: require('role.rangedAttacker'),
    scout: require('role.scout'),
    mineralHarvester: require('role.mineralHarvester'),
    linkManager: require('role.linkManager'),
    nukeManager: require('role.nukeManager'),
    storageManager: require('role.storageManager')
};

// 添加新的导入
const energyDistributor = require('energyDistributor');
const expedition = require('expedition');
const monitor = require('monitor');
const resourceManager = require('resourceManager');
const energyUtils = require('energyUtils');
const towerManager = require('towerManager');
const visualizer = require('visualizer');
const commands = require('commands');
const console_commands = require('console_commands');
const linkNetwork = require('linkNetwork');
const nukeManager = require('nukeManager');
const observerManager = require('observerManager');
const rampartManager = require('rampartManager');
const storageManager = require('storageManager');

// 初始化全局对象
global.Stats = global.Stats || {
    cpu: {
        used: 0,
        limit: Game.cpu.limit,
        bucket: Game.cpu.bucket
    },
    gcl: {
        level: Game.gcl.level,
        progress: Game.gcl.progress
    },
    rooms: {}
};

// 清理死亡creep的内存
function cleanupMemory() {
    // 清理死亡creep的内存
    for(let name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    
    // 每1000个tick清理一次过期的统计数据
    if(Game.time % 1000 === 0) {
        for(let roomName in Memory.rooms) {
            // 清理能源分配器的统计数据
            if(Memory.rooms[roomName].energyDistributor && Memory.rooms[roomName].energyDistributor.stats) {
                const stats = Memory.rooms[roomName].energyDistributor.stats;
                
                // 限制统计数据长度
                if(stats.collectionRate && stats.collectionRate.length > 100) {
                    stats.collectionRate = stats.collectionRate.slice(-100);
                }
                
                if(stats.distributionRate && stats.distributionRate.length > 100) {
                    stats.distributionRate = stats.distributionRate.slice(-100);
                }
                
                if(stats.efficiency && stats.efficiency.length > 100) {
                    stats.efficiency = stats.efficiency.slice(-100);
                }
            }
        }
    }
}

// 主循环
module.exports.loop = function() {
    const startCpu = Game.cpu.getUsed();
    
    try {
        // 清理内存
        cleanupMemory();
        
        // 初始化控制台命令
        if(!global.consoleCommandsInitialized) {
            require('console_commands').init();
            global.consoleCommandsInitialized = true;
        }
        
        // 初始化全局对象
        if(!global.managers) {
            global.managers = {};
        }
        
        // 处理每个房间
        for(let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            // 只处理我们控制的房间
            if(!room.controller || !room.controller.my) continue;
            
            // 运行孵化系统
            const spawner = require('spawner');
            spawner.spawnCreeps(room);
            
            // 运行能源分配系统
            require('energyDistributor').run(room);
            
            // 运行防御系统
            require('battleSystem').run(room);
            
            // 运行建筑管理系统
            require('buildingPlanner').run(room);
            
            // 运行资源管理系统
            require('resourceManager').run(room);
        }
        
        // 处理所有creep
        for(let name in Game.creeps) {
            const creep = Game.creeps[name];
            
            // 根据角色运行不同的逻辑
            if(creep.memory.role) {
                try {
                    require(`role.${creep.memory.role}`).run(creep);
                } catch(error) {
                    console.log(`Creep ${name} 角色 ${creep.memory.role} 运行错误: ${error}`);
                }
            }
        }
        
        // 显示统计信息
        if(Game.time % 100 === 0) {
            const stats = {
                time: Game.time,
                cpu: Game.cpu.getUsed(),
                bucket: Game.cpu.bucket,
                gcl: Game.gcl.level,
                gclProgress: Game.gcl.progress,
                gclProgressTotal: Game.gcl.progressTotal,
                rooms: {}
            };
            
            for(let roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                if(room.controller && room.controller.my) {
                    stats.rooms[roomName] = {
                        rcl: room.controller.level,
                        progress: room.controller.progress,
                        progressTotal: room.controller.progressTotal,
                        energy: room.energyAvailable,
                        energyCapacity: room.energyCapacityAvailable,
                        creeps: _.filter(Game.creeps, c => c.room.name === roomName).length
                    };
                }
            }
            
            console.log(`统计信息: ${JSON.stringify(stats)}`);
        }
    } catch(error) {
        console.log(`主循环错误: ${error}`);
    }

    // CPU监控结束
    const endCpu = Game.cpu.getUsed();
    if(Game.time % 100 === 0) {
        console.log(`CPU使用: ${(endCpu - startCpu).toFixed(2)}/${Game.cpu.limit}`);
    }
};

// 修改运行房间系统函数
function runRoomSystems(room) {
    // CPU检查
    if(!cpuManager.shouldRunSystem('roomSystems', 'high')) return;

    try {
        // 运行战斗系统 - 这是高优先级的，应该首先运行
        battleSystem.run(room);
        
        // 运行能量分配系统
        energyDistributor.run(room);
        
        // 运行资源清理系统
        resourceCleaner.run(room);
        
        // 运行建筑规划系统
        if(room.controller && room.controller.my) {
            buildingPlanner.run(room);
        }
        
        // 运行道路规划系统
        roadPlanner.run(room);
        
        // 运行塔管理系统
        towerManager.run(room);
        
        // 运行资源管理系统
        resourceManager.run(room);
        
        // 运行链接网络系统
        if(room.controller && room.controller.my && room.controller.level >= 5) {
            linkNetwork.run(room);
        }
        
        // 运行核弹管理系统
        if(room.controller && room.controller.my && room.controller.level >= 8) {
            nukeManager.run(room);
        }
        
        // 运行观察者管理系统
        if(room.controller && room.controller.my && room.controller.level >= 8) {
            observerManager.run(room);
        }
        
        // 运行城墙管理系统
        if(room.controller && room.controller.my && room.controller.level >= 2) {
            rampartManager.run(room);
        }
        
        // 运行存储管理系统
        if(room.controller && room.controller.my && room.controller.level >= 4) {
            storageManager.run(room);
        }
        
        // 运行可视化系统
        visualizer.run(room);
    } catch(error) {
        console.log(`房间系统运行错误 ${room.name}: ${error}`);
    }
}

// 修改运行Creeps函数
function runCreeps() {
    // 获取所有creep并按角色排序，在紧急情况下优先处理harvester
    const creeps = Object.values(Game.creeps);
    
    // 检查是否有房间处于紧急状态
    const hasEmergencyRoom = _.some(Game.rooms, room => 
        room.memory.emergencyFlags && room.memory.emergencyFlags.prioritizeHarvesting
    );
    
    // 如果有紧急情况，优先处理harvester
    if(hasEmergencyRoom) {
        creeps.sort((a, b) => {
            if(a.memory.role === 'harvester' && b.memory.role !== 'harvester') return -1;
            if(a.memory.role !== 'harvester' && b.memory.role === 'harvester') return 1;
            return 0;
        });
    }
    
    // 处理所有creep
    for(const creep of creeps) {
        try {
            if(!creep.spawning) {
                // 先检查是否有清理任务
                if(creep.memory.cleaning) {
                    // 尝试运行清理任务
                    const resourceCleaner = require('resourceCleaner');
                    if(resourceCleaner.runCollector(creep)) {
                        // 如果正在执行清理任务，跳过普通角色行为
                        continue;
                    }
                }
                
                // 检查是否需要清理障碍物
                if(creep.room.memory.obstaclesToClear && creep.room.memory.obstaclesToClear.length > 0 && 
                   (creep.memory.role === 'builder' || creep.memory.role === 'repairer')) {
                    const obstacle = creep.room.memory.obstaclesToClear[0];
                    const structure = Game.getObjectById(obstacle.id);
                    
                    if(structure) {
                        if(creep.dismantle(structure) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(structure, {visualizePathStyle: {stroke: '#ff0000'}});
                        }
                        continue;
                    } else {
                        // 如果障碍物不存在，从列表中移除
                        creep.room.memory.obstaclesToClear.shift();
                    }
                }
                
                // 检查是否需要暂停非必要活动
                if(creep.room.memory.emergencyFlags) {
                    // 如果需要暂停升级，跳过upgrader的行为
                    if(creep.room.memory.emergencyFlags.pauseUpgrading && creep.memory.role === 'upgrader') {
                        // 临时将upgrader转为harvester
                        if(!creep.memory.temporaryHarvester) {
                            creep.memory.originalRole = creep.memory.role;
                            creep.memory.role = 'harvester';
                            creep.memory.temporaryHarvester = true;
                            console.log(`[Emergency] 临时将 ${creep.name} 从 upgrader 转换为 harvester`);
                        }
                    }
                    
                    // 如果需要暂停建造，跳过builder的行为
                    if(creep.room.memory.emergencyFlags.pauseBuilding && creep.memory.role === 'builder') {
                        // 临时将builder转为harvester
                        if(!creep.memory.temporaryHarvester) {
                            creep.memory.originalRole = creep.memory.role;
                            creep.memory.role = 'harvester';
                            creep.memory.temporaryHarvester = true;
                            console.log(`[Emergency] 临时将 ${creep.name} 从 builder 转换为 harvester`);
                        }
                    }
                }
                
                // 只运行普通角色行为
                if(roles[creep.memory.role]) {
                    roles[creep.memory.role].run(creep);
                }
            }
        } catch(creepError) {
            console.log(`Creep ${creep.name} 运行错误: ${creepError.stack || creepError}`);
        }
    }
}

// 自定义统计更新函数
function updateStats() {
    // 更新CPU统计
    global.Stats.cpu = {
        used: Game.cpu.getUsed(),
        limit: Game.cpu.limit,
        bucket: Game.cpu.bucket
    };
    
    // 更新GCL统计
    global.Stats.gcl = {
        level: Game.gcl.level,
        progress: Game.gcl.progress
    };
    
    // 更新房间统计 - 减少统计信息的详细程度
    for(const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if(room.controller && room.controller.my) {
            global.Stats.rooms[roomName] = {
                rcl: room.controller.level,
                energyAvailable: room.energyAvailable,
                energyCapacity: room.energyCapacityAvailable,
                creeps: _.filter(Game.creeps, c => c.room.name === roomName).length
            };
        }
    }
}