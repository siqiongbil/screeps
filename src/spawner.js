const PRIORITY_LEVELS = {
    EMERGENCY: 0,    // 紧急情况（如没有采集者）
    CRITICAL: 1,     // 关键角色（如carrier）
    HIGH: 2,        // 高优先级（如upgrader）
    MEDIUM: 3,      // 中等优先级（如builder）
    LOW: 4          // 低优先级（如scout）
};

// 统一限制定义
const LIMITS = {
    // 全局限制
    GLOBAL: {
        BASE_PER_ROOM: 3,  // 每个房间的基础倍数
        MAX_PER_ROOM: 12,  // 每个房间的最大数量
        EXTRA_SLOTS: 10,   // 额外槽位
        ABSOLUTE_MAX: 100  // 绝对上限
    },
    
    // 角色限制
    ROLES: {
        harvester: {
            base: 1,
            rcl2: 3,
            rcl4: 4,
            max: 4,
            body: [WORK, WORK, CARRY, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        carrier: {
            rcl2: 1,
            rcl4: 2,
            max: 3,
            body: [CARRY, CARRY, MOVE, MOVE],
            maxParts: 10,
            lifetime: 1500
        },
        upgrader: {
            base: 1,
            max: 3,
            body: [WORK, CARRY, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        builder: {
            base: 1,
            max: 3,
            body: [WORK, CARRY, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        repairer: {
            base: 1,
            max: 2,
            body: [WORK, CARRY, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        defender: {
            max: 3,
            body: [ATTACK, ATTACK, MOVE, MOVE],
            maxParts: 10,
            lifetime: 1500
        },
        healer: {
            max: 2,
            body: [HEAL, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        rangedAttacker: {
            max: 2,
            body: [RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE],
            maxParts: 10,
            lifetime: 1500
        },
        scout: {
            max: 1,
            body: [MOVE, MOVE, MOVE],
            maxParts: 3,
            lifetime: 1500
        },
        mineralHarvester: {
            max: 1,
            body: [WORK, WORK, CARRY, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        linkManager: {
            max: 1,
            body: [CARRY, CARRY, MOVE, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        nukeManager: {
            max: 1,
            body: [CARRY, CARRY, MOVE, MOVE],
            maxParts: 6,
            lifetime: 1500
        },
        storageManager: {
            max: 1,
            body: [CARRY, CARRY, MOVE, MOVE],
            maxParts: 6,
            lifetime: 1500
        }
    }
};

const ROLE_PRIORITIES = {
    harvester: PRIORITY_LEVELS.EMERGENCY,
    carrier: PRIORITY_LEVELS.CRITICAL,
    upgrader: PRIORITY_LEVELS.HIGH,
    builder: PRIORITY_LEVELS.MEDIUM,
    repairer: PRIORITY_LEVELS.MEDIUM,
    defender: PRIORITY_LEVELS.HIGH,
    healer: PRIORITY_LEVELS.HIGH,
    rangedAttacker: PRIORITY_LEVELS.HIGH,
    scout: PRIORITY_LEVELS.LOW,
    mineralHarvester: PRIORITY_LEVELS.MEDIUM,
    linkManager: PRIORITY_LEVELS.HIGH,
    nukeManager: PRIORITY_LEVELS.MEDIUM,
    storageManager: PRIORITY_LEVELS.HIGH
};

class SpawnManager {
    constructor(room) {
        // 添加房间有效性检查
        if (!room || !Game.rooms[room.name]) {
            throw new Error(`无效的房间: ${room ? room.name : 'undefined'}`);
        }
        
        this.room = room;
        this.spawn = this.getAvailableSpawn();
        this.mode = this.determineMode();
        this.spawnQueue = [];

        if (!Memory.spawns) {
            Memory.spawns = {
                queues: {},
                stats: {}
            };
        }
    }

    // 添加获取可用spawn的方法
    getAvailableSpawn() {
        return this.room.find(FIND_MY_SPAWNS).find(spawn => !spawn.spawning);
    }

    // 添加确定模式的方法
    determineMode() {
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && creep.room.name === this.room.name
        );
        
        return harvesters.length < 2 ? 'emergency' : 'normal';
    }

    run() {
        try {
            // 检查CPU使用情况
            const cpuLimit = Game.cpu.limit || 20;
            const cpuUsed = Game.cpu.getUsed();
            const cpuUsageRatio = cpuUsed / cpuLimit;
            
            // CPU使用率高时，减少操作频率
            if(cpuUsageRatio > 0.8) {
                // CPU使用率超过80%，只执行关键操作
                console.log(`CPU使用率高: ${(cpuUsageRatio * 100).toFixed(2)}%, 减少非关键操作`);
                
                // 只处理一个房间的生成请求
                const roomsToProcess = Object.keys(Game.rooms)
                    .filter(roomName => Game.rooms[roomName].controller && Game.rooms[roomName].controller.my)
                    .slice(0, 1);
                
                for(let roomName of roomsToProcess) {
                    const room = Game.rooms[roomName];
                    this.processSpawnQueue(room);
                }
                
                return;
            }
            
            // 正常CPU使用率，执行所有操作
            for(let roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                
                // 只处理我们控制的房间
                if(!room.controller || !room.controller.my) continue;
                
                // 初始化房间的生成队列
                this.initializeQueue(room);
                
                // 更新房间状态
                this.updateRoomStatus(room);
                
                // 分析并添加需要生成的creep
                this.analyzeAndQueueCreeps(room);
                
                // 处理生成队列
                this.processSpawnQueue(room);
                
                // 更新统计数据
                this.updateStats(room);
                
                // 检查能源再生
                this.checkEnergyRegeneration(room);
                
                // 优化能源分配
                this.optimizeEnergyAllocation(room);
            }
        } catch(error) {
            console.log(`SpawnManager运行错误: ${error}`);
        }
    }

    initializeQueue(room) {
        if (!Memory.spawns.queues[room.name]) {
            Memory.spawns.queues[room.name] = {
                queue: [],
                lastCheck: Game.time,
                emergencyMode: false
            };
        }
    }

    updateRoomStatus(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        const roomQueue = Memory.spawns.queues[room.name];
        
        // 检查是否处于紧急状态
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && creep.room.name === room.name
        );
        
        roomQueue.emergencyMode = harvesters.length < 2;
        
        // 更新可用能量
        roomQueue.availableEnergy = room.energyAvailable;
        roomQueue.energyCapacity = room.energyCapacityAvailable;
        
        // 更新spawn状态
        roomQueue.spawns = spawns.map(spawn => ({
            id: spawn.id,
            name: spawn.name,
            busy: !!spawn.spawning
        }));
    }

    analyzeAndQueueCreeps(room) {
        const roomQueue = Memory.spawns.queues[room.name];
        
        // 如果队列已满，不再分析
        if (roomQueue.queue.length >= 10) return;
        
        // 处理来自energyDistributor的请求
        // 检查统一队列系统中的请求
        if(Memory.spawns && Memory.spawns.queues && Memory.spawns.queues[room.name] && 
           Memory.spawns.queues[room.name].energyRequests && 
           Memory.spawns.queues[room.name].energyRequests.length > 0) {
            
            console.log(`[Spawner] 处理来自energyDistributor的${Memory.spawns.queues[room.name].energyRequests.length}个请求`);
            
            // 将energyDistributor的请求添加到孵化队列
            for(let request of Memory.spawns.queues[room.name].energyRequests) {
                this.queueCreep(room, {
                    role: request.role,
                    priority: request.priority || ROLE_PRIORITIES[request.role],
                    body: this.getOptimalBody(room, request.role),
                    memory: request.memory || {}
                });
            }
            
            // 清空energyDistributor的请求队列
            Memory.spawns.queues[room.name].energyRequests = [];
        }
        
        // 不再处理room.memory.spawnQueue
        
        // 获取当前房间的creep数量
        const creepCounts = this.getCreepCounts(room);
        
        // 获取目标数量
        const targetCounts = this.getTargetCounts(room);
        
        // 分析每个角色的需求
        for (let role in targetCounts) {
            const current = creepCounts[role] || 0;
            const target = targetCounts[role];
            
            if (current < target) {
                // 计算需要添加的数量
                const needed = target - current;
                
                // 检查队列中是否已经有该角色的请求
                const inQueue = roomQueue.queue.filter(req => req.role === role).length;
                
                // 如果队列中的数量加上当前数量仍小于目标，添加新的请求
                if (current + inQueue < target) {
                    this.queueCreep(room, {
                        role: role,
                        priority: ROLE_PRIORITIES[role],
                        body: this.getOptimalBody(room, role)
                    });
                }
            }
        }
    }

    getCreepCounts(room) {
        const counts = {};
        for (let name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.room.name === room.name) {
                counts[creep.memory.role] = (counts[creep.memory.role] || 0) + 1;
            }
        }
        return counts;
    }

    getTargetCounts(room) {
        // 基于房间等级和状态动态计算目标数量
        const rcl = room.controller.level;
        const hostiles = room.find(FIND_HOSTILE_CREEPS).length;
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        
        // 计算可开采位置数量
        const energyUtils = require('energyUtils');
        const harvestPositions = energyUtils.countHarvestPositions(room);
        
        // 全局creep数量限制
        const globalLimit = Math.min(rcl * LIMITS.GLOBAL.BASE_PER_ROOM, LIMITS.GLOBAL.MAX_PER_ROOM);
        
        // 使用energyDistributor提供的比例（如果可用）
        if(room.memory.creepRatios) {
            const ratios = room.memory.creepRatios;
            
            // 基于比例计算初始数量
            const counts = {};
            for(let role in ratios) {
                counts[role] = Math.ceil(globalLimit * ratios[role]);
            }
            
            // 应用角色特定的上限限制
            counts.harvester = Math.min(counts.harvester, this.getMaxHarvesters(rcl, harvestPositions));
            counts.carrier = Math.min(counts.carrier, this.getMaxCarriers(rcl));
            counts.upgrader = Math.min(counts.upgrader, this.getMaxUpgraders(rcl));
            counts.builder = Math.min(counts.builder, this.getMaxBuilders(rcl, constructionSites));
            counts.repairer = Math.min(counts.repairer || 0, this.getMaxRepairers(rcl));
            
            // 确保防御单位在有敌人时生成
            if(hostiles > 0) {
                counts.defender = Math.min(hostiles, this.getMaxDefenders(rcl));
                counts.healer = Math.min(Math.floor(hostiles/2), this.getMaxHealers(rcl));
                counts.rangedAttacker = Math.min(hostiles, this.getMaxRangedAttackers(rcl));
            }
            
            // 确保总数不超过全局限制
            let total = 0;
            for(let role in counts) {
                total += counts[role];
            }
            
            // 如果总数超过限制，按优先级缩减
            if(total > globalLimit) {
                // 角色优先级（数字越小优先级越高）
                const rolePriorities = room.memory.rolePriorities || {
                    harvester: 1,
                    carrier: 2,
                    upgrader: 3,
                    builder: 4,
                    repairer: 5,
                    defender: 1, // 防御单位高优先级
                    healer: 2,
                    rangedAttacker: 2,
                    scout: 6,
                    mineralHarvester: 7,
                    linkManager: 5,
                    nukeManager: 8,
                    storageManager: 5
                };
                
                // 按优先级排序角色
                const sortedRoles = Object.keys(counts).sort((a, b) => 
                    (rolePriorities[a] || 99) - (rolePriorities[b] || 99)
                );
                
                // 在资源有限时，优先保证高优先级角色的数量
                let remainingSlots = globalLimit;
                for(const role of sortedRoles) {
                    const desired = counts[role];
                    counts[role] = Math.min(desired, remainingSlots);
                    remainingSlots -= counts[role];
                    if(remainingSlots <= 0) break;
                }
            }
            
            // 根据控制器等级添加特殊角色
            if(rcl >= 5) {
                const links = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_LINK
                });
                if(links.length > 0) {
                    counts.linkManager = this.getMaxLinkManagers(rcl);
                }
            }
            
            if(rcl >= 8) {
                const nukers = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_NUKER
                });
                if(nukers.length > 0) {
                    counts.nukeManager = this.getMaxNukeManagers(rcl);
                }
            }
            
            if(rcl >= 6) {
                const minerals = room.find(FIND_MINERALS);
                const extractors = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTRACTOR
                });
                if(minerals.length > 0 && extractors.length > 0) {
                    counts.mineralHarvester = this.getMaxMineralHarvesters(rcl);
                }
            }
            
            if(rcl >= 4) {
                const storage = room.storage;
                if(storage) {
                    counts.storageManager = this.getMaxStorageManagers(rcl);
                }
            }
            
            // 根据能源状态动态调整
            this.adjustTargetCountsByEnergyStatus(counts, room);
            
            return counts;
        }
        
        // 默认计算方式（如果没有energyDistributor）
        const counts = {
            harvester: this.getMaxHarvesters(rcl, harvestPositions),
            upgrader: this.getMaxUpgraders(rcl),
            builder: this.getMaxBuilders(rcl, constructionSites),
            repairer: this.getMaxRepairers(rcl),
            defender: hostiles > 0 ? this.getMaxDefenders(rcl) : 0,
            healer: hostiles > 0 ? this.getMaxHealers(rcl) : 0,
            rangedAttacker: hostiles > 0 ? this.getMaxRangedAttackers(rcl) : 0,
            scout: rcl >= 3 ? this.getMaxScouts(rcl) : 0,
            mineralHarvester: 0,
            linkManager: 0,
            nukeManager: 0,
            storageManager: 0,
            carrier: 0
        };
        
        // 计算carrier数量，基于存储建筑和资源需求
        const storageStructures = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE || 
                         s.structureType === STRUCTURE_CONTAINER
        });
        
        // 计算需要能量的建筑数量
        const energyNeedingStructures = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || 
                          s.structureType === STRUCTURE_EXTENSION || 
                          s.structureType === STRUCTURE_TOWER) && 
                          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // 计算掉落的资源数量
        const droppedResources = room.find(FIND_DROPPED_RESOURCES).length;
        
        // 根据存储建筑、需要能量的建筑和掉落资源计算carrier数量
        if(storageStructures.length > 0 || energyNeedingStructures.length > 0 || droppedResources > 0) {
            counts.carrier = this.getMaxCarriers(rcl);
        }
        
        // 根据能源状态动态调整
        this.adjustTargetCountsByEnergyStatus(counts, room);
        
        return counts;
    }

    getOptimalBody(room, role) {
        const energy = room.energyCapacityAvailable;
        const emergencyMode = Memory.spawns.queues[room.name].emergencyMode;
        
        // 紧急模式下使用基础配置
        if (emergencyMode) {
            return [WORK, CARRY, MOVE];
        }
        
        // 根据角色和可用能量返回最优体型
        const bodies = {
            harvester: this.getHarvesterBody(energy),
            carrier: this.getCarrierBody(energy),
            upgrader: this.getUpgraderBody(energy),
            builder: this.getBuilderBody(energy),
            repairer: this.getRepairerBody(energy),
            defender: this.getDefenderBody(energy),
            healer: this.getHealerBody(energy),
            rangedAttacker: this.getRangedAttackerBody(energy),
            scout: this.getScoutBody(energy),
            mineralHarvester: this.getMineralHarvesterBody(energy),
            linkManager: this.getLinkManagerBody(energy),
            nukeManager: this.getNukeManagerBody(energy),
            storageManager: this.getStorageManagerBody(energy)
        };
        
        return bodies[role] || [WORK, CARRY, MOVE];
    }

    getHarvesterBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200); // WORK=100, CARRY=50, MOVE=50
        maxParts = Math.min(maxParts, 6); // 限制最大部件数
        
        for (let i = 0; i < maxParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getCarrierBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 150); // CARRY=50, CARRY=50, MOVE=50
        maxParts = Math.min(maxParts, 8);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(CARRY);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getUpgraderBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200); // WORK=100, CARRY=50, MOVE=50
        maxParts = Math.min(maxParts, 6);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getBuilderBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200);
        maxParts = Math.min(maxParts, 5);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getRepairerBody(energy) {
        return this.getBuilderBody(energy); // 使用与建造者相同的体型
    }

    getDefenderBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 190); // ATTACK=80, TOUGH=10, MOVE=100
        maxParts = Math.min(maxParts, 7);
        
        // 添加TOUGH
        for (let i = 0; i < Math.min(maxParts, 2); i++) {
            body.push(TOUGH);
        }
        
        // 添加ATTACK
        for (let i = 0; i < maxParts; i++) {
            body.push(ATTACK);
        }
        
        // 添加MOVE
        for (let i = 0; i < maxParts; i++) {
            body.push(MOVE);
        }
        
        return body;
    }

    getHealerBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 300); // HEAL=250, MOVE=50
        maxParts = Math.min(maxParts, 5);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(HEAL);
            body.push(MOVE);
        }
        
        return body;
    }

    getRangedAttackerBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200); // RANGED_ATTACK=150, MOVE=50
        maxParts = Math.min(maxParts, 6);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(RANGED_ATTACK);
            body.push(MOVE);
        }
        
        return body;
    }

    getScoutBody(energy) {
        return [MOVE, MOVE, MOVE]; // 轻量级侦察兵
    }

    // 获取矿物采集者体型
    getMineralHarvesterBody(energy) {
        // 矿物采集者需要大量WORK部件和适量的CARRY和MOVE
        if (energy >= 1500) {
            return [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 1000) {
            return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 800) {
            return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else if (energy >= 550) {
            return [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else {
            return [WORK, CARRY, MOVE, MOVE];
        }
    }

    // 获取链接管理者体型
    getLinkManagerBody(energy) {
        // 链接管理者需要大量CARRY部件和足够的MOVE部件
        if (energy >= 1500) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 1000) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else if (energy >= 800) {
            return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else if (energy >= 550) {
            return [CARRY, CARRY, CARRY, MOVE, MOVE];
        } else {
            return [CARRY, CARRY, MOVE, MOVE];
        }
    }

    // 获取核弹管理者体型
    getNukeManagerBody(energy) {
        // 核弹管理者需要大量CARRY部件和足够的MOVE部件
        if (energy >= 2000) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 1500) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 1000) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else if (energy >= 800) {
            return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else {
            return [CARRY, CARRY, CARRY, MOVE, MOVE];
        }
    }

    // 获取存储管理者体型
    getStorageManagerBody(energy) {
        // 存储管理者需要大量CARRY部件和适量的MOVE
        if (energy >= 2000) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 1500) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 1000) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        } else if (energy >= 800) {
            return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else if (energy >= 550) {
            return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
        } else {
            return [CARRY, CARRY, MOVE, MOVE];
        }
    }

    // 将creep生成请求添加到队列
    queueCreep(room, request) {
        // 初始化房间队列
        if (!Memory.spawns.queues) {
            Memory.spawns.queues = {};
        }
        if (!Memory.spawns.queues[room.name]) {
            Memory.spawns.queues[room.name] = {
                queue: [],
                lastProcessTime: 0
            };
        }
        
        // 检查是否已经存在相同角色的请求
        const existingRequest = Memory.spawns.queues[room.name].queue.find(
            req => req.role === request.role
        );
        
        if (existingRequest) {
            // 如果存在，更新优先级
            existingRequest.priority = request.priority;
            return;
        }
        
        // 添加新请求
        Memory.spawns.queues[room.name].queue.push({
            role: request.role,
            priority: request.priority || 100,
            body: request.body || this.getCreepBody(request.role, room),
            memory: request.memory || {}
        });
        
        // 按优先级排序
        Memory.spawns.queues[room.name].queue.sort((a, b) => a.priority - b.priority);
        
        // 记录日志
        console.log(`房间 ${room.name} 添加了新的creep生成请求: ${request.role} (优先级: ${request.priority || 100})`);
    }

    processSpawnQueue(room) {
        const roomQueue = Memory.spawns.queues[room.name];
        if (!roomQueue || roomQueue.queue.length === 0) return;
        
        // 添加检测间隔，减少CPU消耗
        if(!roomQueue.lastProcessTime) {
            roomQueue.lastProcessTime = 0;
        }
        
        // 如果上次处理是在最近5个tick内，且没有可用的spawn，则跳过
        const availableSpawns = room.find(FIND_MY_SPAWNS).filter(spawn => !spawn.spawning);
        if(Game.time - roomQueue.lastProcessTime < 5 && availableSpawns.length === 0) {
            return;
        }
        
        // 更新最后处理时间
        roomQueue.lastProcessTime = Game.time;
        
        // 如果没有可用的spawn，直接返回
        if (availableSpawns.length === 0) return;
        
        // 检查全局限制
        if (!this.checkLimits(room)) return;
        
        // 获取房间能量状态
        const energyStatus = room.memory.energyStatus;
        if (!energyStatus) return;
        
        // 获取当前能源状态
        const currentStatus = energyStatus.currentStatus;
        const energyLevel = energyStatus.energyLevel;
        
        // 获取目标数量
        const targetCounts = this.getTargetCounts(room);
        
        // 获取当前数量
        const currentCounts = {};
        for (const role in targetCounts) {
            currentCounts[role] = _.filter(Game.creeps, c => c.memory.role === role && c.room.name === room.name).length;
        }
        
        // 根据能源状态调整优先级
        const rolePriorities = room.memory.rolePriorities || {
            harvester: 1,
            carrier: 2,
            upgrader: 3,
            builder: 4,
            repairer: 5,
            defender: 1,
            healer: 2,
            rangedAttacker: 2,
            scout: 6,
            mineralHarvester: 7,
            linkManager: 5,
            nukeManager: 8,
            storageManager: 5
        };
        
        // 根据能源状态调整优先级
        if (currentStatus === 'critical') {
            // 在危急状态下，提高harvester和carrier的优先级
            rolePriorities.harvester = 0;
            rolePriorities.carrier = 1;
        } else if (currentStatus === 'low') {
            // 在低能源状态下，适度提高harvester和carrier的优先级
            rolePriorities.harvester = 0.5;
            rolePriorities.carrier = 1.5;
        } else if (currentStatus === 'high') {
            // 在高能源状态下，提高其他角色的优先级
            rolePriorities.upgrader = 2;
            rolePriorities.builder = 3;
            rolePriorities.repairer = 4;
        }
        
        // 更新房间的优先级设置
        room.memory.rolePriorities = rolePriorities;
        
        // 按优先级排序队列
        roomQueue.queue.sort((a, b) => {
            const priorityA = rolePriorities[a.role] || 99;
            const priorityB = rolePriorities[b.role] || 99;
            return priorityA - priorityB;
        });
        
        // 处理队列中的每个请求
        for (let i = roomQueue.queue.length - 1; i >= 0; i--) {
            const request = roomQueue.queue[i];
            const role = request.role;
            
            // 检查是否达到目标数量
            if (currentCounts[role] >= targetCounts[role]) {
                roomQueue.queue.splice(i, 1);
                continue;
            }
            
            // 检查是否有足够的能量
            const body = this.getCreepBody(role, room);
            const cost = this.calculateBodyCost(body);
            
            if (room.energyAvailable >= cost) {
                // 尝试生成creep
                const spawn = availableSpawns[0];
                const result = spawn.spawnCreep(body, `${role}_${Game.time}`, {
                    memory: { role: role }
                });
                
                if (result === OK) {
                    // 生成成功，从队列中移除
                    roomQueue.queue.splice(i, 1);
                    break;
                }
            }
        }
    }

    calculateBodyCost(body) {
        let cost = 0;
        for (const part of body) {
            switch (part) {
                case WORK:
                    cost += 100;
                    break;
                case CARRY:
                    cost += 50;
                    break;
                case MOVE:
                    cost += 50;
                    break;
                case ATTACK:
                    cost += 80;
                    break;
                case RANGED_ATTACK:
                    cost += 150;
                    break;
                case HEAL:
                    cost += 250;
                    break;
                case CLAIM:
                    cost += 600;
                    break;
                case TOUGH:
                    cost += 10;
                    break;
            }
        }
        return cost;
    }

    // 生成creep名称
    generateCreepName(role) {
        // 获取当前tick
        const tick = Game.time;
        
        // 生成随机字符串
        const randomStr = Math.random().toString(36).substring(2, 5);
        
        // 组合名称
        return `${role}_${tick}_${randomStr}`;
    }

    // 记录creep生成统计信息
    recordSpawn(room, request) {
        // 初始化统计信息
        if (!Memory.spawns.stats) {
            Memory.spawns.stats = {};
        }
        if (!Memory.spawns.stats[room.name]) {
            Memory.spawns.stats[room.name] = {
                total: 0,
                byRole: {},
                byBody: {},
                lastSpawn: 0,
                spawnTimes: []
            };
        }
        
        const stats = Memory.spawns.stats[room.name];
        
        // 更新统计信息
        stats.total++;
        stats.byRole[request.role] = (stats.byRole[request.role] || 0) + 1;
        
        // 记录身体配置
        const bodyKey = request.body.map(part => BODYPART_COST[part]).join(',');
        stats.byBody[bodyKey] = (stats.byBody[bodyKey] || 0) + 1;
        
        // 记录生成时间
        stats.lastSpawn = Game.time;
        stats.spawnTimes.push(Game.time);
        
        // 只保留最近1000个tick的生成记录
        stats.spawnTimes = stats.spawnTimes.filter(time => Game.time - time <= 1000);
        
        // 记录日志
        console.log(`房间 ${room.name} 生成了新的 ${request.role} (总数: ${stats.total})`);
    }

    updateStats(room) {
        const stats = Memory.spawns.stats[room.name];
        if (!stats) return;
        
        console.log(`房间 ${room.name} 孵化统计:
            总孵化数: ${stats.total}
            角色分布:
            ${Object.entries(stats.byRole)
                .map(([role, count]) => `${role}: ${count}`)
                .join('\n            ')}`);
    }

    getRolePriority(role) {
        const priorities = {
            harvester: 100,
            carrier: 90,
            miner: 85,
            upgrader: 80,
            builder: 70,
            repairer: 60,
            linkManager: 85,
            mineralHarvester: 65,
            nukeManager: 50,
            storageManager: 75,
            scout: 50,
            defender: 95,
            rangedAttacker: 40,
            healer: 30
        };
        
        return priorities[role] || 0;
    }

    // 可视化creep生成过程
    visualizeSpawning(spawn, role) {
        // 获取生成进度
        const spawningCreep = Game.creeps[spawn.spawning.name];
        if (!spawningCreep) return;
        
        // 计算生成进度百分比
        const progress = (spawningCreep.ticksToLive / LIMITS.ROLES[role].lifetime) * 100;
        
        // 创建进度条
        const barLength = 10;
        const filledLength = Math.floor(progress / 100 * barLength);
        const emptyLength = barLength - filledLength;
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
        
        // 显示生成信息
        spawn.room.visual.text(
            `正在生成 ${role} ${progressBar} ${Math.floor(progress)}%`,
            spawn.pos.x,
            spawn.pos.y - 1,
            {
                align: 'center',
                color: '#ffffff'
            }
        );
        
        // 显示剩余时间
        spawn.room.visual.text(
            `${spawningCreep.ticksToLive} ticks`,
            spawn.pos.x,
            spawn.pos.y + 1,
            {
                align: 'center',
                color: '#ffffff'
            }
        );
    }

    // 添加检查能量自动再生的方法
    checkEnergyRegeneration(room) {
        // 添加检测间隔，减少CPU消耗
        if(!room.memory.lastEnergyRegenCheck) {
            room.memory.lastEnergyRegenCheck = 0;
        }
        
        // 每15个tick检查一次
        if(Game.time - room.memory.lastEnergyRegenCheck < 15) {
            return;
        }
        
        // 更新最后检查时间
        room.memory.lastEnergyRegenCheck = Game.time;
        
        // 获取房间能量状态
        const energyUtils = require('energyUtils');
        const emergency = energyUtils.checkEnergyEmergency(room);
        
        // 检查是否处于紧急状态
        if(emergency.isEmergency) {
            // 记录低能量状态
            if(!room.memory.lowEnergy) {
                room.memory.lowEnergy = {
                    startTime: Game.time,
                    lastCheck: Game.time,
                    level: emergency.level
                };
                console.log(`房间 ${room.name} ${emergency.reason}，启动能量自动再生模式 (级别: ${emergency.level})`);
            } else {
                room.memory.lowEnergy.lastCheck = Game.time;
                room.memory.lowEnergy.level = emergency.level;
            }
            
            // 如果低能量状态持续超过100个tick，采取进一步措施
            if(room.memory.lowEnergy.startTime && Game.time - room.memory.lowEnergy.startTime > 100) {
                // 检查是否已经有紧急harvester在队列中
                const hasEmergencyHarvester = Memory.spawns.queues[room.name].queue.some(req => 
                    req.role === 'harvester' && req.priority <= 0
                );
                
                // 根据紧急程度决定是否添加紧急harvester
                if(!hasEmergencyHarvester && emergency.level >= 2) {
                    // 计算当前harvester数量
                    const harvesterCount = _.filter(Game.creeps, c => 
                        c.memory.role === 'harvester' && c.room.name === room.name
                    ).length;
                    
                    // 计算目标harvester数量
                    const roomCreepCount = _.filter(Game.creeps, c => c.room.name === room.name).length;
                    const targetHarvesterCount = Math.ceil(roomCreepCount * (emergency.adjustedRatios.harvester || 0.3));
                    
                    // 如果当前harvester数量低于目标数量，添加紧急harvester
                    if(harvesterCount < targetHarvesterCount) {
                        // 添加紧急harvester到队列
                        this.queueCreep(room, {
                            role: 'harvester',
                            priority: -1, // 最高优先级
                            body: [WORK, CARRY, MOVE], // 最基础的体型
                            memory: {
                                emergency: true
                            }
                        });
                        
                        // 确保队列已排序
                        Memory.spawns.queues[room.name].queue.sort((a, b) => a.priority - b.priority);
                        
                        console.log(`房间 ${room.name} ${emergency.reason}，添加紧急harvester (当前: ${harvesterCount}, 目标: ${targetHarvesterCount})`);
                    }
                }
                
                // 如果能量严重不足，尝试使用紧急能量恢复措施
                if(emergency.level >= 3) {
                    const status = energyUtils.getRoomStatus(room);
                    if(status.totalEnergyLevel < 0.1) {
                        energyUtils.emergencyEnergyRecovery(room);
                    }
                }
            }
            
            // 优化能量分配策略
            this.optimizeEnergyAllocation(room);
        } else {
            // 如果能量恢复，清除低能量状态
            if(room.memory.lowEnergy) {
                console.log(`房间 ${room.name} 能量已恢复到足够水平，退出能量自动再生模式`);
                delete room.memory.lowEnergy;
                
                // 恢复正常操作
                energyUtils.restoreNormalOperations(room);
            }
        }
    }
    
    // 添加优化能量分配策略的方法
    optimizeEnergyAllocation(room) {
        // 获取所有母巢
        const spawns = room.find(FIND_MY_SPAWNS);
        
        // 计算每个母巢的能量
        let totalSpawnEnergy = 0;
        spawns.forEach(spawn => {
            totalSpawnEnergy += spawn.store[RESOURCE_ENERGY];
        });
        
        // 计算扩展的能量
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        
        let totalExtensionEnergy = 0;
        extensions.forEach(extension => {
            totalExtensionEnergy += extension.store[RESOURCE_ENERGY];
        });
        
        // 如果母巢能量足够但扩展能量不足，考虑从母巢转移能量到扩展
        if(totalSpawnEnergy >= spawns.length * 250 && totalExtensionEnergy < extensions.length * 50) {
            // 找出能量最多的母巢
            const richestSpawn = _.max(spawns, s => s.store[RESOURCE_ENERGY]);
            
            // 找出能量最少的扩展
            const poorestExtension = _.min(extensions, e => e.store[RESOURCE_ENERGY]);
            
            // 如果找到了合适的建筑，添加能量转移任务
            if(richestSpawn && poorestExtension && richestSpawn.store[RESOURCE_ENERGY] > 250 && poorestExtension.store[RESOURCE_ENERGY] < 50) {
                // 检查是否已经有能量转移任务
                const hasTransferTask = room.memory.tasks && room.memory.tasks.some(task => 
                    task.type === 'transferEnergy' && task.targetId === poorestExtension.id
                );
                
                if(!hasTransferTask) {
                    // 添加能量转移任务
                    if(!room.memory.tasks) {
                        room.memory.tasks = [];
                    }
                    
                    room.memory.tasks.push({
                        id: `transferEnergy_${Game.time}`,
                        type: 'transferEnergy',
                        sourceId: richestSpawn.id,
                        targetId: poorestExtension.id,
                        amount: Math.min(richestSpawn.store[RESOURCE_ENERGY] - 250, 50 - poorestExtension.store[RESOURCE_ENERGY]),
                        priority: 1, // 高优先级
                        created: Game.time
                    });
                    
                    console.log(`房间 ${room.name} 添加能量转移任务：从母巢 ${richestSpawn.id} 到扩展 ${poorestExtension.id}`);
                }
            }
        }
    }

    // 获取全局creep数量限制
    getGlobalCreepLimit(room) {
        // 获取所有我的房间
        const myRooms = _.filter(Game.rooms, r => r.controller && r.controller.my);
        
        // 计算每个房间的基础限制
        let totalLimit = 0;
        for (const r of myRooms) {
            const rcl = r.controller.level;
            totalLimit += Math.min(
                rcl * LIMITS.GLOBAL.BASE_PER_ROOM,
                LIMITS.GLOBAL.MAX_PER_ROOM
            );
        }
        
        // 添加额外的余量
        totalLimit += LIMITS.GLOBAL.EXTRA_SLOTS;
        
        // 确保不超过绝对上限
        return Math.min(totalLimit, LIMITS.GLOBAL.ABSOLUTE_MAX);
    }

    // 根据能源状态动态调整目标数量
    adjustTargetCountsByEnergyStatus(counts, room) {
        const energyStatus = room.memory.energyStatus;
        if (!energyStatus) return;
        
        // 获取当前能源状态
        const currentStatus = energyStatus.currentStatus;
        const energyLevel = energyStatus.energyLevel;
        
        // 根据能源状态调整数量
        switch(currentStatus) {
            case 'critical':
                // 在危急状态下，增加harvester和carrier的数量
                counts.harvester = Math.min(
                    counts.harvester * 1.5,
                    this.getMaxHarvesters(room.controller.level, energyStatus.harvestPositions)
                );
                counts.carrier = Math.min(
                    counts.carrier * 1.5,
                    this.getMaxCarriers(room.controller.level)
                );
                // 减少其他角色的数量
                counts.upgrader = Math.max(1, Math.floor(counts.upgrader * 0.5));
                counts.builder = Math.max(1, Math.floor(counts.builder * 0.5));
                counts.repairer = Math.max(1, Math.floor(counts.repairer * 0.5));
                break;
                
            case 'low':
                // 在低能源状态下，适度增加harvester和carrier的数量
                counts.harvester = Math.min(
                    counts.harvester * 1.2,
                    this.getMaxHarvesters(room.controller.level, energyStatus.harvestPositions)
                );
                counts.carrier = Math.min(
                    counts.carrier * 1.2,
                    this.getMaxCarriers(room.controller.level)
                );
                // 适度减少其他角色的数量
                counts.upgrader = Math.max(1, Math.floor(counts.upgrader * 0.8));
                counts.builder = Math.max(1, Math.floor(counts.builder * 0.8));
                counts.repairer = Math.max(1, Math.floor(counts.repairer * 0.8));
                break;
                
            case 'high':
                // 在高能源状态下，可以增加其他角色的数量
                counts.upgrader = Math.min(
                    counts.upgrader * 1.2,
                    this.getMaxUpgraders(room.controller.level)
                );
                counts.builder = Math.min(
                    counts.builder * 1.2,
                    this.getMaxBuilders(room.controller.level, room.find(FIND_CONSTRUCTION_SITES).length)
                );
                counts.repairer = Math.min(
                    counts.repairer * 1.2,
                    this.getMaxRepairers(room.controller.level)
                );
                break;
        }
        
        // 确保总数不超过全局限制
        let total = 0;
        for(let role in counts) {
            total += counts[role];
        }
        
        const globalLimit = Math.min(
            room.controller.level * LIMITS.GLOBAL.BASE_PER_ROOM,
            LIMITS.GLOBAL.MAX_PER_ROOM
        );
        
        if(total > globalLimit) {
            // 角色优先级（数字越小优先级越高）
            const rolePriorities = room.memory.rolePriorities || {
                harvester: 1,
                carrier: 2,
                upgrader: 3,
                builder: 4,
                repairer: 5,
                defender: 1,
                healer: 2,
                rangedAttacker: 2,
                scout: 6,
                mineralHarvester: 7,
                linkManager: 5,
                nukeManager: 8,
                storageManager: 5
            };
            
            // 按优先级排序角色
            const sortedRoles = Object.keys(counts).sort((a, b) => 
                (rolePriorities[a] || 99) - (rolePriorities[b] || 99)
            );
            
            // 在资源有限时，优先保证高优先级角色的数量
            let remainingSlots = globalLimit;
            for(const role of sortedRoles) {
                const desired = counts[role];
                counts[role] = Math.min(desired, remainingSlots);
                remainingSlots -= counts[role];
                if(remainingSlots <= 0) break;
            }
        }
    }
    
    // 获取harvester的最大数量
    getMaxHarvesters(rcl, harvestPositions) {
        const limits = LIMITS.ROLES.harvester;
        
        // 根据控制器等级和可开采位置计算最大数量
        let maxCount = harvestPositions;
        
        // 根据控制器等级调整
        if (rcl <= 2) {
            maxCount = Math.min(maxCount, limits.rcl2);
        } else if (rcl <= 4) {
            maxCount = Math.min(maxCount, limits.rcl4);
        } else {
            maxCount = Math.min(maxCount, limits.max);
        }
        
        return maxCount;
    }
    
    getMaxCarriers(rcl) {
        const limits = LIMITS.ROLES.carrier;
        
        // 根据控制器等级返回最大数量
        if (rcl <= 2) {
            return limits.rcl2;
        } else if (rcl <= 4) {
            return limits.rcl4;
        } else {
            return limits.max;
        }
    }
    
    getMaxUpgraders(rcl) {
        const limits = LIMITS.ROLES.upgrader;
        
        // 根据控制器等级计算最大数量
        const maxCount = Math.min(rcl + limits.base, limits.max);
        
        return maxCount;
    }
    
    getMaxBuilders(rcl, constructionSites) {
        const limits = LIMITS.ROLES.builder;
        
        // 如果没有建筑工地，返回0
        if (constructionSites === 0) {
            return 0;
        }
        
        // 根据控制器等级和建筑工地数量计算最大数量
        const maxCount = Math.min(rcl, limits.max);
        
        return maxCount;
    }
    
    getMaxRepairers(rcl) {
        const limits = LIMITS.ROLES.repairer;
        return Math.min(Math.floor(rcl/2), limits.max);
    }

    getMaxDefenders(rcl) {
        return LIMITS.ROLES.defender.max;
    }

    getMaxHealers(rcl) {
        return LIMITS.ROLES.healer.max;
    }

    getMaxRangedAttackers(rcl) {
        const limits = LIMITS.ROLES.rangedAttacker;
        
        // 返回最大数量限制
        return limits.max;
    }

    getMaxScouts(rcl) {
        const limits = LIMITS.ROLES.scout;
        
        // 返回最大数量限制
        return limits.max;
    }

    // 获取mineralHarvester的最大数量
    getMaxMineralHarvesters(rcl) {
        const limits = LIMITS.ROLES.mineralHarvester;
        
        // 返回最大数量限制
        return limits.max;
    }

    getMaxLinkManagers(rcl) {
        return LIMITS.ROLES.linkManager.max;
    }

    getMaxNukeManagers(rcl) {
        return LIMITS.ROLES.nukeManager.max;
    }

    getMaxStorageManagers(rcl) {
        return LIMITS.ROLES.storageManager.max;
    }

    // 添加限制检查方法
    checkLimits(room) {
        const totalCreeps = Object.keys(Game.creeps).length;
        const maxCreeps = this.getGlobalCreepLimit(room);
        
        if (totalCreeps >= maxCreeps) {
            console.log(`房间 ${room.name} 已达到全局creep数量限制 (${totalCreeps}/${maxCreeps})`);
            return false;
        }
        
        return true;
    }

    // 根据角色和房间状态获取creep的身体配置
    getCreepBody(role, room) {
        const rcl = room.controller.level;
        const energyAvailable = room.energyAvailable;
        const energyCapacity = room.energyCapacityAvailable;
        
        // 获取角色特定的身体配置
        const roleConfig = LIMITS.ROLES[role];
        if (!roleConfig) {
            console.log(`未知角色: ${role}`);
            return [WORK, CARRY, MOVE];
        }
        
        // 获取基础身体配置
        let body = roleConfig.body;
        
        // 根据控制器等级调整身体大小
        const maxParts = Math.min(
            Math.floor(energyCapacity / 200), // 每个部分200能量
            roleConfig.maxParts
        );
        
        // 确保身体大小不超过最大限制
        if (body.length > maxParts) {
            body = body.slice(0, maxParts);
        }
        
        // 根据可用能量调整身体大小
        if (energyAvailable < energyCapacity) {
            const affordableParts = Math.floor(energyAvailable / 200);
            if (affordableParts < body.length) {
                body = body.slice(0, affordableParts);
            }
        }
        
        // 确保至少有一个基本部分
        if (body.length === 0) {
            body = [WORK, CARRY, MOVE];
        }
        
        return body;
    }
}

module.exports = {
    spawnCreeps: function(room) {
        // 添加安全检查
        if (!room || !Game.rooms[room.name]) {
            console.log(`无法为无效房间生成 creeps: ${room ? room.name : 'undefined'}`);
            return;
        }
        
        try {
            const manager = new SpawnManager(room);
            manager.run();
        } catch (error) {
            console.log(`房间 ${room.name} 生成 creeps 时出错: ${error.stack || error}`);
        }
    },
    
    // 导出SpawnManager类，以便commands.js可以使用
    SpawnManager: SpawnManager
};