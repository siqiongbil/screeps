/**
 * 全局命令模块
 * 提供一些方便的控制台命令
 */

// 导入需要的模块
const energyUtils = require('energyUtils');
const storageUtils = require('storageUtils');

// 全局命令
global.help = function() {
    console.log(`
可用命令:
  - checkEnergy(roomName): 检查指定房间的能量状态
  - creepInfo(roomName): 查看指定房间所有creep的详细信息
  - spawnQueue(roomName): 查看指定房间的孵化队列
  - clearMemory(): 清理无效的内存数据
  - stats(): 显示游戏统计信息
  - help(): 显示此帮助信息
  
个性化命令:
  - carrierStatus(roomName): 查看指定房间的carrier状态和工作情况
  - optimizeEnergy(roomName): 优化指定房间的能源分配
  - roomDetails(roomName): 显示房间的详细信息，包括建筑、资源和creep
  - toggleEmergency(roomName, [enable]): 切换房间的紧急模式
  - adjustCarrierCount(roomName, count): 调整指定房间的carrier目标数量
  - showEnergyFlow(roomName): 显示能源流动情况
  - checkExtensions(roomName): 检查并创建扩展建筑工地
  - runBuildingPlanner(roomName): 强制运行建筑规划器
  - showBuildingLimits(roomName): 显示建筑限制
`);
};

global.status = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    console.log(`房间 ${roomName} 状态:`);
    console.log(`控制器等级: ${room.controller.level}`);
    console.log(`能源: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
    console.log(`Creeps: ${_.filter(Game.creeps, c => c.room.name === roomName).length}`);
    console.log(`敌人: ${room.find(FIND_HOSTILE_CREEPS).length}`);
    console.log(`建筑工地: ${room.find(FIND_CONSTRUCTION_SITES).length}`);
    
    const storage = storageUtils.findStorage(room);
    if(storage) {
        console.log(`存储能源: ${storage.store[RESOURCE_ENERGY]}`);
    }
    
    if(room.memory.energyDistributor) {
        console.log(`能源分配系统: ${room.memory.energyDistributor.status.level}`);
        console.log(`采集效率: ${(room.memory.energyDistributor.collection.efficiency * 100).toFixed(2)}%`);
    }
};

global.creeps = function(roomName) {
    const creeps = _.filter(Game.creeps, c => c.room.name === roomName);
    if(creeps.length === 0) {
        console.log(`房间 ${roomName} 没有creep`);
        return;
    }
    
    console.log(`房间 ${roomName} 的creep列表:`);
    
    const roles = {};
    creeps.forEach(creep => {
        const role = creep.memory.role;
        if(!roles[role]) {
            roles[role] = [];
        }
        roles[role].push(creep.name);
    });
    
    for(const role in roles) {
        console.log(`${role}: ${roles[role].length}`);
        console.log(`  ${roles[role].join(', ')}`);
    }
};

global.energy = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    const status = energyUtils.getRoomStatus(room);
    console.log(`房间 ${roomName} 能源状态:`);
    console.log(`能源: ${status.energy}/${status.energyCapacity} (${Math.round(status.energyLevel * 100)}%)`);
    console.log(`存储: ${status.storage}/${status.storageCapacity}`);
    console.log(`容器能量: ${status.containerEnergy}/${status.containerCapacity} (${status.containers}个容器) - 仅供参考，不参与状态管理`);
    
    if(room.memory.energyDistributor) {
        console.log(`能源分配系统状态: ${room.memory.energyDistributor.status.level}`);
        console.log(`采集效率: ${(room.memory.energyDistributor.collection.efficiency * 100).toFixed(2)}%`);
        
        // 显示源信息
        if(room.memory.energyDistributor.collection.sources) {
            console.log(`能源源:`);
            for(const sourceId in room.memory.energyDistributor.collection.sources) {
                const source = room.memory.energyDistributor.collection.sources[sourceId];
                console.log(`  源 ${sourceId.substr(-4)}: 采集者 ${source.harvesters || 0}, 效率 ${(source.efficiency * 100).toFixed(2)}%`);
            }
        }
    }
};

global.killAll = function(roomName) {
    const creeps = _.filter(Game.creeps, c => c.room.name === roomName);
    if(creeps.length === 0) {
        console.log(`房间 ${roomName} 没有creep`);
        return;
    }
    
    console.log(`正在自杀房间 ${roomName} 的 ${creeps.length} 个creep...`);
    creeps.forEach(creep => creep.suicide());
};

global.clearMemory = function() {
    // 清理死亡creep的内存
    for(const name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log(`清理死亡creep内存: ${name}`);
        }
    }
    
    // 清理无效房间的内存
    for(const roomName in Memory.rooms) {
        if(!Game.rooms[roomName] || !Game.rooms[roomName].controller || !Game.rooms[roomName].controller.my) {
            delete Memory.rooms[roomName];
            console.log(`清理无效房间内存: ${roomName}`);
        }
    }
};

global.emergency = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!room.memory.energyDistributor) {
        console.log(`房间 ${roomName} 没有能源分配系统`);
        return;
    }
    
    room.memory.energyDistributor.status.level = 'critical';
    console.log(`已将房间 ${roomName} 设置为紧急模式`);
};

global.normal = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!room.memory.energyDistributor) {
        console.log(`房间 ${roomName} 没有能源分配系统`);
        return;
    }
    
    room.memory.energyDistributor.status.level = 'normal';
    console.log(`已将房间 ${roomName} 设置为正常模式`);
};

// 添加显示源采集情况的命令
global.sources = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    const sources = room.find(FIND_SOURCES);
    if(sources.length === 0) {
        console.log(`房间 ${roomName} 没有能源源`);
        return;
    }
    
    console.log(`房间 ${roomName} 的能源源情况:`);
    
    sources.forEach(source => {
        // 计算源周围的可用位置
        const terrain = room.getTerrain();
        let availablePositions = 0;
        
        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                if(dx === 0 && dy === 0) continue; // 跳过源本身的位置
                
                const x = source.pos.x + dx;
                const y = source.pos.y + dy;
                
                // 检查位置是否在房间内且不是墙
                if(x >= 0 && x < 50 && y >= 0 && y < 50 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    availablePositions++;
                }
            }
        }
        
        // 计算当前在该源工作的creep数量
        const creepsAtSource = _.filter(Game.creeps, c => 
            c.memory.sourceId === source.id && 
            c.room.name === roomName
        );
        
        // 计算当前在源附近的creep数量
        const creepsNearSource = _.filter(Game.creeps, c => 
            c.room.name === roomName && 
            c.pos.getRangeTo(source) <= 2
        );
        
        console.log(`源 ${source.id.substr(-4)}: 能量 ${source.energy}/${source.energyCapacity}`);
        console.log(`  可用位置: ${availablePositions}`);
        console.log(`  分配的采集者: ${creepsAtSource.length}`);
        console.log(`  附近的creep: ${creepsNearSource.length}`);
        
        // 如果有energyDistributor数据，显示效率
        if(room.memory.energyDistributor && 
           room.memory.energyDistributor.collection && 
           room.memory.energyDistributor.collection.sources && 
           room.memory.energyDistributor.collection.sources[source.id]) {
            const sourceData = room.memory.energyDistributor.collection.sources[source.id];
            console.log(`  采集效率: ${(sourceData.efficiency * 100).toFixed(2)}%`);
        }
    });
};

// 添加链接网络状态命令
global.links = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的链接网络`);
        return;
    }
    
    // 检查控制器等级
    if(room.controller.level < 5) {
        console.log(`房间 ${roomName} 的控制器等级不足，需要5级以上才能使用链接`);
        return;
    }
    
    // 获取链接网络状态
    const linkNetwork = require('linkNetwork');
    const report = linkNetwork.getNetworkReport(room);
    
    // 输出报告
    console.log(report);
    
    // 可视化链接网络
    linkNetwork.visualizeNetwork(room);
    
    return '链接网络状态已显示在控制台和房间可视化层';
};

