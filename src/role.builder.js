module.exports = {
    run: function(creep) {
        // 更新工作状态
        if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
        }
        if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
        }

        if(creep.memory.building) {
            // 按优先级排序建筑工地
            const targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(targets.length) {
                // 使用buildingPlanner中的优先级
                const buildingPlanner = require('./buildingPlanner');
                const STRUCTURE_PRIORITY = buildingPlanner.STRUCTURE_PRIORITY;
                
                // 按优先级排序
                const sortedTargets = targets.sort((a, b) => {
                    const priorityA = STRUCTURE_PRIORITY[a.structureType] || 15;
                    const priorityB = STRUCTURE_PRIORITY[b.structureType] || 15;
                    return priorityA - priorityB; // 数字越小优先级越高
                });

                const target = creep.pos.findClosestByPath(sortedTargets);
                if(creep.build(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
            }
            // 如果没有建筑工地，就去修理建筑
            else {
                const repairTargets = creep.room.find(FIND_STRUCTURES, {
                    filter: object => object.hits < object.hitsMax && object.structureType !== STRUCTURE_WALL
                });
                
                if(repairTargets.length > 0) {
                    // 按损坏程度排序
                    const sortedRepairTargets = repairTargets.sort((a, b) => {
                        return (a.hitsMax - a.hits) - (b.hitsMax - b.hits);
                    });

                    const target = creep.pos.findClosestByPath(sortedRepairTargets);
                    if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            visualizePathStyle: {stroke: '#ffff00'},
                            reusePath: 5
                        });
                    }
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