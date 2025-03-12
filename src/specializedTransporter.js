// roles/specializedTransporter.js
module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        // 查找最近的专精采集者
        const target = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'specializedHarvester' && c.store.getUsedCapacity() > 0
        });
        if (target) {
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
    } else {
        // 当前房间不是主房间且需要将资源运回主房间
        if (creep.room.name !== Memory.mainRoom && creep.room.memory.transportResourcesToMainRoom) {
            const mainRoomStorage = Game.rooms[Memory.mainRoom].storage;
            if (mainRoomStorage && mainRoomStorage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.transfer(mainRoomStorage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(mainRoomStorage, { visualizePathStyle: { stroke: '#ffffff' } });
                }
                return;
            }
        }

        // 若 Storage 已满，则将能量传送到本房间内需要能量的建筑
        const target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: structure =>
                (structure.structureType === STRUCTURE_SPAWN ||
                 structure.structureType === STRUCTURE_EXTENSION ||
                 structure.structureType === STRUCTURE_TOWER) &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};