// 添加核弹状态命令
global.nuker = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的核弹发射井`);
        return;
    }
    
    // 检查控制器等级
    if(room.controller.level < 8) {
        console.log(`房间 ${roomName} 的控制器等级不足，需要8级才能使用核弹发射井`);
        return;
    }
    
    // 获取核弹状态
    const nukeManager = require('nukeManager');
    const report = nukeManager.getNukerReport(room);
    
    // 输出报告
    console.log(report);
    
    // 可视化核弹状态
    const nuker = nukeManager.getNuker(room);
    if(nuker) {
        nukeManager.visualizeNukerStatus(room, nuker);
    }
    
    return '核弹状态已显示在控制台和房间可视化层';
};

// 添加设置核弹发射目标命令
global.launchNuke = function(roomName, targetRoom, x, y) {
    // 检查参数
    if(!roomName || !targetRoom || x === undefined || y === undefined) {
        console.log('用法: launchNuke(roomName, targetRoom, x, y)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的核弹发射井`);
        return;
    }
    
    // 检查控制器等级
    if(room.controller.level < 8) {
        console.log(`房间 ${roomName} 的控制器等级不足，需要8级才能使用核弹发射井`);
        return;
    }
    
    // 设置发射目标
    const nukeManager = require('nukeManager');
    const result = nukeManager.setLaunchTarget(room, targetRoom, x, y);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加取消核弹发射命令
global.cancelNuke = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的核弹发射井`);
        return;
    }
    
    // 取消发射命令
    const nukeManager = require('nukeManager');
    const result = nukeManager.cancelLaunch(room);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加观察者命令
global.observe = function(roomName, targetRoomName) {
    // 检查参数
    if(!roomName || !targetRoomName) {
        console.log('用法: observe(roomName, targetRoomName)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的观察者`);
        return;
    }
    
    // 检查控制器等级
    if(room.controller.level < 8) {
        console.log(`房间 ${roomName} 的控制器等级不足，需要8级才能使用观察者`);
        return;
    }
    
    // 添加观察请求
    const observerManager = require('observerManager');
    const result = observerManager.addObserveRequest(room, targetRoomName, 'manual', 10);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加自动观察命令
global.autoObserve = function(roomName, enabled, mode) {
    // 检查参数
    if(!roomName) {
        console.log('用法: autoObserve(roomName, enabled, mode)');
        console.log('模式: scout, mineral, hostile');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的观察者`);
        return;
    }
    
    // 检查控制器等级
    if(room.controller.level < 8) {
        console.log(`房间 ${roomName} 的控制器等级不足，需要8级才能使用观察者`);
        return;
    }
    
    // 设置自动观察模式
    const observerManager = require('observerManager');
    const result = observerManager.setAutoObserveMode(room, enabled === undefined ? true : enabled, mode);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加获取房间数据命令
global.roomData = function(roomName, targetRoomName) {
    // 检查参数
    if(!roomName || !targetRoomName) {
        console.log('用法: roomData(roomName, targetRoomName)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的观察者`);
        return;
    }
    
    // 获取房间数据
    const observerManager = require('observerManager');
    const report = observerManager.getRoomData(room, targetRoomName);
    
    // 输出报告
    console.log(report);
    
    return report;
};

// 添加城墙状态命令
global.ramparts = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的城墙`);
        return;
    }
    
    // 获取城墙状态
    const rampartManager = require('rampartManager');
    const report = rampartManager.getRampartReport(room);
    
    // 输出报告
    console.log(report);
    
    return '城墙状态已显示在控制台';
};

// 添加打开所有城墙命令
global.openRamparts = function(roomName, duration) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的城墙`);
        return;
    }
    
    // 设置所有城墙为公开
    const rampartManager = require('rampartManager');
    const result = rampartManager.setAllRampartsPublic(room, true, duration);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加关闭所有城墙命令
global.closeRamparts = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的城墙`);
        return;
    }
    
    // 设置所有城墙为私有
    const rampartManager = require('rampartManager');
    const result = rampartManager.setAllRampartsPublic(room, false);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加切换城墙状态命令
global.toggleRampart = function(roomName, rampartId, isPublic, duration) {
    // 检查参数
    if(!roomName || !rampartId) {
        console.log('用法: toggleRampart(roomName, rampartId, isPublic, duration)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的城墙`);
        return;
    }
    
    // 设置城墙状态
    const rampartManager = require('rampartManager');
    const result = rampartManager.setRampartPublic(room, rampartId, isPublic === undefined ? true : isPublic, duration);
    
    // 输出结果
    console.log(result);
    
    return result;
};

