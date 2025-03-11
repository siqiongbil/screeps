// roles/defender.js
// Defender 角色：保护本房间，主动攻击入侵敌人；无敌时返回房间控制器附近待命
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (target) {
        if (creep.attack(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ff00ff' } });
        }
    } else {
        creep.moveTo(creep.room.controller);
    }
};
