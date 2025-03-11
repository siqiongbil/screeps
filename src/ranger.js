// roles/ranger.js
// Ranger 角色：使用远程攻击支援作战，保持适当安全距离；允许跨房间作战
module.exports.run = function (creep) {
    const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (target) {
        if (creep.rangedAttack(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
        }
    } else {
        creep.moveTo(creep.room.controller);
    }
};
