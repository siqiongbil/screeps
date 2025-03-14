// 使用专用的存储工具模块
const storageUtils = require('storageUtils');

module.exports = {
    // 主运行函数
    run: function(room) {
        if(!room.memory.resourceCleaner) {
            this.initializeMemory(room);
        }

        // 每10 ticks执行一次清理任务
        if(Game.time % 10 !== 0) return;

        try {
            // 获取所有需要清理的目标
            const targets = [
                ...room.find(FIND_DROPPED_RESOURCES),
                ...room.find(FIND_TOMBSTONES, {
                    filter: tomb => tomb.store.getUsedCapacity() > 0
                }),
                ...room.find(FIND_RUINS, {
                    filter: ruin => ruin.store.getUsedCapacity() > 0
                })
            ];

            // 更新清理目标列表
            this.updateTargets(room, targets);

            // 分配收集者
            this.assignCollectors(room);

            // 清理过期的目标
            this.cleanupTargets(room);
        } catch (error) {
            console.log(`房间 ${room.name} 资源清理系统错误：${error}`);
        }
    },

    // 初始化内存
    initializeMemory: function(room) {
        room.memory.resourceCleaner = {
            targets: {},  // 清理目标列表
            collectors: {}  // 收集者分配
        };
    },

    // 更新清理目标
    updateTargets: function(room, targets) {
        // 确保内存结构完整
        if(!room.memory.resourceCleaner) {
            this.initializeMemory(room);
        }
        
        const targetMemory = room.memory.resourceCleaner.targets;
        if(!targetMemory) {
            room.memory.resourceCleaner.targets = {};
            return;
        }

        targets.forEach(target => {
            if(target && target.id && !targetMemory[target.id]) {
                targetMemory[target.id] = {};
            }
        });
    },

    // 分配收集者
    assignCollectors: function(room) {
        // 确保内存结构完整
        if(!room.memory.resourceCleaner) {
            this.initializeMemory(room);
            return;
        }
        
        const targets = room.memory.resourceCleaner.targets;
        const collectors = room.memory.resourceCleaner.collectors;
        
        if(!targets || !collectors) {
            // 如果targets或collectors不存在，重新初始化
            this.initializeMemory(room);
            return;
        }

        // 获取所有空闲的收集者
        const idleCarriers = room.find(FIND_MY_CREEPS, {
            filter: creep => 
                (creep.memory.role === 'carrier' || creep.memory.role === 'harvester') &&
                !creep.memory.cleaning &&
                creep.store.getFreeCapacity() > 0
        });

        // 为每个目标分配收集者
        for(const targetId in targets) {
            if(!collectors[targetId] && idleCarriers.length > 0) {
                const target = Game.getObjectById(targetId);
                if(!target) {
                    // 如果目标不存在，从targets中删除
                    delete targets[targetId];
                    continue;
                }

                const collector = target.pos.findClosestByPath(idleCarriers);
                if(collector) {
                    collector.memory.cleaning = { targetId };
                    collectors[targetId] = collector.id;
                    idleCarriers.splice(idleCarriers.indexOf(collector), 1);
                }
            }
        }
    },

    // 清理过期目标
    cleanupTargets: function(room) {
        // 确保内存结构完整
        if(!room.memory.resourceCleaner) {
            this.initializeMemory(room);
            return;
        }
        
        const targets = room.memory.resourceCleaner.targets;
        const collectors = room.memory.resourceCleaner.collectors;
        
        if(!targets || !collectors) {
            // 如果targets或collectors不存在，重新初始化
            this.initializeMemory(room);
            return;
        }

        for(const targetId in targets) {
            const target = Game.getObjectById(targetId);
            if(!target) {
                // 目标不存在，清理
                if(collectors[targetId]) {
                    const collector = Game.getObjectById(collectors[targetId]);
                    if(collector && collector.memory) {
                        delete collector.memory.cleaning;
                    }
                    delete collectors[targetId];
                }
                delete targets[targetId];
                continue;
            }
            
            // 检查资源是否已耗尽
            let isEmpty = false;
            
            if(target.store) {
                // 安全地检查存储是否为空
                try {
                    if(typeof target.store.getUsedCapacity === 'function') {
                        isEmpty = target.store.getUsedCapacity() === 0;
                    } else {
                        // 旧版API兼容
                        isEmpty = _.sum(target.store) === 0;
                    }
                } catch(e) {
                    isEmpty = false;
                }
            } else if(target.amount !== undefined) {
                isEmpty = target.amount === 0;
            }
            
            if(isEmpty) {
                if(collectors[targetId]) {
                    const collector = Game.getObjectById(collectors[targetId]);
                    if(collector && collector.memory) {
                        delete collector.memory.cleaning;
                    }
                    delete collectors[targetId];
                }
                delete targets[targetId];
            }
        }
    },

    // 执行清理任务
    runCollector: function(creep) {
        if(!creep || !creep.memory || !creep.memory.cleaning) return false;

        const targetId = creep.memory.cleaning.targetId;
        if(!targetId) {
            delete creep.memory.cleaning;
            return false;
        }
        
        const target = Game.getObjectById(targetId);
        if(!target) {
            delete creep.memory.cleaning;
            return false;
        }

        // 如果背包满了，先去存储
        if(creep.store.getFreeCapacity() === 0) {
            const storage = storageUtils.findStorage(creep.room);
            if(storage) {
                const resourceTypes = Object.keys(creep.store);
                if(resourceTypes.length > 0) {
                    if(creep.transfer(storage, resourceTypes[0]) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
            return true;
        }

        // 使用通用的收集方法
        return creep.collectResource(target);
    }
}; 