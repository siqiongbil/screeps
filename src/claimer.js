// roles/claimer.js
// Claimer 角色：负责进入目标房间后占领或预定该房间的控制器
const utils = require('./utils');

module.exports.run = function (creep) {
    if (creep.room.controller) {
        if (!creep.room.controller.my) {
            if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
            } else if (creep.claimController(creep.room.controller) === OK) {
                console.log(`Room ${creep.room.name} claimed by ${creep.name}`);
                // 检查房间是否已经有 Spawn
                const spawns = creep.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_SPAWN });
                if (spawns.length === 0) {
                    // 在房间中心位置放置一个 Spawn 的 Construction Site
                    const centerPos = new RoomPosition(25, 25, creep.room.name);
                    const result = creep.room.createConstructionSite(centerPos, STRUCTURE_SPAWN);
                    if (result === OK) {
                        console.log(`Spawn construction site created at ${centerPos} in room ${creep.room.name}`);
                    } else {
                        console.log(`Failed to create Spawn construction site at ${centerPos} in room ${creep.room.name}: ${result}`);
                    }
                }
                // 将新房间的信息添加到主房间的内存中
                const mainRoom = Game.rooms[Memory.mainRoom];
                if (mainRoom) {
                    if (!mainRoom.memory.subRooms) {
                        mainRoom.memory.subRooms = [];
                    }
                    if (!mainRoom.memory.subRooms.includes(creep.room.name)) {
                        mainRoom.memory.subRooms.push(creep.room.name);
                        console.log(`Added room ${creep.room.name} to main room ${Memory.mainRoom} subRooms`);
                    }
                } else {
                    console.log(`Main room ${Memory.mainRoom} does not exist.`);
                }
            }
        } else {
            // 如果已经占领，发展生态
            // 可以在这里添加发展生态的逻辑，例如增加 builder 和 upgrader 的数量
            // 这里简单地返回控制器附近待命
            creep.moveTo(creep.room.controller);
        }
    } else {
        console.log(`Room ${creep.room.name} does not have a controller.`);
    }
};
