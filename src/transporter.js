// roles/transporter.js
// Transporter 角色：将其他房间的资源运送至主房间
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    // 定义能量阈值
    const energyThreshold = 10; // 可以根据实际情况调整

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