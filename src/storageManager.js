/**
 * 存储管理系统
 * 提供对StructureStorage的全面管理，包括资源监控、分配和优化
 */

// 导入需要的模块
const storageUtils = require('storageUtils');

// 资源类型常量
const RESOURCE_TYPES = {
    BASIC: 'basic',      // 基础资源（能量）
    MINERAL: 'mineral',  // 矿物资源
    COMPOUND: 'compound', // 化合物
    COMMODITY: 'commodity', // 商品
    BOOST: 'boost'       // 强化材料
};

// 资源阈值设置
const RESOURCE_THRESHOLDS = {
    [RESOURCE_ENERGY]: {
        critical: 5000,   // 紧急状态阈值
        low: 20000,       // 低水平阈值
        normal: 50000,    // 正常水平阈值
        excess: 100000    // 过剩水平阈值
    },
    mineral: {
        critical: 1000,
        low: 3000,
        normal: 5000,
        excess: 10000
    },
    compound: {
        critical: 500,
        low: 1000,
        normal: 3000,
        excess: 5000
    },
    boost: {
        critical: 1000,
        low: 2000,
        normal: 5000,
        excess: 8000
    }
};

module.exports = {
    // 主运行函数
    run: function(room) {
        // 检查房间是否有存储
        if(!room.storage) return;
        
        // 初始化存储管理内存
        if(!room.memory.storageManager) {
            this.initMemory(room);
        }
        
        // 每10个tick执行一次
        if(Game.time % 10 !== 0) return;
        
        try {
            // 更新存储状态
            this.updateStorageStatus(room);
            
            // 执行资源管理策略
            this.manageResources(room);
            
            // 可视化存储状态
            this.visualizeStorage(room);
        } catch(error) {
            console.log(`存储管理系统错误 ${room.name}: ${error}`);
        }
    },
    
    // 初始化内存
    initMemory: function(room) {
        room.memory.storageManager = {
            status: {
                lastUpdate: Game.time,
                energy: 0,
                energyLevel: 'normal', // critical, low, normal, excess
                resources: {},
                totalResources: 0,
                freeCapacity: 0
            },
            settings: {
                thresholds: JSON.parse(JSON.stringify(RESOURCE_THRESHOLDS)),
                priorities: {
                    [RESOURCE_ENERGY]: 1,
                    mineral: 2,
                    compound: 3,
                    boost: 4
                },
                autoBalance: true,
                autoSell: false,
                autoBuy: false
            },
            distribution: {
                // 资源分配记录
                lastDistribution: {},
                pendingRequests: []
            },
            stats: {
                history: [],
                averageGrowth: 0,
                peakUsage: 0
            }
        };
    },
    
    // 更新存储状态
    updateStorageStatus: function(room) {
        const storage = room.storage;
        if(!storage) return;
        
        const memory = room.memory.storageManager;
        const status = memory.status;
        const settings = memory.settings;
        
        // 更新基本信息
        status.lastUpdate = Game.time;
        status.energy = storage.store[RESOURCE_ENERGY] || 0;
        status.totalResources = storage.store.getUsedCapacity();
        status.freeCapacity = storage.store.getFreeCapacity();
        
        // 确定能量水平
        if(status.energy <= settings.thresholds[RESOURCE_ENERGY].critical) {
            status.energyLevel = 'critical';
        } else if(status.energy <= settings.thresholds[RESOURCE_ENERGY].low) {
            status.energyLevel = 'low';
        } else if(status.energy <= settings.thresholds[RESOURCE_ENERGY].excess) {
            status.energyLevel = 'normal';
        } else {
            status.energyLevel = 'excess';
        }
        
        // 更新所有资源状态
        status.resources = {};
        for(const resourceType in storage.store) {
            status.resources[resourceType] = storage.store[resourceType];
        }
        
        // 更新统计数据
        this.updateStats(room);
    },
    
    // 更新统计数据
    updateStats: function(room) {
        const memory = room.memory.storageManager;
        const status = memory.status;
        const stats = memory.stats;
        
        // 保存历史数据（最多保存10条记录）
        stats.history.push({
            time: Game.time,
            energy: status.energy,
            totalResources: status.totalResources,
            freeCapacity: status.freeCapacity
        });
        
        if(stats.history.length > 10) {
            stats.history.shift();
        }
        
        // 计算平均增长率
        if(stats.history.length >= 2) {
            const oldest = stats.history[0];
            const newest = stats.history[stats.history.length - 1];
            const timeDiff = newest.time - oldest.time;
            
            if(timeDiff > 0) {
                const energyDiff = newest.energy - oldest.energy;
                stats.averageGrowth = energyDiff / timeDiff;
            }
        }
        
        // 更新峰值使用量
        stats.peakUsage = Math.max(stats.peakUsage, status.totalResources);
    },
    
    // 管理资源
    manageResources: function(room) {
        const storage = room.storage;
        if(!storage) return;
        
        const memory = room.memory.storageManager;
        const status = memory.status;
        const settings = memory.settings;
        
        // 根据能量水平调整策略
        switch(status.energyLevel) {
            case 'critical':
                this.handleCriticalEnergy(room);
                break;
            case 'low':
                this.handleLowEnergy(room);
                break;
            case 'normal':
                this.handleNormalEnergy(room);
                break;
            case 'excess':
                this.handleExcessEnergy(room);
                break;
        }
        
        // 处理其他资源
        this.manageOtherResources(room);
        
        // 处理资源分配请求
        this.processDistributionRequests(room);
    },
    
    // 处理紧急能量状态
    handleCriticalEnergy: function(room) {
        // 紧急状态下，优先收集能量
        room.memory.energyEmergency = true;
        
        // 通知能量分配系统进入紧急模式
        if(room.memory.energyDistributor) {
            room.memory.energyDistributor.status.level = 'critical';
        }
        
        // 可以考虑从终端或市场购买能量
        this.considerBuyingEnergy(room);
    },
    
    // 处理低能量状态
    handleLowEnergy: function(room) {
        // 低能量状态，需要增加能量收集
        room.memory.energyEmergency = true;
        
        // 通知能量分配系统进入警戒模式
        if(room.memory.energyDistributor) {
            room.memory.energyDistributor.status.level = 'warning';
        }
    },
    
    // 处理正常能量状态
    handleNormalEnergy: function(room) {
        // 正常状态，平衡资源分配
        room.memory.energyEmergency = false;
        
        // 通知能量分配系统进入正常模式
        if(room.memory.energyDistributor) {
            room.memory.energyDistributor.status.level = 'normal';
        }
    },
    
    // 处理过剩能量状态
    handleExcessEnergy: function(room) {
        // 能量过剩，可以考虑用于升级控制器或建造
        room.memory.energyEmergency = false;
        
        // 通知能量分配系统进入富余模式
        if(room.memory.energyDistributor) {
            room.memory.energyDistributor.status.level = 'excess';
        }
        
        // 考虑将能量转移到终端或卖出
        this.considerSellingEnergy(room);
    },
    
    // 管理其他资源
    manageOtherResources: function(room) {
        const storage = room.storage;
        if(!storage) return;
        
        const memory = room.memory.storageManager;
        const status = memory.status;
        const settings = memory.settings;
        
        // 遍历所有资源
        for(const resourceType in status.resources) {
            if(resourceType === RESOURCE_ENERGY) continue; // 能量已单独处理
            
            const amount = status.resources[resourceType];
            const resourceCategory = this.getResourceCategory(resourceType);
            const threshold = settings.thresholds[resourceCategory] || settings.thresholds.mineral;
            
            // 根据资源量决定策略
            if(amount <= threshold.critical) {
                // 紧急状态，考虑购买
                if(settings.autoBuy) {
                    this.considerBuyingResource(room, resourceType);
                }
            } else if(amount >= threshold.excess) {
                // 过剩状态，考虑卖出
                if(settings.autoSell) {
                    this.considerSellingResource(room, resourceType);
                }
            }
        }
    },
    
    // 处理资源分配请求
    processDistributionRequests: function(room) {
        const storage = room.storage;
        if(!storage) return;
        
        const memory = room.memory.storageManager;
        const requests = memory.distribution.pendingRequests;
        
        // 处理所有待处理的请求
        for(let i = 0; i < requests.length; i++) {
            const request = requests[i];
            
            // 检查请求是否过期
            if(Game.time > request.expireTime) {
                requests.splice(i, 1);
                i--;
                continue;
            }
            
            // 检查资源是否足够
            if(storage.store[request.resourceType] < request.amount) {
                continue;
            }
            
            // 尝试分配资源
            const target = Game.getObjectById(request.targetId);
            if(!target) {
                requests.splice(i, 1);
                i--;
                continue;
            }
            
            // 记录分配
            memory.distribution.lastDistribution[request.targetId] = {
                resourceType: request.resourceType,
                amount: request.amount,
                time: Game.time
            };
            
            // 移除已处理的请求
            requests.splice(i, 1);
            i--;
        }
    },
    
    // 考虑购买能量
    considerBuyingEnergy: function(room) {
        // 这里可以实现从市场购买能量的逻辑
        // 或者从其他房间请求能量
    },
    
    // 考虑卖出能量
    considerSellingEnergy: function(room) {
        // 这里可以实现向市场卖出能量的逻辑
        // 或者向其他房间提供能量
    },
    
    // 考虑购买资源
    considerBuyingResource: function(room, resourceType) {
        // 这里可以实现从市场购买特定资源的逻辑
    },
    
    // 考虑卖出资源
    considerSellingResource: function(room, resourceType) {
        // 这里可以实现向市场卖出特定资源的逻辑
    },
    
    // 获取资源类别
    getResourceCategory: function(resourceType) {
        if(resourceType === RESOURCE_ENERGY) {
            return RESOURCE_TYPES.BASIC;
        }
        
        // 判断是否为矿物
        if(resourceType.length === 1) {
            return RESOURCE_TYPES.MINERAL;
        }
        
        // 判断是否为化合物
        if(resourceType.length === 2 || resourceType.length === 3) {
            return RESOURCE_TYPES.COMPOUND;
        }
        
        // 判断是否为强化材料
        if(resourceType.indexOf('X') !== -1) {
            return RESOURCE_TYPES.BOOST;
        }
        
        // 默认为商品
        return RESOURCE_TYPES.COMMODITY;
    },
    
    // 可视化存储状态
    visualizeStorage: function(room) {
        const storage = room.storage;
        if(!storage) return;
        
        const memory = room.memory.storageManager;
        const status = memory.status;
        
        // 创建可视化对象
        const visual = room.visual;
        
        // 显示存储标题
        visual.text(`存储状态`, storage.pos.x, storage.pos.y - 1.5, {
            color: 'white',
            font: 0.7,
            align: 'center'
        });
        
        // 显示能量水平
        const energyLevelColors = {
            'critical': 'red',
            'low': 'yellow',
            'normal': 'green',
            'excess': 'blue'
        };
        
        visual.text(`能量: ${this.formatNumber(status.energy)}`, storage.pos.x, storage.pos.y - 1, {
            color: energyLevelColors[status.energyLevel],
            font: 0.5,
            align: 'center'
        });
        
        // 显示容量使用情况
        const usedPercent = Math.round((status.totalResources / (status.totalResources + status.freeCapacity)) * 100);
        visual.text(`使用率: ${usedPercent}%`, storage.pos.x, storage.pos.y - 0.5, {
            color: usedPercent > 90 ? 'red' : (usedPercent > 70 ? 'yellow' : 'green'),
            font: 0.5,
            align: 'center'
        });
        
        // 显示增长率
        const growthRate = memory.stats.averageGrowth;
        visual.text(`增长率: ${growthRate > 0 ? '+' : ''}${this.formatNumber(growthRate)}/tick`, storage.pos.x, storage.pos.y + 0.5, {
            color: growthRate > 0 ? 'green' : (growthRate < 0 ? 'red' : 'white'),
            font: 0.4,
            align: 'center'
        });
    },
    
    // 格式化数字
    formatNumber: function(num) {
        if(Math.abs(num) >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if(Math.abs(num) >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else {
            return num.toString();
        }
    },
    
    // 添加资源分配请求
    requestResources: function(room, targetId, resourceType, amount, priority = 5, expireTime = Game.time + 100) {
        if(!room.storage) return false;
        
        const memory = room.memory.storageManager;
        if(!memory) this.initMemory(room);
        
        // 创建请求
        const request = {
            targetId: targetId,
            resourceType: resourceType,
            amount: amount,
            priority: priority,
            requestTime: Game.time,
            expireTime: expireTime
        };
        
        // 添加到请求队列
        memory.distribution.pendingRequests.push(request);
        
        // 按优先级排序
        memory.distribution.pendingRequests.sort((a, b) => a.priority - b.priority);
        
        return true;
    },
    
    // 获取存储报告
    getStorageReport: function(room) {
        if(!room.storage) return '该房间没有存储设施';
        
        const memory = room.memory.storageManager;
        if(!memory) this.initMemory(room);
        
        const status = memory.status;
        const stats = memory.stats;
        
        // 生成报告
        let report = `=== 存储状态报告 (${room.name}) ===\n`;
        report += `能量: ${this.formatNumber(status.energy)} (${status.energyLevel})\n`;
        report += `总资源: ${this.formatNumber(status.totalResources)}/${this.formatNumber(status.totalResources + status.freeCapacity)} (${Math.round((status.totalResources / (status.totalResources + status.freeCapacity)) * 100)}%)\n`;
        report += `平均增长率: ${stats.averageGrowth > 0 ? '+' : ''}${this.formatNumber(stats.averageGrowth)}/tick\n`;
        report += `峰值使用量: ${this.formatNumber(stats.peakUsage)}\n\n`;
        
        // 资源明细
        report += `资源明细:\n`;
        const resources = Object.keys(status.resources).sort((a, b) => status.resources[b] - status.resources[a]);
        
        for(const resourceType of resources) {
            const amount = status.resources[resourceType];
            if(amount > 0) {
                report += `  ${resourceType}: ${this.formatNumber(amount)}\n`;
            }
        }
        
        return report;
    }
}; 