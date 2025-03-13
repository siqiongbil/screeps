module.exports = {
    run: function(creep) {
        // 找到最近的能量源
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if(!source) return;

        // 如果不在能量源旁边，就移动过去
        if(!creep.pos.isNearTo(source)) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        // 在能量源旁边就开始采集
        else {
            creep.harvest(source);
        }

        // 如果周围有container，优先把能量放入container
        const containers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType == STRUCTURE_CONTAINER &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        if(containers.length > 0) {
            creep.transfer(containers[0], RESOURCE_ENERGY);
        }
    }
}; 