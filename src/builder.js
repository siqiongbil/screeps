const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    // 定义能量阈值
    const energyThreshold = 10; // 可以根据实际情况调整

    // 检查是否需要补充能量
    if (!utils.ensureEnergy(creep, energyThreshold)) return;

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
};