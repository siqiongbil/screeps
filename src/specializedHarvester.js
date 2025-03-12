// roles/specializedHarvester.js
module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        // 优先从 Storage 获取能量
        const storage = creep.room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // 其次从 Spawn 获取能量
        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                (structure.structureType === STRUCTURE_STORAGE ||
                 structure.structureType === STRUCTURE_SPAWN) &&
                structure.store && structure.store[RESOURCE_ENERGY] > 0 &&
                structure.room.name === creep.room.name
        });
        if (target) {
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    } else {
        // 查找最近的 Extension 或 Spawn 存放能量
        const target = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'specializedTransporter' && c.store.getFreeCapacity() > 0
        });
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }
    }
};