module.exports = {
    run: function(creep) {
        // 更新工作状态
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
        }

        // 使用buildingPlanner中的优先级
        const buildingPlanner = require('./buildingPlanner');
        const STRUCTURE_PRIORITY = buildingPlanner.STRUCTURE_PRIORITY;

        if(creep.memory.working) {
            // 首先检查是否有严重损坏的道路需要修复
            let criticalRoads = [];
            if(creep.room.memory.monitor && creep.room.memory.monitor.roads && creep.room.memory.monitor.roads.criticallyDamaged > 0) {
                criticalRoads = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5
                });
            }
            
            if(criticalRoads.length > 0) {
                // 按照损坏程度排序，优先修复最严重的
                criticalRoads.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
                
                if(creep.repair(criticalRoads[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(criticalRoads[0], {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }
            
            // 寻找需要维修的建筑，按优先级排序
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: object => object.hits < object.hitsMax && object.structureType !== STRUCTURE_WALL
            });
            
            if(targets.length > 0) {
                // 按优先级排序
                const sortedTargets = targets.sort((a, b) => {
                    // 道路优先级提高
                    if(a.structureType === STRUCTURE_ROAD && b.structureType !== STRUCTURE_ROAD) {
                        return -1;
                    }
                    if(a.structureType !== STRUCTURE_ROAD && b.structureType === STRUCTURE_ROAD) {
                        return 1;
                    }
                    
                    const priorityA = STRUCTURE_PRIORITY[a.structureType] || 15;
                    const priorityB = STRUCTURE_PRIORITY[b.structureType] || 15;
                    
                    // 如果优先级相同，按照损坏程度排序
                    if(priorityA === priorityB) {
                        return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
                    }
                    
                    return priorityA - priorityB; // 数字越小优先级越高
                });
                
                // 选择优先级最高的建筑进行维修
                if(creep.repair(sortedTargets[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sortedTargets[0], {
                        visualizePathStyle: {stroke: '#ffffff'},
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