// 添加查看孵化队列命令
global.spawnQueue = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的母巢`);
        return;
    }
    
    // 检查是否有孵化队列
    if(!Memory.spawns || !Memory.spawns.queues || !Memory.spawns.queues[roomName]) {
        console.log(`房间 ${roomName} 没有孵化队列`);
        return;
    }
    
    const queue = Memory.spawns.queues[roomName].queue;
    
    if(queue.length === 0) {
        console.log(`房间 ${roomName} 的孵化队列为空`);
        return;
    }
    
    console.log(`房间 ${roomName} 的孵化队列:`);
    queue.forEach((request, index) => {
        console.log(`${index+1}. 角色: ${request.role}, 优先级: ${request.priority}, 添加时间: ${Game.time - request.timeAdded} ticks前`);
    });
    
    return queue;
};

// 添加手动添加孵化请求命令
global.addToSpawnQueue = function(roomName, role, priority) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的母巢`);
        return;
    }
    
    // 检查角色是否有效
    const validRoles = ['harvester', 'carrier', 'upgrader', 'builder', 'repairer', 'defender', 'healer', 'rangedAttacker', 'scout', 'mineralHarvester', 'linkManager', 'nukeManager', 'storageManager'];
    if(!role || !validRoles.includes(role)) {
        console.log(`无效的角色，有效角色: ${validRoles.join(', ')}`);
        return;
    }
    
    // 初始化孵化队列
    if(!Memory.spawns) {
        Memory.spawns = {
            queues: {},
            stats: {}
        };
    }
    
    if(!Memory.spawns.queues[roomName]) {
        Memory.spawns.queues[roomName] = {
            queue: [],
            lastCheck: Game.time,
            emergencyMode: false
        };
    }
    
    // 创建孵化请求
    const spawner = require('spawner');
    const spawnManager = new spawner.SpawnManager(room);
    
    const request = {
        role: role,
        priority: priority !== undefined ? priority : spawnManager.getRolePriority(role),
        body: spawnManager.getOptimalBody(room, role),
        timeAdded: Game.time
    };
    
    // 添加到队列
    Memory.spawns.queues[roomName].queue.push(request);
    Memory.spawns.queues[roomName].queue.sort((a, b) => a.priority - b.priority);
    
    console.log(`已将 ${role} 添加到房间 ${roomName} 的孵化队列，优先级: ${request.priority}`);
    
    return request;
};

// 添加清空孵化队列命令
global.clearSpawnQueue = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    // 检查是否有孵化队列
    if(!Memory.spawns || !Memory.spawns.queues || !Memory.spawns.queues[roomName]) {
        console.log(`房间 ${roomName} 没有孵化队列`);
        return;
    }
    
    const queueLength = Memory.spawns.queues[roomName].queue.length;
    Memory.spawns.queues[roomName].queue = [];
    
    console.log(`已清空房间 ${roomName} 的孵化队列，共清除 ${queueLength} 个请求`);
    
    return true;
};

// 添加重命名母巢命令
global.renameSpawn = function(spawnName, newName) {
    // 检查参数
    if(!spawnName || !newName) {
        console.log('用法: renameSpawn(spawnName, newName)');
        return;
    }
    
    // 检查母巢是否存在
    const spawn = Game.spawns[spawnName];
    if(!spawn) {
        console.log(`母巢 ${spawnName} 不存在`);
        return;
    }
    
    // 检查是否有访问权限
    if(!spawn.room.controller || !spawn.room.controller.my) {
        console.log(`无法访问母巢 ${spawnName}`);
        return;
    }
    
    // 重命名母巢
    const result = spawn.rename(newName);
    
    if(result === OK) {
        console.log(`母巢 ${spawnName} 已重命名为 ${newName}`);
        return true;
    } else {
        console.log(`重命名母巢失败，错误代码: ${result}`);
        return false;
    }
};

// 添加显示母巢状态命令
global.spawns = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的母巢`);
        return;
    }
    
    // 获取房间中的所有母巢
    const spawns = room.find(FIND_MY_SPAWNS);
    
    if(spawns.length === 0) {
        console.log(`房间 ${roomName} 没有母巢`);
        return;
    }
    
    console.log(`房间 ${roomName} 的母巢状态:`);
    spawns.forEach(spawn => {
        console.log(`名称: ${spawn.name}`);
        console.log(`  能源: ${spawn.store[RESOURCE_ENERGY]}/${spawn.store.getCapacity(RESOURCE_ENERGY)}`);
        console.log(`  状态: ${spawn.spawning ? '正在孵化 ' + Game.creeps[spawn.spawning.name].memory.role : '空闲'}`);
        if(spawn.spawning) {
            console.log(`  进度: ${Math.floor(spawn.spawning.remainingTime / spawn.spawning.needTime * 100)}%`);
            console.log(`  剩余时间: ${spawn.spawning.remainingTime} ticks`);
        }
    });
    
    return spawns;
};

// 添加手动规划母巢位置的命令
global.planSpawn = function(roomName, x, y) {
    // 检查参数
    if(!roomName || x === undefined || y === undefined) {
        console.log('用法: planSpawn(roomName, x, y)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法在房间 ${roomName} 规划母巢`);
        return;
    }
    
    // 检查控制器等级
    const currentSpawns = room.find(FIND_MY_SPAWNS).length;
    const maxSpawns = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][room.controller.level];
    
    if(currentSpawns >= maxSpawns) {
        console.log(`房间 ${roomName} 已达到控制器等级 ${room.controller.level} 的母巢数量上限 (${maxSpawns})`);
        return;
    }
    
    // 检查位置是否在房间内
    if(x < 0 || x > 49 || y < 0 || y > 49) {
        console.log(`位置 (${x}, ${y}) 超出房间边界`);
        return;
    }
    
    // 检查位置是否可建造
    const pos = new RoomPosition(x, y, roomName);
    const terrain = Game.map.getRoomTerrain(roomName);
    
    if(terrain.get(x, y) === TERRAIN_MASK_WALL) {
        console.log(`位置 (${x}, ${y}) 是墙，无法建造`);
        return;
    }
    
    // 检查是否已有建筑或建筑工地
    const structures = pos.lookFor(LOOK_STRUCTURES);
    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    
    if(structures.length > 0 || sites.length > 0) {
        console.log(`位置 (${x}, ${y}) 已有建筑或建筑工地`);
        return;
    }
    
    // 初始化建筑规划内存
    if(!room.memory.buildingPlan) {
        room.memory.buildingPlan = {
            structures: {}
        };
    }
    
    if(!room.memory.buildingPlan.structures[STRUCTURE_SPAWN]) {
        room.memory.buildingPlan.structures[STRUCTURE_SPAWN] = [];
    }
    
    // 检查是否已经规划了这个位置
    const existingPlan = room.memory.buildingPlan.structures[STRUCTURE_SPAWN].some(p => 
        p.x === x && p.y === y
    );
    
    if(existingPlan) {
        console.log(`位置 (${x}, ${y}) 已经规划了母巢`);
        return;
    }
    
    // 添加母巢规划
    room.memory.buildingPlan.structures[STRUCTURE_SPAWN].push({
        x: x,
        y: y
    });
    
    // 同时添加城墙保护
    if(!room.memory.buildingPlan.structures[STRUCTURE_RAMPART]) {
        room.memory.buildingPlan.structures[STRUCTURE_RAMPART] = [];
    }
    
    room.memory.buildingPlan.structures[STRUCTURE_RAMPART].push({
        x: x,
        y: y
    });
    
    console.log(`已在房间 ${roomName} 的位置 (${x}, ${y}) 规划母巢`);
    
    // 可视化规划
    room.visual.circle(x, y, {
        radius: 0.6,
        fill: '#ff00ff',
        opacity: 0.4
    });
    
    room.visual.text('🏠', x, y, {
        font: 0.7,
        align: 'center'
    });
    
    const spawnCount = currentSpawns + 1;
    room.visual.text(`母巢 #${spawnCount}`, x, y - 0.7, {
        color: '#ff00ff',
        font: 0.5,
        align: 'center'
    });
    
    return true;
};

