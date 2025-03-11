// roles/soldier.js
// Soldier 角色：负责近战入侵作战，攻击敌对单位；若无目标则按入侵目标行动
module.exports.run = function (creep) {
    // 先查找附近敌对 creep
    const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (target) {
        if (creep.attack(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
        }
    } else {
        // 如果设置了入侵目标，则前往目标房间
        if (creep.memory.invasionTarget) {
            if (creep.room.name !== creep.memory.invasionTarget) {
                const exitDir = Game.map.findExit(creep.room, creep.memory.invasionTarget);
                const exit = creep.pos.findClosestByRange(exitDir);
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                // 在目标房间中主动寻找敌对结构或随机巡逻
                const potentialTargets = creep.room.find(FIND_HOSTILE_STRUCTURES);
                if (potentialTargets.length > 0) {
                    creep.moveTo(potentialTargets[0], { visualizePathStyle: { stroke: '#ff0000' } });
                } else {
                    creep.moveTo(25 + Math.floor(Math.random() * 5), 25 + Math.floor(Math.random() * 5));
                }
            }
        } else {
            // 如果没有入侵目标，则返回当前房间控制器附近待命
            creep.moveTo(creep.room.controller);
        }
    }
};
