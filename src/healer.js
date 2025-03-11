// roles/healer.js
// Healer 角色：为受伤友军进行治疗支援；若附近无受伤单位则返回当前房间控制器附近待命
module.exports.run = function (creep) {
    const injured = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: c => c.hits < c.hitsMax
    });
    if (injured) {
        if (creep.heal(injured) === ERR_NOT_IN_RANGE) {
            creep.moveTo(injured, { visualizePathStyle: { stroke: '#00ff00' } });
        }
    } else {
        creep.moveTo(creep.room.controller);
    }
};