// 添加删除规划母巢位置的命令
global.removePlanSpawn = function(roomName, x, y) {
    // 检查参数
    if(!roomName || x === undefined || y === undefined) {
        console.log('用法: removePlanSpawn(roomName, x, y)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法在房间 ${roomName} 删除母巢规划`);
        return;
    }
    
    // 检查建筑规划内存是否存在
    if(!room.memory.buildingPlan || 
       !room.memory.buildingPlan.structures || 
       !room.memory.buildingPlan.structures[STRUCTURE_SPAWN]) {
        console.log(`房间 ${roomName} 没有母巢规划`);
        return;
    }
    
    // 查找并删除规划
    const spawnPlans = room.memory.buildingPlan.structures[STRUCTURE_SPAWN];
    const index = spawnPlans.findIndex(p => p.x === x && p.y === y);
    
    if(index === -1) {
        console.log(`在位置 (${x}, ${y}) 没有找到母巢规划`);
        return;
    }
    
    // 删除母巢规划
    spawnPlans.splice(index, 1);
    
    // 同时删除对应位置的城墙规划
    if(room.memory.buildingPlan.structures[STRUCTURE_RAMPART]) {
        const rampartPlans = room.memory.buildingPlan.structures[STRUCTURE_RAMPART];
        const rampartIndex = rampartPlans.findIndex(p => p.x === x && p.y === y);
        
        if(rampartIndex !== -1) {
            rampartPlans.splice(rampartIndex, 1);
        }
    }
    
    console.log(`已删除房间 ${roomName} 位置 (${x}, ${y}) 的母巢规划`);
    return true;
};

// 添加显示所有规划母巢位置的命令
global.showPlannedSpawns = function(roomName) {
    // 检查参数
    if(!roomName) {
        console.log('用法: showPlannedSpawns(roomName)');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法查看房间 ${roomName} 的母巢规划`);
        return;
    }
    
    // 检查建筑规划内存是否存在
    if(!room.memory.buildingPlan || 
       !room.memory.buildingPlan.structures || 
       !room.memory.buildingPlan.structures[STRUCTURE_SPAWN] ||
       room.memory.buildingPlan.structures[STRUCTURE_SPAWN].length === 0) {
        console.log(`房间 ${roomName} 没有母巢规划`);
        return;
    }
    
    // 获取当前母巢数量
    const currentSpawns = room.find(FIND_MY_SPAWNS);
    const maxSpawns = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][room.controller.level];
    
    console.log(`房间 ${roomName} 的母巢规划:`);
    console.log(`当前母巢数量: ${currentSpawns.length}/${maxSpawns}`);
    
    // 显示现有母巢
    if(currentSpawns.length > 0) {
        console.log('现有母巢:');
        currentSpawns.forEach(spawn => {
            console.log(`  - ${spawn.name} 位于 (${spawn.pos.x}, ${spawn.pos.y})`);
            
            // 可视化现有母巢
            room.visual.circle(spawn.pos.x, spawn.pos.y, {
                radius: 0.6,
                fill: '#00ff00',
                opacity: 0.4
            });
            
            room.visual.text('🏠', spawn.pos.x, spawn.pos.y, {
                font: 0.7,
                align: 'center'
            });
        });
    }
    
    // 显示规划的母巢
    const plannedSpawns = room.memory.buildingPlan.structures[STRUCTURE_SPAWN];
    console.log('规划的母巢:');
    
    plannedSpawns.forEach((plan, index) => {
        console.log(`  - 规划 #${index + 1} 位于 (${plan.x}, ${plan.y})`);
        
        // 可视化规划的母巢
        room.visual.circle(plan.x, plan.y, {
            radius: 0.6,
            fill: '#ff00ff',
            opacity: 0.4
        });
        
        room.visual.text('🏠', plan.x, plan.y, {
            font: 0.7,
            align: 'center'
        });
        
        const spawnNumber = currentSpawns.length + index + 1;
        room.visual.text(`母巢 #${spawnNumber}`, plan.x, plan.y - 0.7, {
            color: '#ff00ff',
            font: 0.5,
            align: 'center'
        });
    });
    
    return true;
};

