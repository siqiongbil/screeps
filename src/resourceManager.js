// const utils = require('utils');

module.exports = {
    // 主运行函数
    run: function(room) {
        // 初始化资源管理数据
        if(!room.memory.resources) {
            this.initializeResourceManager(room);
        }
        
        // 每10 ticks执行一次
        if(Game.time % 10 !== 0) return;
        
        // 更新资源状态
        this.updateResourceStatus(room);
        
        // 执行资源管理策略
        this.executeResourceStrategy(room);
        
        // 处理跨房间资源传输
        this.handleInterRoomTransfer(room);
    },

    // 初始化资源管理数据
    initializeResourceManager: function(room) {
        room.memory.resources = {
            lastUpdate: Game.time,
            distribution: {},
            thresholds: {
                energy: {
                    critical: 5000,
                    low: 10000,
                    normal: 50000,
                    excess: 100000
                },
                minerals: {
                    critical: 1000,
                    low: 2000,
                    normal: 5000,
                    excess: 10000
                },
                compounds: {
                    critical: 500,
                    low: 1000,
                    normal: 3000,
                    excess: 5000
                }
            },
            priorities: {
                [STRUCTURE_SPAWN]: 1,
                [STRUCTURE_EXTENSION]: 2,
                [STRUCTURE_TOWER]: 3,
                [STRUCTURE_STORAGE]: 4,
                [STRUCTURE_TERMINAL]: 5,
                [STRUCTURE_LAB]: 6,
                [STRUCTURE_CONTAINER]: 7,
            },
            market: {
                minPrice: 0.1,
                maxPrice: 10,
                maxOrderAge: 10000,
                minMargin: 0.05
            },
            status: {}
        };
    },

    // 更新资源状态
    updateResourceStatus: function(room) {
        const resources = room.memory.resources;
        const storage = room.storage;
        const terminal = room.terminal;
        
        // 更新能量分布
        resources.distribution = this.calculateResourceDistribution(room);
        
        // 更新市场价格
        if(terminal) {
            this.updateMarketPrices(room);
        }
        
        // 更新资源状态
        resources.status = this.getResourceStatus(room);
        
        // 更新最后更新时间
        resources.lastUpdate = Game.time;
    },

    // 计算资源分布
    calculateResourceDistribution: function(room) {
        const distribution = {
            energy: {},
            minerals: {},
            compounds: {}
        };
        
        // 遍历所有建筑
        room.find(FIND_STRUCTURES).forEach(structure => {
            if(structure.store) {
                // 记录能量分布
                if(structure.store[RESOURCE_ENERGY]) {
                    distribution.energy[structure.structureType] = 
                        (distribution.energy[structure.structureType] || 0) + 
                        structure.store[RESOURCE_ENERGY];
                }
                
                // 记录矿物分布
                for(let resource in structure.store) {
                    if(resource !== RESOURCE_ENERGY) {
                        if(this.isMineral(resource)) {
                            distribution.minerals[resource] = 
                                (distribution.minerals[resource] || 0) + 
                                structure.store[resource];
                        } else {
                            distribution.compounds[resource] = 
                                (distribution.compounds[resource] || 0) + 
                                structure.store[resource];
                        }
                    }
                }
            }
        });
        
        return distribution;
    },

    // 更新市场价格
    updateMarketPrices: function(room) {
        const resources = room.memory.resources;
        
        // 遍历所有资源类型
        for(let resourceType in resources.distribution.minerals) {
            const orders = Game.market.getAllOrders({resourceType: resourceType});
            if(orders.length > 0) {
                const sellOrders = orders.filter(order => order.type === ORDER_SELL);
                const buyOrders = orders.filter(order => order.type === ORDER_BUY);
                
                if(sellOrders.length > 0) {
                    resources.market.sellPrice = sellOrders.reduce((sum, order) => sum + order.price, 0) / sellOrders.length;
                }
                if(buyOrders.length > 0) {
                    resources.market.buyPrice = buyOrders.reduce((sum, order) => sum + order.price, 0) / buyOrders.length;
                }
            }
        }
    },

    // 执行资源管理策略
    executeResourceStrategy: function(room) {
        // 检查是否有energyDistributor系统
        const hasEnergyDistributor = room.memory.energyDistributor !== undefined;
        
        // 获取资源状态
        const resources = room.memory.resources;
        const distribution = resources.distribution;
        
        // 计算总能量
        const totalEnergy = this.calculateTotalEnergy(distribution);
        
        // 更新资源状态
        resources.status = resources.status || {};
        resources.status.energy = resources.status.energy || {};
        
        // 如果energyDistributor存在，使用其状态
        if(hasEnergyDistributor) {
            // 能源状态已由energyDistributor更新，不需要在这里更新
            console.log(`[ResourceManager] 房间 ${room.name} 使用energyDistributor管理能源`);
        } else {
            // 否则由resourceManager管理能源
            this.updateEnergyStatus(room, totalEnergy);
            
            // 管理能源分配
            this.manageEnergyDistribution(room);
        }
        
        // 管理矿物资源
        this.manageMineral(room);
        
        // 管理化合物
        this.manageCompounds(room);
        
        // 管理市场交易
        this.manageMarketTrading(room);
    },
    
    // 更新能源状态（仅在没有energyDistributor时使用）
    updateEnergyStatus: function(room, totalEnergy) {
        const resources = room.memory.resources;
        const thresholds = resources.thresholds.energy;
        
        // 确定能源状态
        let status = 'normal';
        if(totalEnergy <= thresholds.critical) {
            status = 'critical';
        } else if(totalEnergy <= thresholds.low) {
            status = 'low';
        } else if(totalEnergy >= thresholds.excess) {
            status = 'excess';
        }
        
        // 更新状态
        resources.status.energy = {
            level: status,
            amount: totalEnergy,
            lastUpdate: Game.time
        };
        
        console.log(`[ResourceManager] 房间 ${room.name} 能源状态: ${status}, 总量: ${totalEnergy}`);
    },
    
    // 管理能源分配（仅在没有energyDistributor时使用）
    manageEnergyDistribution: function(room) {
        // 检查是否有energyDistributor系统
        if(room.memory.energyDistributor) return;
        
        const resources = room.memory.resources;
        const status = resources.status.energy.level;
        
        // 根据能源状态调整分配策略
        switch(status) {
            case 'critical':
                // 紧急状态：优先供应spawn和extension
                this.prioritizeSpawning(room);
                break;
            case 'low':
                // 低能源状态：减少升级和建造，增加采集
                this.balanceEnergyUsage(room, true);
                break;
            case 'normal':
                // 正常状态：平衡分配
                this.balanceEnergyUsage(room, false);
                break;
            case 'excess':
                // 过剩状态：增加升级和建造
                this.increaseUpgrading(room);
                break;
        }
    },

    // 管理矿物
    manageMineral: function(room) {
        const resources = room.memory.resources;
        const storage = room.storage;
        const terminal = room.terminal;
        
        for(let mineral in resources.distribution.minerals) {
            const amount = resources.distribution.minerals[mineral];
            const threshold = resources.thresholds.minerals;
            
            // 如果数量过低，从市场购买
            if(amount < threshold.critical) {
                this.buyResource(room, mineral, threshold.normal - amount);
            }
            // 如果数量过高，卖出到市场
            else if(amount > threshold.excess) {
                this.sellResource(room, mineral, amount - threshold.normal);
            }
        }
    },

    // 管理化合物
    manageCompounds: function(room) {
        const resources = room.memory.resources;
        const storage = room.storage;
        const terminal = room.terminal;
        
        for(let compound in resources.distribution.compounds) {
            const amount = resources.distribution.compounds[compound];
            const threshold = resources.thresholds.compounds;
            
            // 如果数量过高，考虑卖出
            if(amount > threshold.excess) {
                this.sellResource(room, compound, amount - threshold.normal);
            }
        }
    },

    // 管理市场交易
    manageMarketTrading: function(room) {
        const resources = room.memory.resources;
        const terminal = room.terminal;
        
        if(!terminal) return;
        
        // 检查每种资源的市场价格
        for(let resourceType in resources.market) {
            const sellPrice = resources.market.sellPrice;
            const buyPrice = resources.market.buyPrice;
            
            // 如果价格差足够大，考虑交易
            if(sellPrice && buyPrice && 
               sellPrice > buyPrice * (1 + resources.market.minMargin)) {
                this.tradeCommodity(room, resourceType, sellPrice, buyPrice);
            }
        }
    },

    // 处理跨房间资源传输
    handleInterRoomTransfer: function(room) {
        const resources = room.memory.resources;
        
        // 处理资源请求
        if(room.memory.resourceRequests) {
            for(let request of room.memory.resourceRequests) {
                this.handleResourceRequest(room, request);
            }
        }
    },

    // 处理资源请求
    handleResourceRequest: function(room, request) {
        const terminal = room.terminal;
        if(!terminal || terminal.cooldown > 0) return false;
        
        // 检查是否有足够的资源
        if(terminal.store[request.resourceType] >= request.amount) {
            const result = terminal.send(
                request.resourceType,
                request.amount,
                request.targetRoom,
                `响应资源请求`
            );
            
            if(result === OK) {
                console.log(`从 ${room.name} 发送 ${request.amount} ${request.resourceType} 到 ${request.targetRoom}`);
                return true;
            }
        }
        return false;
    },

    // 请求能量传输
    requestEnergyTransfer: function(room, from, to, amount) {
        // 寻找或生成运输creep
        const carriers = room.find(FIND_MY_CREEPS, {
            filter: creep => 
                creep.memory.role === 'carrier' && 
                !creep.memory.busy
        });
        
        if(carriers.length > 0) {
            const carrier = carriers[0];
            carrier.memory.task = {
                type: 'transfer',
                from: from.id,
                to: to.id,
                resourceType: RESOURCE_ENERGY,
                amount: amount
            };
            carrier.memory.busy = true;
        }
    },

    // 购买资源
    buyResource: function(room, resourceType, amount) {
        const terminal = room.terminal;
        const resources = room.memory.resources;
        
        if(!terminal) return;
        
        const orders = Game.market.getAllOrders({
            resourceType: resourceType,
            type: ORDER_SELL,
            price: { $lt: resources.market.maxPrice }
        });
        
        if(orders.length > 0) {
            orders.sort((a, b) => a.price - b.price);
            const order = orders[0];
            
            const dealAmount = Math.min(amount, order.amount);
            const result = Game.market.deal(order.id, dealAmount, room.name);
            
            if(result === OK) {
                console.log(`房间 ${room.name} 购买了 ${dealAmount} ${resourceType}`);
            }
        }
    },

    // 卖出资源
    sellResource: function(room, resourceType, amount) {
        const terminal = room.terminal;
        const resources = room.memory.resources;
        
        if(!terminal) return;
        
        const orders = Game.market.getAllOrders({
            resourceType: resourceType,
            type: ORDER_BUY,
            price: { $gt: resources.market.minPrice }
        });
        
        if(orders.length > 0) {
            orders.sort((a, b) => b.price - a.price);
            const order = orders[0];
            
            const dealAmount = Math.min(amount, order.amount);
            const result = Game.market.deal(order.id, dealAmount, room.name);
            
            if(result === OK) {
                console.log(`房间 ${room.name} 卖出了 ${dealAmount} ${resourceType}`);
            }
        }
    },

    // 交易商品
    tradeCommodity: function(room, resourceType, sellPrice, buyPrice) {
        const terminal = room.terminal;
        const resources = room.memory.resources;
        
        if(!terminal) return;
        
        // 计算预期利润
        const profitPerUnit = sellPrice - buyPrice;
        const energyCost = Game.market.calcTransactionCost(1000, room.name, room.name) / 1000;
        const netProfit = profitPerUnit - energyCost;
        
        // 如果有足够的利润，执行交易
        if(netProfit > 0) {
            this.buyResource(room, resourceType, 1000);
            this.sellResource(room, resourceType, 1000);
        }
    },

    // 获取资源状态
    getResourceStatus: function(room) {
        const storage = room.storage;
        const terminal = room.terminal;
        
        return {
            energy: {
                available: room.energyAvailable,
                capacity: room.energyCapacityAvailable,
                storage: storage ? storage.store[RESOURCE_ENERGY] : 0,
                terminal: terminal ? terminal.store[RESOURCE_ENERGY] : 0
            },
            minerals: this.getMineralStatus(room),
            compounds: this.getCompoundStatus(room),
            market: {
                orders: Game.market.orders ? Object.keys(Game.market.orders).length : 0,
                credits: Game.market.credits
            }
        };
    },

    // 获取矿物状态
    getMineralStatus: function(room) {
        const status = {};
        const minerals = room.find(FIND_MINERALS);
        
        minerals.forEach(mineral => {
            status[mineral.mineralType] = {
                amount: mineral.mineralAmount,
                density: mineral.density,
                cooldown: mineral.ticksToRegeneration || 0
            };
        });
        
        return status;
    },

    // 获取化合物状态
    getCompoundStatus: function(room) {
        const status = {};
        const storage = room.storage;
        const terminal = room.terminal;
        
        if(storage) {
            for(let resource in storage.store) {
                if(this.isCompound(resource)) {
                    status[resource] = (status[resource] || 0) + storage.store[resource];
                }
            }
        }
        
        if(terminal) {
            for(let resource in terminal.store) {
                if(this.isCompound(resource)) {
                    status[resource] = (status[resource] || 0) + terminal.store[resource];
                }
            }
        }
        
        return status;
    },

    // 判断是否是矿物
    isMineral: function(resourceType) {
        return [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM,
                RESOURCE_KEANIUM, RESOURCE_LEMERGIUM, RESOURCE_ZYNTHIUM,
                RESOURCE_CATALYST].includes(resourceType);
    },

    // 判断是否是化合物
    isCompound: function(resourceType) {
        return !this.isMineral(resourceType) && resourceType !== RESOURCE_ENERGY;
    },

    // 计算总能量
    calculateTotalEnergy: function(distribution) {
        let totalEnergy = 0;
        for(let resourceType in distribution.energy) {
            totalEnergy += distribution.energy[resourceType];
        }
        return totalEnergy;
    },

    // 优先供应spawn和extension
    prioritizeSpawning: function(room) {
        const resources = room.memory.resources;
        
        // 获取所有需要能量的spawn和extension
        const spawns = room.find(FIND_MY_SPAWNS, {
            filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        const extensions = room.find(FIND_STRUCTURES, {
            filter: structure => 
                structure.structureType === STRUCTURE_EXTENSION && 
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // 找到所有carrier
        const carriers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'carrier' && 
            creep.room.name === room.name
        );
        
        // 将所有carrier分配给spawn和extension
        for(let carrier of carriers) {
            if(!carrier.memory.task) {
                // 优先填充spawn
                if(spawns.length > 0) {
                    carrier.memory.task = {
                        type: 'transfer',
                        targetId: spawns[0].id,
                        resourceType: RESOURCE_ENERGY
                    };
                    continue;
                }
                
                // 其次填充extension
                if(extensions.length > 0) {
                    carrier.memory.task = {
                        type: 'transfer',
                        targetId: extensions[0].id,
                        resourceType: RESOURCE_ENERGY
                    };
                    continue;
                }
            }
        }
        
        // 记录日志
        console.log(`[ResourceManager] 房间 ${room.name} 能源紧急状态：优先供应spawn和extension`);
    },

    // 平衡能源使用
    balanceEnergyUsage: function(room, isLow) {
        const resources = room.memory.resources;
        
        // 获取所有需要能量的建筑
        const targets = room.find(FIND_STRUCTURES, {
            filter: structure => {
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_TOWER ||
                        structure.structureType === STRUCTURE_LAB) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        // 按优先级排序
        targets.sort((a, b) => {
            const priorityA = resources.priorities[a.structureType] || 10;
            const priorityB = resources.priorities[b.structureType] || 10;
            return priorityA - priorityB;
        });
        
        // 找到所有carrier
        const carriers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'carrier' && 
            creep.room.name === room.name && 
            !creep.memory.task
        );
        
        // 分配任务
        for(let i = 0; i < carriers.length && i < targets.length; i++) {
            carriers[i].memory.task = {
                type: 'transfer',
                targetId: targets[i].id,
                resourceType: RESOURCE_ENERGY
            };
        }
        
        // 如果能源不足，减少升级和建造
        if(isLow) {
            // 找到所有upgrader和builder
            const upgraders = _.filter(Game.creeps, creep => 
                creep.memory.role === 'upgrader' && 
                creep.room.name === room.name
            );
            
            const builders = _.filter(Game.creeps, creep => 
                creep.memory.role === 'builder' && 
                creep.room.name === room.name
            );
            
            // 将一半的upgrader转为harvester
            for(let i = 0; i < Math.floor(upgraders.length / 2); i++) {
                upgraders[i].memory.role = 'harvester';
                console.log(`[ResourceManager] 将upgrader ${upgraders[i].name} 转为harvester以应对能源不足`);
            }
            
            // 将一半的builder转为harvester
            for(let i = 0; i < Math.floor(builders.length / 2); i++) {
                builders[i].memory.role = 'harvester';
                console.log(`[ResourceManager] 将builder ${builders[i].name} 转为harvester以应对能源不足`);
            }
        }
        
        // 记录日志
        console.log(`[ResourceManager] 房间 ${room.name} ${isLow ? '能源不足' : '能源正常'}：平衡分配能源`);
    },

    // 增加升级
    increaseUpgrading: function(room) {
        const resources = room.memory.resources;
        
        // 获取控制器
        const controller = room.controller;
        
        // 如果控制器已经是8级，不需要增加升级
        if(controller.level === 8) {
            // 将多余的能源用于建造和修复
            this.focusOnBuilding(room);
            return;
        }
        
        // 找到所有harvester
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && 
            creep.room.name === room.name
        );
        
        // 找到所有upgrader
        const upgraders = _.filter(Game.creeps, creep => 
            creep.memory.role === 'upgrader' && 
            creep.room.name === room.name
        );
        
        // 如果upgrader数量少于harvester的一半，将一些harvester转为upgrader
        if(upgraders.length < Math.floor(harvesters.length / 2)) {
            const count = Math.floor(harvesters.length / 2) - upgraders.length;
            
            for(let i = 0; i < count && i < harvesters.length; i++) {
                harvesters[i].memory.role = 'upgrader';
                console.log(`[ResourceManager] 将harvester ${harvesters[i].name} 转为upgrader以利用过剩能源`);
            }
        }
        
        // 记录日志
        console.log(`[ResourceManager] 房间 ${room.name} 能源过剩：增加控制器升级`);
    },
    
    // 专注于建造和修复
    focusOnBuilding: function(room) {
        const resources = room.memory.resources;
        
        // 找到所有harvester
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && 
            creep.room.name === room.name
        );
        
        // 找到所有builder
        const builders = _.filter(Game.creeps, creep => 
            creep.memory.role === 'builder' && 
            creep.room.name === room.name
        );
        
        // 找到所有repairer
        const repairers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'repairer' && 
            creep.room.name === room.name
        );
        
        // 如果builder和repairer数量少于harvester的一半，将一些harvester转为builder和repairer
        const targetCount = Math.floor(harvesters.length / 2);
        const currentCount = builders.length + repairers.length;
        
        if(currentCount < targetCount) {
            const count = targetCount - currentCount;
            
            // 优先增加builder
            const builderCount = Math.min(count, Math.ceil(count / 2));
            for(let i = 0; i < builderCount && i < harvesters.length; i++) {
                harvesters[i].memory.role = 'builder';
                console.log(`[ResourceManager] 将harvester ${harvesters[i].name} 转为builder以利用过剩能源`);
            }
            
            // 其次增加repairer
            const repairerCount = count - builderCount;
            for(let i = builderCount; i < builderCount + repairerCount && i < harvesters.length; i++) {
                harvesters[i].memory.role = 'repairer';
                console.log(`[ResourceManager] 将harvester ${harvesters[i].name} 转为repairer以利用过剩能源`);
            }
        }
        
        // 记录日志
        console.log(`[ResourceManager] 房间 ${room.name} 能源过剩：专注于建造和修复`);
    }
};