const PRIORITY_LEVELS = {
    EMERGENCY: 0,    // 紧急情况（如没有采集者）
    CRITICAL: 1,     // 关键角色（如carrier）
    HIGH: 2,        // 高优先级（如upgrader）
    MEDIUM: 3,      // 中等优先级（如builder）
    LOW: 4          // 低优先级（如scout）
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
        const globalLimit = Math.min(rcl * 3, 12); // RCL 3最多9个creep
        
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
                counts.defender = Math.min(hostiles, 3);
                counts.healer = Math.floor(hostiles/2);
                counts.rangedAttacker = Math.min(hostiles, 2);
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
            
            // 控制器等级5及以上时，添加链接管理者
            if(rcl >= 5) {
                // 检查房间中是否有链接
                const links = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_LINK
                });
                
                if(links.length > 0) {
                    // 每个房间分配一个链接管理者
                    counts.linkManager = 1;
                }
            }
            
            // 控制器等级8及以上时，添加核弹管理者
            if(rcl >= 8) {
                // 检查房间中是否有核弹发射井
                const nukers = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_NUKER
                });
                
                if(nukers.length > 0) {
                    // 每个房间分配一个核弹管理者
                    counts.nukeManager = 1;
                }
            }
            
            // 控制器等级6及以上时，添加矿物采集者
            if(rcl >= 6) {
                // 检查房间中是否有矿物和提取器
                const minerals = room.find(FIND_MINERALS);
                const extractors = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTRACTOR
                });
                
                if(minerals.length > 0 && extractors.length > 0) {
                    // 每个矿物分配一个矿物采集者
                    counts.mineralHarvester = minerals.length;
                }
            }
            
            // 控制器等级4及以上时，添加存储管理者
            if(rcl >= 4) {
                // 检查房间中是否有存储
                const storage = room.storage;
                
                if(storage) {
                    // 每个房间分配一个存储管理者
                    counts.storageManager = 1;
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
            defender: hostiles > 0 ? Math.min(hostiles, 3) : 0,
            healer: hostiles > 0 ? Math.floor(hostiles/2) : 0,
            rangedAttacker: hostiles > 0 ? Math.min(hostiles, 2) : 0,
            scout: rcl >= 3 ? 1 : 0,
            mineralHarvester: 0, // 默认为0
            linkManager: 0, // 默认为0
            nukeManager: 0, // 默认为0
            storageManager: 0, // 默认为0
            carrier: 0 // 默认为0，将在下面根据需求计算
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
            // 基础carrier数量
            let carrierCount = 1; // 至少保留1个carrier处理掉落资源和基本运输
            
            // 根据存储建筑数量增加carrier
            if(storageStructures.length > 0) {
                carrierCount += Math.min(Math.floor(storageStructures.length / 2), 2);
            }
            
            // 根据需要能量的建筑数量增加carrier
            if(energyNeedingStructures.length > 5) {
                carrierCount += 1;
            }
            
            // 根据控制器等级限制carrier数量
            counts.carrier = Math.min(carrierCount, this.getMaxCarriers(rcl));
        }
        
        // 控制器等级5及以上时，添加链接管理者
        if(rcl >= 5) {
            // 检查房间中是否有链接
            const links = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LINK
            });
            
            if(links.length > 0) {
                // 每个房间分配一个链接管理者
                counts.linkManager = 1;
            }
        }
        
        // 控制器等级8及以上时，添加核弹管理者
        if(rcl >= 8) {
            // 检查房间中是否有核弹发射井
            const nukers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_NUKER
            });
            
            if(nukers.length > 0) {
                // 每个房间分配一个核弹管理者
                counts.nukeManager = 1;
            }
        }
        
        // 控制器等级6及以上时，添加矿物采集者
        if(rcl >= 6) {
            // 检查房间中是否有矿物和提取器
            const minerals = room.find(FIND_MINERALS);
            const extractors = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_EXTRACTOR
            });
            
            if(minerals.length > 0 && extractors.length > 0) {
                // 每个矿物分配一个矿物采集者
                counts.mineralHarvester = minerals.length;
            }
        }
        
        // 控制器等级4及以上时，添加存储管理者
        if(rcl >= 4) {
            // 检查房间中是否有存储
            const storage = room.storage;
            
            if(storage) {
                // 每个房间分配一个存储管理者
                counts.storageManager = 1;
            }
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

    queueCreep(room, request) {
        const roomQueue = Memory.spawns.queues[room.name];
        
        // 创建新的请求
        const spawnRequest = {
            role: request.role,
            body: request.body,
            priority: request.priority,
            timeAdded: Game.time
        };
        
        // 将请求添加到队列并按优先级排序
        roomQueue.queue.push(spawnRequest);
        roomQueue.queue.sort((a, b) => a.priority - b.priority);
        
        // 限制队列长度
        if (roomQueue.queue.length > 20) {
            roomQueue.queue = roomQueue.queue.slice(0, 20);
        }
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
        
        // 检查全局creep数量限制
        const totalCreeps = Object.keys(Game.creeps).length;
        const maxCreeps = this.getGlobalCreepLimit(room);
        
        if (totalCreeps >= maxCreeps) {
            console.log(`房间 ${room.name} 已达到全局creep数量限制 (${totalCreeps}/${maxCreeps})`);
            return;
        }
        
        // 获取房间能量状态
        const energyUtils = require('energyUtils');
        const emergency = energyUtils.checkEnergyEmergency(room);
        
        // 计算当前房间各角色的creep数量
        const roomCreeps = _.filter(Game.creeps, creep => creep.room.name === room.name);
        const roleCounts = {};
        roomCreeps.forEach(creep => {
            roleCounts[creep.memory.role] = (roleCounts[creep.memory.role] || 0) + 1;
        });
        const roomCreepCount = roomCreeps.length;
        
        // 根据紧急状态调整队列优先级
        if(emergency.isEmergency) {
            // 重新计算各角色的目标数量
            const targetCounts = {};
            if(emergency.adjustedRatios) {
                for(let role in emergency.adjustedRatios) {
                    targetCounts[role] = Math.ceil(roomCreepCount * emergency.adjustedRatios[role]);
                }
            }
            
            // 检查harvester数量是否足够
            const harvesterCount = roleCounts['harvester'] || 0;
            const targetHarvesterCount = targetCounts['harvester'] || Math.ceil(roomCreepCount * 0.3);
            
            // 计算harvester的最大数量限制
            const harvestPositions = energyUtils.countHarvestPositions(room);
            const rcl = room.controller ? room.controller.level : 0;
            const maxHarvesters = rcl <= 2 ? harvestPositions : 
                                 rcl <= 4 ? Math.min(harvestPositions, rcl * 1.5) : 
                                 Math.min(harvestPositions, rcl * 2);
            
            // 确保目标harvester数量不超过最大限制
            const adjustedTargetHarvesterCount = Math.min(targetHarvesterCount, Math.floor(maxHarvesters));
            
            // 检查是否需要更多harvester
            const needsHarvesters = harvesterCount < adjustedTargetHarvesterCount;
            
            // 在紧急状态下，强制重置所有请求的优先级
            roomQueue.queue.forEach(req => {
                // 保存原始优先级
                if(!req.originalPriority && req.priority !== undefined) {
                    req.originalPriority = req.priority;
                }
                
                // 设置新的优先级
                if(req.role === 'harvester') {
                    // harvester始终有最高优先级
                    req.priority = -100;
                } else if(req.role === 'carrier') {
                    // carrier次之
                    req.priority = 100;
                } else if(req.role === 'builder' || req.role === 'repairer') {
                    // builder和repairer再次之
                    req.priority = 200;
                } else {
                    // 其他角色最低优先级
                    req.priority = 300;
                }
            });
            
            // 重新排序队列
            roomQueue.queue.sort((a, b) => a.priority - b.priority);
            
            // 在紧急情况下，记录调整后的队列状态
            if(emergency.level >= 2) {
                console.log(`房间 ${room.name} 进入能量紧急状态: ${emergency.reason}`);
                console.log(`[紧急] 房间 ${room.name} 能量状态: ${emergency.reason}, 调整后的队列:`);
                roomQueue.queue.slice(0, 3).forEach((req, i) => {
                    console.log(`  ${i+1}. ${req.role} (优先级: ${req.priority})`);
                });
            }
            
            // 在紧急状态下，检查是否需要强制生产harvester
            if(emergency.level >= 2 && needsHarvesters) {
                // 检查队列中是否已有harvester请求
                const harvesterRequestsInQueue = roomQueue.queue.filter(req => req.role === 'harvester').length;
                
                // 检查正在生产的harvester数量
                const harvesterSpawning = room.find(FIND_MY_SPAWNS).filter(spawn => 
                    spawn.spawning && 
                    Game.creeps[spawn.spawning.name] && 
                    Game.creeps[spawn.spawning.name].memory.role === 'harvester'
                ).length;
                
                // 计算总的harvester数量（现有 + 正在生产 + 队列中）
                const totalHarvesters = harvesterCount + harvesterSpawning + harvesterRequestsInQueue;
                
                // 如果总数仍然小于目标数量，添加新的harvester请求
                if(totalHarvesters < adjustedTargetHarvesterCount) {
                    console.log(`[紧急] 房间 ${room.name} 需要更多harvester (当前: ${harvesterCount}, 生产中: ${harvesterSpawning}, 队列中: ${harvesterRequestsInQueue}, 目标: ${adjustedTargetHarvesterCount})`);
                    
                    this.queueCreep(room, {
                        role: 'harvester',
                        priority: -100, // 最高优先级
                        body: [WORK, CARRY, MOVE], // 最基础的体型
                        memory: {
                            emergency: true
                        }
                    });
                    
                    // 重新排序队列
                    roomQueue.queue.sort((a, b) => a.priority - b.priority);
                }
            }
        } else {
            // 如果不是紧急状态，恢复原始优先级
            roomQueue.queue.forEach(req => {
                if(req.originalPriority !== undefined) {
                    req.priority = req.originalPriority;
                    delete req.originalPriority;
                }
            });
            
            // 重新排序队列
            roomQueue.queue.sort((a, b) => a.priority - b.priority);
        }
        
        // 处理队列中的请求
        let processedCount = 0;
        const maxProcessPerTick = Math.min(availableSpawns.length, roomQueue.queue.length);
        
        // 在紧急状态下，检查是否需要强制生产harvester
        let forceHarvester = false;
        if(emergency.isEmergency && emergency.level >= 2) {
            const harvesterCount = roleCounts['harvester'] || 0;
            
            // 计算harvester的最大数量限制
            const harvestPositions = energyUtils.countHarvestPositions(room);
            const rcl = room.controller ? room.controller.level : 0;
            const maxHarvesters = rcl <= 2 ? harvestPositions : 
                                 rcl <= 4 ? Math.min(harvestPositions, rcl * 1.5) : 
                                 Math.min(harvestPositions, rcl * 2);
            
            // 计算目标harvester数量，并确保不超过最大限制
            const targetHarvesterCount = emergency.adjustedRatios ? 
                Math.ceil(roomCreepCount * emergency.adjustedRatios.harvester) : 
                Math.ceil(roomCreepCount * 0.3);
            
            const adjustedTargetHarvesterCount = Math.min(targetHarvesterCount, Math.floor(maxHarvesters));
            
            forceHarvester = harvesterCount < adjustedTargetHarvesterCount;
        }
        
        for (let i = 0; i < maxProcessPerTick; i++) {
            // 获取队列中的请求
            const request = roomQueue.queue[i - processedCount];
            
            // 检查是否有足够的能量
            const bodyCost = this.calculateBodyCost(request.body);
            if (room.energyAvailable < bodyCost) continue;
            
            // 在紧急状态下，如果需要强制生产harvester，跳过非harvester请求
            if(forceHarvester && request.role !== 'harvester') {
                continue;
            }
            
            // 获取一个可用的母巢
            const spawn = availableSpawns[0];
            
            // 尝试孵化
            const creepName = this.generateCreepName(request.role);
            const result = spawn.spawnCreep(request.body, creepName, {
                memory: {
                    role: request.role,
                    room: room.name,
                    working: false,
                    spawnTime: Game.time,
                    spawnName: spawn.name,
                    emergency: request.memory && request.memory.emergency
                }
            });
            
            // 如果孵化成功，从队列中移除请求并从可用母巢列表中移除已使用的母巢
            if (result === OK) {
                roomQueue.queue.splice(i - processedCount, 1);
                availableSpawns.shift();
                processedCount++;
                
                // 更新角色计数
                roleCounts[request.role] = (roleCounts[request.role] || 0) + 1;
                
                console.log(`房间 ${room.name} 的母巢 ${spawn.name} 开始孵化 ${request.role}: ${creepName}`);
                
                // 更新统计信息
                this.recordSpawn(room, request);
                
                // 可视化孵化过程
                this.visualizeSpawning(spawn, request.role);
                
                // 更新最后处理时间，用于能量紧急状态检测
                roomQueue.lastProcessedTime = Game.time;
            }
        }
    }

    calculateBodyCost(body) {
        return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
    }

    generateCreepName(role) {
        return role.charAt(0).toUpperCase() + role.slice(1) + Game.time;
    }

    recordSpawn(room, request) {
        if (!Memory.spawns.stats[room.name]) {
            Memory.spawns.stats[room.name] = {
                spawns: {},
                totalSpawns: 0
            };
        }
        
        const stats = Memory.spawns.stats[room.name];
        stats.totalSpawns++;
        
        if (!stats.spawns[request.role]) {
            stats.spawns[request.role] = 0;
        }
        stats.spawns[request.role]++;
    }

    updateStats(room) {
        const stats = Memory.spawns.stats[room.name];
        if (!stats) return;
        
        console.log(`房间 ${room.name} 孵化统计:
            总孵化数: ${stats.totalSpawns}
            角色分布:
            ${Object.entries(stats.spawns)
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

    // 添加可视化孵化过程的方法
    visualizeSpawning(spawn, role) {
        const visual = new RoomVisual(spawn.room.name);
        
        // 在母巢上方显示正在孵化的角色
        visual.text(
            `🥚 ${role}`,
            spawn.pos.x,
            spawn.pos.y - 0.5,
            {color: 'yellow', font: 0.5, align: 'center'}
        );
        
        // 添加到房间内存中，以便可视化模块使用
        if (!spawn.room.memory.visualizer) {
            spawn.room.memory.visualizer = {};
        }
        
        if (!spawn.room.memory.visualizer.spawns) {
            spawn.room.memory.visualizer.spawns = {};
        }
        
        spawn.room.memory.visualizer.spawns[spawn.name] = {
            role: role,
            startTime: Game.time
        };
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
        // 基于控制器等级计算每个房间的基础限制
        const rcl = room.controller.level;
        const baseLimit = Math.min(rcl * 3, 12);
        
        // 计算所有我的房间
        const myRooms = _.filter(Game.rooms, r => r.controller && r.controller.my);
        
        // 计算全局限制 - 每个房间的基础限制之和，加上一些额外的余量
        let globalLimit = 0;
        for (const r of myRooms) {
            const roomRcl = r.controller.level;
            globalLimit += Math.min(roomRcl * 3, 12);
        }
        
        // 添加一些额外的余量用于远征和防御
        globalLimit += 10;
        
        // 设置一个绝对上限，防止内存溢出
        return Math.min(globalLimit, 100);
    }

    // 根据能源状态动态调整目标数量
    adjustTargetCountsByEnergyStatus(counts, room) {
        // 获取能源状态
        let energyStatus = 'normal';
        if(room.memory.energyDistributor && room.memory.energyDistributor.status) {
            energyStatus = room.memory.energyDistributor.status.level || 'normal';
        }
        
        const energyUtils = require('energyUtils');
        
        // 在能源紧急状态下，优先保证harvester和carrier
        if(energyStatus === 'critical') {
            // 增加harvester和carrier的目标数量
            counts.harvester = Math.min(counts.harvester + 1, this.getMaxHarvesters(room.controller.level, energyUtils.countHarvestPositions(room)));
            if(counts.carrier) {
                counts.carrier = Math.min(counts.carrier + 1, this.getMaxCarriers(room.controller.level));
            }
            
            // 减少其他角色的目标数量
            for(let role in counts) {
                if(role !== 'harvester' && role !== 'carrier' && role !== 'defender' && role !== 'healer' && role !== 'rangedAttacker') {
                    counts[role] = Math.max(Math.floor(counts[role] * 0.5), 0);
                }
            }
        } else if(energyStatus === 'low') {
            // 在能源低状态下，略微调整
            for(let role in counts) {
                if(role !== 'harvester' && role !== 'carrier' && role !== 'defender' && role !== 'healer' && role !== 'rangedAttacker') {
                    counts[role] = Math.max(Math.floor(counts[role] * 0.8), 0);
                }
            }
        }
        
        return counts;
    }
    
    // 获取各角色的最大数量
    getMaxHarvesters(rcl, harvestPositions) {
        return Math.min(harvestPositions, rcl <= 2 ? rcl + 1 : 
                        rcl <= 4 ? Math.min(rcl * 1.5, 4) : 
                        Math.min(rcl, 4));
    }
    
    getMaxCarriers(rcl) {
        return rcl <= 2 ? 1 : rcl <= 4 ? 2 : 3;
    }
    
    getMaxUpgraders(rcl) {
        return Math.min(rcl + 1, 3);
    }
    
    getMaxBuilders(rcl, constructionSites) {
        return constructionSites > 0 ? Math.min(rcl, 3) : 0;
    }
    
    getMaxRepairers(rcl) {
        return Math.min(Math.floor(rcl/2), 2);
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