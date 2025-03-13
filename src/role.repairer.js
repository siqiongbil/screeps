module.exports = {
    run: function(creep) {
        // 更新工作状态
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
        }

        // 定义建筑优先级
        const priority = {
            [STRUCTURE_SPAWN]: 6,
            [STRUCTURE_EXTENSION]: 5,
            [STRUCTURE_TOWER]: 4,
            [STRUCTURE_STORAGE]: 3,
            [STRUCTURE_CONTAINER]: 2
        };

        if(creep.memory.working) {
            // 寻找需要维修的建筑，按优先级排序
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: object => object.hits < object.hitsMax && object.structureType !== STRUCTURE_WALL
            });
            
            if(targets.length > 0) {
                // 按优先级排序：Spawn > Extension > Tower > Storage > Container > 其他
                const sortedTargets = targets.sort((a, b) => {
                    return (priority[b.structureType] || 0) - (priority[a.structureType] || 0);
                });

                // 在相同类型的建筑中，优先修理损坏程度高的
                const target = sortedTargets.reduce((best, current) => {
                    if(!best) return current;
                    if(best.structureType !== current.structureType) {
                        return (priority[current.structureType] || 0) > (priority[best.structureType] || 0) ? current : best;
                    }
                    return (current.hitsMax - current.hits) > (best.hitsMax - best.hits) ? current : best;
                }, null);

                if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#ffff00'},
                        reusePath: 5
                    });
                }
            }
            // 如果没有需要维修的建筑，就去升级控制器
            else {
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
            }
        }
        else {
            // 先尝试从容器获取能量
            if(creep.withdrawFromContainer()) {
                return;
            }
            
            // 如果没有可用的容器，再从能量源采集
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if(source) {
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
            }
        }
    }
}; 