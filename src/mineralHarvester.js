// roles/mineralHarvester.js
// MineralHarvester 角色：采集本房间内的矿物资源，并将其存入 Storage 或 Terminal
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    if (creep.store.getFreeCapacity() > 0) {
        const minerals = creep.room.find(FIND_MINERALS);
        if (minerals.length > 0) {
            const mineral = minerals[0];
            if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
                creep.moveTo(mineral, { visualizePathStyle: { stroke: '#00ffff' } });
            }
        }
    } else {
        // 满载后，将矿物传送到 Storage 或 Terminal（仅处理当前房间内的建筑）
        if (creep.room.storage) {
            if (creep.transfer(creep.room.storage, _.findKey(creep.store)) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else if (creep.room.terminal) {
            if (creep.transfer(creep.room.terminal, _.findKey(creep.store)) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.terminal, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};
