/**
 * 存储管理者角色
 * 负责从存储中取出资源并分配给需要的建筑或爬虫
 */

module.exports = {
    // 主运行函数
    run: function(creep) {
        // 如果正在执行任务但能量耗尽，切换到收集能量状态
        if(creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('🔄 收集');
        }
        // 如果正在收集能量但存储已满，切换到工作状态
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('📦 分配');
        }
        
        // 检查房间是否有存储
        if(!creep.room.storage) {
            // 如果没有存储，切换到其他角色
            creep.memory.role = 'carrier';
            return;
        }
        
        // 根据工作状态执行不同任务
        if(creep.memory.working) {
            this.distributeResources(creep);
        } else {
            this.collectResources(creep);
        }
    },
    
    // 收集资源
    collectResources: function(creep) {
        // 优先从存储中收集能量
        const storage = creep.room.storage;
        
        // 检查存储中是否有能量
        if(storage && storage.store[RESOURCE_ENERGY] > 0) {
            // 如果存储中有能量，从存储中取出能量
            if(creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return;
        }
        
        // 如果存储中没有能量，尝试从其他来源收集
        // 例如，从容器中收集
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                         s.store[RESOURCE_ENERGY] > 0
        });
        
        if(containers.length > 0) {
            // 按能量数量排序，优先从能量最多的容器收集
            containers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
            
            if(creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(containers[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return;
        }
        
        // 如果没有容器，尝试从掉落的资源中收集
        const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: resource => resource.resourceType === RESOURCE_ENERGY
        });
        
        if(droppedResources.length > 0) {
            // 按数量排序，优先收集数量最多的
            droppedResources.sort((a, b) => b.amount - a.amount);
            
            if(creep.pickup(droppedResources[0]) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedResources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return;
        }
        
        // 如果没有掉落的资源，尝试从墓碑中收集
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: tombstone => tombstone.store[RESOURCE_ENERGY] > 0
        });
        
        if(tombstones.length > 0) {
            if(creep.withdraw(tombstones[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstones[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return;
        }
        
        // 如果没有其他来源，尝试从废墟中收集
        const ruins = creep.room.find(FIND_RUINS, {
            filter: ruin => ruin.store[RESOURCE_ENERGY] > 0
        });
        
        if(ruins.length > 0) {
            if(creep.withdraw(ruins[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(ruins[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return;
        }
        
        // 如果实在没有能量来源，尝试采集能量源
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if(sources.length > 0) {
            if(creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    },
    
    // 分配资源
    distributeResources: function(creep) {
        // 获取存储管理系统
        const storageManager = require('storageManager');
        
        // 检查是否有待处理的请求
        if(creep.room.memory.storageManager && 
           creep.room.memory.storageManager.distribution && 
           creep.room.memory.storageManager.distribution.pendingRequests && 
           creep.room.memory.storageManager.distribution.pendingRequests.length > 0) {
            
            // 获取最高优先级的请求
            const request = creep.room.memory.storageManager.distribution.pendingRequests[0];
            const target = Game.getObjectById(request.targetId);
            
            if(target) {
                // 检查是否已经携带了请求的资源类型
                if(creep.store[request.resourceType] > 0) {
                    // 将资源转移到目标
                    if(creep.transfer(target, request.resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                    } else {
                        // 成功转移后，更新请求
                        const transferAmount = Math.min(creep.store[request.resourceType], request.amount);
                        request.amount -= transferAmount;
                        
                        // 如果请求已完成，移除请求
                        if(request.amount <= 0) {
                            creep.room.memory.storageManager.distribution.pendingRequests.shift();
                        }
                    }
                    return;
                } else {
                    // 需要先从存储中获取资源
                    const storage = creep.room.storage;
                    if(storage && storage.store[request.resourceType] > 0) {
                        if(creep.withdraw(storage, request.resourceType, Math.min(request.amount, creep.store.getFreeCapacity())) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffaa00'}});
                        }
                        return;
                    }
                }
            } else {
                // 目标不存在，移除请求
                creep.room.memory.storageManager.distribution.pendingRequests.shift();
            }
        }
        
        // 如果没有待处理的请求，执行默认分配逻辑
        
        // 优先填充扩展和母巢
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if(targets.length > 0) {
            if(creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        }
        
        // 然后填充塔
        const towers = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_TOWER &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 200;
            }
        });
        
        if(towers.length > 0) {
            // 按能量数量排序，优先填充能量最少的塔
            towers.sort((a, b) => a.store[RESOURCE_ENERGY] - b.store[RESOURCE_ENERGY]);
            
            if(creep.transfer(towers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(towers[0], {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        }
        
        // 然后填充实验室
        const labs = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_LAB &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if(labs.length > 0) {
            if(creep.transfer(labs[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(labs[0], {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        }
        
        // 如果没有需要填充的建筑，检查是否有需要能量的爬虫
        const needyCreeps = creep.room.find(FIND_MY_CREEPS, {
            filter: (c) => {
                return c.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                       (c.memory.role === 'builder' || 
                        c.memory.role === 'upgrader' || 
                        c.memory.role === 'repairer');
            }
        });
        
        if(needyCreeps.length > 0) {
            // 按角色优先级排序
            const rolePriority = {
                'builder': 1,
                'repairer': 2,
                'upgrader': 3
            };
            
            needyCreeps.sort((a, b) => rolePriority[a.memory.role] - rolePriority[b.memory.role]);
            
            if(creep.transfer(needyCreeps[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(needyCreeps[0], {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        }
        
        // 如果没有其他任务，前往存储附近待命
        if(creep.room.storage) {
            creep.moveTo(creep.room.storage, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }
}; 