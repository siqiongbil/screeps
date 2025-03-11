// tower.js
// 塔防模块：控制房间内所有塔自动攻击敌对 creep 或维修建筑
module.exports.run = function (tower) {
    // 查找最近的敌对 creep
    const target = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (target) {
        tower.attack(target);
        return;
    }
    // 没有敌人时，查找受损建筑进行维修（排除墙体）
    const repairTarget = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure =>
            structure.hits < structure.hitsMax * 0.8 &&
            structure.structureType !== STRUCTURE_WALL
    });
    if (repairTarget) {
        tower.repair(repairTarget);
    }
};
