// roles/harvester.js
// Harvester 角色：采集能量，并优先回收 tombstone/ruin 内的能量
const utils = require('./utils');

module.exports.run = function (creep) {
    // 确保该 creep 在其 homeRoom 内工作
    if (!utils.ensureInHomeRoom(creep)) return;

    // 优先回收附近 tombstone 中的能量
    const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
        filter: ts => ts.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombstone) {
        if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
        return;
    }
    // 次优先回收 ruins 中的能量
    const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
        filter: r => r.store && r.store[RESOURCE_ENERGY] > 0
    });
    if (ruin) {
        if (creep.withdraw(ruin, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(ruin, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
        return;
    }

    // 正常采集能量：优先从 Storage 获取能量，其次从 Source 获取能量
    if (creep.store.getFreeCapacity() > 0) {
        // 优先从 Storage 获取能量
        const storage = creep.room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // 其次从 Source 获取能量
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        const source = creep.pos.findClosestByPath(sources);
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    } else {
        // 当能量满载后，优先将能量存入 Storage
        const storage = creep.room.storage;
        if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 如果当前房间不是主房间，则将能量送回主房间
        if (creep.room.name !== Memory.mainRoom && creep.room.memory.transportResourcesToMainRoom) {
            const mainRoomStorage = Game.rooms[Memory.mainRoom].storage;
            if (mainRoomStorage && mainRoomStorage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.transfer(mainRoomStorage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(mainRoomStorage, { visualizePathStyle: { stroke: '#ffffff' } });
                }
                return;
            } else {
                console.log(`Main room storage in ${Memory.mainRoom} does not exist.`);
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