// 添加显示存储状态命令
global.storage = function(roomName) {
    // 检查房间是否存在
    if(!roomName || !Game.rooms[roomName]) {
        console.log('请提供有效的房间名称');
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的存储`);
        return;
    }
    
    // 检查是否有存储
    if(!room.storage) {
        console.log(`房间 ${roomName} 没有存储设施`);
        return;
    }
    
    // 获取存储状态报告
    const storageManager = require('storageManager');
    const report = storageManager.getStorageReport(room);
    
    // 输出报告
    console.log(report);
    
    // 可视化存储状态
    storageManager.visualizeStorage(room);
    
    return '存储状态已显示在控制台和房间可视化层';
};

// 添加设置存储阈值命令
global.setStorageThreshold = function(roomName, resourceType, level, value) {
    // 检查参数
    if(!roomName || !resourceType || !level || value === undefined) {
        console.log('用法: setStorageThreshold(roomName, resourceType, level, value)');
        console.log('level可选值: critical, low, normal, excess');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的存储`);
        return;
    }
    
    // 检查是否有存储
    if(!room.storage) {
        console.log(`房间 ${roomName} 没有存储设施`);
        return;
    }
    
    // 检查是否有存储管理系统
    if(!room.memory.storageManager) {
        const storageManager = require('storageManager');
        storageManager.initMemory(room);
    }
    
    // 检查level是否有效
    const validLevels = ['critical', 'low', 'normal', 'excess'];
    if(!validLevels.includes(level)) {
        console.log(`无效的阈值级别，有效级别: ${validLevels.join(', ')}`);
        return;
    }
    
    // 设置阈值
    if(resourceType === RESOURCE_ENERGY) {
        room.memory.storageManager.settings.thresholds[RESOURCE_ENERGY][level] = value;
        console.log(`已将房间 ${roomName} 的能量 ${level} 阈值设置为 ${value}`);
    } else {
        // 获取资源类别
        const storageManager = require('storageManager');
        const category = storageManager.getResourceCategory(resourceType);
        
        room.memory.storageManager.settings.thresholds[category][level] = value;
        console.log(`已将房间 ${roomName} 的 ${category} 类资源 ${level} 阈值设置为 ${value}`);
    }
    
    return true;
};

// 添加请求资源命令
global.requestResource = function(roomName, targetId, resourceType, amount, priority) {
    // 检查参数
    if(!roomName || !targetId || !resourceType || !amount) {
        console.log('用法: requestResource(roomName, targetId, resourceType, amount, [priority])');
        return;
    }
    
    // 检查房间是否存在
    if(!Game.rooms[roomName]) {
        console.log(`房间 ${roomName} 不存在或无法访问`);
        return;
    }
    
    const room = Game.rooms[roomName];
    
    // 检查是否有访问权限
    if(!room.controller || !room.controller.my) {
        console.log(`无法访问房间 ${roomName} 的存储`);
        return;
    }
    
    // 检查是否有存储
    if(!room.storage) {
        console.log(`房间 ${roomName} 没有存储设施`);
        return;
    }
    
    // 检查目标是否存在
    const target = Game.getObjectById(targetId);
    if(!target) {
        console.log(`目标 ${targetId} 不存在`);
        return;
    }
    
    // 检查存储中是否有足够的资源
    if(room.storage.store[resourceType] < amount) {
        console.log(`存储中没有足够的 ${resourceType}，当前: ${room.storage.store[resourceType]}，请求: ${amount}`);
        return;
    }
    
    // 添加资源请求
    const storageManager = require('storageManager');
    const result = storageManager.requestResources(room, targetId, resourceType, amount, priority);
    
    if(result) {
        console.log(`已添加从房间 ${roomName} 存储中请求 ${amount} 单位 ${resourceType} 到目标 ${targetId} 的请求`);
    } else {
        console.log(`添加资源请求失败`);
    }
    
    return result;
};

// 添加清理多余creep的命令
global.cleanupExcessCreeps = function(role) {
    // 获取所有指定角色的creep
    const creeps = _.filter(Game.creeps, c => !role || c.memory.role === role);
    
    // 按房间分组
    const creepsByRoom = _.groupBy(creeps, c => c.room.name);
    
    // 对每个房间进行处理
    for(let roomName in creepsByRoom) {
        const room = Game.rooms[roomName];
        if(!room || !room.controller || !room.controller.my) continue;
        
        const roomCreeps = creepsByRoom[roomName];
        
        // 获取该房间的creep数量限制
        const rcl = room.controller.level;
        const maxCreeps = Math.min(rcl * 3, 12);
        
        // 如果超过限制，杀死多余的creep
        if(roomCreeps.length > maxCreeps) {
            // 按角色分组
            const creepsByRole = _.groupBy(roomCreeps, c => c.memory.role);
            
            // 对每个角色进行处理
            for(let creepRole in creepsByRole) {
                if(role && creepRole !== role) continue;
                
                const roleCreeps = creepsByRole[creepRole];
                
                // 计算该角色应该保留的数量
                let keepCount;
                if(creepRole === 'harvester') {
                    // 计算可开采位置数量
                    const sources = room.find(FIND_SOURCES);
                    const harvestPositions = sources.length * 3; // 粗略估计每个源有3个位置
                    keepCount = Math.min(harvestPositions, 4); // 最多保留4个harvester
                } else {
                    // 其他角色保留2个
                    keepCount = 2;
                }
                
                // 如果超过保留数量，杀死多余的creep
                if(roleCreeps.length > keepCount) {
                    // 按年龄排序，杀死最老的creep
                    roleCreeps.sort((a, b) => a.ticksToLive - b.ticksToLive);
                    
                    for(let i = 0; i < roleCreeps.length - keepCount; i++) {
                        const creep = roleCreeps[i];
                        console.log(`杀死多余的${creepRole}: ${creep.name}`);
                        creep.suicide();
                    }
                }
            }
        }
    }
    
    console.log('清理完成');
};

// 添加查看carrier状态的命令
global.carrierStatus = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    const carriers = _.filter(Game.creeps, c => c.memory.role === 'carrier' && c.room.name === roomName);
    if(carriers.length === 0) {
        console.log(`房间 ${roomName} 中没有carrier`);
        return;
    }
    
    console.log(`房间 ${roomName} 的carrier状态:`);
    console.log(`总数: ${carriers.length}`);
    
    // 统计工作状态
    let working = 0;
    let collecting = 0;
    
    carriers.forEach(carrier => {
        if(carrier.memory.working) {
            working++;
        } else {
            collecting++;
        }
    });
    
    console.log(`正在运送能源: ${working}`);
    console.log(`正在收集能源: ${collecting}`);
    
    // 查找掉落的资源
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
    });
    
    console.log(`掉落的能源: ${droppedResources.length} 堆，共 ${_.sum(droppedResources, r => r.amount)} 单位`);
    
    // 查找需要能源的建筑
    const needEnergyStructures = room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_SPAWN || 
                      s.structureType === STRUCTURE_EXTENSION || 
                      s.structureType === STRUCTURE_TOWER) && 
                      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    console.log(`需要能源的建筑: ${needEnergyStructures.length}`);
    
    // 计算carrier效率
    if(carriers.length > 0 && Game.time % 10 === 0) {
        if(!Memory.carrierStats) {
            Memory.carrierStats = {};
        }
        
        if(!Memory.carrierStats[roomName]) {
            Memory.carrierStats[roomName] = {
                lastEnergy: room.energyAvailable,
                deliveryRate: []
            };
        }
        
        const stats = Memory.carrierStats[roomName];
        const currentEnergy = room.energyAvailable;
        const delivered = Math.max(0, currentEnergy - stats.lastEnergy);
        
        stats.deliveryRate.push(delivered);
        if(stats.deliveryRate.length > 10) {
            stats.deliveryRate.shift();
        }
        
        const avgDelivery = _.sum(stats.deliveryRate) / stats.deliveryRate.length;
        console.log(`平均每10tick运送: ${avgDelivery.toFixed(2)} 单位能源`);
        
        stats.lastEnergy = currentEnergy;
    }
};

