/**
 * 能源分配优化系统
 * 根据控制器等级智能调整能源收集和分配策略
 * 与resourceManager协同工作，专注于能源收集和分配
 */

const energyUtils = require('energyUtils');

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每5个tick运行一次
        if(Game.time % 5 !== 0) return;
        
        // 初始化内存
        if(!room.memory.energyDistributor) {
            this.initializeMemory(room);
        }
        
        try {
            // 分析房间能源状态
            this.analyzeEnergyStatus(room);
            
            // 优化能源收集
            this.optimizeEnergyCollection(room);
            
            // 优化能源分配
            this.optimizeEnergyDistribution(room);
            
            // 调整creep角色比例
            this.adjustCreepRatios(room);
            
            // 更新统计数据
            this.updateStats(room);
            
            // 与resourceManager共享状态
            this.shareStatusWithResourceManager(room);
            
            // 记录调试信息
            if(Game.time % 100 === 0) {
                console.log(`[energyDistributor] 房间 ${room.name} 能源状态: ${room.memory.energyDistributor.status.level}, 采集效率: ${(room.memory.energyDistributor.collection.efficiency * 100).toFixed(2)}%`);
            }
        } catch(error) {
            console.log(`房间 ${room.name} 能源分配系统错误：${error}`);
        }
    },
    
    // 初始化内存
    initializeMemory: function(room) {
        const rcl = room.controller.level;
        
        room.memory.energyDistributor = {
            status: {
                level: 'normal', // normal, low, critical
                lastUpdate: Game.time
            },
            collection: {
                sources: {},
                efficiency: 0
            },
            distribution: {
                priorities: this.getDistributionPriorities(rcl),
                targets: {}
            },
            creepRatios: this.getCreepRatios(rcl, 'normal'),
            stats: {
                collectionRate: [],
                distributionRate: [],
                efficiency: []
            }
        };
        
        // 确保spawnQueue存在
        this.ensureSpawnQueue(room);
    },
    
    // 确保spawnQueue存在
    ensureSpawnQueue: function(room) {
        if(!Memory.spawns) {
            Memory.spawns = { queues: {} };
        }
        
        if(!Memory.spawns.queues[room.name]) {
            Memory.spawns.queues[room.name] = { queue: [], energyRequests: [] };
        }
        
        if(!Memory.spawns.queues[room.name].energyRequests) {
            Memory.spawns.queues[room.name].energyRequests = [];
        }
        
        // 不再创建room.memory.spawnQueue，统一使用Memory.spawns.queues
    },
    
    // 与resourceManager共享状态
    shareStatusWithResourceManager: function(room) {
        if(!room.memory.resources) return;
        
        // 将能源状态信息共享给resourceManager
        room.memory.resources.status.energy = {
            level: room.memory.energyDistributor.status.level,
            efficiency: room.memory.energyDistributor.collection.efficiency,
            lastUpdate: Game.time
        };
    },
    
    // 根据控制器等级获取分配优先级
    getDistributionPriorities: function(rcl) {
        // 基础优先级
        const priorities = {
            [STRUCTURE_SPAWN]: 1,
            [STRUCTURE_EXTENSION]: 2,
            [STRUCTURE_TOWER]: 3,
            [STRUCTURE_STORAGE]: 4,
            [STRUCTURE_CONTAINER]: 6  // 降低容器优先级
        };
        
        // 根据控制器等级调整
        if(rcl <= 2) {
            // 低级别时，优先填充spawn和extension
            priorities[STRUCTURE_SPAWN] = 1;
            priorities[STRUCTURE_EXTENSION] = 1;
        } else if(rcl <= 4) {
            // 中级别时，平衡填充
            priorities[STRUCTURE_TOWER] = 2;
        } else {
            // 高级别时，增加存储优先级
            priorities[STRUCTURE_STORAGE] = 3;
            priorities[STRUCTURE_TERMINAL] = 3;
        }
        
        return priorities;
    },
    
    // 根据控制器等级和能源状态获取creep比例
    getCreepRatios: function(rcl, energyStatus) {
        let ratios = {};
        
        // 根据控制器等级设置基础比例
        if(rcl <= 2) {
            // 控制器1-2级：专注于能源收集和升级
            ratios = {
                harvester: 0.40,
                upgrader: 0.35,
                builder: 0.25
            };
            
            // 检查是否有容器或掉落资源
            const room = this.getCurrentRoom();
            if(room) {
                const containers = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                });
                
                const droppedResources = room.find(FIND_DROPPED_RESOURCES).length;
                
                // 如果有容器或掉落资源，添加一个carrier
                if(containers.length > 0 || droppedResources > 0) {
                    ratios.carrier = 0.15;
                    
                    // 从其他角色中均匀减少比例
                    ratios.harvester -= 0.05;
                    ratios.upgrader -= 0.05;
                    ratios.builder -= 0.05;
                }
            }
        } else if(rcl <= 4) {
            // 控制器3-4级：平衡发展
            ratios = {
                harvester: 0.30,
                upgrader: 0.25,
                builder: 0.25,
                repairer: 0.10
            };
            
            // 检查存储建筑和资源需求
            const room = this.getCurrentRoom();
            if(room) {
                const storageStructures = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_STORAGE || 
                                s.structureType === STRUCTURE_CONTAINER
                });
                
                const energyNeedingStructures = room.find(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_SPAWN || 
                                s.structureType === STRUCTURE_EXTENSION || 
                                s.structureType === STRUCTURE_TOWER) && 
                                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
                
                const droppedResources = room.find(FIND_DROPPED_RESOURCES).length;
                
                // 根据存储建筑和资源需求计算carrier比例
                let carrierRatio = 0;
                
                if(storageStructures.length > 0 || energyNeedingStructures.length > 0 || droppedResources > 0) {
                    // 基础carrier比例
                    carrierRatio = 0.10;
                    
                    // 根据存储建筑数量增加比例
                    if(storageStructures.length >= 3) {
                        carrierRatio += 0.05;
                    }
                    
                    // 根据需要能量的建筑数量增加比例
                    if(energyNeedingStructures.length > 5) {
                        carrierRatio += 0.05;
                    }
                    
                    // 添加carrier比例
                    ratios.carrier = carrierRatio;
                    
                    // 从其他角色中均匀减少比例
                    const reduction = carrierRatio / 4;
                    ratios.harvester -= reduction;
                    ratios.upgrader -= reduction;
                    ratios.builder -= reduction;
                    ratios.repairer -= reduction;
                }
            }
            
            // 控制器4级：添加存储管理者
            if(rcl === 4) {
                // 检查房间中是否有存储
                const room = this.getCurrentRoom();
                if(room && room.storage) {
                    // 添加存储管理者
                    ratios.storageManager = 0.10;
                    
                    // 从其他角色中均匀减少比例
                    const reduction = 0.10 / (Object.keys(ratios).length - 1);
                    for(let role in ratios) {
                        if(role !== 'storageManager') {
                            ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                        }
                    }
                }
            }
        } else if(rcl <= 6) {
            // 控制器5-6级：增加专业角色
            ratios = {
                harvester: 0.20,
                upgrader: 0.15,
                builder: 0.15,
                repairer: 0.10,
                scout: 0.05,
                defender: 0.05
            };
            
            // 检查存储建筑和资源需求
            const room = this.getCurrentRoom();
            if(room) {
                const storageStructures = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_STORAGE || 
                                s.structureType === STRUCTURE_CONTAINER
                });
                
                const energyNeedingStructures = room.find(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_SPAWN || 
                                s.structureType === STRUCTURE_EXTENSION || 
                                s.structureType === STRUCTURE_TOWER) && 
                                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
                
                // 根据存储建筑和资源需求计算carrier比例
                let carrierRatio = 0;
                
                if(storageStructures.length > 0 || energyNeedingStructures.length > 0) {
                    // 基础carrier比例
                    carrierRatio = 0.15;
                    
                    // 根据存储建筑数量增加比例
                    if(storageStructures.length >= 4) {
                        carrierRatio += 0.05;
                    }
                    
                    // 添加carrier比例
                    ratios.carrier = carrierRatio;
                    
                    // 从其他角色中均匀减少比例
                    const reduction = carrierRatio / 6;
                    for(let role in ratios) {
                        if(role !== 'carrier') {
                            ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                        }
                    }
                }
                
                // 检查是否有矿物和提取器
                const minerals = room.find(FIND_MINERALS);
                const extractors = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTRACTOR
                });
                
                if(minerals.length > 0 && extractors.length > 0) {
                    // 添加矿物采集者
                    ratios.mineralHarvester = 0.10;
                    
                    // 从其他角色中均匀减少比例
                    const reduction = 0.10 / (Object.keys(ratios).length - 1);
                    for(let role in ratios) {
                        if(role !== 'mineralHarvester') {
                            ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                        }
                    }
                }
            }
            
            // 控制器5级以上：添加链接管理者
            if(rcl >= 5) {
                // 检查房间中是否有链接
                const room = this.getCurrentRoom();
                if(room) {
                    const links = room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_LINK
                    });
                    
                    if(links.length > 0) {
                        ratios.linkManager = 0.05;
                        // 从其他角色中均匀减少比例
                        const reduction = 0.05 / (Object.keys(ratios).length - 1);
                        for(let role in ratios) {
                            if(role !== 'linkManager') {
                                ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                            }
                        }
                    }
                }
            }
            
            // 控制器4级以上：添加存储管理者
            if(rcl >= 4) {
                // 检查房间中是否有存储
                const room = this.getCurrentRoom();
                if(room && room.storage) {
                    // 添加存储管理者
                    ratios.storageManager = 0.10;
                    
                    // 从其他角色中均匀减少比例
                    const reduction = 0.10 / (Object.keys(ratios).length - 1);
                    for(let role in ratios) {
                        if(role !== 'storageManager') {
                            ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                        }
                    }
                }
            }
        } else {
            // 控制器7-8级：高级配置
            ratios = {
                harvester: 0.15,
                carrier: 0.15,
                miner: 0.10,
                mineralHarvester: 0.10,
                upgrader: 0.10,
                builder: 0.10,
                repairer: 0.10,
                scout: 0.05,
                defender: 0.10,
                rangedAttacker: 0.05,
                healer: 0.05,
                linkManager: 0.05,
                storageManager: 0.10
            };
            
            // 控制器8级：添加核弹管理者
            if(rcl >= 8) {
                // 检查房间中是否有核弹发射井
                const room = this.getCurrentRoom();
                if(room) {
                    const nukers = room.find(FIND_MY_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_NUKER
                    });
                    
                    if(nukers.length > 0) {
                        // 添加核弹管理者
                        ratios.nukeManager = 0.05;
                        
                        // 从其他角色中均匀减少比例
                        const reduction = 0.05 / (Object.keys(ratios).length - 1);
                        for(let role in ratios) {
                            if(role !== 'nukeManager') {
                                ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                            }
                        }
                    }
                }
            }
        }
        
        // 根据能源状态调整比例
        if(energyStatus === 'critical') {
            // 能源紧张时，增加采集者和运输者比例
            ratios.harvester = Math.min(ratios.harvester * 1.5, 0.4);
            ratios.carrier = Math.min(ratios.carrier * 1.5, 0.4);
            
            // 减少其他角色比例
            for(let role in ratios) {
                if(role !== 'harvester' && role !== 'carrier') {
                    ratios[role] = Math.max(ratios[role] * 0.5, 0.05);
                }
            }
        } else if(energyStatus === 'surplus') {
            // 能源充足时，增加建造者和升级者比例
            ratios.builder = Math.min(ratios.builder * 1.5, 0.3);
            ratios.upgrader = Math.min(ratios.upgrader * 1.5, 0.3);
            
            // 适当减少采集者比例
            ratios.harvester = Math.max(ratios.harvester * 0.8, 0.1);
        }
        
        // 控制器等级6及以上时，确保有矿物采集者
        if(rcl >= 6) {
            // 检查房间中是否有矿物和提取器
            const room = this.getCurrentRoom();
            if(room) {
                const minerals = room.find(FIND_MINERALS);
                const extractors = room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTRACTOR
                });
                
                if(minerals.length > 0 && extractors.length > 0) {
                    // 确保矿物采集者比例不为0
                    if(!ratios.mineralHarvester || ratios.mineralHarvester < 0.05) {
                        ratios.mineralHarvester = 0.05;
                        
                        // 从其他角色中均匀减少比例
                        const reduction = 0.05 / Object.keys(ratios).length;
                        for(let role in ratios) {
                            if(role !== 'mineralHarvester') {
                                ratios[role] = Math.max(ratios[role] - reduction, 0.05);
                            }
                        }
                    }
                }
            }
        }
        
        // 确保比例总和为1
        let total = 0;
        for(let role in ratios) {
            total += ratios[role];
        }
        
        if(total !== 1) {
            const factor = 1 / total;
            for(let role in ratios) {
                ratios[role] *= factor;
            }
        }
        
        return ratios;
    },
    
    // 获取当前房间
    getCurrentRoom: function() {
        // 尝试获取当前正在处理的房间
        for(let roomName in Game.rooms) {
            if(Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) {
                return Game.rooms[roomName];
            }
        }
        return null;
    },
    
    // 获取最佳采集者数量
    getOptimalHarvesters: function(rcl, source) {
        // 如果提供了source参数，计算该源的可开采位置
        if(source) {
            const terrain = source.room.getTerrain();
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
            
            // 根据控制器等级和可用位置计算最佳采集者数量
            if(rcl <= 2) return Math.min(2, availablePositions); // 每个源最多2个采集者，但不超过可用位置
            if(rcl <= 4) return Math.min(3, availablePositions); // 每个源最多3个采集者，但不超过可用位置
            return Math.min(1, availablePositions); // 高级别时使用1个专业采集者+矿工，但不超过可用位置
        }
        
        // 如果没有提供source参数，使用默认值
        if(rcl <= 2) return 2; // 每个源最多2个采集者
        if(rcl <= 4) return 3; // 每个源最多3个采集者
        return 1; // 高级别时使用1个专业采集者+矿工
    },
    
    // 获取最佳运输者数量
    getOptimalCarriers: function(rcl, droppedResourcesCount) {
        if(rcl <= 2) return Math.min(4, droppedResourcesCount + 1);
        if(rcl <= 4) return Math.min(6, droppedResourcesCount + 2);
        if(rcl <= 6) return Math.min(8, droppedResourcesCount + 3);
        return Math.min(10, droppedResourcesCount + 4);
    },
    
    // 分析房间能源状态
    analyzeEnergyStatus: function(room) {
        const status = energyUtils.getRoomStatus(room);
        const distributor = room.memory.energyDistributor;
        const rcl = room.controller.level;
        
        // 更新能源水平状态 - 仅使用spawn/extension能量水平
        if(status.energyLevel < 0.2) {
            distributor.status.level = 'critical';
        } else if(status.energyLevel < 0.5) {
            distributor.status.level = 'low';
        } else {
            distributor.status.level = 'normal';
        }
        
        // 分析每个能源的采集情况
        const sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            const sourceId = source.id;
            
            // 初始化源数据
            if(!distributor.collection.sources[sourceId]) {
                distributor.collection.sources[sourceId] = {
                    harvesters: 0,
                    capacity: source.energyCapacity,
                    available: source.energy,
                    efficiency: 0
                };
            }
            
            // 更新源数据
            const sourceData = distributor.collection.sources[sourceId];
            sourceData.available = source.energy;
            
            // 计算采集者数量
            const harvesters = _.filter(Game.creeps, creep => 
                creep.memory.role === 'harvester' && 
                creep.memory.sourceId === sourceId
            ).length;
            
            sourceData.harvesters = harvesters;
            
            // 计算效率（基于采集者数量和源容量）
            const optimalHarvesters = this.getOptimalHarvesters(rcl, source);
            sourceData.efficiency = Math.min(1, harvesters / optimalHarvesters);
        });
        
        // 计算总体采集效率
        let totalEfficiency = 0;
        let sourceCount = 0;
        
        for(let sourceId in distributor.collection.sources) {
            totalEfficiency += distributor.collection.sources[sourceId].efficiency;
            sourceCount++;
        }
        
        distributor.collection.efficiency = sourceCount > 0 ? totalEfficiency / sourceCount : 0;
        
        // 更新状态时间戳
        distributor.status.lastUpdate = Game.time;
    },
    
    // 优化能源收集
    optimizeEnergyCollection: function(room) {
        const distributor = room.memory.energyDistributor;
        const sources = room.find(FIND_SOURCES);
        const rcl = room.controller.level;
        
        // 为每个源分配最优采集者数量
        sources.forEach(source => {
            const sourceId = source.id;
            const sourceData = distributor.collection.sources[sourceId];
            const optimalHarvesters = this.getOptimalHarvesters(rcl, source);
            
            // 如果采集者不足，标记为需要更多采集者
            if(sourceData.harvesters < optimalHarvesters) {
                // 使用统一的队列系统
                this.queueCreepRequest(room, {
                    role: 'harvester',
                    priority: 1, // 高优先级
                    memory: {
                        sourceId: sourceId
                    }
                });
            }
        });
        
        // 优化掉落资源的收集
        const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
            filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
        });
        
        if(droppedResources.length > 0) {
            // 标记需要更多carrier
            const carriers = _.filter(Game.creeps, creep => 
                creep.memory.role === 'carrier' && creep.room.name === room.name
            ).length;
            
            const optimalCarriers = this.getOptimalCarriers(rcl, droppedResources.length);
            
            if(carriers < optimalCarriers) {
                // 使用统一的队列系统
                this.queueCreepRequest(room, {
                    role: 'carrier',
                    priority: 2 // 中高优先级
                });
            }
        }
        
        // 控制器4级以上，考虑添加矿工
        if(rcl >= 4) {
            const miners = _.filter(Game.creeps, creep => 
                creep.memory.role === 'miner' && creep.room.name === room.name
            ).length;
            
            // 计算需要的矿工数量（每个源一个）
            const optimalMiners = sources.length;
            
            if(miners < optimalMiners) {
                // 找到没有矿工的源
                const unmanagedSources = sources.filter(source => {
                    return !_.some(Game.creeps, creep => 
                        creep.memory.role === 'miner' && 
                        creep.memory.sourceId === source.id
                    );
                });
                
                if(unmanagedSources.length > 0) {
                    // 使用统一的队列系统
                    this.queueCreepRequest(room, {
                        role: 'miner',
                        priority: 2, // 中高优先级
                        memory: {
                            sourceId: unmanagedSources[0].id
                        }
                    });
                }
            }
        }
    },
    
    // 统一的Creep请求队列方法
    queueCreepRequest: function(room, request) {
        this.ensureSpawnQueue(room);
        
        // 检查是否已经在队列中
        const existingRequest = _.find(Memory.spawns.queues[room.name].energyRequests, 
            req => req.role === request.role && 
                  (!request.memory || !request.memory.sourceId || 
                   (req.memory && req.memory.sourceId === request.memory.sourceId))
        );
        
        if(!existingRequest) {
            // 添加到统一队列
            Memory.spawns.queues[room.name].energyRequests.push(request);
            
            // 不再添加到room.memory.spawnQueue，统一使用Memory.spawns.queues
            
            console.log(`[energyDistributor] 房间 ${room.name} 请求生成 ${request.role} (优先级: ${request.priority})`);
        } else {
            // 如果已存在相同角色的请求，更新其优先级（取较高值）
            existingRequest.priority = Math.min(existingRequest.priority, request.priority);
            console.log(`[energyDistributor] 更新 ${request.role} 的请求优先级为 ${existingRequest.priority}`);
        }
        
        // 限制队列长度并按优先级排序
        if(Memory.spawns.queues[room.name].energyRequests.length > 10) {
            Memory.spawns.queues[room.name].energyRequests.sort((a, b) => a.priority - b.priority);
            Memory.spawns.queues[room.name].energyRequests.splice(10);
        }
    },
    
    // 优化能源分配
    optimizeEnergyDistribution: function(room) {
        const distributor = room.memory.energyDistributor;
        const rcl = room.controller.level;
        
        // 获取所有需要能源的建筑
        const targets = room.find(FIND_STRUCTURES, {
            filter: structure => {
                if(structure.structureType === STRUCTURE_CONTROLLER) return false;
                
                // 检查是否有能源存储
                if(!structure.store) return false;
                
                // 检查是否需要能源
                if(structure.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return false;
                
                // 根据建筑类型过滤
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_TOWER ||
                        (rcl >= 4 && structure.structureType === STRUCTURE_STORAGE) ||
                        (rcl >= 6 && structure.structureType === STRUCTURE_TERMINAL) ||
                        structure.structureType === STRUCTURE_CONTAINER);  // 保留容器，但优先级较低
            }
        });
        
        // 更新分配优先级
        distributor.distribution.priorities = this.getDistributionPriorities(rcl);
        
        // 根据能源状态调整优先级
        if(distributor.status.level === 'critical') {
            // 在能源紧急状态下，提高spawn和extension的优先级
            distributor.distribution.priorities[STRUCTURE_SPAWN] = 1;
            distributor.distribution.priorities[STRUCTURE_EXTENSION] = 1;
            distributor.distribution.priorities[STRUCTURE_TOWER] = 3;
        } else if(distributor.status.level === 'low') {
            // 在能源低状态下，保持默认优先级
        } else {
            // 在能源充足状态下，平衡优先级
            if(rcl >= 4) {
                distributor.distribution.priorities[STRUCTURE_TOWER] = 2;
            }
        }
        
        // 按优先级排序
        targets.sort((a, b) => {
            const priorityA = distributor.distribution.priorities[a.structureType] || 10;
            const priorityB = distributor.distribution.priorities[b.structureType] || 10;
            return priorityA - priorityB;
        });
        
        // 更新分配目标
        distributor.distribution.targets = {};
        
        targets.forEach(target => {
            distributor.distribution.targets[target.id] = {
                type: target.structureType,
                needed: target.store.getFreeCapacity(RESOURCE_ENERGY),
                priority: distributor.distribution.priorities[target.structureType] || 10
            };
        });
        
        // 控制器4级以上，考虑链接网络
        if(rcl >= 5) {
            this.optimizeLinkNetwork(room);
        }
    },
    
    // 优化链接网络
    optimizeLinkNetwork: function(room) {
        // 如果没有链接，跳过
        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        if(links.length < 2) return;
        
        // 初始化链接网络内存
        if(!room.memory.links) {
            room.memory.links = {
                senders: [],
                receivers: [],
                lastTransfer: 0
            };
            
            // 分析链接位置
            links.forEach(link => {
                // 靠近控制器的是接收者
                if(link.pos.getRangeTo(room.controller) <= 3) {
                    room.memory.links.receivers.push(link.id);
                }
                // 靠近存储的是接收者
                else if(room.storage && link.pos.getRangeTo(room.storage) <= 3) {
                    room.memory.links.receivers.push(link.id);
                }
                // 其他的是发送者
                else {
                    room.memory.links.senders.push(link.id);
                }
            });
        }
        
        // 每10个tick传输一次能源
        if(Game.time % 10 !== 0 || Game.time - room.memory.links.lastTransfer < 10) return;
        
        // 从发送者传输到接收者
        const senders = room.memory.links.senders
            .map(id => Game.getObjectById(id))
            .filter(link => link && link.store[RESOURCE_ENERGY] >= 400);
            
        const receivers = room.memory.links.receivers
            .map(id => Game.getObjectById(id))
            .filter(link => link && link.store.getFreeCapacity(RESOURCE_ENERGY) >= 200)
            .sort((a, b) => {
                // 优先填充靠近控制器的链接
                const aToController = a.pos.getRangeTo(room.controller);
                const bToController = b.pos.getRangeTo(room.controller);
                return aToController - bToController;
            });
            
        if(senders.length > 0 && receivers.length > 0) {
            const result = senders[0].transferEnergy(receivers[0]);
            if(result === OK) {
                room.memory.links.lastTransfer = Game.time;
            }
        }
    },
    
    // 调整creep角色比例
    adjustCreepRatios: function(room) {
        const distributor = room.memory.energyDistributor;
        const status = distributor.status.level;
        const rcl = room.controller.level;
        
        // 根据控制器等级和能源状态调整creep比例
        distributor.creepRatios = this.getCreepRatios(rcl, status);
        
        // 确保比例总和为1
        let total = 0;
        for(let role in distributor.creepRatios) {
            total += distributor.creepRatios[role];
        }
        
        if(total !== 1) {
            const factor = 1 / total;
            for(let role in distributor.creepRatios) {
                distributor.creepRatios[role] *= factor;
            }
        }
        
        // 将比例信息传递给spawner
        if(!room.memory.creepRatios) {
            room.memory.creepRatios = {};
        }
        
        // 添加角色优先级信息，与spawner.js中保持一致
        room.memory.rolePriorities = {
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
        
        for(let role in distributor.creepRatios) {
            room.memory.creepRatios[role] = distributor.creepRatios[role];
        }
    },
    
    // 更新统计数据
    updateStats: function(room) {
        const distributor = room.memory.energyDistributor;
        const stats = distributor.stats;
        
        // 计算采集率（每tick获取的能源）
        const sources = room.find(FIND_SOURCES);
        let totalCapacity = 0;
        let totalAvailable = 0;
        
        sources.forEach(source => {
            totalCapacity += source.energyCapacity;
            totalAvailable += source.energy;
        });
        
        const collectionRate = totalCapacity > 0 ? 1 - (totalAvailable / totalCapacity) : 0;
        stats.collectionRate.push(collectionRate);
        
        // 限制数组长度
        if(stats.collectionRate.length > 100) {
            stats.collectionRate.shift();
        }
        
        // 计算分配率（已分配的能源比例）
        const structures = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN || 
                      s.structureType === STRUCTURE_EXTENSION || 
                      s.structureType === STRUCTURE_TOWER
        });
        
        let totalEnergyCapacity = 0;
        let totalEnergyStored = 0;
        
        structures.forEach(structure => {
            if(structure.store) {
                totalEnergyCapacity += structure.store.getCapacity(RESOURCE_ENERGY);
                totalEnergyStored += structure.store[RESOURCE_ENERGY];
            }
        });
        
        const distributionRate = totalEnergyCapacity > 0 ? totalEnergyStored / totalEnergyCapacity : 0;
        stats.distributionRate.push(distributionRate);
        
        // 限制数组长度
        if(stats.distributionRate.length > 100) {
            stats.distributionRate.shift();
        }
        
        // 计算总体效率
        const efficiency = (collectionRate + distributionRate) / 2;
        stats.efficiency.push(efficiency);
        
        // 限制数组长度
        if(stats.efficiency.length > 100) {
            stats.efficiency.shift();
        }
    },
    
    // 获取能源状态报告
    getEnergyReport: function(room) {
        const distributor = room.memory.energyDistributor;
        
        if(!distributor) {
            return "能源分配系统未初始化";
        }
        
        const stats = distributor.stats;
        const rcl = room.controller.level;
        
        // 计算平均值
        const avgCollectionRate = stats.collectionRate.length > 0 ? 
            stats.collectionRate.reduce((a, b) => a + b, 0) / stats.collectionRate.length : 0;
            
        const avgDistributionRate = stats.distributionRate.length > 0 ? 
            stats.distributionRate.reduce((a, b) => a + b, 0) / stats.distributionRate.length : 0;
            
        const avgEfficiency = stats.efficiency.length > 0 ? 
            stats.efficiency.reduce((a, b) => a + b, 0) / stats.efficiency.length : 0;
        
        // 生成报告
        let report = `=== 房间 ${room.name} 能源状态报告 (RCL ${rcl}) ===\n`;
        report += `能源水平: ${distributor.status.level}\n`;
        report += `采集效率: ${(distributor.collection.efficiency * 100).toFixed(2)}%\n`;
        report += `平均采集率: ${(avgCollectionRate * 100).toFixed(2)}%\n`;
        report += `平均分配率: ${(avgDistributionRate * 100).toFixed(2)}%\n`;
        report += `总体效率: ${(avgEfficiency * 100).toFixed(2)}%\n\n`;
        
        report += `源信息:\n`;
        for(let sourceId in distributor.collection.sources) {
            const source = distributor.collection.sources[sourceId];
            report += `- 源 ${sourceId.substr(0, 6)}: ${source.harvesters}个采集者, 效率${(source.efficiency * 100).toFixed(2)}%\n`;
        }
        
        report += `\nCreep比例:\n`;
        for(let role in distributor.creepRatios) {
            report += `- ${role}: ${(distributor.creepRatios[role] * 100).toFixed(2)}%\n`;
        }
        
        // 添加链接网络信息
        if(rcl >= 5 && room.memory.links) {
            const links = room.memory.links;
            report += `\n链接网络:\n`;
            report += `- 发送者: ${links.senders.length}\n`;
            report += `- 接收者: ${links.receivers.length}\n`;
            report += `- 上次传输: ${Game.time - links.lastTransfer} ticks前\n`;
        }
        
        return report;
    }
}; 