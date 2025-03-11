// utils.js
/**
 * 输出房间状态日志，便于调试
 * @param {Room} room - 房间对象
 */
module.exports.logRoomStatus = function (room) {
    console.log(`Room ${room.name}: Energy ${room.energyAvailable}/${room.energyCapacityAvailable}, Controller Level ${room.controller.level}`);
};

// utils.js
/**
 * 检查 creep 是否在其 homeRoom 内工作
 * 如果不在，则移动到 homeRoom 的中心位置，并返回 false；否则返回 true
 * @param {Creep} creep - 需要检查的 creep 对象
 * @returns {boolean} 如果在 homeRoom 内则返回 true，否则返回 false
 */
module.exports.ensureInHomeRoom = function (creep) {
    
    if (!creep.memory.homeRoom) {
        creep.say('未设置 homeRoom');
        console.log(`creep ${creep.name} 未设置 homeRoom`);
        return false;
    }

    if (creep.room.name !== creep.memory.homeRoom) {
        const targetPos = new RoomPosition(25, 25, creep.memory.homeRoom);
        creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#00ffff' } });
        creep.say(`前往 ${creep.memory.homeRoom} 中心位置...`);
        return false;
    }
    creep.say(`正在 ${creep.memory.homeRoom} 内工作`);
    return true;
};

/**
 * 找到最近的能捡资源的 creep
 * @param {RoomPosition} pos - 资源的位置
 * @returns {Creep|null} 最近的能捡资源的 creep 或 null
 */
module.exports.findClosestCreepToPickup = function (pos) {
    const creeps = pos.findInRange(FIND_MY_CREEPS, 3, {
        filter: c => c.store.getFreeCapacity() > 0
    });
    if (creeps.length > 0) {
        return pos.findClosestByPath(creeps);
    }
    return null;
};