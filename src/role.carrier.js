module.exports = {
    run: function(creep) {
        // 更新工作状态
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
        }

        if(creep.memory.working) {
            // 按优先级寻找需要能量的建筑
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_SPAWN ||
                            structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_TOWER) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if(targets.length > 0) {
                // 计算每种建筑类型的能量需求百分比
                const spawnNeed = this.calculateEnergyNeed(targets, STRUCTURE_SPAWN);
                const extensionNeed = this.calculateEnergyNeed(targets, STRUCTURE_EXTENSION);
                const towerNeed = this.calculateEnergyNeed(targets, STRUCTURE_TOWER);
                
                // 根据能量需求百分比动态调整优先级
                let priorityMap = {};
                
                // Spawn和Extension的能量低于50%时提高优先级
                if(spawnNeed > 50) {
                    priorityMap[STRUCTURE_SPAWN] = 5;
                } else {
                    priorityMap[STRUCTURE_SPAWN] = 3;
                }
                
                if(extensionNeed > 50) {
                    priorityMap[STRUCTURE_EXTENSION] = 4;
                } else {
                    priorityMap[STRUCTURE_EXTENSION] = 2;
                }
                
                // 检查房间中是否有敌人，如果有则提高Tower的优先级
                const hostiles = creep.room.find(FIND_HOSTILE_CREEPS).length;
                if(hostiles > 0) {
                    priorityMap[STRUCTURE_TOWER] = 6; // 敌人存在时，Tower优先级最高
                } else if(towerNeed > 70) {
                    priorityMap[STRUCTURE_TOWER] = 4; // Tower能量不足时提高优先级
                } else {
                    priorityMap[STRUCTURE_TOWER] = 1;
                }
                
                // 按优先级排序
                const sortedTargets = targets.sort((a, b) => {
                    return priorityMap[b.structureType] - priorityMap[a.structureType];
                });

                // 找到最近的高优先级目标
                const target = creep.pos.findClosestByPath(sortedTargets);
                if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
            }
            // 如果没有建筑需要能量，存入storage
            else {
                const storage = creep.room.storage;
                if(storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    if(creep.transfer(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {
                            visualizePathStyle: {stroke: '#ffffff'},
                            reusePath: 5
                        });
                    }
                }
            }
        }
        else {
            // 优先从掉落资源获取能量
            const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: resource => resource.resourceType == RESOURCE_ENERGY && resource.amount > 20
            });
            
            if(droppedEnergy) {
                if(creep.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }

            // 其次从坟墓获取能量
            const tombstones = creep.room.find(FIND_TOMBSTONES, {
                filter: tombstone => tombstone.store[RESOURCE_ENERGY] > 0
            });
            
            if(tombstones.length > 0) {
                const tombstone = creep.pos.findClosestByPath(tombstones);
                if(creep.withdraw(tombstone, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }

            // 再次从废墟获取能量
            const ruins = creep.room.find(FIND_RUINS, {
                filter: ruin => ruin.store[RESOURCE_ENERGY] > 0
            });
            
            if(ruins.length > 0) {
                const ruin = creep.pos.findClosestByPath(ruins);
                if(creep.withdraw(ruin, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(ruin, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }

            // 从容器和存储获取能量
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: structure => 
                    (structure.structureType == STRUCTURE_CONTAINER ||
                     structure.structureType == STRUCTURE_STORAGE) &&
                    structure.store[RESOURCE_ENERGY] > 50
            });
            
            if(containers.length > 0) {
                // 按能量数量排序，优先从能量最多的容器获取
                const sortedContainers = containers.sort((a, b) => 
                    b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]
                );
                
                // 找到最近的高能量容器
                const container = creep.pos.findClosestByPath(sortedContainers);
                if(creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
            }
        }
    },
    
    // 计算特定类型建筑的能量需求百分比
    calculateEnergyNeed: function(structures, structureType) {
        const typeStructures = structures.filter(s => s.structureType === structureType);
        if(typeStructures.length === 0) return 0;
        
        let totalCapacity = 0;
        let totalFree = 0;
        
        typeStructures.forEach(structure => {
            totalCapacity += structure.store.getCapacity(RESOURCE_ENERGY);
            totalFree += structure.store.getFreeCapacity(RESOURCE_ENERGY);
        });
        
        // 计算缺少能量的百分比
        return (totalFree / totalCapacity) * 100;
    }
}; 