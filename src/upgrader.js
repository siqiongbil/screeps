// repairer.js
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    // 定义能量阈值
    const energyThreshold = 10; // 可以根据实际情况调整

    // 检查是否需要补充能量
    if (creep.store.getFreeCapacity() > 0 && creep.store[RESOURCE_ENERGY] < energyThreshold) {
        // 优先从 Storage 获取能量
        const storage = creep.room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 300) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // 如果 Storage 不足，则从 Extension 获取能量
        const extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getUsedCapacity(RESOURCE_ENERGY) > 300
        });
        if (extensions.length > 0) {
            const target = creep.pos.findClosestByPath(extensions);
            if (target) {
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }
        }

        // 如果 Extension 不足，则从 Spawn 获取能量
        const spawn = creep.room.find(FIND_MY_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_SPAWN &&
                structure.store && structure.store[RESOURCE_ENERGY] > 300 &&
                structure.room.name === creep.room.name
        })[0];
        if (spawn) {
            if (creep.withdraw(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    } else {
        // 优先维修当前房间内的受损建筑（不包括墙体）
        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure => structure.hits < structure.hitsMax * 0.8 &&
                                   structure.structureType !== STRUCTURE_WALL &&
                                   structure.room.name === creep.room.name
        });
        if (target) {
            if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 若无维修任务，则建造当前房间内的工地
        const constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
            filter: cs => cs.room.name === creep.room.name
        });
        if (constructionSite) {
            if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSite, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 若无建造任务，则升级当前房间控制器
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }
};