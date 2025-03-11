// invasion.js
module.exports.chooseInvasionTarget = function (room) {
    const exits = Game.map.describeExits(room.name);
    for (const direction in exits) {
        const targetRoomName = exits[direction];
        const targetRoom = Game.rooms[targetRoomName];
        // 如果目标房间已观察到且存在控制器，但不属于我，则选作入侵目标
        if (targetRoom && targetRoom.controller && !targetRoom.controller.my) {
            // 优先选择无主房间
            if (!targetRoom.controller.owner) {
                return targetRoomName;
            }
        }
        // 如果目标房间尚未观察到，可能为空房或低活跃区域，也作为候选
        if (!targetRoom) {
            return targetRoomName;
        }
    }
    return null;
};

// 新增函数：判断入侵队伍是否能够成功
module.exports.canInvasionSucceed = function (room, targetRoomName) {
    const targetRoom = Game.rooms[targetRoomName];
    if (!targetRoom) return false;

    // 获取目标房间的敌对 creep 数量和等级
    const hostileCreeps = targetRoom.find(FIND_HOSTILE_CREEPS);
    const hostileCreepCount = hostileCreeps.length;
    const hostileCreepPower = hostileCreeps.reduce((sum, creep) => sum + creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK) * 2, 0);

    // 获取当前房间的入侵队伍数量和等级
    const invasionCreeps = room.find(FIND_MY_CREEPS, { filter: c => c.memory.invasionTarget === targetRoomName });
    const invasionCreepCount = invasionCreeps.length;
    const invasionCreepPower = invasionCreeps.reduce((sum, creep) => sum + creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK) * 2, 0);

    // 判断入侵队伍是否能够成功
    return invasionCreepPower > hostileCreepPower;
};