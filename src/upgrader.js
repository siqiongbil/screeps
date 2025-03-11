// roles/upgrader.js
// Upgrader 角色：获取能量后升级当前房间的控制器
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    const energyThreshold = 10; // 设置一个合理的能量阈值

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) < energyThreshold) {
        // 能量低于阈值时，优先从 Storage 获取能量
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
        // 能量高于阈值时，升级当前房间的控制器
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }
};