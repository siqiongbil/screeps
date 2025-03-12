// strongHarvester.js
module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        // 查找最近的 Source 进行采集
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
    } else {
        // 查找最近的 Storage 存放能量
        const storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_STORAGE &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 查找最近的 Extension 存放能量
        const extensions = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_EXTENSION &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (extensions) {
            if (creep.transfer(extensions, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(extensions, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 查找最近的 Spawn 存放能量
        const spawn = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_SPAWN &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (spawn) {
            if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};