// 添加优化能源分配的命令
global.optimizeEnergy = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    console.log(`正在优化房间 ${roomName} 的能源分配...`);
    
    // 分析能源状态
    const status = energyUtils.getRoomStatus(room);
    console.log(`当前能源状态: ${status.energyLevel * 100}%`);
    
    // 调整creep比例
    if(room.memory.energyDistributor) {
        const distributor = room.memory.energyDistributor;
        
        // 根据能源状态调整比例
        if(status.energyLevel < 0.3) {
            console.log('能源水平低，增加harvester和carrier比例');
            distributor.status.level = 'critical';
        } else if(status.energyLevel < 0.6) {
            console.log('能源水平中等，保持平衡比例');
            distributor.status.level = 'low';
        } else {
            console.log('能源水平高，增加upgrader和builder比例');
            distributor.status.level = 'normal';
        }
        
        // 重新计算比例
        const energyDistributor = require('energyDistributor');
        energyDistributor.adjustCreepRatios(room);
        
        console.log('已更新creep比例:');
        for(let role in room.memory.creepRatios) {
            console.log(`- ${role}: ${(room.memory.creepRatios[role] * 100).toFixed(2)}%`);
        }
    } else {
        console.log('能源分配系统未初始化');
    }
    
    // 优化能源收集
    const sources = room.find(FIND_SOURCES);
    sources.forEach(source => {
        const harvesters = _.filter(Game.creeps, c => 
            c.memory.role === 'harvester' && 
            c.memory.sourceId === source.id
        );
        
        console.log(`源 ${source.id.substr(0, 6)}: ${harvesters.length} 个harvester, 能源: ${source.energy}/${source.energyCapacity}`);
    });
    
    // 检查存储情况
    const storage = room.storage;
    if(storage) {
        console.log(`存储能源: ${storage.store[RESOURCE_ENERGY]}`);
    }
    
    console.log('能源优化完成');
};

// 添加显示房间详细信息的命令
global.roomDetails = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    console.log(`=== 房间 ${roomName} 详细信息 ===`);
    
    // 基本信息
    console.log(`控制器等级: ${room.controller.level} (${room.controller.progress}/${room.controller.progressTotal})`);
    console.log(`能源: ${room.energyAvailable}/${room.energyCapacityAvailable} (${(room.energyAvailable/room.energyCapacityAvailable*100).toFixed(2)}%)`);
    
    // Creep信息
    const creeps = _.filter(Game.creeps, c => c.room.name === roomName);
    console.log(`\nCreeps (${creeps.length}):`);
    
    const creepsByRole = _.groupBy(creeps, c => c.memory.role);
    for(let role in creepsByRole) {
        console.log(`- ${role}: ${creepsByRole[role].length}`);
    }
    
    // 建筑信息
    console.log(`\n建筑:`);
    const structures = room.find(FIND_STRUCTURES);
    const structuresByType = _.groupBy(structures, s => s.structureType);
    
    for(let type in structuresByType) {
        console.log(`- ${type}: ${structuresByType[type].length}`);
    }
    
    // 资源信息
    console.log(`\n资源:`);
    const sources = room.find(FIND_SOURCES);
    console.log(`- 能源源: ${sources.length}`);
    
    const minerals = room.find(FIND_MINERALS);
    if(minerals.length > 0) {
        console.log(`- 矿物: ${minerals.length} (${minerals[0].mineralType})`);
    }
    
    const droppedResources = room.find(FIND_DROPPED_RESOURCES);
    if(droppedResources.length > 0) {
        console.log(`- 掉落资源: ${droppedResources.length} 堆，共 ${_.sum(droppedResources, r => r.amount)} 单位`);
    }
    
    // 建筑工地
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    if(sites.length > 0) {
        console.log(`\n建筑工地 (${sites.length}):`);
        const sitesByType = _.groupBy(sites, s => s.structureType);
        
        for(let type in sitesByType) {
            console.log(`- ${type}: ${sitesByType[type].length}`);
        }
    }
    
    // 能源分配系统状态
    if(room.memory.energyDistributor) {
        console.log(`\n能源分配系统:`);
        console.log(`- 状态: ${room.memory.energyDistributor.status.level}`);
        console.log(`- 采集效率: ${(room.memory.energyDistributor.collection.efficiency * 100).toFixed(2)}%`);
        
        if(room.memory.energyDistributor.stats) {
            const stats = room.memory.energyDistributor.stats;
            if(stats.efficiency && stats.efficiency.length > 0) {
                const avgEfficiency = _.sum(stats.efficiency) / stats.efficiency.length;
                console.log(`- 平均效率: ${(avgEfficiency * 100).toFixed(2)}%`);
            }
        }
    }
};

