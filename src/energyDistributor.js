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
            creepRatios: {
                harvester: 0.3,
                carrier: 0.2,
                upgrader: 0.2,
                builder: 0.2,
                repairer: 0.1
            },
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
    
    // 调整creep比例
    adjustCreepRatios: function(room) {
        // 获取控制器等级
        const rcl = room.controller.level;
        
        // 获取能源状态
        const energyStatus = room.memory.energyStatus;
        if (!energyStatus) return;
        
        // 获取当前能源状态
        const currentStatus = energyStatus.currentStatus;
        const energyLevel = energyStatus.energyLevel;
        
        // 基础比例
        let ratios = {
            harvester: 0.3,
            carrier: 0.2,
            upgrader: 0.2,
            builder: 0.2,
            repairer: 0.1
        };
        
        // 根据控制器等级调整比例
        if (rcl <= 2) {
            // 低等级房间，优先采集和升级
            ratios.harvester = 0.4;
            ratios.upgrader = 0.3;
            ratios.builder = 0.2;
            ratios.repairer = 0.1;
            ratios.carrier = 0.0;
        } else if (rcl <= 4) {
            // 中等级房间，平衡发展
            ratios.harvester = 0.3;
            ratios.carrier = 0.2;
            ratios.upgrader = 0.2;
            ratios.builder = 0.2;
            ratios.repairer = 0.1;
        } else {
            // 高等级房间，优先建设和维护
            ratios.harvester = 0.2;
            ratios.carrier = 0.3;
            ratios.upgrader = 0.2;
            ratios.builder = 0.2;
            ratios.repairer = 0.1;
        }
        
        // 根据能源状态调整比例
        if (currentStatus === 'critical') {
            // 危急状态，优先采集
            ratios.harvester = 0.5;
            ratios.carrier = 0.3;
            ratios.upgrader = 0.1;
            ratios.builder = 0.1;
            ratios.repairer = 0.0;
        } else if (currentStatus === 'low') {
            // 低能源状态，增加采集
            ratios.harvester = 0.4;
            ratios.carrier = 0.3;
            ratios.upgrader = 0.1;
            ratios.builder = 0.1;
            ratios.repairer = 0.1;
        } else if (currentStatus === 'high') {
            // 高能源状态，增加建设和升级
            ratios.harvester = 0.2;
            ratios.carrier = 0.2;
            ratios.upgrader = 0.3;
            ratios.builder = 0.2;
            ratios.repairer = 0.1;
        }
        
        // 更新房间内存
        room.memory.creepRatios = ratios;
        
        return ratios;
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