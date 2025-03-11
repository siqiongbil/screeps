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
        // 优先建造生产自己的房间内的工地
        const productionRoom = Game.rooms[creep.memory.homeRoom];
        if (productionRoom) {
            const productionRoomSites = productionRoom.find(FIND_CONSTRUCTION_SITES);
            if (productionRoomSites.length > 0) {
                const target = creep.pos.findClosestByPath(productionRoomSites);
                if (target) {
                    if (creep.build(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                    return;
                }
            }
        }

        // 若生产自己的房间没有工地，则优先建造当前房间内的工地
        const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
            filter: cs => cs.room.name === creep.room.name
        });
        if (target) {
            if (creep.build(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 若无建造任务，则检查是否有其他房间需要建造者
        const otherRooms = Object.keys(Game.rooms).filter(roomName => roomName !== creep.room.name && roomName !== creep.memory.homeRoom);
        for (const roomName of otherRooms) {
            const room = Game.rooms[roomName];
            const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
            if (constructionSites.length > 0) {
                const buildersInOtherRoom = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'builder' });
                if (buildersInOtherRoom.length === 0) {
                    creep.moveTo(room.controller);
                    return;
                }
            }
        }

        // 若无建造任务且没有其他房间需要建造者，则升级当前房间控制器
        if (creep.room.controller) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            console.log(`Room ${creep.room.name} does not have a controller.`);
        }
    }
};