// 添加切换紧急模式的命令
global.toggleEmergency = function(roomName, enable) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!room.memory.emergencyFlags) {
        room.memory.emergencyFlags = {};
    }
    
    const flags = room.memory.emergencyFlags;
    
    if(enable === undefined) {
        // 切换模式
        if(flags.prioritizeHarvesting) {
            flags.prioritizeHarvesting = false;
            flags.pauseUpgrading = false;
            flags.pauseBuilding = false;
            room.memory.emergencyStartTime = 0;
            console.log(`已关闭房间 ${roomName} 的紧急模式`);
        } else {
            flags.prioritizeHarvesting = true;
            flags.pauseUpgrading = true;
            flags.pauseBuilding = true;
            room.memory.emergencyStartTime = Game.time;
            console.log(`已开启房间 ${roomName} 的紧急模式`);
        }
    } else if(enable) {
        // 开启紧急模式
        flags.prioritizeHarvesting = true;
        flags.pauseUpgrading = true;
        flags.pauseBuilding = true;
        room.memory.emergencyStartTime = Game.time;
        console.log(`已开启房间 ${roomName} 的紧急模式`);
    } else {
        // 关闭紧急模式
        flags.prioritizeHarvesting = false;
        flags.pauseUpgrading = false;
        flags.pauseBuilding = false;
        room.memory.emergencyStartTime = 0;
        console.log(`已关闭房间 ${roomName} 的紧急模式`);
    }
    
    // 更新能源分配系统状态
    if(room.memory.energyDistributor) {
        if(flags.prioritizeHarvesting) {
            room.memory.energyDistributor.status.level = 'critical';
        } else {
            // 重新分析能源状态
            const status = energyUtils.getRoomStatus(room);
            if(status.energyLevel < 0.3) {
                room.memory.energyDistributor.status.level = 'low';
            } else {
                room.memory.energyDistributor.status.level = 'normal';
            }
        }
    }
};

// 添加调整carrier数量的命令
global.adjustCarrierCount = function(roomName, count) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!count || count < 0) {
        console.log(`请提供有效的carrier数量`);
        return;
    }
    
    // 保存到房间内存中
    if(!room.memory.customCreepCounts) {
        room.memory.customCreepCounts = {};
    }
    
    room.memory.customCreepCounts.carrier = count;
    console.log(`已将房间 ${roomName} 的carrier目标数量设置为 ${count}`);
    
    // 如果使用energyDistributor，也更新比例
    if(room.memory.creepRatios) {
        // 计算总creep数量
        const rcl = room.controller.level;
        const totalCreeps = Math.min(rcl * 3, 12);
        
        // 计算carrier比例
        const carrierRatio = count / totalCreeps;
        
        // 更新比例
        room.memory.creepRatios.carrier = carrierRatio;
        
        // 重新平衡其他角色比例
        let totalOtherRatios = 0;
        let otherRoles = 0;
        
        for(let role in room.memory.creepRatios) {
            if(role !== 'carrier') {
                totalOtherRatios += room.memory.creepRatios[role];
                otherRoles++;
            }
        }
        
        // 计算调整因子
        const adjustFactor = (1 - carrierRatio) / totalOtherRatios;
        
        // 调整其他角色比例
        for(let role in room.memory.creepRatios) {
            if(role !== 'carrier') {
                room.memory.creepRatios[role] *= adjustFactor;
            }
        }
        
        console.log(`已更新creep比例:`);
        for(let role in room.memory.creepRatios) {
            console.log(`- ${role}: ${(room.memory.creepRatios[role] * 100).toFixed(2)}%`);
        }
    }
};

// 添加显示能源流动情况的命令
global.showEnergyFlow = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    console.log(`=== 房间 ${roomName} 能源流动情况 ===`);
    
    // 能源源信息
    const sources = room.find(FIND_SOURCES);
    console.log(`\n能源源 (${sources.length}):`);
    
    sources.forEach(source => {
        const harvesters = _.filter(Game.creeps, c => 
            c.memory.role === 'harvester' && 
            c.memory.sourceId === source.id
        );
        
        console.log(`- 源 ${source.id.substr(0, 6)}: ${source.energy}/${source.energyCapacity} (${harvesters.length} 个harvester)`);
    });
    
    // 掉落资源
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
    });
    
    if(droppedResources.length > 0) {
        console.log(`\n掉落能源: ${droppedResources.length} 堆，共 ${_.sum(droppedResources, r => r.amount)} 单位`);
        
        // 显示最大的几堆
        droppedResources.sort((a, b) => b.amount - a.amount);
        for(let i = 0; i < Math.min(3, droppedResources.length); i++) {
            const resource = droppedResources[i];
            console.log(`- 位置 (${resource.pos.x},${resource.pos.y}): ${resource.amount} 单位`);
        }
    }
    
    // 容器信息
    const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    });
    
    if(containers.length > 0) {
        console.log(`\n容器 (${containers.length}):`);
        containers.forEach(container => {
            console.log(`- 位置 (${container.pos.x},${container.pos.y}): ${container.store[RESOURCE_ENERGY]}/${container.store.getCapacity(RESOURCE_ENERGY)}`);
        });
    }
    
    // 存储信息
    const storage = room.storage;
    if(storage) {
        console.log(`\n存储: ${storage.store[RESOURCE_ENERGY]}/${storage.store.getCapacity(RESOURCE_ENERGY)}`);
    }
    
    // 能源消费者
    console.log(`\n能源消费者:`);
    
    // Spawn和Extension
    const spawns = room.find(FIND_MY_SPAWNS);
    console.log(`- Spawn: ${_.sum(spawns, s => s.store[RESOURCE_ENERGY])}/${_.sum(spawns, s => s.store.getCapacity(RESOURCE_ENERGY))}`);
    
    const extensions = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
    });
    
    if(extensions.length > 0) {
        console.log(`- Extension: ${_.sum(extensions, s => s.store[RESOURCE_ENERGY])}/${_.sum(extensions, s => s.store.getCapacity(RESOURCE_ENERGY))}`);
    }
    
    // Tower
    const towers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER
    });
    
    if(towers.length > 0) {
        console.log(`- Tower: ${_.sum(towers, s => s.store[RESOURCE_ENERGY])}/${_.sum(towers, s => s.store.getCapacity(RESOURCE_ENERGY))}`);
    }
    
    // 运输者
    const carriers = _.filter(Game.creeps, c => c.memory.role === 'carrier' && c.room.name === roomName);
    if(carriers.length > 0) {
        const totalCarrying = _.sum(carriers, c => c.store[RESOURCE_ENERGY]);
        const totalCapacity = _.sum(carriers, c => c.store.getCapacity());
        console.log(`\nCarrier (${carriers.length}): ${totalCarrying}/${totalCapacity}`);
    }
    
    // 能源效率
    if(room.memory.energyDistributor && room.memory.energyDistributor.stats) {
        const stats = room.memory.energyDistributor.stats;
        if(stats.collectionRate && stats.collectionRate.length > 0) {
            const avgCollectionRate = _.sum(stats.collectionRate) / stats.collectionRate.length;
            console.log(`\n平均采集率: ${(avgCollectionRate * 100).toFixed(2)}%`);
        }
        
        if(stats.distributionRate && stats.distributionRate.length > 0) {
            const avgDistributionRate = _.sum(stats.distributionRate) / stats.distributionRate.length;
            console.log(`平均分配率: ${(avgDistributionRate * 100).toFixed(2)}%`);
        }
    }
};

