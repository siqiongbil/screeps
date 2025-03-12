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
        // 修改 creep 的说话内容，显示名字加房间名，总长度不超过 10 字符
        let message = `${creep.name} ${creep.room.name}`;
        if (message.length > 10) {
            message = `${creep.name.slice(0, 10 - creep.room.name.length - 1)} ${creep.room.name}`;
        }
        creep.say(message);
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

// 新增函数：打印入侵目标
module.exports.logInvasionTarget = function (creep, targetRoomName) {
    if(creep){
        console.log(`Creep ${creep.name} is targeting room ${targetRoomName} for invasion.`);
        return false;

    }
    return true;
};

/**
 * 确保 creep 有足够的能量
 * @param {Creep} creep - 需要检查的 creep 对象
 * @param {number} energyThreshold - 能量阈值
 * @returns {boolean} 如果 creep 有足够的能量则返回 true，否则返回 false
 */
module.exports.ensureEnergy = function (creep, energyThreshold) {
    if (creep.store.getFreeCapacity() > 0 && creep.store[RESOURCE_ENERGY] < energyThreshold && creep.room.energyAvailable > 500) {
        // 优先从 Storage 获取能量
        const storage = creep.room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 300) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return false;
        }

        // 如果 Storage 不足，则从 Extension 获取能量
        const extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getUsedCapacity(RESOURCE_ENERGY) >= 50
        });
        if (extensions.length > 0) {
            const target = creep.pos.findClosestByPath(extensions);
            if (target) {
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return false;
            }
        }

        // 如果 Extension 不足，则从 Spawn 获取能量
        const spawn = creep.room.find(FIND_MY_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_SPAWN &&
                structure.store && structure.store[RESOURCE_ENERGY] >= 300 &&
                structure.room.name === creep.room.name
        })[0];
        if (spawn) {
            if (creep.withdraw(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return false;
        }
    }
    return true;
};