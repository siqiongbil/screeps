// builder.js
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    // 定义能量阈值
    const energyThreshold = 10; // 可以根据实际情况调整

    if (creep.store.getFreeCapacity() > 0 && creep.store[RESOURCE_ENERGY] < energyThreshold) {
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
                structure.store && structure.store[RESOURCE_ENERGY] > 100 &&
                structure.room.name === creep.room.name
        });
        if (target) {
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
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
            } else {
                console.log(`Main room storage in ${Memory.mainRoom} does not exist.`);
            }
        }

        // 优先建造当前房间内的工地
        const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
            filter: cs => cs.room.name === creep.room.name
        });
        if (target) {
            if (creep.build(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 若无建造任务，则升级当前房间控制器
        if (creep.room.controller) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            console.log(`Room ${creep.room.name} does not have a controller.`);
        }
    }
};
