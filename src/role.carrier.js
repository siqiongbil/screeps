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
                // 按优先级排序：Spawn > Extension > Tower
                const sortedTargets = targets.sort((a, b) => {
                    const priority = {
                        [STRUCTURE_SPAWN]: 3,
                        [STRUCTURE_EXTENSION]: 2,
                        [STRUCTURE_TOWER]: 1
                    };
                    return priority[b.structureType] - priority[a.structureType];
                });

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
                filter: resource => resource.resourceType == RESOURCE_ENERGY
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

            // 最后从容器获取能量
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: structure => 
                    (structure.structureType == STRUCTURE_CONTAINER ||
                     structure.structureType == STRUCTURE_STORAGE) &&
                    structure.store[RESOURCE_ENERGY] > 50
            });
            
            if(containers.length > 0) {
                const container = creep.pos.findClosestByPath(containers);
                if(creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
            }
        }
    }
}; 