// 添加检查和创建扩展建筑工地的命令
global.checkExtensions = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!room.controller || !room.controller.my) {
        console.log(`房间 ${roomName} 的控制器不属于你`);
        return;
    }
    
    const rcl = room.controller.level;
    console.log(`房间 ${roomName} 的控制器等级: ${rcl}`);
    
    // 检查当前扩展数量
    const extensions = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
    });
    
    // 检查当前扩展建筑工地数量
    const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
    });
    
    // 获取该控制器等级允许的最大扩展数量
    const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];
    
    console.log(`当前扩展数量: ${extensions.length}/${maxExtensions}`);
    console.log(`当前扩展建筑工地数量: ${extensionSites.length}`);
    
    // 如果已经达到最大数量，不需要创建更多
    if(extensions.length >= maxExtensions) {
        console.log(`已达到控制器等级 ${rcl} 允许的最大扩展数量`);
        return;
    }
    
    // 如果有足够的建筑工地，不需要创建更多
    if(extensions.length + extensionSites.length >= maxExtensions) {
        console.log(`已有足够的扩展建筑工地，等待建造完成`);
        return;
    }
    
    // 计算需要创建的扩展数量
    const needToCreate = maxExtensions - extensions.length - extensionSites.length;
    console.log(`需要创建 ${needToCreate} 个扩展建筑工地`);
    
    // 创建扩展建筑工地
    if(needToCreate > 0) {
        // 获取spawn位置作为中心点
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if(!spawn) {
            console.log(`房间 ${roomName} 没有母巢`);
            return;
        }
        
        const center = spawn.pos;
        let created = 0;
        
        // 在spawn周围创建扩展
        // 先尝试在近距离创建
        for(let radius = 2; radius <= 5; radius++) {
            if(created >= needToCreate) break;
            
            // 在当前半径上尝试创建
            for(let dx = -radius; dx <= radius; dx++) {
                for(let dy = -radius; dy <= radius; dy++) {
                    if(created >= needToCreate) break;
                    
                    // 只在半径边缘上创建
                    if(Math.max(Math.abs(dx), Math.abs(dy)) === radius) {
                        const x = center.x + dx;
                        const y = center.y + dy;
                        
                        // 检查位置是否可以建造
                        if(x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                            const pos = new RoomPosition(x, y, room.name);
                            
                            // 检查地形
                            const terrain = Game.map.getRoomTerrain(room.name);
                            if(terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                            
                            // 检查是否已有建筑或建筑工地
                            const structures = pos.lookFor(LOOK_STRUCTURES);
                            const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
                            
                            if(structures.length === 0 && sites.length === 0) {
                                // 创建扩展建筑工地
                                const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                                
                                if(result === OK) {
                                    created++;
                                    console.log(`在位置 (${x}, ${y}) 创建了扩展建筑工地`);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`成功创建了 ${created} 个扩展建筑工地`);
        
        // 如果没有创建足够的扩展，提示玩家
        if(created < needToCreate) {
            console.log(`警告: 只创建了 ${created}/${needToCreate} 个扩展建筑工地，可能是因为找不到合适的位置`);
            console.log(`建议: 手动清理一些空间，或者使用buildingPlanner模块规划建筑`);
        }
    }
};

// 添加强制运行建筑规划器的命令
global.runBuildingPlanner = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!room.controller || !room.controller.my) {
        console.log(`房间 ${roomName} 的控制器不属于你`);
        return;
    }
    
    console.log(`正在为房间 ${roomName} 运行建筑规划器...`);
    
    // 获取当前建筑工地数量
    const sitesBefore = room.find(FIND_CONSTRUCTION_SITES).length;
    
    // 运行建筑规划器
    const buildingPlanner = require('buildingPlanner');
    buildingPlanner.run(room);
    
    // 获取运行后的建筑工地数量
    const sitesAfter = room.find(FIND_CONSTRUCTION_SITES).length;
    
    console.log(`建筑规划器运行完成，创建了 ${sitesAfter - sitesBefore} 个新建筑工地`);
    
    // 显示当前建筑工地类型统计
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    const sitesByType = _.groupBy(sites, site => site.structureType);
    
    console.log(`当前建筑工地 (${sites.length}):`);
    for(let type in sitesByType) {
        console.log(`- ${type}: ${sitesByType[type].length}`);
    }
};

// 添加显示建筑限制的命令
global.showBuildingLimits = function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`无法访问房间 ${roomName}`);
        return;
    }
    
    if(!room.controller || !room.controller.my) {
        console.log(`房间 ${roomName} 的控制器不属于你`);
        return;
    }
    
    const rcl = room.controller.level;
    console.log(`房间 ${roomName} 的控制器等级: ${rcl}`);
    console.log(`建筑限制:`);
    
    // 显示主要建筑的限制
    const buildingTypes = [
        STRUCTURE_SPAWN,
        STRUCTURE_EXTENSION,
        STRUCTURE_TOWER,
        STRUCTURE_STORAGE,
        STRUCTURE_LINK,
        STRUCTURE_TERMINAL,
        STRUCTURE_LAB,
        STRUCTURE_FACTORY,
        STRUCTURE_OBSERVER,
        STRUCTURE_NUKER,
        STRUCTURE_EXTRACTOR
    ];
    
    for(let type of buildingTypes) {
        const limit = CONTROLLER_STRUCTURES[type][rcl] || 0;
        const current = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === type
        }).length;
        
        const sites = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === type
        }).length;
        
        console.log(`- ${type}: ${current}/${limit} (建筑工地: ${sites})`);
    }
    
    // 显示特殊建筑的限制
    console.log(`- ${STRUCTURE_CONTAINER}: ${room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    }).length}/5`);
    
    console.log(`- ${STRUCTURE_ROAD}: ${room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_ROAD
    }).length}/无限制`);
    
    console.log(`- ${STRUCTURE_WALL}: ${room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_WALL
    }).length}/无限制`);
    
    console.log(`- ${STRUCTURE_RAMPART}: ${room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_RAMPART
    }).length}/无限制`);
};

// 导出一个空对象，因为我们主要是设置全局函数
module.exports = {}; 